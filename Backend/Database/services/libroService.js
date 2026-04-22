// Database/services/libroService.js
const mongoose = require('mongoose');
const Libro = require('../models/libroModel');
const Inventario = require('../models/inventarioModel');
const Busqueda = require('../models/busquedaModel');
const fs = require('fs').promises;
const path = require('path');
const TiendaFisica = require('../models/tiendaFisicaModel');

/**
 * Servicio de Libros - Encapsula la lógica de negocio y acceso a datos para libros
 * Proporciona métodos para todas las operaciones relacionadas con libros en la aplicación
 */
const libroService = {
  /**
   * Crea un nuevo libro en la base de datos
   * @param {Object} libroData - Datos del libro a crear
   * @returns {Promise<Object>} El libro creado
   */
  async crearLibro(libroData) {
    try {
      // Iniciar una sesión de transacción de MongoDB
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        console.log('Creando nuevo libro:', JSON.stringify(libroData, null, 2));
        
        // Comprobar campos obligatorios
        const {
          titulo,
          autor,
          editorial,
          genero,
          idioma,
          fecha_publicacion,
          anio_publicacion,
          numero_paginas,
          precio_info,
          precio,
          estado
        } = libroData;

        // Validar que tengamos todos los campos obligatorios
        if (!titulo || !autor || !editorial || !genero || !idioma || 
            !fecha_publicacion || !anio_publicacion || !numero_paginas || 
            !precio || !estado) {
          throw new Error('Faltan campos obligatorios para crear el libro');
        }

        // Formatear datos de autor si es necesario
        let autorFormateado = autor;

        // Si el autor viene como un objeto simple en lugar de array
        if (autor && !Array.isArray(autor)) {
          autorFormateado = [autor];
        }

        // Generar autor_nombre_completo
        const autorNombreCompleto = autorFormateado.map(a => 
          `${a.nombre} ${a.apellidos}`
        ).join(', ');
        
        libroData.autor = autorFormateado;
        libroData.autor_nombre_completo = autorNombreCompleto;

        // Si se proporciona precio_info, asegurarse de que tenga la estructura correcta
        if (!libroData.precio_info) {
          libroData.precio_info = {
            precio_base: precio,
            moneda: 'COP',
            impuesto: {
              tipo: 'IVA',
              porcentaje: 19
            },
            descuentos: []
          };
        }

        // Crear instancia del modelo con los datos
        const nuevoLibro = new Libro(libroData);
        await nuevoLibro.save({ session });
        
        console.log('Libro creado con ID:', nuevoLibro._id);

        // NUEVO: Obtener todas las tiendas activas
        const tiendasActivas = await TiendaFisica.find({ 
          estado: 'activa' 
        }).session(session);
        
        console.log(`Encontradas ${tiendasActivas.length} tiendas activas para distribuir inventario`);
        
        if (tiendasActivas.length === 0) {
          throw new Error('No hay tiendas activas disponibles para crear inventario');
        }

        // NUEVO: Distribuir stock entre tiendas
        const stockTotal = libroData.stock || 0;
        const stockPorTienda = this._distribuirStockEntreTiendas(stockTotal, tiendasActivas.length);
        
        console.log('Distribución de stock:', stockPorTienda);

        // NUEVO: Crear inventario en cada tienda activa
        const inventariosCreados = [];
        
        for (let i = 0; i < tiendasActivas.length; i++) {
          const tienda = tiendasActivas[i];
          const stockAsignado = stockPorTienda[i] || 0;
          
          const nuevoInventario = new Inventario({
            id_libro: nuevoLibro._id,
            id_tienda: tienda._id,
            stock_total: stockAsignado,
            stock_disponible: stockAsignado,
            stock_reservado: 0
          });
          
          await nuevoInventario.save({ session });
          inventariosCreados.push({
            tienda: tienda.nombre,
            stock: stockAsignado
          });
          
          console.log(`Inventario creado en tienda ${tienda.nombre}: ${stockAsignado} unidades`);
        }

        // Actualizar el stock total del libro con la suma real distribuida
        const stockTotalDistribuido = stockPorTienda.reduce((sum, stock) => sum + stock, 0);
        nuevoLibro.stock = stockTotalDistribuido;
        await nuevoLibro.save({ session });

        // Confirmar la transacción
        await session.commitTransaction();
        session.endSession();

        console.log(`Libro creado exitosamente con inventario distribuido en ${tiendasActivas.length} tiendas`);
        console.log('Inventarios creados:', inventariosCreados);

        return nuevoLibro.toObject();
      } catch (error) {
        // Si algo falla, abortar la transacción
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error creando libro:', error);
      throw error;
    }
  },

  /**
   * Distribuye stock de manera equitativa entre tiendas
   * @private
   * @param {Number} stockTotal - Cantidad total de stock a distribuir
   * @param {Number} numeroTiendas - Número de tiendas activas
   * @returns {Array} Array con la cantidad asignada a cada tienda
   */
  _distribuirStockEntreTiendas(stockTotal, numeroTiendas) {
    if (stockTotal <= 0 || numeroTiendas <= 0) {
      return new Array(numeroTiendas).fill(0);
    }

    // Calcular distribución base
    const stockBasePorTienda = Math.floor(stockTotal / numeroTiendas);
    const stockRestante = stockTotal % numeroTiendas;
    
    // Crear array con distribución base
    const distribucion = new Array(numeroTiendas).fill(stockBasePorTienda);
    
    // Distribuir el stock restante en las primeras tiendas
    for (let i = 0; i < stockRestante; i++) {
      distribucion[i] += 1;
    }
    
    console.log(`Distribución calculada: ${stockTotal} total = ${stockBasePorTienda} base + ${stockRestante} extra`);
    console.log(`Resultado: [${distribucion.join(', ')}]`);
    
    return distribucion;
  },

  /**
   * Obtiene un libro por su ID
   * @param {String} libroId - ID del libro a buscar
   * @returns {Promise<Object>} El libro encontrado
   */
  async obtenerLibroPorId(libroId) {
    try {
      console.log('Servicio: Buscando libro con ID:', libroId);
      let libro;

      if (mongoose.Types.ObjectId.isValid(libroId)) {
        libro = await Libro.findById(libroId);
      } else {
        libro = await Libro.findOne({ id_libro: libroId });
      }

      if (!libro) {
        throw new Error(`Libro no encontrado con ID: ${libroId}`);
      }

      // Obtener stock consolidado REAL
      const stockConsolidado = await this._obtenerStockConsolidado(libro._id);
      
      const libroConStock = libro.toObject();
      
      // IMPORTANTE: Sobrescribir con valores REALES
      libroConStock.stock = stockConsolidado.stock_total;
      libroConStock.stock_disponible = stockConsolidado.stock_disponible;
      libroConStock.stock_reservado = stockConsolidado.stock_reservado;
      libroConStock.tiendas_con_stock = stockConsolidado.tiendas_con_stock;
      libroConStock.stock_consolidado = stockConsolidado;
      
      console.log(`Stock REAL - Total: ${stockConsolidado.stock_total}, Disponible: ${stockConsolidado.stock_disponible}, Reservado: ${stockConsolidado.stock_reservado}`);

      return libroConStock;
    } catch (error) {
      console.error('Error obteniendo libro por ID:', error);
      throw error;
    }
  },

  /**
   * Actualiza un libro existente
   * @param {String} libroId - ID del libro a actualizar
   * @param {Object} datosActualizados - Nuevos datos del libro
   * @param {Number} version - Versión actual del libro para control de concurrencia
   * @returns {Promise<Object>} El libro actualizado
   */
  async actualizarLibro(libroId, datosActualizados, version) {
    try {
      console.log(`Actualizando libro ${libroId} con datos:`, JSON.stringify(datosActualizados, null, 2));
      
      // Iniciar una sesión de transacción
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verificar si el libro existe
        let libro;
        if (mongoose.Types.ObjectId.isValid(libroId)) {
          libro = await Libro.findById(libroId).session(session);
        } else {
          libro = await Libro.findOne({ id_libro: libroId }).session(session);
        }

        if (!libro) {
          throw new Error('Libro no encontrado para actualizar');
        }

        // Control de concurrencia optimista
        if (version !== undefined && libro.version !== version) {
          throw new Error('El libro ha sido modificado por otro usuario. Por favor, recarga los datos.');
        }

        // Verificar si hay cambios en el autor
        if (datosActualizados.autor) {
          let autor = datosActualizados.autor;
          
          // Si el autor viene como un objeto simple en lugar de array
          if (!Array.isArray(autor)) {
            autor = [autor];
          }

          // Actualizar el autor_nombre_completo
          if (autor.length > 0) {
            datosActualizados.autor_nombre_completo = autor.map(a => 
              `${a.nombre} ${a.apellidos}`
            ).join(', ');
          }
        }

        // NUEVO: Manejar actualización de stock
        if (datosActualizados.stock !== undefined) {
          await this._redistribuirStockEntreTiendas(libro._id, datosActualizados.stock, session);
          console.log(`Stock redistribuido: ${datosActualizados.stock} unidades entre tiendas activas`);
        }

        // Actualizar fecha de última actualización
        datosActualizados.ultima_actualizacion = new Date();

        // Actualizar el libro
        let libroActualizado;
        if (mongoose.Types.ObjectId.isValid(libroId)) {
          libroActualizado = await Libro.findByIdAndUpdate(
            libroId,
            { $set: datosActualizados },
            { new: true, runValidators: true, session }
          );
        } else {
          libroActualizado = await Libro.findOneAndUpdate(
            { id_libro: libroId },
            { $set: datosActualizados },
            { new: true, runValidators: true, session }
          );
        }

        if (!libroActualizado) {
          throw new Error('Libro no encontrado después de intentar actualizar');
        }

        // NUEVO: Verificar si se quedó sin stock y liberar reservas si es necesario
        if (datosActualizados.stock !== undefined) {
          await this._verificarYLiberarReservasSinStock(libroActualizado._id, session);
        }

        // Confirmar la transacción
        await session.commitTransaction();
        session.endSession();
        
        console.log('Libro actualizado exitosamente:', libroActualizado._id);
        
        // Devolver libro con stock consolidado
        return await this.obtenerLibroPorId(libroActualizado._id);
      } catch (error) {
        // Si algo falla, abortar la transacción
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error actualizando libro:', error);
      throw error;
    }
  },

  /**
   * Verificar y liberar reservas si un libro se queda sin stock
   * @private
   * @param {String} idLibro - ID del libro
   * @param {Object} session - Sesión de MongoDB
   */
  async _verificarYLiberarReservasSinStock(idLibro, session) {
    try {
      // Obtener stock consolidado actual
      const stockConsolidado = await this._obtenerStockConsolidado(idLibro);
      
      // Si no hay stock disponible, liberar todas las reservas
      if (stockConsolidado.stock_disponible === 0 && stockConsolidado.stock_reservado > 0) {
        console.log(`Libro ${idLibro} sin stock disponible, liberando ${stockConsolidado.stock_reservado} reservas`);
        
        // Liberar todas las reservas
        await this._liberarTodasLasReservasLibro(idLibro, session);
        
        // Quitar de todos los carritos
        const { carritoService } = require('./index');
        await carritoService.quitarProductoDeCarritos(
          idLibro, 
          'Producto sin stock disponible'
        );
      }
    } catch (error) {
      console.error('Error verificando reservas sin stock:', error);
      // No propagar el error para no romper el flujo principal
    }
  },

  /**
   * Redistribuye el stock de un libro entre todas las tiendas activas
   * @private
   * @param {String} idLibro - ID del libro
   * @param {Number} nuevoStockTotal - Nuevo stock total a distribuir
   * @param {Object} session - Sesión de MongoDB para transacción
   */
  async _redistribuirStockEntreTiendas(idLibro, nuevoStockTotal, session) {
    try {
      console.log(`Redistribuyendo stock del libro ${idLibro}: ${nuevoStockTotal} unidades`);
      
      // Importar TiendaFisica
      const TiendaFisica = require('../models/tiendaFisicaModel');
      
      // Obtener inventarios actuales del libro
      const inventariosActuales = await Inventario.find({
        id_libro: idLibro
      }).populate('id_tienda').session(session);
      
      console.log(`Encontrados ${inventariosActuales.length} inventarios existentes`);
      
      // Verificar si hay stock reservado que no se puede redistribuir
      const stockReservadoTotal = inventariosActuales.reduce((total, inv) => 
        total + (inv.stock_reservado || 0), 0
      );
      
      if (stockReservadoTotal > nuevoStockTotal) {
        throw new Error(`No se puede reducir el stock a ${nuevoStockTotal} porque hay ${stockReservadoTotal} unidades reservadas`);
      }
      
      // Obtener todas las tiendas activas
      const tiendasActivas = await TiendaFisica.find({ 
        estado: 'activa' 
      }).session(session);
      
      if (tiendasActivas.length === 0) {
        throw new Error('No hay tiendas activas para redistribuir el stock');
      }
      
      // Calcular stock disponible para redistribuir (total - reservado)
      const stockDisponibleParaRedistribuir = nuevoStockTotal - stockReservadoTotal;
      
      // Distribuir el stock disponible
      const distribucionDisponible = this._distribuirStockEntreTiendas(
        stockDisponibleParaRedistribuir, 
        tiendasActivas.length
      );
      
      console.log(`Stock reservado: ${stockReservadoTotal}, Disponible para redistribuir: ${stockDisponibleParaRedistribuir}`);
      
      // Crear mapa de inventarios existentes por tienda
      const inventariosPorTienda = new Map();
      inventariosActuales.forEach(inv => {
        if (inv.id_tienda && inv.id_tienda.estado === 'activa') {
          inventariosPorTienda.set(inv.id_tienda._id.toString(), inv);
        }
      });
      
      // Actualizar o crear inventarios para cada tienda activa
      for (let i = 0; i < tiendasActivas.length; i++) {
        const tienda = tiendasActivas[i];
        const stockDisponibleAsignado = distribucionDisponible[i] || 0;
        const tiendaId = tienda._id.toString();
        
        if (inventariosPorTienda.has(tiendaId)) {
          // Actualizar inventario existente
          const inventarioExistente = inventariosPorTienda.get(tiendaId);
          const stockReservadoTienda = inventarioExistente.stock_reservado || 0;
          const nuevoStockTotal = stockDisponibleAsignado + stockReservadoTienda;
          
          // Registrar el cambio como un ajuste
          if (nuevoStockTotal !== inventarioExistente.stock_total) {
            const diferencia = nuevoStockTotal - inventarioExistente.stock_total;
            
            if (diferencia > 0) {
              await inventarioExistente.registrarEntrada(
                diferencia,
                'ajuste_auditoria',
                null,
                `Redistribución de stock: ${inventarioExistente.stock_total} → ${nuevoStockTotal}`
              );
            } else if (diferencia < 0) {
              await inventarioExistente.registrarSalida(
                Math.abs(diferencia),
                'ajuste_auditoria',
                null,
                null,
                `Redistribución de stock: ${inventarioExistente.stock_total} → ${nuevoStockTotal}`
              );
            }
          }
          
          console.log(`Tienda ${tienda.nombre}: Stock actualizado a ${nuevoStockTotal} (${stockDisponibleAsignado} disponible + ${stockReservadoTienda} reservado)`);
        } else {
          // Crear nuevo inventario para esta tienda
          const nuevoInventario = new Inventario({
            id_libro: idLibro,
            id_tienda: tienda._id,
            stock_total: stockDisponibleAsignado,
            stock_disponible: stockDisponibleAsignado,
            stock_reservado: 0
          });
          
          await nuevoInventario.save({ session });
          console.log(`Tienda ${tienda.nombre}: Nuevo inventario creado con ${stockDisponibleAsignado} unidades`);
        }
      }
      
      // Eliminar inventarios de tiendas que ya no están activas (si los hay)
      for (const [tiendaId, inventario] of inventariosPorTienda) {
        const tiendaAunActiva = tiendasActivas.some(t => t._id.toString() === tiendaId);
        if (!tiendaAunActiva && inventario.stock_reservado === 0) {
          await Inventario.findByIdAndDelete(inventario._id).session(session);
          console.log(`Inventario eliminado de tienda inactiva: ${inventario.id_tienda.nombre}`);
        }
      }
      
      console.log('Redistribución de stock completada exitosamente');
      
    } catch (error) {
      console.error('Error redistribuyendo stock:', error);
      throw error;
    }
  },

  /**
   * Elimina lógicamente un libro (marca como inactivo)
   * @param {String} libroId - ID del libro a desactivar
   * @returns {Promise<Boolean>} True si se desactivó correctamente
   */
  async desactivarLibro(libroId) {
    try {
      console.log('Desactivando libro con ID:', libroId);
      
      // Iniciar sesión de transacción
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verificar que el libro existe
        const libroExistente = await this.obtenerLibroPorId(libroId);

        if (!libroExistente) {
          throw new Error('Libro no encontrado para desactivar');
        }

        // NUEVO: Liberar todas las reservas de este libro antes de desactivarlo
        await this._liberarTodasLasReservasLibro(libroId, session);

        // NUEVO: Quitar el libro de todos los carritos
        const { carritoService } = require('./index'); // Importar carritoService
        await carritoService.quitarProductoDeCarritos(
          libroId, 
          'Libro desactivado por administrador'
        );

        // Desactivar lógicamente el libro (marcar como inactivo)
        let resultado;
        if (mongoose.Types.ObjectId.isValid(libroId)) {
          resultado = await Libro.findByIdAndUpdate(
            libroId,
            { 
              $set: { 
                activo: false,
                ultima_actualizacion: new Date()
              }
            },
            { new: true, session }
          );
        } else {
          resultado = await Libro.findOneAndUpdate(
            { id_libro: libroId },
            { 
              $set: { 
                activo: false,
                ultima_actualizacion: new Date()
              }
            },
            { new: true, session }
          );
        }

        if (!resultado) {
          throw new Error('Error al desactivar el libro');
        }

        await session.commitTransaction();
        session.endSession();
        
        console.log('Libro desactivado correctamente y reservas liberadas:', resultado._id);
        return true;
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error desactivando libro:', error);
      throw error;
    }
  },

  /**
   * Elimina físicamente un libro de la base de datos
   * @param {String} libroId - ID del libro a eliminar
   * @returns {Promise<Boolean>} True si se eliminó correctamente
   */
  async eliminarLibroPermanente(libroId) {
    try {
      console.log('Eliminando permanentemente libro con ID:', libroId);
      
      // Iniciar una sesión de transacción
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verificar si el libro existe
        let libroExistente;
        if (mongoose.Types.ObjectId.isValid(libroId)) {
          libroExistente = await Libro.findById(libroId).session(session);
        } else {
          libroExistente = await Libro.findOne({ id_libro: libroId }).session(session);
        }

        if (!libroExistente) {
          throw new Error('Libro no encontrado para eliminación física');
        }

        // NUEVO: Liberar todas las reservas de este libro
        await this._liberarTodasLasReservasLibro(libroExistente._id, session);

        // NUEVO: Quitar el libro de todos los carritos
        const { carritoService } = require('./index'); // Importar carritoService
        await carritoService.quitarProductoDeCarritos(
          libroExistente._id, 
          'Libro eliminado permanentemente'
        );

        // Eliminar todos los inventarios asociados
        await Inventario.deleteMany({ id_libro: libroExistente._id }).session(session);
        console.log('Inventarios eliminados');

        // Eliminar físicamente el libro
        let resultado;
        if (mongoose.Types.ObjectId.isValid(libroId)) {
          resultado = await Libro.findByIdAndDelete(libroId).session(session);
        } else {
          resultado = await Libro.findOneAndDelete({ id_libro: libroId }).session(session);
        }

        if (!resultado) {
          throw new Error('Error al eliminar físicamente el libro');
        }

        // Eliminar imágenes físicas asociadas al libro
        if (libroExistente.imagenes && libroExistente.imagenes.length > 0) {
          const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
          const librosDir = path.join(uploadDir, 'libros');
          
          // Procesar cada imagen para eliminarla
          const deletePromises = libroExistente.imagenes.map(imagen => {
            if (imagen.nombre_archivo) {
              const rutaArchivo = path.join(librosDir, imagen.nombre_archivo);
              return fs.unlink(rutaArchivo).catch(err => {
                console.warn(`No se pudo eliminar la imagen ${imagen.nombre_archivo}: ${err.message}`);
              });
            }
            return Promise.resolve();
          });
          
          // Esperar a que se eliminen todas las imágenes
          await Promise.all(deletePromises);
        }

        // Confirmar la transacción
        await session.commitTransaction();
        session.endSession();
        
        console.log('Libro eliminado permanentemente y reservas liberadas:', libroExistente._id);
        return true;
      } catch (error) {
        // Si algo falla, abortar la transacción
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error eliminando físicamente libro:', error);
      throw error;
    }
  },

  /**
   * Libera todas las reservas de un libro específico en todos los inventarios
   * @private
   * @param {String} idLibro - ID del libro
   * @param {Object} session - Sesión de MongoDB para transacción
   */
  async _liberarTodasLasReservasLibro(idLibro, session) {
    try {
      console.log(`Liberando todas las reservas del libro ${idLibro}`);
      
      // Obtener todos los inventarios del libro que tengan stock reservado
      const inventariosConReservas = await Inventario.find({
        id_libro: idLibro,
        stock_reservado: { $gt: 0 }
      }).session(session);
      
      console.log(`Encontrados ${inventariosConReservas.length} inventarios con reservas`);
      
      let totalReservasLiberadas = 0;
      
      for (const inventario of inventariosConReservas) {
        const stockReservado = inventario.stock_reservado;
        
        if (stockReservado > 0) {
          // Crear movimiento de liberación masiva
          const stockAnterior = {
            total: inventario.stock_total,
            disponible: inventario.stock_disponible,
            reservado: inventario.stock_reservado
          };
          
          // Mover todo el stock reservado a disponible
          inventario.stock_disponible += stockReservado;
          inventario.stock_reservado = 0;
          
          const stockPosterior = {
            total: inventario.stock_total,
            disponible: inventario.stock_disponible,
            reservado: inventario.stock_reservado
          };
          
          // Registrar movimiento de liberación masiva
          inventario.movimientos.push({
            tipo: 'liberacion_reserva',
            cantidad: stockReservado,
            fecha: new Date(),
            id_usuario: null, // Sistema
            motivo: 'expiracion_reserva',
            id_reserva: null, // Liberación masiva
            notas: 'Liberación masiva por desactivación/eliminación del libro',
            stock_anterior: stockAnterior,
            stock_posterior: stockPosterior
          });
          
          await inventario.save({ session });
          totalReservasLiberadas += stockReservado;
          
          console.log(`Liberadas ${stockReservado} reservas del inventario en tienda ${inventario.id_tienda}`);
        }
      }
      
      console.log(`Total de reservas liberadas: ${totalReservasLiberadas}`);
      
    } catch (error) {
      console.error('Error liberando reservas del libro:', error);
      throw error;
    }
  },

  /**
   * Listar libros con filtros y paginación
   * @param {Object} filtros - Filtros para la búsqueda
   * @param {Number} pagina - Número de página
   * @param {Number} limite - Cantidad de resultados por página
   * @param {String} ordenarPor - Campo por el que ordenar
   * @param {String} direccion - Dirección del ordenamiento ('asc' o 'desc')
   * @returns {Promise<Object>} Resultados paginados
   */
  async listarLibros(filtros = {}, pagina = 1, limite = 10, ordenarPor = 'fecha_registro', direccion = 'desc') {
    try {
      console.log(`Listando libros - Página ${pagina}, Límite ${limite}, Orden ${ordenarPor} ${direccion}`);
      console.log('Filtros:', JSON.stringify(filtros, null, 2));
      
      const skip = (pagina - 1) * limite;
      const query = Libro.buscarPorCriterios(filtros);
      const total = await Libro.countDocuments(query.getQuery());
      
      const ordenamiento = {};
      ordenamiento[ordenarPor] = direccion === 'asc' ? 1 : -1;

      // Obtener libros
      const libros = await query
        .skip(skip)
        .limit(limite)
        .sort(ordenamiento);

      // CORREGIDO: Obtener stock consolidado REAL para cada libro
      const librosConStockReal = await Promise.all(
        libros.map(async (libro) => {
          const stockConsolidado = await this._obtenerStockConsolidado(libro._id);
          const libroObj = libro.toObject();
          
          // IMPORTANTE: Sobrescribir con valores REALES
          libroObj.stock = stockConsolidado.stock_total;
          libroObj.stock_disponible = stockConsolidado.stock_disponible;
          libroObj.stock_reservado = stockConsolidado.stock_reservado;
          libroObj.tiendas_con_stock = stockConsolidado.tiendas_con_stock;
          libroObj.stock_consolidado = stockConsolidado;
          
          return libroObj;
        })
      );

      const totalPaginas = Math.ceil(total / limite) || 1;

      console.log(`Libros encontrados: ${libros.length}, Total: ${total}`);
      
      return {
        datos: librosConStockReal,
        paginacion: {
          total,
          pagina,
          limite,
          totalPaginas
        }
      };
    } catch (error) {
      console.error('Error listando libros:', error);
      throw error;
    }
  },

  /**
   * Obtener tiendas que tienen stock de un libro específico
   * @param {String} idLibro - ID del libro
   * @returns {Promise<Array>} Lista de tiendas con stock disponible
   */
  async obtenerTiendasConStock(idLibro) {
    try {
      console.log(`Obteniendo tiendas con stock del libro ${idLibro}`);
      
      // Buscar inventarios que tengan stock del libro
      const inventarios = await Inventario.find({
        id_libro: idLibro,
        stock_total: { $gt: 0 }
      })
      .populate({
        path: 'id_tienda',
        match: { estado: 'activa' },
        select: 'nombre codigo direccion coordenadas servicios estado'
      })
      .lean();
      
      // Filtrar solo inventarios con tienda activa y formatear respuesta
      const tiendasConStock = inventarios
        .filter(inv => inv.id_tienda)
        .map(inv => ({
          tienda: inv.id_tienda,
          stock_total: inv.stock_total,
          stock_disponible: inv.stock_disponible,
          stock_reservado: inv.stock_reservado,
          estado_inventario: inv.estado,
          puede_reservar: inv.stock_disponible > 0 && inv.id_tienda.servicios.recogida_productos
        }));
      
      console.log(`Encontradas ${tiendasConStock.length} tiendas con stock del libro`);
      
      return tiendasConStock;
    } catch (error) {
      console.error('Error obteniendo tiendas con stock:', error);
      throw error;
    }
  },

  /**
   * Obtiene el stock consolidado de un libro sumando todas las tiendas
   * @private
   * @param {String} idLibro - ID del libro
   * @returns {Promise<Object>} Información de stock consolidado
   */
  async _obtenerStockConsolidado(idLibro) {
    try {
      // Obtener TODOS los inventarios de este libro en tiendas activas
      const inventarios = await Inventario.find({
        id_libro: idLibro
      }).populate({
        path: 'id_tienda',
        match: { estado: 'activa' },
        select: 'estado servicios'
      });

      // Filtrar solo inventarios de tiendas activas
      const inventariosActivos = inventarios.filter(inv => 
        inv.id_tienda && 
        inv.id_tienda.estado === 'activa'
      );

      if (inventariosActivos.length === 0) {
        return {
          stock_total: 0,
          stock_disponible: 0,
          stock_reservado: 0,
          tiendas_con_stock: 0,
          tiendas_disponibles: 0
        };
      }

      // Sumar stock real de todas las tiendas activas
      let stockTotal = 0;
      let stockDisponible = 0;
      let stockReservado = 0;
      let tiendasConStock = 0;
      let tiendasDisponibles = 0;

      for (const inv of inventariosActivos) {
        stockTotal += inv.stock_total || 0;
        stockDisponible += inv.stock_disponible || 0;
        stockReservado += inv.stock_reservado || 0;
        
        if (inv.stock_total > 0) {
          tiendasConStock++;
        }
        
        if (inv.stock_disponible > 0) {
          tiendasDisponibles++;
        }
      }

      console.log(`Stock consolidado para libro ${idLibro}: Total=${stockTotal}, Disponible=${stockDisponible}, Reservado=${stockReservado}`);

      return {
        stock_total: stockTotal,
        stock_disponible: stockDisponible,
        stock_reservado: stockReservado,
        tiendas_con_stock: tiendasConStock,
        tiendas_disponibles: tiendasDisponibles
      };
    } catch (error) {
      console.error('Error obteniendo stock consolidado:', error);
      return {
        stock_total: 0,
        stock_disponible: 0,
        stock_reservado: 0,
        tiendas_con_stock: 0,
        tiendas_disponibles: 0
      };
    }
  },

  /**
   * Realiza una búsqueda de libros utilizando Atlas Search y guarda la consulta
   * @param {String} termino - Término de búsqueda
   * @param {Object} filtros - Filtros adicionales
   * @param {Object} usuario - Usuario que realiza la búsqueda (opcional)
   * @param {Number} limite - Cantidad de resultados
   * @returns {Promise<Object>} Resultados de la búsqueda y registro
   */
  async buscarYRegistrar(termino, filtros = {}, usuario = null, limite = 20) {
    try {
      // Decodificar términos de búsqueda que puedan venir URL-encoded
      if (termino) {
        try {
          termino = decodeURIComponent(termino);
        } catch (e) {
          console.warn('Error decodificando término de búsqueda, usando valor original:', e.message);
        }
      }
      
      console.log(`Búsqueda: "${termino || ''}", filtros:`, JSON.stringify(filtros, null, 2));
      
      // Crear pipeline de búsqueda
      const pipeline = [];
      
      // Etapa 1: Buscar con Atlas Search (si hay término de búsqueda)
      if (termino && termino.trim() !== '') {
        pipeline.push({
          $search: {
            index: 'libro_search_index', // Nombre del índice creado en Atlas
            compound: {
              should: [
                // Búsqueda en título (mayor peso)
                {
                  text: {
                    query: termino,
                    path: "titulo",
                    score: { boost: { value: 5 } },
                    fuzzy: {
                      maxEdits: 2,
                      prefixLength: 1
                    }
                  }
                },
                // Búsqueda en autor
                {
                  text: {
                    query: termino,
                    path: "autor_nombre_completo",
                    score: { boost: { value: 4 } },
                    fuzzy: {
                      maxEdits: 2,
                      prefixLength: 1
                    }
                  }
                },
                // Búsqueda en género
                {
                  text: {
                    query: termino,
                    path: "genero",
                    score: { boost: { value: 3 } },
                    fuzzy: {
                      maxEdits: 2,
                      prefixLength: 1
                    }
                  }
                },
                // Búsqueda en editorial
                {
                  text: {
                    query: termino,
                    path: "editorial",
                    score: { boost: { value: 3 } },
                    fuzzy: {
                      maxEdits: 2,
                      prefixLength: 1
                    }
                  }
                },
                // Búsqueda en palabras clave
                {
                  text: {
                    query: termino,
                    path: "palabras_clave",
                    score: { boost: { value: 2 } },
                    fuzzy: {
                      maxEdits: 2,
                      prefixLength: 1
                    }
                  }
                },
                // Búsqueda en descripción
                {
                  text: {
                    query: termino,
                    path: "descripcion",
                    score: { boost: { value: 1 } },
                    fuzzy: {
                      maxEdits: 2,
                      prefixLength: 1
                    }
                  }
                }
              ],
              minimumShouldMatch: 1
            }
          }
        });
      }
      
      // Etapa 2: Aplicar filtros adicionales con $match
      const matchConditions = { activo: true };
      
      // Aplicar filtros específicos (excepto solo_disponibles)
      this.aplicarFiltrosAtlasSearch(matchConditions, filtros);
      
      // Agregar etapa $match al pipeline
      pipeline.push({ $match: matchConditions });
      
      // NUEVO: Si se solicita solo disponibles, hacer lookup con inventarios
      if (filtros.solo_disponibles) {
        pipeline.push(
          // Lookup para obtener inventarios
          {
            $lookup: {
              from: 'inventarios',
              localField: '_id',
              foreignField: 'id_libro',
              as: 'inventarios'
            }
          },
          // Lookup para verificar que las tiendas estén activas
          {
            $lookup: {
              from: 'tienda_fisicas',
              localField: 'inventarios.id_tienda',
              foreignField: '_id',
              as: 'tiendas'
            }
          },
          // Calcular stock disponible total
          {
            $addFields: {
              stock_disponible_total: {
                $sum: {
                  $map: {
                    input: '$inventarios',
                    as: 'inv',
                    in: {
                      $cond: [
                        {
                          $and: [
                            { $gt: ['$$inv.stock_disponible', 0] },
                            {
                              $in: [
                                '$$inv.id_tienda',
                                {
                                  $map: {
                                    input: {
                                      $filter: {
                                        input: '$tiendas',
                                        cond: { 
                                          $and: [
                                            { $eq: ['$$this.estado', 'activa'] },
                                            { $eq: ['$$this.servicios.recogida_productos', true] }
                                          ]
                                        }
                                      }
                                    },
                                    as: 'tienda',
                                    in: '$$tienda._id'
                                  }
                                }
                              ]
                            }
                          ]
                        },
                        '$$inv.stock_disponible',
                        0
                      ]
                    }
                  }
                }
              }
            }
          },
          // Filtrar solo libros con stock disponible > 0
          {
            $match: {
              stock_disponible_total: { $gt: 0 }
            }
          },
          // Limpiar campos temporales
          {
            $project: {
              inventarios: 0,
              tiendas: 0,
              stock_disponible_total: 0
            }
          }
        );
      }
      
      // Etapa final: Limitar resultados
      pipeline.push({ $limit: limite });
      
      // Ejecutar búsqueda
      let libros;
      
      if (pipeline.length > 0) {
        // Si hay búsqueda de texto o filtros, usar pipeline completo
        libros = await Libro.aggregate(pipeline);
        console.log(`Libros encontrados con pipeline: ${libros.length}`);
      } else {
        // Si no hay búsqueda ni filtros, devolver libros por defecto (más recientes)
        const query = { activo: true };
        
        // Aplicar filtro de solo disponibles si es necesario
        if (filtros.solo_disponibles) {
          // Para la consulta simple, usar un método más directo
          const librosConStock = await this._obtenerLibrosConStockDisponible(limite);
          libros = librosConStock;
        } else {
          libros = await Libro.find(query).sort({ fecha_registro: -1 }).limit(limite);
        }
        
        console.log(`No se especificaron criterios, mostrando ${libros.length} libros recientes`);
      }
      
      // Agregar información de stock consolidado a cada libro
      const librosConStockConsolidado = await Promise.all(
        libros.map(async (libro) => {
          const stockConsolidado = await this._obtenerStockConsolidado(libro._id);
          return {
            ...libro,
            stock_consolidado: stockConsolidado,
            stock: stockConsolidado.stock_total,
            stock_disponible: stockConsolidado.stock_disponible,
            stock_reservado: stockConsolidado.stock_reservado
          };
        })
      );
      
      // Registrar la búsqueda en el historial
      const busquedaData = {
        termino: termino || '',
        total_resultados: librosConStockConsolidado.length,
        filtros
      };
      
      // Agregar usuario si está autenticado
      if (usuario && usuario._id) {
        busquedaData.id_usuario = usuario._id;
      }
      
      // Guardar registro de búsqueda
      const nuevaBusqueda = new Busqueda(busquedaData);
      await nuevaBusqueda.save();
      console.log('Búsqueda registrada con ID:', nuevaBusqueda._id);
      
      return {
        resultados: librosConStockConsolidado,
        id_busqueda: nuevaBusqueda._id
      };
    } catch (error) {
      console.error('Error en búsqueda de libros con Atlas Search:', error);
      throw error;
    }
  },

  /**
   * Obtener libros que tienen stock disponible en tiendas activas
   * @private
   * @param {Number} limite - Cantidad máxima de resultados
   * @returns {Promise<Array>} Lista de libros con stock
   */
  async _obtenerLibrosConStockDisponible(limite = 20) {
    try {
      const pipeline = [
        // Lookup con inventarios
        {
          $lookup: {
            from: 'inventarios',
            localField: '_id',
            foreignField: 'id_libro',
            as: 'inventarios'
          }
        },
        // Lookup con tiendas para verificar que estén activas
        {
          $lookup: {
            from: 'tienda_fisicas',
            localField: 'inventarios.id_tienda',
            foreignField: '_id',
            as: 'tiendas'
          }
        },
        // Calcular stock disponible en tiendas activas
        {
          $addFields: {
            stock_disponible_total: {
              $sum: {
                $map: {
                  input: '$inventarios',
                  as: 'inv',
                  in: {
                    $cond: [
                      {
                        $and: [
                          { $gt: ['$$inv.stock_disponible', 0] },
                          {
                            $in: [
                              '$$inv.id_tienda',
                              {
                                $map: {
                                  input: {
                                    $filter: {
                                      input: '$tiendas',
                                      cond: { 
                                        $and: [
                                          { $eq: ['$$this.estado', 'activa'] },
                                          { $eq: ['$$this.servicios.recogida_productos', true] }
                                        ]
                                      }
                                    }
                                  },
                                  as: 'tienda',
                                  in: '$$tienda._id'
                                }
                              }
                            ]
                          }
                        ]
                      },
                      '$$inv.stock_disponible',
                      0
                    ]
                  }
                }
              }
            }
          }
        },
        // Filtrar solo libros activos con stock > 0
        {
          $match: {
            activo: true,
            stock_disponible_total: { $gt: 0 }
          }
        },
        // Limpiar campos temporales
        {
          $project: {
            inventarios: 0,
            tiendas: 0,
            stock_disponible_total: 0
          }
        },
        // Ordenar por fecha de registro (más recientes primero)
        {
          $sort: { fecha_registro: -1 }
        },
        // Limitar resultados
        {
          $limit: limite
        }
      ];
      
      const libros = await Libro.aggregate(pipeline);
      console.log(`Encontrados ${libros.length} libros con stock disponible`);
      
      return libros;
    } catch (error) {
      console.error('Error obteniendo libros con stock disponible:', error);
      return [];
    }
  },

  // Método auxiliar para aplicar filtros a la búsqueda de Atlas Search
  aplicarFiltrosAtlasSearch(matchConditions, filtros) {
    // Filtros de texto (ya no necesitamos normalización ni regex, Atlas Search se encarga)
    if (filtros.genero) {
      matchConditions.genero = filtros.genero;
    }
    
    if (filtros.editorial) {
      matchConditions.editorial = filtros.editorial;
    }
    
    if (filtros.idioma) {
      matchConditions.idioma = filtros.idioma;
    }
    
    if (filtros.estado) {
      matchConditions.estado = filtros.estado;
    }
    
    // Filtros de precio
    if (filtros.precio_min || filtros.precio_max) {
      matchConditions.precio = {};
      if (filtros.precio_min) matchConditions.precio.$gte = parseFloat(filtros.precio_min);
      if (filtros.precio_max) matchConditions.precio.$lte = parseFloat(filtros.precio_max);
    }
    
    // Solo disponibles
    if (filtros.solo_disponibles) {
      matchConditions.stock = { $gt: 0 };
    }
    
    // Incluir inactivos
    if (filtros.incluir_inactivos !== true) {
      matchConditions.activo = true;
    }
  },

  // Método para búsquedas con autocompletado
  async buscarAutocomplete(prefijo, campo = "titulo", limite = 10) {
    try {
      if (!prefijo || prefijo.trim() === '') {
        return [];
      }

      // Validar que el campo tenga soporte para autocompletado
      const camposPermitidos = ['titulo', 'autor_nombre_completo', 'genero', 'editorial'];
      if (!camposPermitidos.includes(campo)) {
        campo = 'titulo'; // Valor por defecto si no es válido
      }

      // Pipeline para autocompletado usando Atlas Search
      const pipeline = [
        {
          $search: {
            index: "libro_search_index",
            // Usar el subcampo autocomplete del campo solicitado
            autocomplete: {
              query: prefijo,
              path: `${campo}.autocomplete`,
              fuzzy: {
                maxEdits: 1,
                prefixLength: 1
              }
            }
          }
        },
        // Obtener solo los campos necesarios y score
        {
          $project: {
            _id: 1,
            titulo: 1,
            autor_nombre_completo: 1,
            [campo]: 1,
            // Usar doble score para evitar el error de $meta
            score: { $const: 1.0 } // Score constante como alternativa
          }
        },
        // Limitar cantidad de resultados
        {
          $limit: limite
        }
      ];

      const resultados = await Libro.aggregate(pipeline);
      return resultados;
    } catch (error) {
      console.error(`Error en autocompletado para ${campo}:`, error);
      
      // Plan B: Usar búsqueda de texto normal si falla autocomplete
      try {
        console.log(`Intentando fallback para autocompletar ${campo} con búsqueda de texto normal`);
        return await this.busquedaTextoSimple(prefijo, campo, limite);
      } catch (fallbackError) {
        console.error('Error en fallback de autocompletado:', fallbackError);
        throw error; // Propagar el error original
      }
    }
  },

  // Método fallback para autocompletado usando regex
  async busquedaTextoSimple(prefijo, campo = "titulo", limite = 10) {
    // Escapar caracteres especiales para regex
    const terminoEscapado = prefijo.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Crear condición de búsqueda
    const query = { 
      activo: true,
      [campo]: { $regex: `^${terminoEscapado}`, $options: 'i' }
    };
    
    // Campos a seleccionar
    const projection = { 
      _id: 1, 
      titulo: 1, 
      autor_nombre_completo: 1,
      [campo]: 1
    };
    
    // Ejecutar consulta
    return await Libro.find(query, projection).limit(limite);
  },

  // Método para búsqueda difusa (fuzzy) por múltiples campos
  async busquedaDifusa(termino, campos = ["titulo", "autor_nombre_completo"], limite = 20) {
    try {
      if (!termino || termino.trim() === '') {
        return [];
      }

      // Verificar si los campos solicitados son válidos
      const camposValidos = ["titulo", "autor_nombre_completo", "genero", "editorial", "descripcion", "palabras_clave"];
      const camposFiltrados = Array.isArray(campos) 
        ? campos.filter(c => camposValidos.includes(c))
        : typeof campos === 'string'
          ? campos.split(',').map(c => c.trim()).filter(c => camposValidos.includes(c))
          : ["titulo", "autor_nombre_completo"];

      // Si no quedaron campos válidos, usar los predeterminados
      if (camposFiltrados.length === 0) {
        camposFiltrados.push("titulo", "autor_nombre_completo");
      }

      // Pipeline para búsqueda difusa usando Atlas Search
      const pipeline = [
        {
          $search: {
            index: "libro_search_index",
            compound: {
              should: camposFiltrados.map(campo => ({
                text: {
                  query: termino,
                  path: campo,
                  fuzzy: {
                    maxEdits: 2,
                    prefixLength: 1
                  }
                }
              })),
              minimumShouldMatch: 1
            }
          }
        },
        {
          $match: { activo: true }
        },
        // En lugar de usar $meta searchScore, usar $addFields con valor constante si es necesario
        {
          $addFields: {
            relevance: 1.0 // Score constante como alternativa
          }
        },
        {
          $limit: limite
        }
      ];

      const resultados = await Libro.aggregate(pipeline);
      return resultados;
    } catch (error) {
      console.error('Error en búsqueda difusa:', error);
      
      // Plan B: Usar búsqueda básica con regex si falla la búsqueda difusa
      try {
        console.log('Intentando fallback para búsqueda difusa con regex básico');
        return await this.busquedaRegexBasica(termino, campos, limite);
      } catch (fallbackError) {
        console.error('Error en fallback de búsqueda difusa:', fallbackError);
        throw error; // Propagar el error original
      }
    }
  },

  // Método fallback para búsqueda difusa usando regex
  async busquedaRegexBasica(termino, campos = ["titulo", "autor_nombre_completo"], limite = 20) {
    // Normalizar término (quitar acentos)
    const normalizarTexto = (texto) => {
      if (!texto) return '';
      return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    };
    
    const terminoNormalizado = normalizarTexto(termino);
    
    // Escapar caracteres especiales para regex
    const escaparRegex = (texto) => {
      return texto.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };
    
    const terminoRegex = escaparRegex(terminoNormalizado);
    
    // Asegurar que campos sea un array
    const camposArray = Array.isArray(campos) 
      ? campos 
      : typeof campos === 'string'
        ? campos.split(',').map(c => c.trim())
        : ["titulo", "autor_nombre_completo"];
    
    // Crear condiciones para cada campo
    const condiciones = camposArray.map(campo => ({
      [campo]: { $regex: terminoRegex, $options: 'i' }
    }));
    
    // Construir query
    const query = { 
      activo: true,
      $or: condiciones
    };
    
    // Ejecutar consulta
    return await Libro.find(query).limit(limite);
  },

  // Método para búsqueda por sinónimos (útil para términos relacionados)
  async busquedaConSinonimos(termino, sinonimos = [], limite = 20) {
    try {
      // Si no hay término o sinónimos, retornar array vacío
      if ((!termino || termino.trim() === '') && (!sinonimos || sinonimos.length === 0)) {
        return [];
      }

      // Construir array de términos incluyendo el original y sus sinónimos
      const terminos = [termino, ...sinonimos].filter(t => t && t.trim() !== '');

      const pipeline = [
        {
          $search: {
            index: "libro_search_index",
            compound: {
              should: terminos.map(t => ({
                text: {
                  query: t,
                  path: ["titulo", "autor_nombre_completo", "genero", "descripcion", "palabras_clave"],
                  fuzzy: {
                    maxEdits: 1
                  }
                }
              })),
              minimumShouldMatch: 1
            }
          }
        },
        {
          $match: { activo: true }
        },
        {
          $sort: { score: { $meta: "searchScore" } }
        },
        {
          $limit: limite
        }
      ];

      return await Libro.aggregate(pipeline);
    } catch (error) {
      console.error('Error en búsqueda con sinónimos:', error);
      throw error;
    }
  },

  /**
   * Registrar interacción con un libro desde una búsqueda
   * @param {String} idBusqueda - ID de la búsqueda
   * @param {String} idLibro - ID del libro visualizado
   * @returns {Promise<Object>} Registro de búsqueda actualizado
   */
  async registrarInteraccionBusqueda(idBusqueda, idLibro) {
    try {
      console.log(`Registrando interacción: Búsqueda ${idBusqueda}, Libro ${idLibro}`);
      
      const busqueda = await Busqueda.findById(idBusqueda);
      
      if (!busqueda) {
        throw new Error(`Búsqueda no encontrada con ID: ${idBusqueda}`);
      }
      
      await busqueda.agregarLibroVisto(idLibro);
      console.log('Interacción registrada correctamente');
      
      return busqueda;
    } catch (error) {
      console.error('Error registrando interacción de búsqueda:', error);
      throw error;
    }
  },

  /**
   * Obtener libros recomendados para un usuario
   * @param {String} idUsuario - ID del usuario
   * @param {Number} limite - Cantidad máxima de recomendaciones
   * @returns {Promise<Array>} Lista de libros recomendados
   */
  async obtenerRecomendaciones(idUsuario, limite = 5) {
    try {
      console.log(`Obteniendo recomendaciones para usuario ${idUsuario}`);
      
      // Obtener búsquedas recientes del usuario
      const busquedasRecientes = await Busqueda.busquedasRecientesUsuario(idUsuario, 10);
      
      // Extraer términos más frecuentes
      const terminosFrecuentes = {};
      busquedasRecientes.forEach(busqueda => {
        if (busqueda.termino && busqueda.termino.trim() !== '') {
          const termino = busqueda.termino.toLowerCase().trim();
          if (!terminosFrecuentes[termino]) {
            terminosFrecuentes[termino] = 0;
          }
          terminosFrecuentes[termino]++;
        }
      });
      
      // Ordenar términos por frecuencia
      const terminosOrdenados = Object.entries(terminosFrecuentes)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])
        .slice(0, 3); // Tomar los 3 términos más frecuentes
      
      console.log('Términos frecuentes de búsqueda:', terminosOrdenados);
      
      // Obtener libros ya vistos por el usuario (para excluirlos)
      const librosVistos = [];
      busquedasRecientes.forEach(busqueda => {
        if (busqueda.interaccion && busqueda.interaccion.libros_vistos) {
          librosVistos.push(...busqueda.interaccion.libros_vistos);
        }
      });
      
      // ESTRATEGIA 1: Recomendaciones basadas en calificaciones
      console.log('Buscando recomendaciones por calificaciones...');
      const recomendacionesPorCalificacion = await Libro.find({ 
        activo: true,
        stock: { $gt: 0 },
        'calificaciones.cantidad': { $gt: 0 },
        'calificaciones.promedio': { $gte: 4.0 }
      })
      .sort({ 'calificaciones.promedio': -1 })
      .limit(limite);
      
      if (recomendacionesPorCalificacion.length > 0) {
        console.log(`Encontradas ${recomendacionesPorCalificacion.length} recomendaciones por calificación`);
        return await this._agregarStockConsolidadoALibros(recomendacionesPorCalificacion);
      }
      
      // ESTRATEGIA 2: Recomendaciones basadas en términos de búsqueda
      if (terminosOrdenados.length > 0) {
        console.log('Buscando recomendaciones por términos frecuentes...');
        // Construir query para búsqueda por términos
        const query = {
          activo: true,
          stock: { $gt: 0 }
        };
        
        // Excluir libros ya vistos si hay alguno
        if (librosVistos.length > 0) {
          query._id = { $nin: librosVistos };
        }
        
        // Crear condiciones para búsqueda por términos
        const orConditions = [];
        terminosOrdenados.forEach(termino => {
          orConditions.push(
            { titulo: { $regex: termino, $options: 'i' } },
            { autor_nombre_completo: { $regex: termino, $options: 'i' } },
            { genero: { $regex: termino, $options: 'i' } },
            { descripcion: { $regex: termino, $options: 'i' } }
          );
        });
        
        if (orConditions.length > 0) {
          query.$or = orConditions;
        }
        
        // Buscar libros relacionados con términos frecuentes
        const recomendaciones = await Libro.find(query)
          .sort({ fecha_registro: -1 })
          .limit(limite);
        
        if (recomendaciones.length > 0) {
          console.log(`Encontradas ${recomendaciones.length} recomendaciones por términos`);
          return await this._agregarStockConsolidadoALibros(recomendaciones);
        }
      }
      
      // ESTRATEGIA 3: Recomendaciones por libros con descuento
      console.log('Buscando recomendaciones por descuento...');
      const librosConDescuento = await Libro.obtenerLibrosConDescuento()
        .limit(limite);
      
      if (librosConDescuento.length > 0) {
        console.log(`Encontradas ${librosConDescuento.length} recomendaciones con descuento`);
        return await this._agregarStockConsolidadoALibros(librosConDescuento);
      }
      
      // ESTRATEGIA 4: Como último recurso, mostrar libros recientes
      console.log('Mostrando libros recientes como recomendación...');
      return await Libro.find({ 
        activo: true, 
        stock: { $gt: 0 } 
      })
      .sort({ fecha_registro: -1 })
      .limit(limite);
      
    } catch (error) {
      console.error('Error obteniendo recomendaciones:', error);
      // Si hay error, devolver libros recientes como fallback
      try {
        let librosF = await Libro.find({ 
          activo: true, 
          stock: { $gt: 0 } 
        })
        .sort({ fecha_registro: -1 })
        .limit(limite);
        return await this._agregarStockConsolidadoALibros(librosF);
      } catch (err) {
        console.error('Error en fallback de recomendaciones:', err);
        return []; // Devolver array vacío en caso de error completo
      }
    }
  },

  /**
 * Método auxiliar para agregar stock consolidado a cualquier array de libros
 */
  async _agregarStockConsolidadoALibros(libros) {
    if (!Array.isArray(libros) || libros.length === 0) {
      return libros;
    }
    
    return await Promise.all(
      libros.map(async (libro) => {
        try {
          const stockConsolidado = await this._obtenerStockConsolidado(libro._id);
          const libroObj = typeof libro.toObject === 'function' ? libro.toObject() : libro;
          
          // Sobrescribir con valores REALES del inventario
          libroObj.stock = stockConsolidado.stock_total;
          libroObj.stock_disponible = stockConsolidado.stock_disponible;
          libroObj.stock_reservado = stockConsolidado.stock_reservado;
          libroObj.tiendas_con_stock = stockConsolidado.tiendas_con_stock;
          libroObj.stock_consolidado = stockConsolidado;
          
          return libroObj;
        } catch (error) {
          console.error(`Error obteniendo stock para libro ${libro._id}:`, error);
          // Devolver libro sin modificar si hay error
          return typeof libro.toObject === 'function' ? libro.toObject() : libro;
        }
      })
    );
  },

  /**
   * Obtener libros con descuento activo
   * @param {Number} limite - Cantidad máxima de resultados
   * @returns {Promise<Array>} Lista de libros con descuento
   */
  async obtenerLibrosConDescuento(limite = 20) {
    try {
      console.log(`Obteniendo hasta ${limite} libros con descuento`);
      
      const libros = await Libro.obtenerLibrosConDescuento()
        .limit(limite);
      
      // CORREGIDO: Agregar stock consolidado a cada libro
      const librosConStockReal = await Promise.all(
        libros.map(async (libro) => {
          const stockConsolidado = await this._obtenerStockConsolidado(libro._id);
          const libroObj = libro.toObject();
          
          // Sobrescribir con valores REALES del inventario
          libroObj.stock = stockConsolidado.stock_total;
          libroObj.stock_disponible = stockConsolidado.stock_disponible;
          libroObj.stock_reservado = stockConsolidado.stock_reservado;
          libroObj.tiendas_con_stock = stockConsolidado.tiendas_con_stock;
          libroObj.stock_consolidado = stockConsolidado;
          
          return libroObj;
        })
      );
      
      console.log(`Libros con descuento encontrados: ${librosConStockReal.length}`);
      return librosConStockReal;
    } catch (error) {
      console.error('Error obteniendo libros con descuento:', error);
      throw error;
    }
  },

  /**
   * Obtener libros destacados (mejor calificados)
   * @param {Number} limite - Cantidad máxima de resultados
   * @returns {Promise<Array>} Lista de libros destacados
   */
  async obtenerLibrosDestacados(limite = 10) {
    try {
      console.log(`Obteniendo hasta ${limite} libros destacados`);
      
      const libros = await Libro.obtenerLibrosDestacados(limite);
      
      // CORREGIDO: Agregar stock consolidado a cada libro
      const librosConStockReal = await Promise.all(
        libros.map(async (libro) => {
          const stockConsolidado = await this._obtenerStockConsolidado(libro._id);
          const libroObj = libro.toObject();
          
          // Sobrescribir con valores REALES del inventario
          libroObj.stock = stockConsolidado.stock_total;
          libroObj.stock_disponible = stockConsolidado.stock_disponible;
          libroObj.stock_reservado = stockConsolidado.stock_reservado;
          libroObj.tiendas_con_stock = stockConsolidado.tiendas_con_stock;
          libroObj.stock_consolidado = stockConsolidado;
          
          return libroObj;
        })
      );
      
      console.log(`Libros destacados encontrados: ${librosConStockReal.length}`);
      return librosConStockReal;
    } catch (error) {
      console.error('Error obteniendo libros destacados:', error);
      throw error;
    }
  },

  /**
   * Actualizar calificación de un libro
   * @param {String} idLibro - ID del libro
   * @param {Number} calificacion - Valor de la calificación (1-5)
   * @returns {Promise<Object>} Libro actualizado
   */
  async actualizarCalificacion(idLibro, calificacion) {
    try {
      console.log(`Calificando libro ${idLibro} con ${calificacion} estrellas`);
      
      const libroActualizado = await Libro.agregarCalificacion(idLibro, calificacion);
      
      if (!libroActualizado) {
        throw new Error(`No se pudo actualizar la calificación del libro ${idLibro}`);
      }
      
      console.log('Calificación actualizada correctamente');
      return libroActualizado.toObject();
    } catch (error) {
      console.error('Error actualizando calificación:', error);
      throw error;
    }
  },

  /**
   * Buscar libros por texto
   * @param {String} texto - Texto a buscar
   * @param {Number} limite - Cantidad máxima de resultados
   * @returns {Promise<Array>} Lista de libros encontrados
   */
  async buscarPorTexto(texto, limite = 20) {
    try {
      console.log(`Buscando libros con texto "${texto}"`);
      
      const libros = await Libro.buscarPorTexto(texto, limite);
      
      console.log(`Libros encontrados: ${libros.length}`);
      return libros.map(l => l.toObject());
    } catch (error) {
      console.error('Error buscando libros por texto:', error);
      throw error;
    }
  },

  /**
   * Marcar un libro como histórico agotado
   * @param {String} idLibro - ID del libro
   * @returns {Promise<Object>} Libro actualizado
   */
  async marcarComoHistoricoAgotado(idLibro) {
    try {
      console.log(`Marcando libro ${idLibro} como histórico agotado`);
      
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Actualizar libro
        const libroActualizado = await Libro.marcarComoHistoricoAgotado(idLibro)
          .session(session);
        
        if (!libroActualizado) {
          throw new Error(`Libro no encontrado con ID: ${idLibro}`);
        }

        // Actualizar inventario
        const inventario = await Inventario.findOne({ id_libro: idLibro })
          .session(session);
        
        if (inventario) {
          inventario.estado = 'historico_agotado';
          await inventario.save({ session });
          console.log('Inventario actualizado a histórico agotado');
        } else {
          console.log('No se encontró inventario para este libro');
        }

        await session.commitTransaction();
        session.endSession();
        
        console.log('Libro marcado como histórico agotado correctamente');
        return libroActualizado.toObject();
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error marcando libro como histórico:', error);
      throw error;
    }
  },

  /**
   * Agregar un ejemplar a un libro
   * @param {String} idLibro - ID del libro
   * @param {Object} ejemplarData - Datos del ejemplar
   * @returns {Promise<Object>} Libro actualizado
   */
  async agregarEjemplar(idLibro, ejemplarData) {
    try {
      console.log(`Agregando ejemplar al libro ${idLibro}:`, JSON.stringify(ejemplarData, null, 2));
      
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verificar si el libro existe
        let libro;
        if (mongoose.Types.ObjectId.isValid(idLibro)) {
          libro = await Libro.findById(idLibro).session(session);
        } else {
          libro = await Libro.findOne({ id_libro: idLibro }).session(session);
        }

        if (!libro) {
          throw new Error(`Libro no encontrado con ID: ${idLibro}`);
        }

        // Verificar si el código ya existe
        const codigoExiste = await Libro.verificarCodigoEjemplar(ejemplarData.codigo);
        if (codigoExiste) {
          throw new Error(`Ya existe un ejemplar con el código ${ejemplarData.codigo}`);
        }

        // Agregar el ejemplar
        await libro.agregarEjemplar(
          ejemplarData.codigo,
          ejemplarData.estado_fisico || 'excelente',
          ejemplarData.ubicacion || ''
        );
        console.log('Ejemplar agregado al libro');

        // Actualizar inventario
        const inventario = await Inventario.findOne({ id_libro: libro._id })
          .session(session);
        
        if (inventario) {
          await inventario.registrarEntrada(
            1, // Un ejemplar
            'inventario_inicial',
            null, // ID usuario
            `Registro manual de ejemplar: ${ejemplarData.codigo}`
          );
          console.log('Inventario actualizado');
        } else {
          // Crear inventario si no existe
          const nuevoInventario = new Inventario({
            id_libro: libro._id,
            stock_total: 1,
            stock_disponible: 1
          });
          await nuevoInventario.save({ session });
          console.log('Creado nuevo inventario para el libro');
        }

        await session.commitTransaction();
        session.endSession();
        
        console.log('Ejemplar agregado correctamente');
        return libro.toObject();
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error agregando ejemplar:', error);
      throw error;
    }
  },

  /**
   * Actualizar un ejemplar específico
   * @param {String} idLibro - ID del libro
   * @param {String} codigo - Código del ejemplar
   * @param {Object} datosActualizados - Nuevos datos del ejemplar
   * @returns {Promise<Object>} Libro actualizado
   */
  async actualizarEjemplar(idLibro, codigo, datosActualizados) {
    try {
      console.log(`Actualizando ejemplar ${codigo} del libro ${idLibro}:`, 
                  JSON.stringify(datosActualizados, null, 2));
      
      // Iniciar sesión de transacción
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Buscar el libro
        let libro;
        if (mongoose.Types.ObjectId.isValid(idLibro)) {
          libro = await Libro.findById(idLibro).session(session);
        } else {
          libro = await Libro.findOne({ id_libro: idLibro }).session(session);
        }

        if (!libro) {
          throw new Error(`Libro no encontrado con ID: ${idLibro}`);
        }

        // Encontrar el ejemplar
        const ejemplarIndex = libro.ejemplares.findIndex(e => e.codigo === codigo);
        if (ejemplarIndex === -1) {
          throw new Error(`Ejemplar con código ${codigo} no encontrado`);
        }

        // Actualizar los campos del ejemplar
        if (datosActualizados.estado_fisico) {
          libro.ejemplares[ejemplarIndex].estado_fisico = datosActualizados.estado_fisico;
        }
        
        if (datosActualizados.ubicacion !== undefined) {
          libro.ejemplares[ejemplarIndex].ubicacion = datosActualizados.ubicacion;
        }
        
        if (datosActualizados.disponible !== undefined) {
          const estadoAnterior = libro.ejemplares[ejemplarIndex].disponible;
          libro.ejemplares[ejemplarIndex].disponible = datosActualizados.disponible;
          
          // Si cambió disponibilidad, actualizar inventario
          if (estadoAnterior !== datosActualizados.disponible) {
            const inventario = await Inventario.findOne({ id_libro: libro._id }).session(session);
            if (inventario) {
              if (datosActualizados.disponible) {
                // Liberar reserva
                await inventario.liberarReserva(
                  1, // Un ejemplar
                  null, // ID usuario
                  null, // ID reserva
                  `Actualización manual de disponibilidad: ${codigo}`
                );
                console.log('Ejemplar marcado como disponible en inventario');
              } else {
                // Reservar ejemplar
                await inventario.reservarEjemplares(
                  1, // Un ejemplar
                  null, // ID usuario
                  null, // ID reserva
                  `Actualización manual de disponibilidad: ${codigo}`
                );
                console.log('Ejemplar marcado como no disponible en inventario');
              }
            }
          }
        }

        libro.markModified('ejemplares');
        await libro.save({ session });
        
        await session.commitTransaction();
        session.endSession();
        
        console.log('Ejemplar actualizado correctamente');
        return libro.toObject();
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error actualizando ejemplar:', error);
      throw error;
    }
  },

  /**
   * Eliminar un ejemplar específico
   * @param {String} idLibro - ID del libro
   * @param {String} codigo - Código del ejemplar
   * @returns {Promise<Object>} Libro actualizado
   */
  async eliminarEjemplar(idLibro, codigo) {
    try {
      console.log(`Eliminando ejemplar ${codigo} del libro ${idLibro}`);
      
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Buscar el libro
        let libro;
        if (mongoose.Types.ObjectId.isValid(idLibro)) {
          libro = await Libro.findById(idLibro).session(session);
        } else {
          libro = await Libro.findOne({ id_libro: idLibro }).session(session);
        }

        if (!libro) {
          throw new Error(`Libro no encontrado con ID: ${idLibro}`);
        }

        // Encontrar el ejemplar
        const ejemplarIndex = libro.ejemplares.findIndex(e => e.codigo === codigo);
        if (ejemplarIndex === -1) {
          throw new Error(`Ejemplar con código ${codigo} no encontrado`);
        }

        // Verificar si el ejemplar estaba disponible
        const estabaDisponible = libro.ejemplares[ejemplarIndex].disponible;

        // Eliminar el ejemplar
        libro.ejemplares.splice(ejemplarIndex, 1);
        libro.stock = libro.ejemplares.length;
        libro.markModified('ejemplares');
        await libro.save({ session });
        console.log('Ejemplar eliminado de libro');

        // Actualizar inventario
        if (estabaDisponible) {
          const inventario = await Inventario.findOne({ id_libro: libro._id })
            .session(session);
          
          if (inventario) {
            await inventario.registrarSalida(
              1, // Un ejemplar
              'baja',
              null, // ID usuario
              null, // ID transacción
              `Eliminación manual de ejemplar: ${codigo}`
            );
            console.log('Inventario actualizado');
          }
        }

        await session.commitTransaction();
        session.endSession();
        
        console.log('Ejemplar eliminado correctamente');
        return libro.toObject();
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error eliminando ejemplar:', error);
      throw error;
    }
  },

  /**
   * Agregar un descuento a un libro
   * @param {String} idLibro - ID del libro
   * @param {Object} descuentoData - Datos del descuento
   * @returns {Promise<Object>} Libro actualizado
   */
  async agregarDescuento(idLibro, descuentoData) {
    try {
      console.log(`Agregando descuento al libro ${idLibro}:`, JSON.stringify(descuentoData, null, 2));
      
      // Buscar el libro
      let libro;
      if (mongoose.Types.ObjectId.isValid(idLibro)) {
        libro = await Libro.findById(idLibro);
      } else {
        libro = await Libro.findOne({ id_libro: idLibro });
      }

      if (!libro) {
        throw new Error(`Libro no encontrado con ID: ${idLibro}`);
      }

      // Validar datos del descuento
      if (!descuentoData.tipo || !descuentoData.valor) {
        throw new Error('El tipo y valor del descuento son obligatorios');
      }

      if (!['porcentaje', 'valor_fijo', 'promocion_2x1', 'bundle'].includes(descuentoData.tipo)) {
        throw new Error('Tipo de descuento no válido');
      }

      // Agregar el descuento
      await libro.agregarDescuento(
        descuentoData.tipo,
        descuentoData.valor,
        descuentoData.fecha_inicio,
        descuentoData.fecha_fin,
        descuentoData.codigo_promocion || ''
      );
      
      console.log('Descuento agregado correctamente');
      return libro.toObject();
    } catch (error) {
      console.error('Error agregando descuento:', error);
      throw error;
    }
  },

  /**
   * Desactivar todos los descuentos de un libro
   * @param {String} idLibro - ID del libro
   * @returns {Promise<Object>} Libro actualizado
   */
  async desactivarDescuentos(idLibro) {
    try {
      console.log(`Desactivando descuentos del libro ${idLibro}`);
      
      const libroActualizado = await Libro.desactivarDescuentos(idLibro);
      
      if (!libroActualizado) {
        throw new Error(`Libro no encontrado con ID: ${idLibro}`);
      }
      
      console.log('Descuentos desactivados correctamente');
      return libroActualizado.toObject();
    } catch (error) {
      console.error('Error desactivando descuentos:', error);
      throw error;
    }
  },

  /**
   * Verificar si un código de ejemplar ya existe
   * @param {String} codigo - Código a verificar
   * @returns {Promise<Boolean>} True si el código ya existe
   */
  async verificarCodigoEjemplar(codigo) {
    try {
      console.log(`Verificando si existe el código de ejemplar: ${codigo}`);
      
      const existe = await Libro.verificarCodigoEjemplar(codigo);
      
      console.log(`Código ${codigo} existe: ${existe ? 'Sí' : 'No'}`);
      return existe;
    } catch (error) {
      console.error('Error verificando código de ejemplar:', error);
      throw error;
    }
  },

  /**
   * Subir y agregar una imagen a un libro
   * @param {String} idLibro - ID del libro
   * @param {Object} archivo - Archivo de imagen
   * @param {Object} metadatos - Metadatos de la imagen
   * @returns {Promise<Object>} Libro actualizado
   */
  async agregarImagenLibro(idLibro, archivo, metadatos) {
    try {
      console.log('Agregando imagen al libro:', idLibro);
      console.log('Archivo recibido:', archivo ? {
        filename: archivo.filename,
        originalname: archivo.originalname,
        mimetype: archivo.mimetype,
        size: archivo.size,
        path: archivo.path,
        url: archivo.url
      } : 'No hay archivo');
      
      // Buscar el libro
      let libro;
      if (mongoose.Types.ObjectId.isValid(idLibro)) {
        libro = await Libro.findById(idLibro);
      } else {
        libro = await Libro.findOne({ id_libro: idLibro });
      }

      if (!libro) {
        throw new Error(`Libro no encontrado con ID: ${idLibro}`);
      }

      console.log('Libro encontrado:', libro._id.toString());

      // Verificar que la imagen existe
      if (!archivo || (!archivo.filename && !archivo.path)) {
        throw new Error('No se recibió un archivo de imagen válido');
      }

      // URL para acceder a la imagen
      const baseUrl = process.env.BASE_URL || 'https://librosfera.onrender.com/';
      const urlImagen = archivo.url || `${baseUrl}/uploads/libros/${archivo.filename}`;
      
      console.log('URL de la imagen:', urlImagen);
      
      // Inicializar arreglo de imágenes si no existe
      if (!libro.imagenes) {
        libro.imagenes = [];
      }
      
      // Verificar si el orden ya está asignado a otra imagen
      const ordenYaAsignado = libro.imagenes.find(img => img.orden === metadatos.orden);
      
      // Preparar datos de la imagen
      const imagenData = {
        url: urlImagen,
        nombre_archivo: archivo.filename,
        tipo: metadatos.tipo || 'detalle',
        orden: metadatos.orden,
        alt_text: metadatos.alt_text || libro.titulo,
        fecha_subida: new Date(),
        activa: true
      };
      
      console.log('Datos de imagen a guardar:', imagenData);
      
      // Si el orden ya está asignado, necesitamos reordenar
      if (ordenYaAsignado) {
        console.log(`Orden ${imagenData.orden} ya asignado, reordenando imágenes...`);
        
        // Si es orden 0 (portada) o 1 (contraportada), desplazar la imagen existente
        if (imagenData.orden === 0 || imagenData.orden === 1) {
          // Actualizar tipos según el orden
          imagenData.tipo = imagenData.orden === 0 ? 'portada' : 'contraportada';
          
          // Desplazar todas las imágenes con orden >= al nuevo
          libro.imagenes.forEach(img => {
            if (img.orden >= imagenData.orden) {
              img.orden += 1;
              
              // Actualizar tipo según el nuevo orden
              if (img.orden === 1) {
                img.tipo = 'contraportada';
              } else if (img.orden > 1 && img.tipo === 'portada') {
                img.tipo = 'detalle';
              }
            }
          });
        }
      }
      
      // Agregar la nueva imagen
      libro.imagenes.push(imagenData);
      
      // Ordenar imágenes por orden
      libro.imagenes.sort((a, b) => a.orden - b.orden);
      
      libro.markModified('imagenes');
      
      // Si es la primera imagen y no hay portada en legacy, hacerla portada
      if (libro.imagenes.length === 1 && (!libro.imagenes_legacy || !libro.imagenes_legacy.portada)) {
        if (!libro.imagenes_legacy) {
          libro.imagenes_legacy = { adicionales: [] };
        }
        libro.imagenes_legacy.portada = urlImagen;
        libro.markModified('imagenes_legacy');
      }
      
      // Guardar el libro
      await libro.save();
      
      console.log('Imagen agregada correctamente');
      return libro.toObject();
    } catch (error) {
      console.error('Error agregando imagen al libro:', error);
      throw error;
    }
  },

  /**
   * Actualizar orden de imágenes
   * @param {String} idLibro - ID del libro
   * @param {Array} ordenesNuevos - Array de {id_imagen, orden_nuevo}
   * @returns {Promise<Object>} Libro actualizado
   */
  async actualizarOrdenImagenes(idLibro, ordenesNuevos) {
    try {
      console.log(`Actualizando orden de imágenes del libro ${idLibro}:`, JSON.stringify(ordenesNuevos, null, 2));
      
      // Buscar el libro
      let libro;
      if (mongoose.Types.ObjectId.isValid(idLibro)) {
        libro = await Libro.findById(idLibro);
      } else {
        libro = await Libro.findOne({ id_libro: idLibro });
      }
  
      if (!libro) {
        throw new Error(`Libro no encontrado con ID: ${idLibro}`);
      }
  
      if (!libro.imagenes || libro.imagenes.length === 0) {
        throw new Error('El libro no tiene imágenes para reordenar');
      }
  
      // Crear un mapa temporal de las imágenes actuales para fácil referencia
      const imagenesMap = new Map();
      libro.imagenes.forEach(img => {
        imagenesMap.set(img._id.toString(), {
          id: img._id.toString(),
          ordenActual: img.orden,
          tipoActual: img.tipo
        });
      });
  
      // Primero, verificar si hay cambios que afecten a las posiciones 0 y 1
      // que requieren tratamiento especial
      let cambioEnPortada = false;
      let cambioEnContraportada = false;
      let nuevaPortadaId = null;
      let nuevaContraportadaId = null;
  
      ordenesNuevos.forEach(item => {
        if (item.orden_nuevo === 0) {
          cambioEnPortada = true;
          nuevaPortadaId = item.id_imagen;
        }
        if (item.orden_nuevo === 1) {
          cambioEnContraportada = true;
          nuevaContraportadaId = item.id_imagen;
        }
      });
  
      // Crear un mapa de órdenes para detectar conflictos
      const ordenesAsignados = new Map();
      
      // Crear un mapa para registrar los cambios a realizar
      const cambios = [];
  
      // Procesar cada cambio de orden
      ordenesNuevos.forEach(item => {
        const imagen = libro.imagenes.id(item.id_imagen);
        
        if (!imagen) {
          // Intentar buscar por otros medios si el ID directo falla
          const imagenIndex = libro.imagenes.findIndex(img => 
            (img._id && img._id.toString() === item.id_imagen) || 
            img.url.includes(item.id_imagen)
          );
          
          if (imagenIndex !== -1) {
            const imagenActual = libro.imagenes[imagenIndex];
            cambios.push({
              imagen: imagenActual,
              ordenNuevo: item.orden_nuevo,
              tipoNuevo: item.tipo_nuevo,
              index: imagenIndex
            });
            
            // Registrar el orden asignado
            if (ordenesAsignados.has(item.orden_nuevo)) {
              ordenesAsignados.set(item.orden_nuevo, [...ordenesAsignados.get(item.orden_nuevo), imagenIndex]);
            } else {
              ordenesAsignados.set(item.orden_nuevo, [imagenIndex]);
            }
          }
        } else {
          cambios.push({
            imagen: imagen,
            ordenNuevo: item.orden_nuevo,
            tipoNuevo: item.tipo_nuevo,
            index: libro.imagenes.indexOf(imagen)
          });
          
          // Registrar el orden asignado
          if (ordenesAsignados.has(item.orden_nuevo)) {
            ordenesAsignados.set(item.orden_nuevo, [...ordenesAsignados.get(item.orden_nuevo), libro.imagenes.indexOf(imagen)]);
          } else {
            ordenesAsignados.set(item.orden_nuevo, [libro.imagenes.indexOf(imagen)]);
          }
        }
      });
  
      // Detectar conflictos de orden (más de una imagen con el mismo orden)
      ordenesAsignados.forEach((indices, orden) => {
        if (indices.length > 1) {
          console.log(`Conflicto detectado: ${indices.length} imágenes asignadas al orden ${orden}`);
          
          // Resolver conflicto incrementando el orden para todas excepto la primera
          for (let i = 1; i < indices.length; i++) {
            let nuevoOrden = orden + i;
            
            // Buscar el siguiente orden disponible
            while (ordenesAsignados.has(nuevoOrden)) {
              nuevoOrden++;
            }
            
            const cambioConflicto = cambios.find(c => c.index === indices[i]);
            if (cambioConflicto) {
              console.log(`Resolviendo conflicto: Imagen en índice ${indices[i]} movida de orden ${orden} a ${nuevoOrden}`);
              cambioConflicto.ordenNuevo = nuevoOrden;
              ordenesAsignados.set(nuevoOrden, [indices[i]]);
            }
          }
        }
      });
  
      // Aplicar cambios, asegurando que el tipo coincida con el orden
      cambios.forEach(cambio => {
        // Determinar el tipo basado en el orden, si no se especificó uno nuevo
        let tipoFinal = cambio.tipoNuevo;
        
        if (!tipoFinal) {
          if (cambio.ordenNuevo === 0) {
            tipoFinal = 'portada';
          } else if (cambio.ordenNuevo === 1) {
            tipoFinal = 'contraportada';
          } else if (cambio.ordenNuevo > 1) {
            // Mantener 'contenido' si ya lo era, de lo contrario usar 'detalle'
            tipoFinal = cambio.imagen.tipo === 'contenido' ? 'contenido' : 'detalle';
          }
        } else {
          // Asegurar coherencia entre tipo y orden
          if (cambio.ordenNuevo === 0 && tipoFinal !== 'portada') {
            console.log(`Ajustando tipo: se especificó '${tipoFinal}' para orden 0, usando 'portada'`);
            tipoFinal = 'portada';
          } else if (cambio.ordenNuevo === 1 && tipoFinal !== 'contraportada') {
            console.log(`Ajustando tipo: se especificó '${tipoFinal}' para orden 1, usando 'contraportada'`);
            tipoFinal = 'contraportada';
          }
        }
        
        // Aplicar cambios
        cambio.imagen.orden = cambio.ordenNuevo;
        cambio.imagen.tipo = tipoFinal;
      });
  
      // Ordenar imágenes por orden
      libro.imagenes.sort((a, b) => a.orden - b.orden);
      
      // Verificar que hay una portada (orden 0) y contraportada (orden 1)
      if (libro.imagenes.length > 0 && libro.imagenes[0].orden !== 0) {
        console.log('No se encontró portada (orden 0), asignando la primera imagen');
        libro.imagenes[0].orden = 0;
        libro.imagenes[0].tipo = 'portada';
      }
      
      if (libro.imagenes.length > 1 && libro.imagenes[1].orden !== 1) {
        console.log('No se encontró contraportada (orden 1), asignando la segunda imagen');
        libro.imagenes[1].orden = 1;
        libro.imagenes[1].tipo = 'contraportada';
      }
      
      // Asegurar orden consecutivo sin huecos
      for (let i = 0; i < libro.imagenes.length; i++) {
        libro.imagenes[i].orden = i;
        
        // Asegurar coherencia tipo-orden
        if (i === 0) {
          libro.imagenes[i].tipo = 'portada';
        } else if (i === 1) {
          libro.imagenes[i].tipo = 'contraportada';
        } else if (libro.imagenes[i].tipo !== 'contenido') {
          libro.imagenes[i].tipo = 'detalle';
        }
      }
      
      libro.markModified('imagenes');
      await libro.save();
      
      console.log('Orden de imágenes actualizado correctamente');
      return libro.toObject();
    } catch (error) {
      console.error('Error actualizando orden de imágenes:', error);
      throw error;
    }
  },

  /**
   * Eliminar una imagen de un libro
   * @param {String} idLibro - ID del libro
   * @param {String} idImagen - ID de la imagen
   * @returns {Promise<Object>} Libro actualizado
   */
  async eliminarImagenLibro(idLibro, idImagen) {
    try {
      console.log(`Eliminando imagen ${idImagen} del libro ${idLibro}`);
      
      // Buscar el libro
      let libro;
      if (mongoose.Types.ObjectId.isValid(idLibro)) {
        libro = await Libro.findById(idLibro);
      } else {
        libro = await Libro.findOne({ id_libro: idLibro });
      }
  
      if (!libro) {
        throw new Error(`Libro no encontrado con ID: ${idLibro}`);
      }
  
      // Si el libro no tiene imágenes
      if (!libro.imagenes || libro.imagenes.length === 0) {
        throw new Error(`El libro no tiene imágenes para eliminar`);
      }
  
      // Intentamos distintas estrategias para encontrar la imagen
      let imagenAEliminar = null;
      let imagenIndex = -1;
      
      // 1. Buscar imagen por ID exacto (si es un ObjectID válido)
      if (mongoose.Types.ObjectId.isValid(idImagen)) {
        // Intentamos encontrar directamente por id
        imagenIndex = libro.imagenes.findIndex(img => 
          img._id && img._id.toString() === idImagen
        );
        
        if (imagenIndex >= 0) {
          imagenAEliminar = libro.imagenes[imagenIndex];
        }
      }
      
      // 2. Si no encontramos por ID, intentar por posición o atributos
      if (imagenIndex === -1) {
        // Si idImagen es un número, buscar por índice
        const posicion = parseInt(idImagen);
        if (!isNaN(posicion) && posicion >= 0 && posicion < libro.imagenes.length) {
          imagenIndex = posicion;
          imagenAEliminar = libro.imagenes[imagenIndex];
        } else {
          // 3. Buscar por tipo o nombre de archivo
          imagenIndex = libro.imagenes.findIndex(img => 
            (img.tipo === 'portada' && idImagen.includes('portada')) ||
            (img.tipo === 'contraportada' && idImagen.includes('contraportada')) ||
            (img.nombre_archivo && img.nombre_archivo.includes(idImagen))
          );
          
          if (imagenIndex >= 0) {
            imagenAEliminar = libro.imagenes[imagenIndex];
          }
        }
      }
      
      // 4. Último recurso: simplemente eliminar la primera imagen
      if (imagenIndex === -1 && libro.imagenes.length > 0) {
        imagenIndex = 0;
        imagenAEliminar = libro.imagenes[0];
        console.log("No se encontró la imagen específica, eliminando la primera imagen disponible.");
      }
      
      // Si aún así no se encuentra la imagen
      if (imagenIndex === -1) {
        console.log("Imágenes disponibles:", libro.imagenes.map(img => ({
          _id: img._id?.toString(),
          tipo: img.tipo,
          orden: img.orden,
          nombre_archivo: img.nombre_archivo
        })));
        throw new Error(`Imagen no encontrada con ID: ${idImagen}`);
      }
      
      // Guardar datos importantes antes de eliminar
      const ordenEliminado = libro.imagenes[imagenIndex].orden;
      const tipoEliminado = libro.imagenes[imagenIndex].tipo;
      const nombreArchivo = libro.imagenes[imagenIndex].nombre_archivo;
      
      // Eliminar la imagen utilizando splice
      libro.imagenes.splice(imagenIndex, 1);
      
      // Reordenar las imágenes restantes
      if (libro.imagenes.length > 0) {
        // Si se eliminó la portada o contraportada, promover otras imágenes
        if (ordenEliminado === 0 || ordenEliminado === 1) {
          // Actualizar órdenes y tipos
          libro.imagenes.forEach(img => {
            // Reducir orden de todas las imágenes con orden > ordenEliminado
            if (img.orden > ordenEliminado) {
              img.orden -= 1;
            }
            
            // Actualizar tipos según el nuevo orden
            if (img.orden === 0) {
              img.tipo = 'portada';
            } else if (img.orden === 1) {
              img.tipo = 'contraportada';
            }
          });
        } else {
          // Para otras imágenes, simplemente reducir el orden de las posteriores
          libro.imagenes.forEach(img => {
            if (img.orden > ordenEliminado) {
              img.orden -= 1;
            }
          });
        }
        
        // Ordenar imágenes por orden
        libro.imagenes.sort((a, b) => a.orden - b.orden);
      }
      
      libro.markModified('imagenes');
      await libro.save();
      
      // Eliminar archivo físico
      try {
        if (nombreArchivo) {
          const directorioImagenes = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads/libros');
          const rutaArchivo = path.join(directorioImagenes, nombreArchivo);
          await fs.unlink(rutaArchivo).catch(e => console.warn(`Aviso: ${e.message}`));
          console.log('Archivo físico eliminado');
        }
      } catch (err) {
        console.warn(`No se pudo eliminar el archivo físico: ${err.message}`);
        // Continuar incluso si no se puede eliminar el archivo físico
      }
      
      return libro;
    } catch (error) {
      console.error('Error eliminando imagen:', error);
      throw error;
    }
  },

  /**
   * Reservar stock de un libro para una compra
   * @param {String} idLibro - ID del libro
   * @param {Number} cantidad - Cantidad a reservar
   * @param {String} idUsuario - ID del usuario que realiza la reserva
   * @param {String} idReserva - ID de la reserva o carrito
   * @returns {Promise<Object>} Resultado de la operación
   */
  async reservarStock(idLibro, cantidad, idUsuario, idReserva) {
    try {
      console.log(`Reservando ${cantidad} unidades del libro ${idLibro}`);
      
      // Iniciar sesión de transacción para asegurar atomicidad
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verificar si el libro existe
        let libro;
        if (mongoose.Types.ObjectId.isValid(idLibro)) {
          libro = await Libro.findById(idLibro).session(session);
        } else {
          libro = await Libro.findOne({ id_libro: idLibro }).session(session);
        }

        if (!libro) {
          throw new Error(`Libro no encontrado con ID: ${idLibro}`);
        }

        // Verificar si hay suficiente stock disponible
        const inventario = await Inventario.findOne({ id_libro: libro._id })
          .session(session);
        
        if (!inventario) {
          throw new Error('Inventario no encontrado para este libro');
        }

        console.log(`Stock disponible: ${inventario.stock_disponible}, Solicitado: ${cantidad}`);
        
        if (inventario.stock_disponible < cantidad) {
          throw new Error(`Stock insuficiente. Disponible: ${inventario.stock_disponible}, Solicitado: ${cantidad}`);
        }

        // Determinar si idReserva es un ObjectId válido
        let reservaId = null; // Por defecto usamos null si no es un ObjectId válido
        
        // Reservar stock en el inventario
        await inventario.reservarEjemplares(
          cantidad,
          idUsuario,
          reservaId,
          `Reserva para compra ID: ${idReserva}`
        );

        await session.commitTransaction();
        session.endSession();
        
        console.log(`Reservados ${cantidad} ejemplares correctamente`);
        return {
          exito: true,
          mensaje: `${cantidad} ejemplar(es) reservado(s) exitosamente`,
          inventario: {
            stock_total: inventario.stock_total,
            stock_disponible: inventario.stock_disponible,
            stock_reservado: inventario.stock_reservado
          }
        };
      } catch (error) {
        console.error('Error reservando stock:', error);
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error reservando stock:', error);
      throw error;
    }
  },

  /**
   * Liberar stock reservado de un libro
   * @param {String} idLibro - ID del libro
   * @param {Number} cantidad - Cantidad a liberar
   * @param {String} idUsuario - ID del usuario
   * @param {String} idReserva - ID de la reserva o carrito
   * @returns {Promise<Object>} Resultado de la operación
   */
  async liberarStockReservado(idLibro, cantidad, idUsuario, idReserva) {
    try {
      console.log(`Liberando ${cantidad} unidades reservadas del libro ${idLibro}`);
      
      // Iniciar sesión de transacción
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verificar si el libro existe
        let libro;
        if (mongoose.Types.ObjectId.isValid(idLibro)) {
          libro = await Libro.findById(idLibro).session(session);
        } else {
          libro = await Libro.findOne({ id_libro: idLibro }).session(session);
        }

        if (!libro) {
          throw new Error(`Libro no encontrado con ID: ${idLibro}`);
        }

        // Liberar stock en el inventario
        const inventario = await Inventario.findOne({ id_libro: libro._id })
          .session(session);
        
        if (!inventario) {
          throw new Error('Inventario no encontrado para este libro');
        }

        // Verificar que haya suficiente stock reservado
        if (inventario.stock_reservado < cantidad) {
          throw new Error(`No hay suficiente stock reservado. Reservado: ${inventario.stock_reservado}, Solicitado: ${cantidad}`);
        }

        // Determinar si idReserva es un ObjectId válido
        let reservaId = null; // Por defecto usamos null si no es un ObjectId válido
  
        await inventario.liberarReserva(
          cantidad,
          idUsuario,
          reservaId,
          `Liberación de reserva ID: ${idReserva}`
        );

        await session.commitTransaction();
        session.endSession();
        
        console.log(`Liberados ${cantidad} ejemplares correctamente`);
        return {
          exito: true,
          mensaje: `${cantidad} ejemplar(es) liberado(s) exitosamente`,
          inventario: {
            stock_total: inventario.stock_total,
            stock_disponible: inventario.stock_disponible,
            stock_reservado: inventario.stock_reservado
          }
        };
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error liberando stock reservado:', error);
      throw error;
    }
  },

  /**
   * Obtener reporte de consistencia de inventarios
   * @returns {Promise<Object>} Reporte de consistencia
   */
  async obtenerReporteConsistencia() {
    try {
      console.log('Generando reporte de consistencia de inventarios');
      
      // Verificar consistencia general de inventarios
      const consistenciaInventarios = await Inventario.verificarConsistenciaGeneral();
      
      // Verificar libros con stock inconsistente
      const librosInconsistentes = [];
      const libros = await Libro.find({ activo: true }, '_id titulo stock');
      
      for (const libro of libros) {
        const stockConsolidado = await this._obtenerStockConsolidado(libro._id);
        
        if (libro.stock !== stockConsolidado.stock_total) {
          librosInconsistentes.push({
            id_libro: libro._id,
            titulo: libro.titulo,
            stock_libro: libro.stock,
            stock_consolidado: stockConsolidado.stock_total,
            diferencia: libro.stock - stockConsolidado.stock_total
          });
        }
      }
      
      // Verificar tiendas sin inventario
      const tiendasActivas = await TiendaFisica.find({ estado: 'activa' }, '_id nombre');
      const tiendasSinInventario = [];
      
      for (const tienda of tiendasActivas) {
        const inventarios = await Inventario.countDocuments({ id_tienda: tienda._id });
        
        if (inventarios === 0) {
          tiendasSinInventario.push({
            id_tienda: tienda._id,
            nombre: tienda.nombre
          });
        }
      }
      
      const reporte = {
        fecha_reporte: new Date(),
        consistencia_inventarios: consistenciaInventarios,
        libros_inconsistentes: {
          cantidad: librosInconsistentes.length,
          detalles: librosInconsistentes
        },
        tiendas_sin_inventario: {
          cantidad: tiendasSinInventario.length,
          detalles: tiendasSinInventario
        },
        resumen: {
          inventarios_totales: consistenciaInventarios.total_inventarios,
          inventarios_inconsistentes: consistenciaInventarios.inconsistencias,
          libros_con_stock_inconsistente: librosInconsistentes.length,
          tiendas_sin_inventario: tiendasSinInventario.length
        }
      };
      
      console.log('Reporte de consistencia generado:', reporte.resumen);
      
      return reporte;
    } catch (error) {
      console.error('Error generando reporte de consistencia:', error);
      throw error;
    }
  },

  /**
   * Reparar inconsistencias de stock automáticamente
   * @returns {Promise<Object>} Resultado de las reparaciones
   */
  async repararInconsistenciasStock() {
    try {
      console.log('Iniciando reparación automática de inconsistencias');
      
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Obtener reporte de consistencia
        const reporte = await this.obtenerReporteConsistencia();
        
        let reparaciones = 0;
        let errores = 0;
        
        // Reparar libros con stock inconsistente
        for (const libro of reporte.libros_inconsistentes.detalles) {
          try {
            await this.sincronizarStockLibro(libro.id_libro);
            reparaciones++;
            console.log(`Stock reparado para libro ${libro.titulo}: ${libro.stock_libro} → ${libro.stock_consolidado}`);
          } catch (error) {
            console.error(`Error reparando libro ${libro.titulo}:`, error);
            errores++;
          }
        }
        
        // Crear inventarios faltantes para tiendas sin inventario
        for (const tienda of reporte.tiendas_sin_inventario.detalles) {
          try {
            // Por ahora solo registramos, no creamos inventarios automáticamente
            console.log(`Tienda sin inventario detectada: ${tienda.nombre}`);
          } catch (error) {
            console.error(`Error procesando tienda ${tienda.nombre}:`, error);
          }
        }
        
        await session.commitTransaction();
        session.endSession();
        
        const resultado = {
          fecha_reparacion: new Date(),
          problemas_detectados: {
            inventarios_inconsistentes: reporte.consistencia_inventarios.inconsistencias,
            libros_inconsistentes: reporte.libros_inconsistentes.cantidad,
            tiendas_sin_inventario: reporte.tiendas_sin_inventario.cantidad
          },
          reparaciones_realizadas: {
            stocks_sincronizados: reparaciones,
            errores: errores
          }
        };
        
        console.log('Reparación completada:', resultado);
        
        return resultado;
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error en reparación automática:', error);
      throw error;
    }
  },

  /**
   * Sincronizar stock de todos los libros con su stock consolidado
   * @returns {Promise<Object>} Estadísticas de sincronización
   */
  async sincronizarTodosLosStocks() {
    try {
      console.log('Iniciando sincronización masiva de stocks');
      
      // Obtener todos los libros activos
      const libros = await Libro.find({ activo: true }, '_id titulo');
      
      let sincronizados = 0;
      let errores = 0;
      
      for (const libro of libros) {
        try {
          await this.sincronizarStockLibro(libro._id);
          sincronizados++;
        } catch (error) {
          console.error(`Error sincronizando libro ${libro._id}:`, error);
          errores++;
        }
      }
      
      console.log(`Sincronización completada: ${sincronizados} exitosos, ${errores} errores`);
      
      return {
        total_libros: libros.length,
        sincronizados,
        errores,
        fecha_sincronizacion: new Date()
      };
    } catch (error) {
      console.error('Error en sincronización masiva:', error);
      throw error;
    }
  },

  /**
   * Sincronizar el campo stock del libro con el stock consolidado real
   * @param {String} idLibro - ID del libro
   * @returns {Promise<Object>} Libro actualizado
   */
  async sincronizarStockLibro(idLibro) {
    try {
      console.log(`Sincronizando stock del libro ${idLibro}`);
      
      const stockConsolidado = await this._obtenerStockConsolidado(idLibro);
      
      // Actualizar el campo stock del libro
      let libroActualizado;
      if (mongoose.Types.ObjectId.isValid(idLibro)) {
        libroActualizado = await Libro.findByIdAndUpdate(
          idLibro,
          {
            $set: {
              stock: stockConsolidado.stock_total,
              ultima_actualizacion: new Date()
            }
          },
          { new: true }
        );
      } else {
        libroActualizado = await Libro.findOneAndUpdate(
          { id_libro: idLibro },
          {
            $set: {
              stock: stockConsolidado.stock_total,
              ultima_actualizacion: new Date()
            }
          },
          { new: true }
        );
      }
      
      console.log(`Stock sincronizado: ${stockConsolidado.stock_total} para libro ${idLibro}`);
      
      return libroActualizado;
    } catch (error) {
      console.error('Error sincronizando stock del libro:', error);
      throw error;
    }
  },

  /**
   * Confirmar compra de un libro (convierte reserva en venta)
   * @param {String} idLibro - ID del libro
   * @param {Number} cantidad - Cantidad comprada
   * @param {String} idUsuario - ID del usuario
   * @param {String} idTransaccion - ID de la transacción
   * @param {String} idReserva - ID de la reserva o carrito
   * @returns {Promise<Object>} Resultado de la operación
   */
  async confirmarCompraLibro(idLibro, cantidad, idUsuario, idTransaccion, idReserva) {
    try {
      console.log(`Confirmando compra de ${cantidad} unidades del libro ${idLibro}`);
      
      // Iniciar sesión de transacción
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verificar si el libro existe
        let libro;
        if (mongoose.Types.ObjectId.isValid(idLibro)) {
          libro = await Libro.findById(idLibro).session(session);
        } else {
          libro = await Libro.findOne({ id_libro: idLibro }).session(session);
        }

        if (!libro) {
          throw new Error(`Libro no encontrado con ID: ${idLibro}`);
        }

        // Determinar si los IDs son ObjectId válidos
        let transaccionId = null; // Usar null en lugar de string no válido
        
        // Confirmar venta en el inventario
        const inventario = await Inventario.findOne({ id_libro: libro._id })
          .session(session);
        
        if (!inventario) {
          throw new Error('Inventario no encontrado para este libro');
        }

        // Registrar salida (venta)
        await inventario.registrarSalida(
          cantidad,
          'venta',
          idUsuario,
          transaccionId,
          `Venta confirmada. Transacción: ${idTransaccion}, Reserva: ${idReserva}`
        );

        await session.commitTransaction();
        session.endSession();
        
        console.log(`Compra de ${cantidad} ejemplares confirmada`);
        return {
          exito: true,
          mensaje: `Compra de ${cantidad} ejemplar(es) registrada exitosamente`,
          inventario: {
            stock_total: inventario.stock_total,
            stock_disponible: inventario.stock_disponible,
            stock_reservado: inventario.stock_reservado
          }
        };
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Error confirmando compra:', error);
      throw error;
    }
  }
};

module.exports = libroService;