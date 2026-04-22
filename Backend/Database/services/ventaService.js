// Database/services/ventaService.js (MEJORADO - MANEJO DE CONCURRENCIA)
const mongoose = require('mongoose');
const Venta = require('../models/ventaModel');
const Devolucion = require('../models/devolucionModel');
const devolucionService = require('./devolucionService');
const { Carrito, CarritoItem, Libro, Inventario } = require('../models');
const tarjetaService = require('./tarjetaService');
const emailService = require('../../src/utils/emailService');

class VentaService {
  /**
   * Calcular costo de envío según el tipo
   */
  _calcularCostoEnvio(tipoEnvio) {
    const COSTO_ENVIO_DOMICILIO = 7000;
    return tipoEnvio === 'domicilio' ? COSTO_ENVIO_DOMICILIO : 0;
  }

  /**
   * Ejecutar operación con retry automático para WriteConflicts
   * @private
   */
  async _ejecutarConRetry(operacion, maxReintentos = 3, delayBase = 100) {
    for (let intento = 1; intento <= maxReintentos; intento++) {
      try {
        return await operacion();
      } catch (error) {
        // Si es WriteConflict y no es el último intento, reintentar
        if (error.code === 112 && intento < maxReintentos) {
          console.log(`WriteConflict detectado (intento ${intento}/${maxReintentos}), reintentando...`);
          
          // Delay exponencial con jitter
          const delay = delayBase * Math.pow(2, intento - 1) + Math.random() * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Si no es WriteConflict o se agotaron los reintentos, propagar error
        throw error;
      }
    }
  }

  /**
   * Mapea y valida la dirección de envío desde el request al schema requerido
   * @private
   */
  _mapearDireccionEnvio(direccionEnvio) {
    if (!direccionEnvio) {
      throw new Error('La dirección de envío es obligatoria');
    }

    const direccionMapeada = {
      direccion_completa: direccionEnvio.calle || direccionEnvio.direccion_completa || direccionEnvio.direccion,
      ciudad: direccionEnvio.ciudad,
      departamento: direccionEnvio.departamento || direccionEnvio.estado_provincia || direccionEnvio.estado,
      codigo_postal: direccionEnvio.codigo_postal,
      pais: direccionEnvio.pais || 'Colombia',
      referencia: direccionEnvio.referencias || direccionEnvio.referencia,
      telefono_contacto: direccionEnvio.telefono_contacto || direccionEnvio.telefono
    };

    // Validar campos obligatorios
    if (!direccionMapeada.direccion_completa) {
      throw new Error('La dirección completa es obligatoria (calle, carrera, etc.)');
    }

    if (!direccionMapeada.ciudad) {
      throw new Error('La ciudad es obligatoria');
    }

    if (!direccionMapeada.departamento) {
      throw new Error('El departamento/estado es obligatorio');
    }

    console.log('Dirección mapeada:', direccionMapeada);
    
    return direccionMapeada;
  }

  /**
   * Crear una venta desde un carrito CON MANEJO ROBUSTO DE CONCURRENCIA
   */
  async crearVenta(idUsuario, datosVenta) {
    console.log('Iniciando creación de venta con manejo de concurrencia mejorado');
    
    // 1. FASE DE PREPARACIÓN (sin transacción)
    let carrito, items, tarjeta, totalFinalAPagar;
    
    try {
      // Obtener y validar el carrito
      carrito = await Carrito.findOne({ 
        id_usuario: idUsuario, 
        estado: 'activo' 
      });
      
      if (!carrito || carrito.n_item === 0) {
        throw new Error('No hay un carrito activo con productos');
      }
      
      // Obtener items del carrito con información completa
      items = await CarritoItem.find({ id_carrito: carrito._id })
        .populate('id_libro');
      
      if (items.length === 0) {
        throw new Error('El carrito está vacío');
      }
      
      // Calcular totales y validar método de pago
      const costoEnvio = this._calcularCostoEnvio(datosVenta.tipo_envio);
      const totalSinEnvio = carrito.totales.total_final;
      const totalConEnvio = totalSinEnvio + costoEnvio;
      
      // Manejar impuesto opcional
      totalFinalAPagar = totalConEnvio;
      let impuestoPagadoPorCliente = false;
      let montoImpuestoExcluido = 0;
      
      if (datosVenta.cliente_pagara_impuesto === true) {
        impuestoPagadoPorCliente = true;
        montoImpuestoExcluido = carrito.totales.total_impuestos;
        totalFinalAPagar = totalConEnvio - montoImpuestoExcluido;
        
        if (totalFinalAPagar < 0) {
          totalFinalAPagar = 0;
        }
      }
      
      // Validar método de pago
      tarjeta = await this._validarMetodoPago(
        idUsuario, 
        datosVenta.id_tarjeta, 
        totalFinalAPagar
      );
      
      console.log(`Fase de preparación completada. Total a pagar: $${totalFinalAPagar.toLocaleString()}`);
      
    } catch (error) {
      console.error('Error en fase de preparación:', error);
      throw error;
    }
    
    // 2. FASE DE VALIDACIÓN DE RESERVAS (sin transacción)
    try {
      console.log('Validando reservas existentes...');
      for (const item of items) {
        const reservaInfo = await this._verificarReservaItem(carrito._id, item.id_libro._id);
        
        if (!reservaInfo.valida) {
          throw new Error(`Reserva inválida para "${item.id_libro.titulo}": ${reservaInfo.mensaje}`);
        }
        
        if (reservaInfo.cantidadReservada < item.cantidad) {
          throw new Error(`Stock reservado insuficiente para "${item.id_libro.titulo}". Reservado: ${reservaInfo.cantidadReservada}, Necesario: ${item.cantidad}`);
        }
      }
      console.log('Todas las reservas están válidas');
      
    } catch (error) {
      console.error('Error validando reservas:', error);
      throw error;
    }
    
    // 3. FASE DE PROCESAMIENTO DE PAGO (antes de la transacción principal)
    let pagoRealizado = false;
    try {
      console.log('Procesando pago...');
      await this._procesarPago(tarjeta, totalFinalAPagar, `TEMP-${Date.now()}`);
      pagoRealizado = true;
      console.log('Pago procesado exitosamente');
      
    } catch (errorPago) {
      console.error('Error procesando pago:', errorPago);
      throw new Error(`Error procesando el pago: ${errorPago.message}`);
    }
    let tienda = null;
    if (datosVenta.tipo_envio === 'recogida_tienda') {
      const tiendaService = require('./tiendaService');
      tienda = await tiendaService.obtenerTiendaPorId(datosVenta.id_tienda_recogida);
      if (!tienda) {
        throw new Error('Tienda de recogida no encontrada');
      }
    }
    // 4. FASE DE TRANSACCIÓN PRINCIPAL (con retry automático)
    return await this._ejecutarConRetry(async () => {
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        console.log('Iniciando transacción principal de venta');
        
        // Preparar información de envío
        let direccionEnvioMapeada = null;
        if (datosVenta.direccion_envio) {
          direccionEnvioMapeada = this._mapearDireccionEnvio(datosVenta.direccion_envio);
        }
        
        let infoEnvio = {};
        
        if (datosVenta.tipo_envio === 'domicilio') {
          if (!direccionEnvioMapeada) {
            throw new Error('La dirección de envío es obligatoria para envío a domicilio');
          }
          
          infoEnvio = {
            tipo: 'domicilio',
            direccion: direccionEnvioMapeada,
            costo: this._calcularCostoEnvio(datosVenta.tipo_envio),
            notas_envio: datosVenta.notas_envio || ''
          };
        } else if (datosVenta.tipo_envio === 'recogida_tienda') {
          infoEnvio = {
            tipo: 'recogida_tienda',
            id_tienda_recogida: tienda._id,
            costo: 0
          };
        }
        
        // Preparar items de la venta
        const itemsVenta = items.map(item => ({
          id_libro: item.id_libro._id,
          snapshot: {
            titulo: item.id_libro.titulo,
            autor: item.id_libro.autor_nombre_completo,
            isbn: item.id_libro.ISBN,
            editorial: item.id_libro.editorial,
            imagen_portada: item.id_libro.imagen_portada
          },
          cantidad: item.cantidad,
          precios: {
            precio_unitario_base: item.precios.precio_base,
            descuento_aplicado: item.precios.total_descuentos,
            precio_unitario_final: item.precios.precio_con_impuestos,
            impuesto: item.precios.impuesto,
            subtotal: item.subtotal
          },
          id_tienda_origen: item.metadatos?.id_tienda_reservado
        }));
        
        // Crear la venta
        const nuevaVenta = new Venta({
          id_cliente: idUsuario,
          id_carrito_origen: carrito._id,
          items: itemsVenta,
          totales: {
            subtotal_sin_descuentos: carrito.totales.subtotal_base,
            total_descuentos: carrito.totales.total_descuentos,
            subtotal_con_descuentos: carrito.totales.subtotal_con_descuentos,
            total_impuestos: datosVenta.cliente_pagara_impuesto ? 0 : carrito.totales.total_impuestos,
            costo_envio: this._calcularCostoEnvio(datosVenta.tipo_envio),
            total_final: totalFinalAPagar
          },
          pago: {
            metodo: tarjeta.tipo === 'debito' ? 'tarjeta_debito' : 'tarjeta_credito',
            id_tarjeta: tarjeta.id_tarjeta,
            ultimos_digitos: tarjeta.ultimos_digitos,
            marca_tarjeta: tarjeta.marca,
            estado_pago: 'aprobado', // Ya se procesó el pago
            fecha_pago: new Date()
          },
          envio: infoEnvio,
          descuentos_aplicados: carrito.codigos_carrito?.map(c => ({
            codigo: c.codigo,
            tipo: 'codigo_promocional'
          })) || [],
          impuesto_info: {
            pagado_por_cliente: datosVenta.cliente_pagara_impuesto || false,
            monto_excluido: datosVenta.cliente_pagara_impuesto ? carrito.totales.total_impuestos : 0,
            monto_incluido: datosVenta.cliente_pagara_impuesto ? 0 : carrito.totales.total_impuestos
          },
          estado: 'pago_aprobado' // Iniciar en estado correcto
        });
        
        // Guardar la venta
        await nuevaVenta.save({ session });
        console.log(`Venta creada: ${nuevaVenta.numero_venta}`);
        
        // Marcar como preparando automáticamente
        nuevaVenta.cambiarEstado('preparando', null, 'Orden en preparación automática');
        await nuevaVenta.save({ session });
        
        // Convertir reservas en ventas definitivas
        console.log('Convirtiendo reservas en ventas definitivas...');
        for (const item of items) {
          await this._convertirReservaEnVenta(
            carrito._id,
            item.id_libro._id,
            item.cantidad,
            idUsuario,
            nuevaVenta._id,
            session
          );
        }
        
        // Limpiar carrito de forma segura
        await this._limpiarCarritoSeguro(carrito, session);

        // Confirmar transacción (core de la venta: venta + conversión reservas + limpieza carrito)
        await session.commitTransaction();
        session.endSession();

        console.log('Venta creada exitosamente con manejo robusto de concurrencia');

        // Side-effects post-commit (no afectan la integridad de la venta si fallan)

        // Si es recogida en tienda, crear el registro fuera de la transacción
        // (tiendaService hace múltiples saves sin sesión que romperían la transacción).
        if (datosVenta.tipo_envio === 'recogida_tienda') {
          try {
            await this._crearRecogidaTienda(nuevaVenta, datosVenta.id_tienda_recogida, null);
          } catch (recogidaError) {
            console.error(`Venta ${nuevaVenta.numero_venta} creada pero falló crear recogida:`, recogidaError);
          }
        }

        // Enviar confirmación por email (no bloqueante)
        this._enviarConfirmacionCompra(nuevaVenta, idUsuario).catch(err =>
          console.error('Error enviando email de confirmación:', err)
        );

        return nuevaVenta;
        
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        // Si el pago ya se realizó pero falló la transacción, intentar reembolso
        if (pagoRealizado) {
          console.error('Transacción falló después del pago, intentando reembolso automático...');
          try {
            await this._reembolsoDeEmergencia(tarjeta, totalFinalAPagar, idUsuario);
            console.log('Reembolso de emergencia procesado');
          } catch (reembolsoError) {
            console.error('ERROR CRÍTICO: No se pudo procesar reembolso automático:', reembolsoError);
            // Aquí deberías alertar al equipo de administración
            await this._alertarReembolsoFallido(idUsuario, totalFinalAPagar, error, reembolsoError);
          }
        }
        
        throw error;
      }
    }, 3, 200); // Máximo 3 reintentos con delay base de 200ms
  }

  /**
   * Limpiar carrito de forma segura para evitar WriteConflicts
   * @private
   */
  async _limpiarCarritoSeguro(carrito, session) {
    const cartUpdate = {
      estado: 'convertido_a_compra',
      n_item: 0,
      n_libros_diferentes: 0,
      totales: {
        subtotal_base: 0,
        total_descuentos: 0,
        subtotal_con_descuentos: 0,
        total_impuestos: 0,
        costo_envio: 0,
        total_final: 0
      },
      codigos_carrito: [],
      problemas: []
    };

    try {
      console.log('Limpiando carrito de forma segura...');

      // Eliminar items uno por uno para evitar conflictos masivos
      const items = await CarritoItem.find({ id_carrito: carrito._id }).session(session);
      for (const item of items) {
        await CarritoItem.findByIdAndDelete(item._id).session(session);
      }
      console.log(`${items.length} items eliminados individualmente`);

      // Update atómico por _id → evita conflictos de versión optimistic concurrency
      await Carrito.findByIdAndUpdate(
        carrito._id,
        { $set: cartUpdate },
        { session, new: true }
      );
      console.log('Carrito actualizado a estado convertido_a_compra');

    } catch (error) {
      console.error('Error limpiando carrito:', error);

      // Fallback: limpieza masiva
      try {
        console.log('Intentando limpieza masiva como fallback...');
        await CarritoItem.deleteMany({ id_carrito: carrito._id }).session(session);
        await Carrito.findByIdAndUpdate(
          carrito._id,
          { $set: cartUpdate },
          { session, new: true }
        );
        console.log('Limpieza masiva exitosa');
      } catch (fallbackError) {
        console.error('Error en limpieza masiva fallback:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Reembolso de emergencia cuando la transacción falla después del pago
   * @private
   */
  async _reembolsoDeEmergencia(tarjeta, monto, idUsuario) {
    try {
      if (tarjeta.tipo === 'debito') {
        await tarjetaService.modificarSaldo(
          tarjeta.id_tarjeta,
          idUsuario,
          monto, // Devolver el monto
          `REEMBOLSO DE EMERGENCIA - Fallo en transacción de venta`
        );
        console.log(`Reembolso de emergencia procesado: $${monto.toLocaleString()}`);
      } else {
        console.log('Tarjeta de crédito - reembolso manual requerido');
      }
    } catch (error) {
      throw new Error(`Error procesando reembolso de emergencia: ${error.message}`);
    }
  }

  /**
   * Alertar sobre un reembolso fallido - para monitoreo crítico
   * @private
   */
  async _alertarReembolsoFallido(idUsuario, monto, errorOriginal, errorReembolso) {
    const alerta = {
      timestamp: new Date(),
      tipo: 'REEMBOLSO_FALLIDO_CRITICO',
      usuario: idUsuario,
      monto: monto,
      error_transaccion: errorOriginal.message,
      error_reembolso: errorReembolso.message,
      requiere_atencion_inmediata: true
    };
    
    console.error('🚨 ALERTA CRÍTICA 🚨', alerta);
    
    // Aquí deberías implementar:
    // - Envío de email urgente al equipo de administración
    // - Notificación a Slack/Discord
    // - Creación de ticket en sistema de soporte
    // - Log en sistema de monitoreo
    
    // Por ahora, al menos guardarlo en un log especial
    try {
      const AlertaCritica = require('../models/alertaCriticaModel'); // Si tienes este modelo
      await AlertaCritica.create(alerta);
    } catch (err) {
      console.error('No se pudo guardar alerta crítica:', err);
    }
  }

  /**
   * Verificar que la reserva de un item está correcta
   * @private
   */
  async _verificarReservaItem(idCarrito, idLibro, session = null) {
    try {
      // Buscar inventario con reservas de este carrito
      const inventario = await Inventario.findOne({
        id_libro: idLibro,
        'movimientos': {
          $elemMatch: {
            tipo: 'reserva',
            id_reserva: idCarrito
          }
        }
      }).session(session);
      
      if (!inventario) {
        return {
          valida: false,
          mensaje: 'No se encontró reserva para este libro',
          cantidadReservada: 0
        };
      }
      
      // Calcular cantidad reservada neta
      let cantidadReservada = 0;
      
      for (const movimiento of inventario.movimientos) {
        if (movimiento.id_reserva && movimiento.id_reserva.equals(idCarrito)) {
          if (movimiento.tipo === 'reserva') {
            cantidadReservada += movimiento.cantidad;
          } else if (movimiento.tipo === 'liberacion_reserva') {
            cantidadReservada -= movimiento.cantidad;
          }
        }
      }
      
      if (cantidadReservada <= 0) {
        return {
          valida: false,
          mensaje: 'La reserva fue liberada o es inválida',
          cantidadReservada: 0
        };
      }
      
      return {
        valida: true,
        mensaje: 'Reserva válida',
        cantidadReservada,
        inventario
      };
    } catch (error) {
      console.error('Error verificando reserva:', error);
      return {
        valida: false,
        mensaje: `Error verificando reserva: ${error.message}`,
        cantidadReservada: 0
      };
    }
  }

  /**
   * Convertir reserva en venta definitiva
   * @private
   */
  async _convertirReservaEnVenta(idCarrito, idLibro, cantidad, idUsuario, idVenta, session) {
    try {
      const reservaInfo = await this._verificarReservaItem(idCarrito, idLibro, session);
      
      if (!reservaInfo.valida || !reservaInfo.inventario) {
        throw new Error(`No se puede convertir reserva en venta para libro ${idLibro}`);
      }
      
      const inventario = reservaInfo.inventario;
      
      // Registrar salida definitiva (reduce del stock reservado, no del disponible)
      await inventario.registrarSalida(
        cantidad,
        'venta',
        idUsuario,
        idVenta,
        `Venta confirmada ${idVenta} - conversión de reserva carrito ${idCarrito}`,
        { session }
      );
      
      console.log(`Reserva convertida en venta: ${cantidad} unidades de libro ${idLibro}`);
    } catch (error) {
      console.error('Error convirtiendo reserva en venta:', error);
      throw error;
    }
  }

  /**
   * Crear registro de recogida en tienda
   * @private
   */
  async _crearRecogidaTienda(venta, idTienda, session) {
    try {
      const tiendaService = require('./tiendaService');
      const recogida = await tiendaService.crearRecogidaDesdeVenta(venta, idTienda);
      console.log(`Recogida creada para venta ${venta.numero_venta} en tienda ${idTienda}`);
      return recogida;
    } catch (error) {
      console.error('Error creando recogida en tienda:', error);
      throw error;
    }
  }

  // ==========================================
  // MÉTODOS PRIVADOS EXISTENTES (mantenidos)
  // ==========================================

  /**
   * Validar método de pago
   * @private
   */
  async _validarMetodoPago(idUsuario, idTarjeta, montoTotal) {
    const tarjeta = await tarjetaService.obtenerTarjetaPorId(idTarjeta, idUsuario);
    
    if (!tarjeta) {
      throw new Error('Tarjeta no encontrada');
    }
    
    if (!tarjeta.activa) {
      throw new Error('La tarjeta no está activa');
    }
    
    const verificacion = await tarjetaService.verificarTarjeta(idTarjeta);
    if (!verificacion.valida) {
      throw new Error(verificacion.mensaje);
    }
    
    if (tarjeta.tipo === 'debito') {
      if (tarjeta.saldo < montoTotal) {
        throw new Error(`Saldo insuficiente. Disponible: $${tarjeta.saldo.toLocaleString()}, Requerido: $${montoTotal.toLocaleString()}`);
      }
    }
    
    return tarjeta;
  }
  
  /**
   * Procesar pago
   * @private
   */
  async _procesarPago(tarjeta, monto, numeroVenta) {
    try {
      if (tarjeta.tipo === 'debito') {
        await tarjetaService.modificarSaldo(
          tarjeta.id_tarjeta,
          tarjeta.id_usuario,
          -monto,
          `Pago de orden ${numeroVenta}`
        );
      } else {
        console.log(`Procesando pago de $${monto} con tarjeta de crédito ${tarjeta.ultimos_digitos}`);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error procesando pago: ${error.message}`);
    }
  }
  
  /**
   * Enviar email de confirmación
   * @private
   */
  async _enviarConfirmacionCompra(venta, idUsuario) {
    try {
      const usuario = await mongoose.model('Usuario').findById(idUsuario);
      await emailService.sendPurchaseConfirmation(
        usuario.email,
        venta,
        usuario
      );
    } catch (error) {
      console.error('Error enviando confirmación:', error);
    }
  }

  // ==========================================
  // RESTO DE MÉTODOS EXISTENTES (sin cambios)
  // ==========================================

  async cancelarVenta(numeroVenta, motivo, solicitadaPor, idUsuario) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const venta = await Venta.findOne({ numero_venta: numeroVenta }).session(session);
      
      if (!venta) {
        throw new Error('Venta no encontrada');
      }
      
      // Validar permisos
      if (solicitadaPor === 'cliente' && venta.id_cliente.toString() !== idUsuario) {
        throw new Error('No tienes permisos para cancelar esta venta');
      }
      
      // Cancelar la venta (sin guardar)
      venta.cancelarVenta(motivo, solicitadaPor, idUsuario);
      
      // Guardar los cambios con la sesión
      await venta.save({ session });
      
      // Si el pago fue aprobado, procesar reembolso
      if (venta.pago.estado_pago === 'reembolsado') {
        await this._procesarReembolso(venta);
      }
      
      // DEVOLVER STOCK CORRECTAMENTE
      console.log('Devolviendo stock por cancelación de venta...');
      for (const item of venta.items) {
        await this._devolverStockPorCancelacion(
          item.id_libro,
          item.cantidad,
          item.id_tienda_origen,
          idUsuario,
          venta._id,
          session
        );
      }
      
      // Si había recogida asociada, cancelarla también
      if (venta.envio.tipo === 'recogida_tienda') {
        await this._cancelarRecogidaAsociada(venta._id, motivo, idUsuario, session);
      }
      
      await session.commitTransaction();
      
      // Enviar notificación
      this._enviarNotificacionCancelacion(venta).catch(err => 
        console.error('Error enviando notificación:', err)
      );
      
      return venta;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Devolver stock por cancelación
   * @private
   */
  async _devolverStockPorCancelacion(idLibro, cantidad, idTiendaOriginal, idUsuario, idVenta, session) {
    try {
      let inventario;
      
      // Intentar devolver a la tienda original si se especifica
      if (idTiendaOriginal) {
        inventario = await Inventario.findOne({
          id_libro: idLibro,
          id_tienda: idTiendaOriginal
        }).session(session);
      }
      
      // Si no hay tienda original o no se encuentra, buscar cualquier inventario activo
      if (!inventario) {
        inventario = await Inventario.findOne({
          id_libro: idLibro,
          estado: 'disponible'
        }).session(session);
      }
      
      // Si aún no hay inventario, crear uno nuevo en una tienda activa
      if (!inventario) {
        const TiendaFisica = require('../models/tiendaFisicaModel');
        const tiendaActiva = await TiendaFisica.findOne({ estado: 'activa' }).session(session);
        
        if (tiendaActiva) {
          inventario = new Inventario({
            id_libro: idLibro,
            id_tienda: tiendaActiva._id,
            stock_total: 0,
            stock_disponible: 0,
            stock_reservado: 0
          });
        } else {
          throw new Error('No hay tiendas activas para devolver el stock');
        }
      }
      
      // Registrar entrada por devolución/cancelación
      await inventario.registrarEntrada(
        cantidad,
        'devolucion',
        idUsuario,
        `Cancelación de venta ${idVenta} - devolución de stock`
      );
      
      console.log(`Stock devuelto: ${cantidad} unidades de libro ${idLibro} a tienda ${inventario.id_tienda}`);
    } catch (error) {
      console.error('Error devolviendo stock por cancelación:', error);
      throw error;
    }
  }

  /**
   * Cancelar recogida asociada a una venta
   * @private
   */
  async _cancelarRecogidaAsociada(idVenta, motivo, idUsuario, session) {
    try {
      const RecogidaTienda = require('../models/recogidaTiendaModel');
      
      const recogida = await RecogidaTienda.findOne({ id_venta: idVenta }).session(session);
      
      if (recogida && !['RECOGIDO', 'CANCELADO', 'EXPIRADO'].includes(recogida.estado)) {
        recogida.cambiarEstado('CANCELADO', `Venta cancelada: ${motivo}`, idUsuario);
        await recogida.save({ session });
        
        console.log(`Recogida ${recogida.codigo_recogida} cancelada por venta cancelada`);
      }
    } catch (error) {
      console.error('Error cancelando recogida asociada:', error);
      // No es crítico, continuar con la cancelación de la venta
    }
  }

  /**
   * Procesar reembolso
   * @private
   */
  async _procesarReembolso(venta) {
    try {
      const tarjeta = await tarjetaService.obtenerTarjetaPorId(venta.pago.id_tarjeta);
      
      if (tarjeta && tarjeta.tipo === 'debito') {
        await tarjetaService.modificarSaldo(
          tarjeta.id_tarjeta,
          venta.id_cliente,
          venta.totales.total_final,
          `Reembolso de orden ${venta.numero_venta}`
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error procesando reembolso:', error);
      throw error;
    }
  }

  // Resto de métodos públicos sin cambios...
  async obtenerVentasCliente(idCliente, opciones = {}) {
    const {
      incluir_devoluciones = true,
      ...opcionesRestantes
    } = opciones;//????
    
    // Usar el método actualizado del modelo
    const ventas = await Venta.obtenerVentasCliente(idCliente, {
      ...opcionesRestantes,
      incluir_devoluciones
    });
    
    // Si se incluyen devoluciones, agregar información detallada
    let ventasConDevoluciones = ventas;
    
    if (incluir_devoluciones) {
      ventasConDevoluciones = await Promise.all(ventas.map(async (venta) => {
        const ventaObj = venta.toObject();
        
        // Agregar resumen de devoluciones
        ventaObj.resumen_devoluciones = venta.obtenerResumenDevoluciones();
        
        // Si tiene devoluciones, obtener la información básica
        if (venta.sistema_devolucion.tiene_devoluciones) {
          const Devolucion = require('../models/devolucionModel');
          const devoluciones = await Devolucion.find({ id_venta: venta._id })
            .select('codigo_devolucion estado fecha_solicitud totales.monto_aprobado_reembolso')
            .sort('-fecha_solicitud');
          
          ventaObj.devoluciones_asociadas = devoluciones;
        }
        
        return ventaObj;
      }));
    }
    
    // Calcular totales con información de devoluciones
    const totales = await Venta.aggregate([
      { $match: { id_cliente: new mongoose.Types.ObjectId(idCliente) } },
      {
        $group: {
          _id: null,
          total_compras: { $sum: 1 },
          monto_total: { $sum: '$totales.total_final' },
          // NUEVAS MÉTRICAS
          compras_con_devolucion: { 
            $sum: { $cond: ['$sistema_devolucion.tiene_devoluciones', 1, 0] } 
          },
          total_monto_devuelto: { $sum: '$sistema_devolucion.monto_total_devuelto' }
        }
      }
    ]);
    
    return {
      ventas: ventasConDevoluciones,
      resumen: totales[0] || { 
        total_compras: 0, 
        monto_total: 0,
        compras_con_devolucion: 0,
        total_monto_devuelto: 0
      }
    };
  }

  async obtenerVentasAdmin(filtros = {}, opciones = {}) {
    const {
      incluir_devoluciones = true,
      ...opcionesRestantes
    } = opciones;//????
    
    // Usar el método actualizado del modelo que incluye filtros de devolución
    const ventas = await Venta.obtenerVentasAdmin(filtros, {
      ...opcionesRestantes,
      incluir_devoluciones
    });
    
    // Agregar información detallada de devoluciones para admins
    let ventasCompletas = ventas;
    
    if (incluir_devoluciones) {
      ventasCompletas = await Promise.all(ventas.map(async (venta) => {
        const ventaObj = venta.toObject();
        
        // Agregar resumen completo de devoluciones
        ventaObj.resumen_devoluciones = venta.obtenerResumenDevoluciones();
        
        // Si tiene devoluciones, obtener información detallada para admins
        if (venta.sistema_devolucion.tiene_devoluciones) {
          const Devolucion = require('../models/devolucionModel');
          const devoluciones = await Devolucion.find({ id_venta: venta._id })
            .populate('id_cliente', 'nombres apellidos email')
            .sort('-fecha_solicitud');
          
          ventaObj.devoluciones_detalladas = devoluciones;
        }
        
        return ventaObj;
      }));
    }
    
    // Calcular totales mejorados para administradores
    const totales = await Venta.aggregate([
      { $match: filtros },
      {
        $group: {
          _id: null,
          total_compras: { $sum: 1 },
          monto_total: { $sum: '$totales.total_final' },
          // MÉTRICAS ADMINISTRATIVAS DETALLADAS
          compras_con_devolucion: { 
            $sum: { $cond: ['$sistema_devolucion.tiene_devoluciones', 1, 0] } 
          },
          total_monto_devuelto: { $sum: '$sistema_devolucion.monto_total_devuelto' },
          devoluciones_pendientes: {
            $sum: {
              $cond: [
                { 
                  $in: ['$sistema_devolucion.estado_devolucion', 
                        ['devolucion_solicitada', 'devolucion_en_proceso', 'devolucion_aprobada']] 
                },
                1, 
                0
              ]
            }
          },
          devoluciones_completadas: {
            $sum: {
              $cond: [
                { 
                  $in: ['$sistema_devolucion.estado_devolucion', 
                        ['devolucion_completada', 'devolucion_parcial']] 
                },
                1, 
                0
              ]
            }
          }
        }
      }
    ]);
    
    return {
      ventas: ventasCompletas,
      resumen: totales[0] || { 
        total_compras: 0, 
        monto_total: 0,
        compras_con_devolucion: 0,
        total_monto_devuelto: 0,
        devoluciones_pendientes: 0,
        devoluciones_completadas: 0
      }
    };
  }
  
  async obtenerDetalleVenta(numeroVenta, idUsuario = null) {
    const query = { numero_venta: numeroVenta };
    
    if (idUsuario) {
      query.id_cliente = idUsuario;
    }
    
    const venta = await Venta.findOne(query)
      .populate('id_cliente', 'nombres apellidos email telefono')
      .populate('items.id_libro', 'titulo autor_nombre_completo ISBN');
    
    if (!venta) {
      throw new Error('Venta no encontrada');
    }
    
    // Obtener todas las devoluciones asociadas con información detallada
    const Devolucion = require('../models/devolucionModel');
    const devoluciones = await Devolucion.find({ id_venta: venta._id })
      .select('codigo_devolucion estado fecha_solicitud fecha_resolucion totales items qr_code')
      .sort('-fecha_solicitud');
    
    // Preparar respuesta completa
    const ventaCompleta = venta.toObject();
    ventaCompleta.resumen_devoluciones = venta.obtenerResumenDevoluciones();
    
    return {
      venta: ventaCompleta,
      devoluciones: devoluciones,
      puede_solicitar_devolucion: venta.puedeSolicitarDevolucion()
    };
  }
  
  async actualizarEstadoEnvio(numeroVenta, nuevoEstado, datosEnvio, idUsuario) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const venta = await Venta.findOne({ numero_venta: numeroVenta }).session(session);
      
      if (!venta) {
        throw new Error('Venta no encontrada');
      }
      
      switch (nuevoEstado) {
        case 'listo_para_envio':
          venta.marcarListoParaEnvio(idUsuario);
          break;
          
        case 'enviado':
          if (!datosEnvio.numero_guia) {
            throw new Error('Se requiere número de guía para marcar como enviado');
          }
          venta.marcarComoEnviado(datosEnvio, idUsuario);
          break;
          
        case 'entregado':
          venta.marcarComoEntregado(idUsuario, datosEnvio.fecha_entrega);
          break;
          
        default:
          throw new Error('Estado de envío no válido');
      }
      
      await venta.save({ session });
      
      if (nuevoEstado === 'enviado') {
        this._enviarNotificacionEnvio(venta).catch(err => 
          console.error('Error enviando notificación:', err)
        );
      }
      
      if (nuevoEstado === 'entregado') {
        this._enviarNotificacionEntrega(venta).catch(err => 
          console.error('Error enviando notificación:', err)
        );
      }
      
      await session.commitTransaction();
      
      return venta;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  async crearDevolucion(numeroVenta, itemsDevolucion, idCliente) {
    try {
      const devolucion = await devolucionService.crearDevolucionDesdeVenta(
        numeroVenta,
        itemsDevolucion,
        idCliente
      );
      
      return devolucion;
      
    } catch (error) {
      console.error('Error en ventaService.crearDevolucion:', error);
      throw error;
    }
  }
  
  async obtenerEstadisticasVentas(fechaInicio, fechaFin) {
    const estadisticas = await Venta.obtenerEstadisticas(
      new Date(fechaInicio),
      new Date(fechaFin)
    );

    const metricasDevolucion = await Venta.aggregate([
      {
        $match: {
          fecha_creacion: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin)
          },
          'sistema_devolucion.tiene_devoluciones': true
        }
      },
      {
        $group: {
          _id: null,
          promedio_tiempo_primera_devolucion: {
            $avg: {
              $subtract: ['$sistema_devolucion.ultima_solicitud_devolucion', '$fecha_creacion']
            }
          },
          tasa_devolucion: {
            $avg: {
              $divide: ['$sistema_devolucion.monto_total_devuelto', '$totales.total_final']
            }
          }
        }
      }
    ]);
    
    // Productos más devueltos
    const productosMasDevueltos = await Venta.aggregate([
      {
        $match: {
          fecha_creacion: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin)
          },
          'sistema_devolucion.tiene_devoluciones': true
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.devolucion_info.cantidad_devuelta': { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$items.id_libro',
          titulo: { $first: '$items.snapshot.titulo' },
          cantidad_devuelta: { $sum: '$items.devolucion_info.cantidad_devuelta' },
          monto_devuelto: { $sum: '$items.devolucion_info.monto_devuelto' },
          frecuencia_devolucion: { $sum: 1 }
        }
      },
      { $sort: { cantidad_devuelta: -1 } },
      { $limit: 10 }
    ]);
    
    const productosMasVendidos = await Venta.aggregate([
      {
        $match: {
          fecha_creacion: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin)
          },
          estado: { $nin: ['cancelado', 'fallo_pago'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.id_libro',
          titulo: { $first: '$items.snapshot.titulo' },
          cantidad_vendida: { $sum: '$items.cantidad' },
          ingresos: { $sum: '$items.precios.subtotal' }
        }
      },
      { $sort: { cantidad_vendida: -1 } },
      { $limit: 10 }
    ]);
    
    return {
      ...estadisticas,
      metricas_devolucion: metricasDevolucion[0] || {
        promedio_tiempo_primera_devolucion: 0,
        tasa_devolucion: 0
      },
      productos_mas_devueltos: productosMasDevueltos
    };
  }
  
  // Métodos de notificación (mantenidos)
  async _enviarNotificacionCancelacion(venta) {
    const usuario = await mongoose.model('Usuario').findById(venta.id_cliente);
    await emailService.sendOrderCancellation(usuario.email, venta);
  }
  
  async _enviarNotificacionEnvio(venta) {
    const usuario = await mongoose.model('Usuario').findById(venta.id_cliente);
    await emailService.sendShippingNotification(usuario.email, venta);
  }
  
  async _enviarNotificacionEntrega(venta) {
    const usuario = await mongoose.model('Usuario').findById(venta.id_cliente);
    await emailService.sendDeliveryConfirmation(usuario.email, venta);
  }
  
  async _enviarEmailDevolucion(devolucion, idCliente) {
    const usuario = await mongoose.model('Usuario').findById(idCliente);
    await emailService.sendReturnConfirmation(usuario.email, devolucion);
  }
}

module.exports = new VentaService();