// Database/services/carritoService.js (CORREGIDO)
const mongoose = require('mongoose');
const { Carrito, Cliente, Inventario } = require('../models');
const CarritoItem = require('../models/carritoItemsModel');
const Libro = require('../models/libroModel');

/**
 * Servicio de Carrito con Sistema de Reservas Automáticas
 */
const carritoService = {
  /**
   * Obtener carrito activo de un usuario (crear si no existe)
   * @param {String} idUsuario - ID del usuario
   * @returns {Promise<Object>} Carrito del usuario
   */
  async obtenerCarritoUsuario(idUsuario) {
    return await this.ejecutarConRetry(async () => {
      try {
        console.log('Obteniendo carrito para usuario:', idUsuario);
        
        if (!mongoose.Types.ObjectId.isValid(idUsuario)) {
          throw new Error('ID de usuario inválido');
        }
        
        // Verificar que el usuario existe y es cliente
        const usuario = await Cliente.findById(idUsuario);
        if (!usuario) {
          throw new Error('Usuario no encontrado o no es cliente');
        }
        
        let carrito = await Carrito.obtenerCarritoActivo(idUsuario);
        
        // Obtener items del carrito
        const items = await CarritoItem.obtenerItemsCarrito(carrito._id);
        
        // CORREGIDO: Verificar items solo si hay items Y el carrito está activo
        if (items.length > 0 && carrito.estado === 'activo') {
          console.log(`Verificando ${items.length} items del carrito`);
          await this._verificarYLimpiarItemsCarritoSeguro(carrito._id, items);
        }
        
        // CORREGIDO: Verificar problemas solo si el carrito tiene items activos
        const itemsActuales = await CarritoItem.find({ id_carrito: carrito._id });
        if (itemsActuales.length > 0) {
          try {
            await carrito.verificarProblemas();
          } catch (problemasError) {
            console.warn('Error verificando problemas (no crítico):', problemasError.message);
            // No propagar el error, continuar con el carrito
          }
        }
        
        // Actualizar totales
        try {
          await carrito.actualizarTotales();
        } catch (totalesError) {
          console.warn('Error actualizando totales (no crítico):', totalesError.message);
          // No propagar el error, continuar con el carrito
        }
        
        // Volver a obtener los items después de la limpieza
        const itemsFinales = await CarritoItem.obtenerItemsCarrito(carrito._id);

        const itemsConStockConsolidado = await Promise.all(
          itemsFinales.map(async (item) => {
            const itemObj = item.toObject();
            
            if (itemObj.id_libro && itemObj.id_libro._id) {
              try {
                const libroService = require('./libroService');
                const stockConsolidado = await libroService._obtenerStockConsolidado(itemObj.id_libro._id);
                
                // Agregar información de stock consolidado al libro
                itemObj.id_libro.stock_consolidado = stockConsolidado;
                itemObj.id_libro.stock_total_disponible = stockConsolidado.stock_total;
                itemObj.id_libro.stock_disponible_consolidado = stockConsolidado.stock_disponible;
                itemObj.id_libro.tiendas_con_stock = stockConsolidado.tiendas_con_stock;
                
              } catch (stockError) {
                console.warn(`Error obteniendo stock consolidado para libro ${itemObj.id_libro._id}:`, stockError.message);
              }
            }
            
            return itemObj;
          })
        );
        
        return {
          carrito: carrito.toObject(),
          items: itemsConStockConsolidado
        };
      } catch (error) {
        console.error('Error obteniendo carrito:', error);
        throw error;
      }
    }, 3, 150); // 3 reintentos con delay base de 150ms
  },

  async _verificarYLimpiarItemsCarritoSeguro(idCarrito, items) {
    try {
      console.log(`Verificando ${items.length} items del carrito ${idCarrito} de forma segura`);
      
      // Procesar items uno por uno para evitar conflictos masivos
      for (const item of items) {
        try {
          // Verificar que el item aún existe antes de procesarlo
          const itemActual = await CarritoItem.findById(item._id);
          
          if (!itemActual) {
            console.log(`Item ${item._id} ya no existe, saltando verificación`);
            continue;
          }
          
          // Verificar si el libro sigue existiendo y activo
          const libro = await Libro.findById(itemActual.id_libro);
          
          if (!libro || !libro.activo) {
            console.log(`Eliminando item de libro inactivo/eliminado: ${itemActual.id_libro}`);
            await this._liberarReservaCompleta(idCarrito, itemActual.id_libro, null, null);
            await CarritoItem.findByIdAndDelete(itemActual._id);
            continue;
          }
          
          // Verificar si aún hay reserva válida
          const reservaInfo = await this._obtenerReservaExistente(idCarrito, itemActual.id_libro, null);
          
          if (!reservaInfo || reservaInfo.cantidad < itemActual.cantidad) {
            console.log(`Problema con reserva del item ${itemActual.id_libro}: reservado=${reservaInfo?.cantidad || 0}, necesario=${itemActual.cantidad}`);
            
            // Intentar re-reservar la diferencia si es posible
            const diferencia = itemActual.cantidad - (reservaInfo?.cantidad || 0);
            if (diferencia > 0) {
              const inventarioDisponible = await this._obtenerMejorInventarioDisponible(itemActual.id_libro, diferencia, null);
              
              if (inventarioDisponible && inventarioDisponible.stock_disponible >= diferencia) {
                try {
                  // Asegurar que idCarrito sea ObjectId
                  let carritoObjectId;
                  if (mongoose.Types.ObjectId.isValid(idCarrito)) {
                    carritoObjectId = typeof idCarrito === 'string' ? new mongoose.Types.ObjectId(idCarrito) : idCarrito;
                  } else {
                    carritoObjectId = new mongoose.Types.ObjectId(idCarrito);
                  }
                  
                  await inventarioDisponible.reservarEjemplares(
                    diferencia,
                    null,
                    carritoObjectId,
                    'Re-reserva automática al verificar carrito'
                  );
                  
                  console.log(`Re-reservados ${diferencia} ejemplares para mantener consistencia`);
                  
                  // Actualizar estado del item
                  itemActual.estado = 'activo';
                  itemActual.mensaje_precio = '';
                  await itemActual.save();
                } catch (reserveError) {
                  console.error('Error re-reservando:', reserveError);
                  // Marcar item con problemas
                  itemActual.estado = 'sin_stock';
                  itemActual.mensaje_precio = 'Problema con la reserva - verificar disponibilidad';
                  await itemActual.save();
                }
              } else {
                // No hay stock suficiente, marcar item con problemas
                itemActual.estado = 'sin_stock';
                itemActual.mensaje_precio = 'Stock insuficiente - producto no disponible';
                await itemActual.save();
              }
            }
          } else {
            // Reserva está bien, asegurar que el estado del item sea activo
            if (itemActual.estado !== 'activo') {
              itemActual.estado = 'activo';
              itemActual.mensaje_precio = '';
              await itemActual.save();
            }
          }
        } catch (itemError) {
          console.error(`Error verificando item ${item._id}:`, itemError);
          
          // Si el error indica que el documento no existe, simplemente continuar
          if (itemError.message.includes('No document found') || 
              itemError.message.includes('document not found') ||
              itemError.message.includes('Cast to ObjectId failed')) {
            console.log(`Item ${item._id} ya no existe, continuando con siguiente item`);
            continue;
          }
          
          // Para otros errores, marcar item con error general si aún existe
          try {
            const itemExistente = await CarritoItem.findById(item._id);
            if (itemExistente) {
              itemExistente.estado = 'removido';
              itemExistente.mensaje_precio = 'Error verificando disponibilidad';
              await itemExistente.save();
            }
          } catch (saveError) {
            console.error('Error guardando estado de error del item:', saveError);
          }
        }
      }
      
      console.log('Verificación segura de items del carrito completada');
    } catch (error) {
      console.error('Error en verificación segura de items del carrito:', error);
      // No propagar el error para no romper el flujo principal
    }
  },

  /**
   * Diagnosticar problemas de reservas en carritos
   * @param {String} idUsuario - ID del usuario (opcional)
   * @returns {Promise<Object>} Reporte de diagnóstico
   */
  async diagnosticarReservas(idUsuario = null) {
    try {
      console.log('Iniciando diagnóstico de reservas');
      
      const diagnostico = {
        fecha: new Date(),
        carritos_analizados: 0,
        items_analizados: 0,
        problemas_encontrados: [],
        reservas_huerfanas: [],
        items_sin_reserva: [],
        reservas_inconsistentes: []
      };
      
      // Obtener carritos a analizar
      let carritosQuery = { estado: 'activo' };
      if (idUsuario) {
        carritosQuery.id_usuario = idUsuario;
      }
      
      const carritos = await Carrito.find(carritosQuery).limit(100); // Limitar para evitar sobrecarga
      diagnostico.carritos_analizados = carritos.length;
      
      for (const carrito of carritos) {
        try {
          const items = await CarritoItem.find({ id_carrito: carrito._id });
          diagnostico.items_analizados += items.length;
          
          for (const item of items) {
            try {
              // Verificar si el libro existe
              const libro = await Libro.findById(item.id_libro);
              if (!libro || !libro.activo) {
                diagnostico.problemas_encontrados.push({
                  tipo: 'libro_inexistente',
                  carrito_id: carrito._id,
                  item_id: item._id,
                  libro_id: item.id_libro,
                  cantidad: item.cantidad
                });
                continue;
              }
              
              // Verificar reserva
              const carritoObjectId = new mongoose.Types.ObjectId(carrito._id);
              const reservaInfo = await this._obtenerReservaExistente(carritoObjectId, item.id_libro, null);
              
              if (!reservaInfo || reservaInfo.cantidad === 0) {
                diagnostico.items_sin_reserva.push({
                  carrito_id: carrito._id,
                  usuario_id: carrito.id_usuario,
                  item_id: item._id,
                  libro_id: item.id_libro,
                  titulo: item.metadatos?.titulo_libro,
                  cantidad_carrito: item.cantidad,
                  cantidad_reservada: 0
                });
              } else if (reservaInfo.cantidad !== item.cantidad) {
                diagnostico.reservas_inconsistentes.push({
                  carrito_id: carrito._id,
                  usuario_id: carrito.id_usuario,
                  item_id: item._id,
                  libro_id: item.id_libro,
                  titulo: item.metadatos?.titulo_libro,
                  cantidad_carrito: item.cantidad,
                  cantidad_reservada: reservaInfo.cantidad,
                  diferencia: item.cantidad - reservaInfo.cantidad,
                  tienda_reserva: reservaInfo.inventario?.id_tienda?.nombre || 'Desconocida'
                });
              }
              
            } catch (itemError) {
              console.error(`Error analizando item ${item._id}:`, itemError);
              diagnostico.problemas_encontrados.push({
                tipo: 'error_analisis_item',
                carrito_id: carrito._id,
                item_id: item._id,
                error: itemError.message
              });
            }
          }
          
        } catch (carritoError) {
          console.error(`Error analizando carrito ${carrito._id}:`, carritoError);
          diagnostico.problemas_encontrados.push({
            tipo: 'error_analisis_carrito',
            carrito_id: carrito._id,
            error: carritoError.message
          });
        }
      }
      
      // Buscar reservas huérfanas (reservas sin item en carrito)
      const inventariosConReservas = await Inventario.find({
        stock_reservado: { $gt: 0 },
        'movimientos.tipo': 'reserva'
      }).populate('id_tienda', 'nombre').populate('id_libro', 'titulo');
      
      for (const inventario of inventariosConReservas) {
        // Obtener todos los IDs de carrito que tienen reservas
        const reservasPorCarrito = {};
        
        for (const movimiento of inventario.movimientos) {
          if (movimiento.tipo === 'reserva' && movimiento.id_reserva) {
            const carritoId = movimiento.id_reserva.toString();
            if (!reservasPorCarrito[carritoId]) {
              reservasPorCarrito[carritoId] = 0;
            }
            reservasPorCarrito[carritoId] += movimiento.cantidad;
          } else if (movimiento.tipo === 'liberacion_reserva' && movimiento.id_reserva) {
            const carritoId = movimiento.id_reserva.toString();
            if (!reservasPorCarrito[carritoId]) {
              reservasPorCarrito[carritoId] = 0;
            }
            reservasPorCarrito[carritoId] -= movimiento.cantidad;
          }
        }
        
        // Verificar cada carrito con reservas
        for (const [carritoId, cantidadReservada] of Object.entries(reservasPorCarrito)) {
          if (cantidadReservada > 0) {
            // Verificar si el carrito y el item existen
            const carrito = await Carrito.findById(carritoId);
            const item = carrito ? await CarritoItem.findOne({ 
              id_carrito: carritoId, 
              id_libro: inventario.id_libro 
            }) : null;
            
            if (!carrito || !item) {
              diagnostico.reservas_huerfanas.push({
                inventario_id: inventario._id,
                libro_id: inventario.id_libro,
                titulo_libro: inventario.id_libro?.titulo,
                tienda_id: inventario.id_tienda._id,
                nombre_tienda: inventario.id_tienda.nombre,
                carrito_id: carritoId,
                cantidad_reservada: cantidadReservada,
                carrito_existe: !!carrito,
                item_existe: !!item
              });
            }
          }
        }
      }
      
      // Generar resumen
      diagnostico.resumen = {
        total_problemas: diagnostico.problemas_encontrados.length + 
                        diagnostico.reservas_huerfanas.length + 
                        diagnostico.items_sin_reserva.length + 
                        diagnostico.reservas_inconsistentes.length,
        items_sin_reserva: diagnostico.items_sin_reserva.length,
        reservas_huerfanas: diagnostico.reservas_huerfanas.length,
        reservas_inconsistentes: diagnostico.reservas_inconsistentes.length,
        otros_problemas: diagnostico.problemas_encontrados.length
      };
      
      console.log('Diagnóstico completado:', diagnostico.resumen);
      
      return diagnostico;
    } catch (error) {
      console.error('Error en diagnóstico de reservas:', error);
      throw error;
    }
  },

  /**
   * Reparar problemas detectados en el diagnóstico
   * @param {String} idUsuario - ID del usuario (opcional)
   * @returns {Promise<Object>} Resultado de las reparaciones
   */
  async repararProblemasReservas(idUsuario = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log('Iniciando reparación de problemas de reservas');
      
      // Primero hacer el diagnóstico
      const diagnostico = await this.diagnosticarReservas(idUsuario);
      
      const reparaciones = {
        fecha: new Date(),
        items_sin_reserva_reparados: 0,
        reservas_huerfanas_liberadas: 0,
        items_eliminados: 0,
        errores: []
      };
      
      // Reparar items sin reserva
      for (const item of diagnostico.items_sin_reserva) {
        try {
          // Intentar re-reservar
          const inventario = await this._obtenerMejorInventarioDisponible(
            item.libro_id, 
            item.cantidad_carrito, 
            session
          );
          
          if (inventario && inventario.stock_disponible >= item.cantidad_carrito) {
            const carritoObjectId = new mongoose.Types.ObjectId(item.carrito_id);
            
            await inventario.reservarEjemplares(
              item.cantidad_carrito,
              item.usuario_id,
              carritoObjectId,
              'Reparación automática - re-reserva de item sin reserva'
            );
            
            reparaciones.items_sin_reserva_reparados++;
            console.log(`Re-reservado item ${item.item_id}: ${item.cantidad_carrito} unidades`);
          } else {
            // No hay stock, eliminar item del carrito
            await CarritoItem.findByIdAndDelete(item.item_id).session(session);
            reparaciones.items_eliminados++;
            console.log(`Item eliminado por falta de stock: ${item.item_id}`);
          }
        } catch (error) {
          console.error(`Error reparando item ${item.item_id}:`, error);
          reparaciones.errores.push({
            tipo: 'item_sin_reserva',
            item_id: item.item_id,
            error: error.message
          });
        }
      }
      
      // Liberar reservas huérfanas
      for (const reserva of diagnostico.reservas_huerfanas) {
        try {
          const inventario = await Inventario.findById(reserva.inventario_id).session(session);
          
          if (inventario && inventario.stock_reservado >= reserva.cantidad_reservada) {
            const carritoObjectId = new mongoose.Types.ObjectId(reserva.carrito_id);
            
            await inventario.liberarReserva(
              reserva.cantidad_reservada,
              null,
              carritoObjectId,
              'Reparación automática - liberación de reserva huérfana'
            );
            
            reparaciones.reservas_huerfanas_liberadas++;
            console.log(`Reserva huérfana liberada: ${reserva.cantidad_reservada} unidades del carrito ${reserva.carrito_id}`);
          }
        } catch (error) {
          console.error(`Error liberando reserva huérfana ${reserva.carrito_id}:`, error);
          reparaciones.errores.push({
            tipo: 'reserva_huerfana',
            carrito_id: reserva.carrito_id,
            error: error.message
          });
        }
      }
      
      await session.commitTransaction();
      session.endSession();
      
      console.log('Reparación completada:', reparaciones);
      
      return {
        diagnostico_inicial: diagnostico.resumen,
        reparaciones: reparaciones
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error en reparación de problemas:', error);
      throw error;
    }
  },

  /**
   * Agregar un libro al carrito CON RESERVA AUTOMÁTICA
   * @param {String} idUsuario - ID del usuario
   * @param {String} idLibro - ID del libro
   * @param {Number} cantidad - Cantidad a agregar
   * @returns {Promise<Object>} Resultado de la operación
   */
  async agregarLibroAlCarrito(idUsuario, idLibro, cantidad = 1) {
    return await this.ejecutarConRetry(async () => {
      try {
        console.log(`Agregando ${cantidad} del libro ${idLibro} al carrito del usuario ${idUsuario}`);
      
        // Validaciones básicas
        if (!mongoose.Types.ObjectId.isValid(idUsuario) || !mongoose.Types.ObjectId.isValid(idLibro)) {
          throw new Error('IDs inválidos');
        }
        
        if (cantidad < 1 || cantidad > 3) {
          throw new Error('La cantidad debe estar entre 1 y 3');
        }
        
        // Verificar que el libro existe y está disponible
        const libro = await Libro.findById(idLibro);
        if (!libro) {
          throw new Error('Libro no encontrado');
        }
        
        if (!libro.activo) {
          throw new Error('El libro no está disponible');
        }

        // Verificar stock consolidado real
        const stockConsolidado = await this._verificarStockConsolidadoDisponible(idLibro, cantidad, null);
        if (!stockConsolidado.suficiente) {
          throw new Error(`Stock insuficiente. Disponible: ${stockConsolidado.disponible}, solicitado: ${cantidad}`);
        }
        
        // Obtener carrito del usuario
        const carrito = await Carrito.obtenerCarritoActivo(idUsuario);
        const carritoObjectId = new mongoose.Types.ObjectId(carrito._id);
        
        // Verificar límite de libros diferentes
        const librosDiferentes = await CarritoItem.distinct('id_libro', { id_carrito: carrito._id });
        if (librosDiferentes.length >= 5 && !librosDiferentes.some(id => id.equals(idLibro))) {
          throw new Error('No se pueden agregar más de 5 libros diferentes al carrito');
        }
        
        // Verificar si el libro ya está en el carrito
        const itemExistente = await CarritoItem.findOne({ 
          id_carrito: carrito._id, 
          id_libro: idLibro 
        });
        
        let inventario = null;
        
        if (itemExistente) {
          console.log(`Item existente encontrado con cantidad: ${itemExistente.cantidad}`);
          
          // Actualizar cantidad del item existente
          const nuevaCantidad = itemExistente.cantidad + cantidad;
          if (nuevaCantidad > 3) {
            throw new Error('No se pueden tener más de 3 ejemplares del mismo libro');
          }
          
          // Obtener inventario para reservar stock adicional
          inventario = await this._obtenerMejorInventarioDisponible(idLibro, cantidad, null);
          
          if (!inventario) {
            throw new Error(`No hay tiendas activas con stock suficiente para aumentar la cantidad`);
          }
          
          if (inventario.stock_disponible < cantidad) {
            throw new Error(`Stock insuficiente para aumentar cantidad. Disponible: ${inventario.stock_disponible}, necesario: ${cantidad}`);
          }
          
          // Reservar stock adicional
          await inventario.reservarEjemplares(
            cantidad,
            idUsuario,
            carritoObjectId,
            `Carrito - aumentar cantidad de ${itemExistente.cantidad} a ${nuevaCantidad}`
          );
          
          console.log(`Stock reservado: ${cantidad} unidades en tienda ${inventario.id_tienda.nombre}`);
          
          // Calcular nuevo subtotal
          const precioUnitario = itemExistente.precios.precio_con_impuestos;
          const nuevoSubtotal = precioUnitario * nuevaCantidad;
          
          // Actualizar cantidad del item
          await CarritoItem.updateOne(
            { _id: itemExistente._id },
            {
              $set: {
                cantidad: nuevaCantidad,
                subtotal: nuevoSubtotal,
                fecha_actualizado: new Date()
              }
            }
          );
          
          console.log(`Cantidad actualizada a ${nuevaCantidad} correctamente`);
          
        } else {
          console.log('Creando nuevo item en el carrito');
          
          // Obtener inventario con mejor disponibilidad
          inventario = await this._obtenerMejorInventarioDisponible(idLibro, cantidad, null);
          
          if (!inventario) {
            throw new Error(`No hay tiendas activas con stock suficiente de "${libro.titulo}"`);
          }
          
          // Reservar stock
          await inventario.reservarEjemplares(
            cantidad,
            idUsuario,
            carritoObjectId,
            `Carrito - agregar ${cantidad} ejemplar(es) de "${libro.titulo}"`
          );
          
          console.log(`Stock reservado: ${cantidad} unidades en tienda ${inventario.id_tienda.nombre}`);
          
          // Calcular precios
          const precioBase = libro.precio_info?.precio_base || libro.precio;
          const impuesto = Math.round(precioBase * 0.19); // IVA 19%
          const precioConImpuesto = precioBase + impuesto;
          const subtotal = precioConImpuesto * cantidad;
          
          // Crear item con TODOS los campos requeridos
          const nuevoItemData = {
            id_carrito: carrito._id,
            id_libro: idLibro,
            cantidad: cantidad,
            precios: {
              precio_base: precioBase,
              precio_con_descuentos: precioBase,
              precio_con_impuestos: precioConImpuesto,
              impuesto: {
                tipo: 'IVA',
                porcentaje: 19,
                valor_impuesto: impuesto
              },
              total_descuentos: 0
            },
            reserva_info: {
              cantidad_reservada: cantidad,
              estado_reserva: 'RESERVADO',
              fecha_reserva: new Date()
            },
            precio_cambiado: false,
            mensaje_precio: '',
            estado: 'activo',
            metadatos: {
              titulo_libro: libro.titulo,
              autor_libro: libro.autor_nombre_completo,
              imagen_portada: libro.imagen_portada,
              isbn: libro.ISBN,
              disponible: true,
              tiendas_disponibles: [inventario.id_tienda._id],
              id_tienda_reservado: inventario.id_tienda._id,
              nombre_tienda_reservado: inventario.id_tienda.nombre
            },
            id_item: new mongoose.Types.ObjectId().toString(),
            codigos_aplicados: [],
            fecha_agregado: new Date(),
            fecha_actualizado: new Date(),
            subtotal: subtotal // ← CAMPO REQUERIDO
          };
          
          // Crear el item
          const resultado = await CarritoItem.create(nuevoItemData);
          
          if (!resultado) {
            // Si falla, liberar la reserva
            await inventario.liberarReserva(
              cantidad,
              idUsuario,
              carritoObjectId,
              'Error creando item - liberando reserva'
            );
            throw new Error('Error creando el item en el carrito');
          }
          
          console.log('Nuevo item creado correctamente');
        }
        
        // Actualizar totales del carrito
        try {
          await carrito.actualizarTotales();
          console.log('Totales del carrito actualizados');
        } catch (totalError) {
          console.warn('Error actualizando totales (no crítico, continuando):', totalError.message);
          // No fallar por esto, el carrito sigue siendo funcional
        }
        
        return {
          exito: true,
          mensaje: `${cantidad} ejemplar(es) agregado(s) al carrito y reservado(s)`,
          carrito: carrito.toObject(),
          stock_info: {
            stock_reservado: cantidad,
            tienda_reserva: inventario ? {
              id: inventario.id_tienda._id,
              nombre: inventario.id_tienda.nombre,
              codigo: inventario.id_tienda.codigo
            } : null
          }
        };
        
      } catch (error) {
        console.error('Error agregando libro al carrito:', error);
        throw error;
      }
    }, 3, 200);
  },

  /**
   * Verificar stock consolidado disponible para un libro
   * @private
   * @param {String} idLibro - ID del libro
   * @param {Number} cantidadNecesaria - Cantidad que se necesita
   * @param {Object} session - Sesión de MongoDB
   * @returns {Promise<Object>} Información de disponibilidad
   */
  async _verificarStockConsolidadoDisponible(idLibro, cantidadNecesaria, session) {
    try {
      // Obtener stock total disponible en todas las tiendas activas
      const inventarios = await Inventario.find({
        id_libro: idLibro,
        stock_disponible: { $gt: 0 }
      })
      .populate({
        path: 'id_tienda',
        match: { estado: 'activa' },
        select: 'estado servicios'
      })
      .session(session);
      
      // Filtrar solo tiendas activas que permitan recogidas
      const inventariosValidos = inventarios.filter(inv => 
        inv.id_tienda && 
        inv.id_tienda.estado === 'activa' &&
        inv.id_tienda.servicios.recogida_productos
      );
      
      const stockDisponibleTotal = inventariosValidos.reduce((total, inv) => 
        total + inv.stock_disponible, 0
      );
      
      console.log(`Stock consolidado disponible: ${stockDisponibleTotal} en ${inventariosValidos.length} tiendas activas`);
      
      return {
        suficiente: stockDisponibleTotal >= cantidadNecesaria,
        disponible: stockDisponibleTotal,
        tiendas_con_stock: inventariosValidos.length
      };
    } catch (error) {
      console.error('Error verificando stock consolidado:', error);
      return {
        suficiente: false,
        disponible: 0,
        tiendas_con_stock: 0
      };
    }
  },

  /**
   * Actualizar cantidad de un item en el carrito CON MANEJO DE RESERVAS
   * @param {String} idUsuario - ID del usuario
   * @param {String} idLibro - ID del libro
   * @param {Number} nuevaCantidad - Nueva cantidad
   * @returns {Promise<Object>} Resultado de la operación
   */
  async actualizarCantidadItem(idUsuario, idLibro, nuevaCantidad) {
    return await this.ejecutarConRetry(async () => {
      try {
        console.log(`Actualizando cantidad del libro ${idLibro} a ${nuevaCantidad} para usuario ${idUsuario}`);
        
        if (nuevaCantidad < 0 || nuevaCantidad > 3) {
          throw new Error('La cantidad debe estar entre 0 y 3');
        }
        
        const carrito = await Carrito.obtenerCarritoActivo(idUsuario);
        const carritoObjectId = new mongoose.Types.ObjectId(carrito._id);
        
        // Buscar item
        const item = await CarritoItem.findOne({ 
          id_carrito: carrito._id, 
          id_libro: idLibro 
        });
        
        if (!item) {
          throw new Error('Item no encontrado en el carrito');
        }
        
        const cantidadAnterior = item.cantidad;
        console.log(`Cantidad anterior: ${cantidadAnterior}, Nueva cantidad: ${nuevaCantidad}`);
        
        if (nuevaCantidad === 0) {
          // Eliminar item - LIBERAR TODA LA RESERVA
          await this._liberarReservaCompleta(carritoObjectId, idLibro, idUsuario, null);
          await CarritoItem.findByIdAndDelete(item._id);
          console.log('Item eliminado del carrito y reserva liberada');
          
        } else {
          // Actualizar cantidad - AJUSTAR RESERVA
          const diferencia = nuevaCantidad - cantidadAnterior;
          
          if (diferencia > 0) {
            // Aumentar cantidad - necesita más reserva
            const inventario = await this._obtenerMejorInventarioDisponible(idLibro, diferencia, null);
            if (!inventario || inventario.stock_disponible < diferencia) {
              throw new Error(`Stock insuficiente para aumentar cantidad. Disponible: ${inventario?.stock_disponible || 0}`);
            }
            
            await inventario.reservarEjemplares(
              diferencia,
              idUsuario,
              carritoObjectId,
              `Carrito - aumentar de ${cantidadAnterior} a ${nuevaCantidad}`
            );
            
            console.log(`Stock adicional reservado: ${diferencia} unidades`);
            
          } else if (diferencia < 0) {
            // CORREGIDO: Disminuir cantidad - liberar parte de la reserva
            const cantidadALiberar = Math.abs(diferencia);
            
            // Obtener TODOS los inventarios que tienen reservas de este carrito para este libro
            const inventariosConReservas = await Inventario.find({
              id_libro: idLibro,
              stock_reservado: { $gt: 0 },
              'movimientos': {
                $elemMatch: {
                  tipo: 'reserva',
                  id_reserva: carritoObjectId
                }
              }
            }).populate('id_tienda', 'nombre estado');
            
            let cantidadLiberada = 0;
            
            // Liberar reservas de cada inventario hasta completar la cantidad
            for (const inventario of inventariosConReservas) {
              if (cantidadLiberada >= cantidadALiberar) break;
              
              // Calcular cuánto está reservado en este inventario para este carrito
              const cantidadReservadaAqui = inventario.obtenerCantidadReservada(carritoObjectId);
              
              if (cantidadReservadaAqui > 0) {
                const aLiberarAqui = Math.min(cantidadReservadaAqui, cantidadALiberar - cantidadLiberada);
                
                await inventario.liberarReserva(
                  aLiberarAqui,
                  idUsuario,
                  carritoObjectId,
                  `Carrito - disminuir de ${cantidadAnterior} a ${nuevaCantidad}`
                );
                
                cantidadLiberada += aLiberarAqui;
                console.log(`Stock liberado: ${aLiberarAqui} unidades de inventario en tienda ${inventario.id_tienda?.nombre || 'desconocida'}`);
              }
            }
            
            if (cantidadLiberada < cantidadALiberar) {
              console.warn(`Solo se liberaron ${cantidadLiberada} de ${cantidadALiberar} unidades solicitadas`);
            } else {
              console.log(`Total liberado correctamente: ${cantidadLiberada} unidades`);
            }
          }
          
          // Calcular nuevo subtotal
          const precioUnitario = item.precios.precio_con_impuestos;
          const nuevoSubtotal = precioUnitario * nuevaCantidad;
          
          // Actualizar cantidad directamente
          await CarritoItem.updateOne(
            { _id: item._id },
            {
              $set: {
                cantidad: nuevaCantidad,
                subtotal: nuevoSubtotal,
                fecha_actualizado: new Date()
              }
            }
          );
          
          console.log(`Cantidad actualizada a ${nuevaCantidad} y reserva ajustada`);
        }
        
        // Actualizar totales del carrito
        try {
          await carrito.actualizarTotales();
          console.log('Totales del carrito actualizados');
        } catch (totalError) {
          console.warn('Error actualizando totales (no crítico, continuando):', totalError.message);
        }
        
        return {
          exito: true,
          mensaje: nuevaCantidad === 0 ? 'Item eliminado del carrito' : `Cantidad actualizada a ${nuevaCantidad}`,
          carrito: carrito.toObject()
        };
      } catch (error) {
        console.error('Error actualizando cantidad:', error);
        throw error;
      }
    }, 3, 150);
  },
  /**
   * Quitar un libro del carrito CON LIBERACIÓN DE RESERVA
   * @param {String} idUsuario - ID del usuario
   * @param {String} idLibro - ID del libro
   * @returns {Promise<Object>} Resultado de la operación
   */
  async quitarLibroDelCarrito(idUsuario, idLibro) {
    try {
      return await this.actualizarCantidadItem(idUsuario, idLibro, 0);
    } catch (error) {
      console.error('Error quitando libro del carrito:', error);
      throw error;
    }
  },

  /**
   * Ejecutar operaciones críticas con retry automático para WriteConflicts
   * @param {Function} operacion - Función a ejecutar
   * @param {Number} maxReintentos - Máximo número de reintentos
   * @param {Number} delayBase - Delay base en milisegundos
   * @returns {Promise} Resultado de la operación
   */
  async ejecutarConRetry(operacion, maxReintentos = 3, delayBase = 100) {
    for (let intento = 1; intento <= maxReintentos; intento++) {
      try {
        return await operacion();
      } catch (error) {
        // Si es WriteConflict y no es el último intento, reintentar
        if (error.code === 112 && intento < maxReintentos) {
          console.log(`WriteConflict detectado en carritoService (intento ${intento}/${maxReintentos}), reintentando...`);
          
          // Delay exponencial con jitter para evitar thundering herd
          const delay = delayBase * Math.pow(2, intento - 1) + Math.random() * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Si no es WriteConflict o se agotaron los reintentos, propagar error
        console.error(`Error en carritoService después de ${intento} intento(s):`, error.message);
        throw error;
      }
    }
  },

  /**
   * Vaciar carrito de un usuario CON LIBERACIÓN DE TODAS LAS RESERVAS
   * @param {String} idUsuario - ID del usuario
   * @returns {Promise<Object>} Resultado de la operación
   */
  async vaciarCarrito(idUsuario) {
    return await this.ejecutarConRetry(async () => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        console.log('Vaciando carrito del usuario:', idUsuario);
        
        const carrito = await Carrito.obtenerCarritoActivo(idUsuario);
        const items = await CarritoItem.find({ id_carrito: carrito._id }).session(session);
        
        // Liberar todas las reservas
        for (const item of items) {
          await this._liberarReservaCompleta(carrito._id, item.id_libro, idUsuario, session);
        }
        
        // Vaciar carrito
        await carrito.vaciar();
        
        await session.commitTransaction();
        
        console.log(`Carrito vaciado y ${items.length} reservas liberadas`);
        
        return {
          exito: true,
          mensaje: 'Carrito vaciado exitosamente y reservas liberadas',
          reservas_liberadas: items.length,
          carrito: carrito.toObject()
        };
      } catch (error) {
        await session.abortTransaction();
        console.error('Error vaciando carrito:', error);
        throw error;
      } finally {
        session.endSession();
      }
    }, 3, 200); // 3 reintentos con delay base de 200ms
  },

  /**
   * Confirmar compra - CONVERTIR RESERVAS EN VENTAS
   * @param {String} idUsuario - ID del usuario
   * @param {Object} datosVenta - Datos de la venta
   * @returns {Promise<Object>} Resultado de la operación
   */
  async confirmarCompra(idUsuario, datosVenta) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log('Confirmando compra y convirtiendo reservas en ventas');
      
      const carrito = await Carrito.obtenerCarritoActivo(idUsuario);
      const items = await CarritoItem.find({ id_carrito: carrito._id }).session(session);
      
      if (items.length === 0) {
        throw new Error('El carrito está vacío');
      }
      
      // Convertir todas las reservas en ventas definitivas
      for (const item of items) {
        const inventario = await this._obtenerInventarioDeReserva(carrito._id, item.id_libro, session);
        
        if (inventario && inventario.stock_reservado >= item.cantidad) {
          // Registrar salida definitiva (reduce del stock reservado)
          await inventario.registrarSalida(
            item.cantidad,
            'venta',
            idUsuario,
            null, // Se completará con el ID de transacción después
            `Venta confirmada desde carrito ${carrito._id}`
          );
        } else {
          throw new Error(`Error en reserva del libro: ${item.metadatos.titulo_libro}`);
        }
      }
      
      await session.commitTransaction();
      
      console.log('Reservas convertidas en ventas exitosamente');
      
      return {
        exito: true,
        mensaje: 'Compra confirmada y stock actualizado',
        items_procesados: items.length
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Error confirmando compra:', error);
      throw error;
    } finally {
      session.endSession();
    }
  },

  // ==========================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ==========================================

  /**
   * Obtener el mejor inventario disponible para un libro
   * @private
   */
  async _obtenerMejorInventarioDisponible(idLibro, cantidad, session) {
    try {
      // Buscar inventarios con stock suficiente, priorizando tiendas con más stock
      const inventarios = await Inventario.find({
        id_libro: idLibro,
        stock_disponible: { $gte: cantidad },
        estado: { $in: ['disponible', 'baja_existencia'] } // Permitir baja existencia también
      })
      .populate({
        path: 'id_tienda',
        match: { estado: 'activa' },
        select: 'nombre codigo estado servicios'
      })
      .session(session)
      .sort({ stock_disponible: -1 }); // Priorizar tiendas con más stock
      
      // Filtrar solo inventarios con tienda activa que permita recogidas
      const inventariosValidos = inventarios.filter(inv => 
        inv.id_tienda && 
        inv.id_tienda.estado === 'activa' &&
        inv.id_tienda.servicios.recogida_productos
      );
      
      if (inventariosValidos.length === 0) {
        console.log(`No se encontraron tiendas activas con stock suficiente para el libro ${idLibro}`);
        return null;
      }
      
      const inventarioSeleccionado = inventariosValidos[0];
      console.log(`Inventario seleccionado: Tienda ${inventarioSeleccionado.id_tienda.nombre}, Stock disponible: ${inventarioSeleccionado.stock_disponible}`);
      
      return inventarioSeleccionado;
    } catch (error) {
      console.error('Error obteniendo mejor inventario disponible:', error);
      return null;
    }
  },

  /**
   * Obtener inventario donde está la reserva
   * @private
   */
  async _obtenerInventarioDeReserva(idCarrito, idLibro, session) {
    try {
      // Asegurar que idCarrito sea un ObjectId válido
      let carritoObjectId;
      if (mongoose.Types.ObjectId.isValid(idCarrito)) {
        carritoObjectId = typeof idCarrito === 'string' ? new mongoose.Types.ObjectId(idCarrito) : idCarrito;
      } else {
        console.warn(`ID de carrito no es un ObjectId válido: ${idCarrito}`);
        return null;
      }
      
      // Buscar inventarios que tengan movimientos de reserva para este carrito
      const inventarios = await Inventario.find({
        id_libro: idLibro,
        'movimientos': {
          $elemMatch: {
            tipo: 'reserva',
            id_reserva: carritoObjectId
          }
        }
      })
      .populate('id_tienda', 'nombre codigo estado')
      .session(session);
      
      if (inventarios.length === 0) {
        console.log(`No se encontró reserva para carrito ${idCarrito} del libro ${idLibro}`);
        return null;
      }
      
      // Si hay múltiples, tomar el primero (no debería pasar normalmente)
      if (inventarios.length > 1) {
        console.warn(`Se encontraron múltiples reservas para carrito ${idCarrito} del libro ${idLibro}, usando la primera`);
      }
      
      const inventario = inventarios[0];
      console.log(`Reserva encontrada en tienda: ${inventario.id_tienda?.nombre || 'Sin nombre'}`);
      
      return inventario;
    } catch (error) {
      console.error('Error obteniendo inventario de reserva:', error);
      return null;
    }
  },

  /**
   * Obtener reserva existente de un carrito para un libro
   * @private
   */
  async _obtenerReservaExistente(idCarrito, idLibro, session) {
    try {
      const inventario = await this._obtenerInventarioDeReserva(idCarrito, idLibro, session);
      
      if (!inventario) {
        return null;
      }
      
      // Asegurar que idCarrito sea un ObjectId para comparación
      let carritoObjectId;
      if (mongoose.Types.ObjectId.isValid(idCarrito)) {
        carritoObjectId = typeof idCarrito === 'string' ? new mongoose.Types.ObjectId(idCarrito) : idCarrito;
      } else {
        console.warn(`ID de carrito no válido para obtener reserva: ${idCarrito}`);
        return null;
      }
      
      // Usar el método del modelo para obtener cantidad reservada
      const cantidadReservada = inventario.obtenerCantidadReservada(carritoObjectId);
      
      console.log(`Cantidad reservada para carrito ${idCarrito}: ${cantidadReservada}`);
      
      return {
        inventario,
        cantidad: cantidadReservada
      };
    } catch (error) {
      console.error('Error obteniendo reserva existente:', error);
      return null;
    }
  },

  /**
   * Liberar reserva completa de un libro en el carrito
   * @private
   */
  async _liberarReservaCompleta(idCarrito, idLibro, idUsuario, session) {
    try {
      console.log(`Liberando reserva completa: Carrito ${idCarrito}, Libro ${idLibro}`);
      
      // Asegurar que idCarrito sea un ObjectId válido
      let carritoObjectId;
      if (mongoose.Types.ObjectId.isValid(idCarrito)) {
        carritoObjectId = typeof idCarrito === 'string' ? new mongoose.Types.ObjectId(idCarrito) : idCarrito;
      } else {
        console.warn(`ID de carrito no válido para liberar reserva: ${idCarrito}`);
        return;
      }
      
      // Obtener TODOS los inventarios que tienen reservas de este carrito para este libro
      const inventariosConReservas = await Inventario.find({
        id_libro: idLibro,
        stock_reservado: { $gt: 0 },
        'movimientos': {
          $elemMatch: {
            tipo: 'reserva',
            id_reserva: carritoObjectId
          }
        }
      }).populate('id_tienda', 'nombre').session(session);
      
      console.log(`Encontrados ${inventariosConReservas.length} inventarios con reservas para este carrito`);
      
      let totalLiberado = 0;
      
      // Liberar reservas de cada inventario
      for (const inventario of inventariosConReservas) {
        const cantidadReservada = inventario.obtenerCantidadReservada(carritoObjectId);
        
        if (cantidadReservada > 0) {
          await inventario.liberarReserva(
            cantidadReservada,
            idUsuario,
            carritoObjectId,
            'Carrito - liberación completa de reserva'
          );
          
          totalLiberado += cantidadReservada;
          console.log(`Liberadas ${cantidadReservada} unidades del inventario en tienda ${inventario.id_tienda?.nombre || 'desconocida'}`);
        }
      }
      
      console.log(`Total liberado: ${totalLiberado} unidades para libro ${idLibro}`);
      
    } catch (error) {
      console.error('Error liberando reserva completa:', error);
      // No propagar el error para no romper el flujo principal
    }
  },

  /**
   * Verificar y limpiar items del carrito con problemas
   * @private
   */
  async _verificarYLimpiarItemsCarrito(idCarrito, items) {
    try {
      console.log(`Verificando ${items.length} items del carrito ${idCarrito}`);
      
      for (const item of items) {
        try {
          // Verificar si el libro sigue existiendo y activo
          const libro = await Libro.findById(item.id_libro);
          
          if (!libro || !libro.activo) {
            console.log(`Eliminando item de libro inactivo/eliminado: ${item.id_libro}`);
            await this._liberarReservaCompleta(idCarrito, item.id_libro, null, null);
            await CarritoItem.findByIdAndDelete(item._id);
            continue;
          }
          
          // Verificar si aún hay reserva válida
          const reservaInfo = await this._obtenerReservaExistente(idCarrito, item.id_libro, null);
          
          if (!reservaInfo || reservaInfo.cantidad < item.cantidad) {
            console.log(`Problema con reserva del item ${item.id_libro}: reservado=${reservaInfo?.cantidad || 0}, necesario=${item.cantidad}`);
            
            // Intentar re-reservar la diferencia si es posible
            const diferencia = item.cantidad - (reservaInfo?.cantidad || 0);
            if (diferencia > 0) {
              const inventarioDisponible = await this._obtenerMejorInventarioDisponible(item.id_libro, diferencia, null);
              
              if (inventarioDisponible && inventarioDisponible.stock_disponible >= diferencia) {
                try {
                  // Asegurar que idCarrito sea ObjectId
                  let carritoObjectId;
                  if (mongoose.Types.ObjectId.isValid(idCarrito)) {
                    carritoObjectId = typeof idCarrito === 'string' ? new mongoose.Types.ObjectId(idCarrito) : idCarrito;
                  } else {
                    carritoObjectId = new mongoose.Types.ObjectId(idCarrito);
                  }
                  
                  await inventarioDisponible.reservarEjemplares(
                    diferencia,
                    null, // Usuario no disponible en verificación
                    carritoObjectId,
                    'Re-reserva automática al verificar carrito'
                  );
                  
                  console.log(`Re-reservados ${diferencia} ejemplares para mantener consistencia`);
                  
                  // Actualizar estado del item
                  item.estado = 'activo';
                  item.mensaje_precio = '';
                  await item.save();
                } catch (reserveError) {
                  console.error('Error re-reservando:', reserveError);
                  // Marcar item con problemas
                  item.estado = 'sin_stock';
                  item.mensaje_precio = 'Problema con la reserva - verificar disponibilidad';
                  await item.save();
                }
              } else {
                // No hay stock suficiente, marcar item con problemas
                item.estado = 'sin_stock';
                item.mensaje_precio = 'Stock insuficiente - producto no disponible';
                await item.save();
              }
            }
          } else {
            // Reserva está bien, asegurar que el estado del item sea activo
            if (item.estado !== 'activo') {
              item.estado = 'activo';
              item.mensaje_precio = '';
              await item.save();
            }
          }
        } catch (itemError) {
          console.error(`Error verificando item ${item._id}:`, itemError);
          // Marcar item con error general - usar 'removido' como estado de error
          try {
            item.estado = 'removido';
            item.mensaje_precio = 'Error verificando disponibilidad';
            await item.save();
          } catch (saveError) {
            console.error('Error guardando estado de error del item:', saveError);
          }
        }
      }
      
      console.log('Verificación de items del carrito completada');
    } catch (error) {
      console.error('Error verificando items del carrito:', error);
    }
  },

  // ==========================================
  // MÉTODOS EXISTENTES (mantenidos)
  // ==========================================

  async aplicarCodigoDescuento(idUsuario, codigoDescuento) {
    try {
      console.log(`Aplicando código ${codigoDescuento} al carrito del usuario ${idUsuario}`);
      
      const carrito = await Carrito.obtenerCarritoActivo(idUsuario);
      
      if (carrito.n_item === 0) {
        throw new Error('No se puede aplicar código a un carrito vacío');
      }
      
      const yaAplicado = carrito.codigos_carrito.some(c => c.codigo === codigoDescuento);
      if (yaAplicado) {
        throw new Error('Este código ya está aplicado al carrito');
      }
      
      const resultado = await carrito.aplicarCodigoDescuento(codigoDescuento);
      
      return {
        exito: true,
        mensaje: resultado.mensaje,
        items_afectados: resultado.items_afectados,
        descuento_aplicado: resultado.descuento_aplicado,
        carrito: carrito.toObject()
      };
    } catch (error) {
      console.error('Error aplicando código:', error);
      throw error;
    }
  },

  async quitarCodigoDescuento(idUsuario, codigoDescuento) {
    try {
      console.log(`Quitando código ${codigoDescuento} del carrito del usuario ${idUsuario}`);
      
      const carrito = await Carrito.obtenerCarritoActivo(idUsuario);
      const resultado = await carrito.quitarCodigoDescuento(codigoDescuento);
      
      return {
        exito: true,
        mensaje: resultado.mensaje,
        items_afectados: resultado.items_afectados,
        carrito: carrito.toObject()
      };
    } catch (error) {
      console.error('Error quitando código:', error);
      throw error;
    }
  },

  async confirmarCambiosPrecio(idUsuario, idLibro = null) {
    try {
      console.log(`Confirmando cambios de precio para usuario ${idUsuario}`);
      
      const carrito = await Carrito.obtenerCarritoActivo(idUsuario);
      let query = { id_carrito: carrito._id, precio_cambiado: true };
      
      if (idLibro) {
        query.id_libro = idLibro;
      }
      
      const itemsConCambios = await CarritoItem.find(query);
      
      if (itemsConCambios.length === 0) {
        throw new Error('No hay cambios de precio pendientes');
      }
      
      let itemsConfirmados = 0;
      for (const item of itemsConCambios) {
        await item.confirmarCambioPrecio();
        itemsConfirmados++;
      }
      
      await carrito.actualizarTotales();
      
      return {
        exito: true,
        mensaje: `${itemsConfirmados} item(s) confirmado(s)`,
        items_confirmados: itemsConfirmados,
        carrito: carrito.toObject()
      };
    } catch (error) {
      console.error('Error confirmando cambios de precio:', error);
      throw error;
    }
  },

  async calcularTotalCarrito(idUsuario) {
    try {
      const carrito = await Carrito.obtenerCarritoActivo(idUsuario);
      await carrito.actualizarTotales();
      
      const stats = await CarritoItem.obtenerEstadisticasItems(carrito._id);
      
      return {
        totales: carrito.totales,
        subtotal: carrito.subtotal,
        descuentos: carrito.total_descuentos,
        costo_envio: carrito.info_envio?.costo_envio || 0,
        total: carrito.total,
        cantidad_items: stats.total_items,
        libros_diferentes: carrito.n_libros_diferentes,
        codigos_aplicados: carrito.codigos_carrito,
        problemas: {
          precio_cambiado: stats.items_con_precio_cambiado,
          sin_stock: stats.items_sin_stock
        }
      };
    } catch (error) {
      console.error('Error calculando total:', error);
      throw error;
    }
  },

  // Métodos administrativos mantenidos iguales...
  async listarCarritos(filtros = {}, pagina = 1, limite = 10) {
    try {
      console.log('Listando carritos con filtros:', JSON.stringify(filtros, null, 2));
      
      const skip = (pagina - 1) * limite;
      const query = {};
      
      if (filtros.estado) query.estado = filtros.estado;
      if (filtros.usuario) {
        const usuarios = await Cliente.find({
          $or: [
            { email: { $regex: filtros.usuario, $options: 'i' } },
            { nombres: { $regex: filtros.usuario, $options: 'i' } }
          ]
        }).select('_id');
        
        query.id_usuario = { $in: usuarios.map(u => u._id) };
      }
      
      if (filtros.fecha_desde) {
        query.fecha_creacion = { $gte: new Date(filtros.fecha_desde) };
      }
      
      if (filtros.fecha_hasta) {
        if (!query.fecha_creacion) query.fecha_creacion = {};
        query.fecha_creacion.$lte = new Date(filtros.fecha_hasta);
      }
      
      const total = await Carrito.countDocuments(query);
      const carritos = await Carrito.find(query)
        .populate('id_usuario', 'email nombres apellidos')
        .skip(skip)
        .limit(limite)
        .sort({ ultima_actualizacion: -1 });
      
      const totalPaginas = Math.ceil(total / limite) || 1;
      
      return {
        datos: carritos.map(c => c.toObject()),
        paginacion: {
          total,
          pagina,
          limite,
          totalPaginas
        }
      };
    } catch (error) {
      console.error('Error listando carritos:', error);
      throw error;
    }
  },

  async obtenerEstadisticasAdmin() {
    try {
      console.log('Obteniendo estadísticas administrativas de carritos');
      
      const estadisticasGenerales = await Carrito.obtenerEstadisticasAdmin();
      const libroMasPopular = await Carrito.obtenerLibroMasPopular();
      const carritosAbandonados = await Carrito.obtenerCarritosAbandonados();
      
      const totalProductosEnCarritos = await CarritoItem.aggregate([
        { $group: { _id: null, total: { $sum: '$cantidad' } } }
      ]);
      
      const valorPotencialTotal = await Carrito.aggregate([
        { $match: { estado: 'activo' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      
      return {
        estadisticas_generales: estadisticasGenerales,
        libro_mas_popular: libroMasPopular,
        carritos_abandonados: carritosAbandonados.length,
        total_productos_en_carritos: totalProductosEnCarritos.length > 0 ? totalProductosEnCarritos[0].total : 0,
        valor_potencial_total: valorPotencialTotal.length > 0 ? valorPotencialTotal[0].total : 0
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas admin:', error);
      throw error;
    }
  },

  async quitarProductoDeCarritos(idLibro, razon = 'Producto descontinuado') {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`Quitando libro ${idLibro} de todos los carritos. Razón: ${razon}`);
      
      const items = await CarritoItem.find({ id_libro: idLibro }).session(session);
      const carritosAfectados = [...new Set(items.map(item => item.id_carrito.toString()))];
      
      // Liberar todas las reservas antes de eliminar los items
      for (const item of items) {
        await this._liberarReservaCompleta(item.id_carrito, idLibro, null, session);
      }
      
      await CarritoItem.deleteMany({ id_libro: idLibro }).session(session);
      
      for (const idCarrito of carritosAfectados) {
        const carrito = await Carrito.findById(idCarrito).session(session);
        if (carrito) {
          await carrito.actualizarTotales();
        }
      }
      
      await session.commitTransaction();
      
      console.log(`Libro eliminado de ${carritosAfectados.length} carritos y reservas liberadas`);
      
      return {
        exito: true,
        mensaje: `Producto eliminado de ${carritosAfectados.length} carritos y reservas liberadas`,
        carritos_afectados: carritosAfectados.length,
        items_eliminados: items.length
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  async vaciarCarritoCliente(idUsuario) {
    try {
      console.log('Admin vaciando carrito del usuario:', idUsuario);
      return await this.vaciarCarrito(idUsuario); // Usar el método que ya maneja reservas
    } catch (error) {
      console.error('Error vaciando carrito de cliente:', error);
      throw error;
    }
  },

  async vaciarTodosLosCarritos() {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log('Vaciando todos los carritos activos');
      
      const carritosActivos = await Carrito.find({ estado: 'activo' }).session(session);
      let totalReservasLiberadas = 0;
      
      for (const carrito of carritosActivos) {
        const items = await CarritoItem.find({ id_carrito: carrito._id }).session(session);
        
        // Liberar todas las reservas
        for (const item of items) {
          await this._liberarReservaCompleta(carrito._id, item.id_libro, null, session);
          totalReservasLiberadas++;
        }
        
        await carrito.vaciar();
      }
      
      await session.commitTransaction();
      
      console.log(`${carritosActivos.length} carritos vaciados y ${totalReservasLiberadas} reservas liberadas`);
      
      return {
        exito: true,
        mensaje: `${carritosActivos.length} carritos vaciados exitosamente y ${totalReservasLiberadas} reservas liberadas`,
        carritos_afectados: carritosActivos.length,
        reservas_liberadas: totalReservasLiberadas
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  async obtenerProductoMasPopular() {
    try {
      console.log('Obteniendo producto más popular en carritos');
      
      const resultado = await Carrito.obtenerLibroMasPopular();
      
      if (!resultado) {
        return {
          mensaje: 'No hay productos en carritos actualmente'
        };
      }
      
      return {
        libro: resultado.libro[0],
        estadisticas: {
          total_en_carritos: resultado.total_en_carritos,
          carritos_diferentes: resultado.carritos_diferentes
        }
      };
    } catch (error) {
      console.error('Error obteniendo producto más popular:', error);
      throw error;
    }
  }
};

module.exports = carritoService;