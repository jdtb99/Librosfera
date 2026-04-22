// Database/services/devolucionService.js (ACTUALIZADO - INTEGRACIÓN COMPLETA CON VENTAS)
const mongoose = require('mongoose');
const Devolucion = require('../models/devolucionModel');
const Venta = require('../models/ventaModel');
const Inventario = require('../models/inventarioModel');
const tarjetaService = require('./tarjetaService');
const emailService = require('../../src/utils/emailService');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');

class DevolucionService {
  
  /**
   * Crear devolución desde venta - MEJORADO CON SINCRONIZACIÓN
   */
  async crearDevolucionDesdeVenta(numeroVenta, itemsDevolucion, idCliente) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Obtener la venta
      const venta = await Venta.findOne({ 
        numero_venta: numeroVenta,
        id_cliente: idCliente 
      }).session(session);
      
      if (!venta) {
        throw new Error('Venta no encontrada');
      }
      
      // Validar que se puede solicitar devolución
      const validacion = venta.puedeSolicitarDevolucion();
      if (!validacion.puede) {
        throw new Error(validacion.razon);
      }
      
      // Crear la devolución
      const devolucion = await Devolucion.crearDesdeVenta(
        venta,
        itemsDevolucion,
        idCliente
      );
      
      // Generar QR code
      const qr = await this.generarCodigoQRDevolucion(devolucion.codigo_devolucion);
      devolucion.qr_code = {
        ...devolucion.qr_code,
        ...qr
      };
      
      await devolucion.save({ session });
      
      // **NUEVA FUNCIONALIDAD**: Sincronizar con la venta
      venta.registrarSolicitudDevolucion(
        devolucion.codigo_devolucion,
        itemsDevolucion,
        idCliente
      );
      
      await venta.save({ session });
      
      await session.commitTransaction();
      
      // Enviar notificación
      this._enviarEmailSolicitudDevolucion(devolucion, idCliente).catch(err => 
        console.error('Error enviando email de devolución:', err)
      );
      
      return devolucion;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Obtener devoluciones de un cliente CON INFORMACIÓN DE VENTA
   */
  async obtenerDevolucionesCliente(idCliente, opciones = {}) {
    const {
      page = 1,
      limit = 10,
      estado,
      incluir_venta = true
    } = opciones;
    
    const query = { id_cliente: idCliente };
    if (estado) {
      query.estado = estado;
    }
    
    let consulta = Devolucion.find(query)
      .sort('-fecha_solicitud')
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    if (incluir_venta) {
      consulta = consulta.populate({
        path: 'id_venta',
        select: 'numero_venta fecha_creacion totales envio sistema_devolucion',
        populate: {
          path: 'sistema_devolucion'
        }
      });
    }
    
    const devoluciones = await consulta;
    
    // Calcular estadísticas
    const estadisticas = await Devolucion.aggregate([
      { $match: { id_cliente: new mongoose.Types.ObjectId(idCliente) } },
      {
        $group: {
          _id: null,
          total_devoluciones: { $sum: 1 },
          monto_total_devuelto: { $sum: '$totales.monto_reembolsado' },
          devoluciones_pendientes: {
            $sum: {
              $cond: [
                { $in: ['$estado', ['solicitada', 'aprobada', 'esperando_envio', 'en_transito', 'recibida', 'en_inspeccion']] },
                1,
                0
              ]
            }
          },
          devoluciones_completadas: {
            $sum: {
              $cond: [
                { $in: ['$estado', ['reembolso_completado', 'cerrada']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    return {
      devoluciones,
      estadisticas: estadisticas[0] || {
        total_devoluciones: 0,
        monto_total_devuelto: 0,
        devoluciones_pendientes: 0,
        devoluciones_completadas: 0
      }
    };
  }

  /**
   * Generar código QR para devolución
   */
  async generarCodigoQRDevolucion(codigoDevolucion) {
    try{
      const baseUrl = process.env.FRONT_URL || 'https://librosfera-awmi.onrender.com';
      let qr_code = {url_rastreo: '', codigo: '', imagen_base64: ''};
      qr_code.url_rastreo = `${baseUrl}/devolucion/rastreo/${codigoDevolucion}`;
      qr_code.codigo = `QR-${codigoDevolucion}`;
      const qrOptions = {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      };
      qr_code.imagen_base64 = await QRCode.toDataURL(qr_code.url_rastreo, qrOptions);
      return qr_code;
    } catch (error) {
      console.error('Error generando código QR:', error);
      throw new Error('No se pudo generar el código QR para la devolución');
    }
  }

  /**
   * Obtener detalle de una devolución CON INFORMACIÓN COMPLETA DE VENTA
   */
  async obtenerDetalleDevolucion(codigoDevolucion, idCliente = null) {
    let devolucion;
    
    // Buscar por código de devolución o código QR
    if (codigoDevolucion.startsWith('QR-')) {
      devolucion = await Devolucion.buscarPorCodigoQR(codigoDevolucion);
    } else {
      devolucion = await Devolucion.buscarPorCodigo(codigoDevolucion);
    }
    
    if (!devolucion) {
      throw new Error('Devolución no encontrada');
    }
    
    // Si se proporciona idCliente, verificar que sea el dueño
    if (idCliente && devolucion.id_cliente.toString() !== idCliente) {
      throw new Error('No tienes permisos para ver esta devolución');
    }
    
    // Obtener venta asociada CON INFORMACIÓN DE DEVOLUCIONES
    const venta = await Venta.findById(devolucion.id_venta)
      .select('numero_venta fecha_creacion totales envio sistema_devolucion items')
      .populate('sistema_devolucion');
    
    return {
      devolucion: devolucion.toObject(),
      venta_info: venta,
      resumen_devolucion_venta: venta ? venta.obtenerResumenDevoluciones() : null
    };
  }
  
  /**
   * Aprobar devolución CON SINCRONIZACIÓN DE VENTA
   */
  async aprobarDevolucion(codigoDevolucion, idUsuarioAdmin, notas = '') {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const devolucion = await Devolucion.buscarPorCodigo(codigoDevolucion).session(session);
      
      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }
      
      // Aplicar cambios en devolución
      devolucion.aprobar(idUsuarioAdmin, notas);
      await devolucion.save({ session });
      
      // **SINCRONIZAR CON VENTA**
      const venta = await Venta.findById(devolucion.id_venta).session(session);
      if (venta) {
        venta.aprobarDevolucion(devolucion.codigo_devolucion, idUsuarioAdmin);
        await venta.save({ session });
      }
      
      await session.commitTransaction();
      
      // Enviar notificación al cliente
      this._enviarNotificacionAprobacion(devolucion).catch(err =>
        console.error('Error enviando notificación:', err)
      );
      
      return devolucion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Rechazar devolución CON SINCRONIZACIÓN DE VENTA
   */
  async rechazarDevolucion(codigoDevolucion, idUsuarioAdmin, motivo) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const devolucion = await Devolucion.buscarPorCodigo(codigoDevolucion).session(session);
      
      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }
      
      if (!motivo) {
        throw new Error('Debe proporcionar un motivo para rechazar la devolución');
      }
      
      // Aplicar cambios en devolución
      devolucion.rechazar(idUsuarioAdmin, motivo);
      await devolucion.save({ session });
      
      // **SINCRONIZAR CON VENTA**
      const venta = await Venta.findById(devolucion.id_venta).session(session);
      if (venta) {
        venta.rechazarDevolucion(devolucion.codigo_devolucion, idUsuarioAdmin, motivo);
        await venta.save({ session });
      }
      
      await session.commitTransaction();
      
      // Enviar notificación al cliente
      this._enviarNotificacionRechazo(devolucion, motivo).catch(err =>
        console.error('Error enviando notificación:', err)
      );
      
      return devolucion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Marcar devolución como recibida
   */
  async marcarComoRecibida(codigoDevolucion, idUsuarioAdmin, datosRecepcion = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const devolucion = await Devolucion.buscarPorCodigo(codigoDevolucion).session(session);
      
      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }
      
      // Aplicar cambios sin guardar
      devolucion.marcarComoRecibida(idUsuarioAdmin, datosRecepcion);
      
      // Guardar con la sesión
      await devolucion.save({ session });
      
      await session.commitTransaction();
      
      return devolucion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Inspeccionar item de devolución
   */
  async inspeccionarItem(codigoDevolucion, idItem, datosInspeccion, idUsuarioAdmin) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const devolucion = await Devolucion.buscarPorCodigo(codigoDevolucion).session(session);
      
      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }
      
      const { resultado, notas, porcentajeReembolso } = datosInspeccion;
      
      if (!resultado || !['aprobado', 'rechazado', 'aprobado_parcial'].includes(resultado)) {
        throw new Error('Resultado de inspección no válido');
      }
      
      // Aplicar cambios sin guardar
      devolucion.inspeccionarItem(
        idItem,
        resultado,
        idUsuarioAdmin,
        notas,
        porcentajeReembolso || (resultado === 'aprobado' ? 100 : 0)
      );
      
      // Guardar con la sesión
      await devolucion.save({ session });
      
      await session.commitTransaction();
      
      // Si todos los items han sido inspeccionados, proceder con el reembolso
      if (devolucion.estado === 'reembolso_aprobado') {
        // Notificar al cliente sobre el resultado de la inspección
        this._enviarNotificacionInspeccion(devolucion).catch(err =>
          console.error('Error enviando notificación:', err)
        );
      }
      
      return devolucion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Procesar reembolso de devolución CON SINCRONIZACIÓN COMPLETA
   */
  async procesarReembolso(codigoDevolucion, idUsuarioAdmin, opcionesInventario = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const devolucion = await Devolucion.buscarPorCodigo(codigoDevolucion).session(session);
      
      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }
      
      const venta = await Venta.findById(devolucion.id_venta).session(session);
      
      if (!venta) {
        throw new Error('Venta original no encontrada');
      }
      
      // Preparar datos de reembolso
      const datosReembolso = {
        metodo: 'tarjeta_original',
        id_tarjeta_original: venta.pago.id_tarjeta,
        referencia: `REF-${devolucion.codigo_devolucion}-${Date.now()}`,
        notas: `Reembolso por devolución ${devolucion.codigo_devolucion}`
      };
      
      // Aplicar cambios en devolución
      devolucion.procesarReembolso(datosReembolso, idUsuarioAdmin);
      await devolucion.save({ session });
      
      // Procesar reembolso monetario
      try {
        await tarjetaService.modificarSaldo(
          venta.pago.id_tarjeta,
          devolucion.id_cliente,
          devolucion.totales.monto_aprobado_reembolso,
          `Reembolso devolución ${devolucion.codigo_devolucion}`
        );
        
        devolucion.completarReembolso(idUsuarioAdmin, datosReembolso.referencia);
        await devolucion.save({ session });
        
      } catch (errorReembolso) {
        throw new Error(`Error procesando reembolso: ${errorReembolso.message}`);
      }
      
      // **PROCESAR INVENTARIO CON MÉTODO MEJORADO**
      console.log('Procesando devolución de stock con método mejorado...');
      const itemsReembolsados = [];
      
      for (const item of devolucion.items) {
        if (item.monto_reembolso > 0) {
          try {
            // Usar el nuevo método del modelo de inventario
            const resultadoStock = await Inventario.procesarDevolucionStock({
              id_libro: item.id_libro,
              cantidad: item.cantidad_a_devolver,
              id_usuario_admin: idUsuarioAdmin,
              codigo_devolucion: devolucion.codigo_devolucion,
              preferencia_tienda: opcionesInventario.tienda_preferida || null
            }, session);
            
            console.log(`✅ Stock procesado: ${item.info_libro.titulo} - ${item.cantidad_a_devolver} unidades a tienda ${resultadoStock.tienda_destino}`);
            
            itemsReembolsados.push({
              id_item: item._id,
              cantidad_devuelta: item.cantidad_a_devolver,
              monto_reembolsado: item.monto_reembolso,
              tienda_destino: resultadoStock.tienda_destino
            });
            
          } catch (errorStock) {
            console.error(`Error procesando stock para ${item.info_libro.titulo}:`, errorStock);
            // Continuar con otros items, pero registrar el error
            itemsReembolsados.push({
              id_item: item._id,
              cantidad_devuelta: 0,
              monto_reembolsado: item.monto_reembolso,
              error_stock: errorStock.message
            });
          }
        }
      }
      
      // Sincronizar con venta
      venta.completarDevolucion(
        devolucion.codigo_devolucion,
        itemsReembolsados,
        devolucion.totales.monto_aprobado_reembolso,
        idUsuarioAdmin
      );
      
      await venta.save({ session });
      
      await session.commitTransaction();
      
      // Enviar notificación
      this._enviarNotificacionReembolso(devolucion).catch(err =>
        console.error('Error enviando notificación:', err)
      );
      
      return devolucion;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Encontrar el mejor inventario para devolver stock
   * @private
   */
  async _encontrarMejorInventarioParaDevolucion(idLibro, session, preferenciasTienda = null) {
    try {
      // Usar el nuevo método estático del modelo de inventario
      const resultado = await Inventario.procesarDevolucionStock({
        id_libro: idLibro,
        cantidad: 0, // Solo para encontrar, no para procesar todavía
        preferencia_tienda: preferenciasTienda
      }, session);
      
      return resultado.inventario_actualizado;
      
    } catch (error) {
      console.error('Error encontrando inventario para devolución:', error);
      throw error;
    }
  }
  
  /**
   * Cancelar devolución CON SINCRONIZACIÓN
   */
  async cancelarDevolucion(codigoDevolucion, idUsuario, motivo, esAdmin = false) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const devolucion = await Devolucion.buscarPorCodigo(codigoDevolucion).session(session);
      
      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }
      
      // Verificar permisos
      if (!esAdmin && devolucion.id_cliente.toString() !== idUsuario) {
        throw new Error('No tienes permisos para cancelar esta devolución');
      }
      
      // Aplicar cambios sin guardar
      devolucion.cancelar(idUsuario, motivo);
      
      // Guardar con la sesión
      await devolucion.save({ session });
      
      // **SINCRONIZAR CON VENTA SI APLICA**
      if (devolucion.estado === 'cancelada') {
        const venta = await Venta.findById(devolucion.id_venta).session(session);
        if (venta) {
          // Liberar items que estaban en proceso de devolución
          for (const item of venta.items) {
            if (item.devolucion_info.tiene_devolucion_activa) {
              item.devolucion_info.tiene_devolucion_activa = false;
              item.devolucion_info.cantidad_disponible_devolucion = 
                item.cantidad - item.devolucion_info.cantidad_devuelta;
            }
          }
          
          // Si no hay otras devoluciones activas, resetear estado
          const otrasDevolucionesActivas = await Devolucion.countDocuments({
            id_venta: venta._id,
            estado: { $in: ['solicitada', 'aprobada', 'esperando_envio', 'en_transito', 'recibida', 'en_inspeccion'] }
          }).session(session);
          
          if (otrasDevolucionesActivas === 0) {
            if (venta.sistema_devolucion.monto_total_devuelto === 0) {
              venta.sistema_devolucion.estado_devolucion = 'sin_devolucion';
              venta.sistema_devolucion.tiene_devoluciones = false;
            }
          }
          
          venta.registrarEvento(
            'devolucion_cancelada',
            `Devolución ${devolucion.codigo_devolucion} cancelada: ${motivo}`,
            idUsuario
          );
          
          await venta.save({ session });
        }
      }
      
      await session.commitTransaction();
      
      return devolucion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Agregar documento a devolución
   */
  async agregarDocumento(codigoDevolucion, archivo, tipo, idUsuario) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const devolucion = await Devolucion.buscarPorCodigo(codigoDevolucion).session(session);
      
      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }
      
      // Verificar permisos
      const esCliente = devolucion.id_cliente.toString() === idUsuario;
      if (!esCliente) {
        // Verificar si es admin
        const usuario = await mongoose.model('Usuario').findById(idUsuario);
        if (!['administrador', 'root'].includes(usuario.tipo_usuario)) {
          throw new Error('No tienes permisos para agregar documentos a esta devolución');
        }
      }
      
      // Guardar archivo
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
      const devolucionesDir = path.join(uploadDir, 'devoluciones', devolucion.codigo_devolucion);
      
      // Crear directorio si no existe
      await fs.mkdir(devolucionesDir, { recursive: true });
      
      const nombreArchivo = `${tipo}_${Date.now()}_${archivo.originalname}`;
      const rutaArchivo = path.join(devolucionesDir, nombreArchivo);
      
      await fs.rename(archivo.path, rutaArchivo);
      
      // Guardar referencia en la devolución (sin guardar)
      const baseUrl = process.env.BASE_URL || 'https://librosfera.onrender.com/';
      const urlArchivo = `${baseUrl}/uploads/devoluciones/${devolucion.codigo_devolucion}/${nombreArchivo}`;
      
      devolucion.agregarDocumento({
        tipo,
        url: urlArchivo,
        nombre_archivo: nombreArchivo,
        subido_por: esCliente ? 'cliente' : 'administrador'
      });
      
      // Guardar con la sesión
      await devolucion.save({ session });
      
      await session.commitTransaction();
      
      return devolucion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Obtener devoluciones para administradores CON INFORMACIÓN DE VENTA
   */
  async obtenerDevolucionesAdmin(filtros = {}, opciones = {}) {
    const {
      page = 1,
      limit = 20,
      ordenar = '-fecha_solicitud',
      incluir_venta = true
    } = opciones;
    
    const query = {};
    
    if (filtros.estado) query.estado = filtros.estado;
    if (filtros.cliente) query.id_cliente = filtros.cliente;
    if (filtros.codigo) query.codigo_devolucion = new RegExp(filtros.codigo, 'i');
    if (filtros.fecha_desde) query.fecha_solicitud = { $gte: new Date(filtros.fecha_desde) };
    if (filtros.fecha_hasta) {
      query.fecha_solicitud = query.fecha_solicitud || {};
      query.fecha_solicitud.$lte = new Date(filtros.fecha_hasta);
    }
    
    let consulta = Devolucion.find(query)
      .populate('id_cliente', 'nombres apellidos email')
      .sort(ordenar)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    if (incluir_venta) {
      consulta = consulta.populate({
        path: 'id_venta',
        select: 'numero_venta fecha_creacion totales sistema_devolucion'
      });
    }
    
    const devoluciones = await consulta;
    const total = await Devolucion.countDocuments(query);
    
    return {
      devoluciones,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        totalPaginas: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * Obtener estadísticas de devoluciones MEJORADAS
   */
  async obtenerEstadisticasDevoluciones(fechaInicio, fechaFin) {
    const estadisticas = await Devolucion.aggregate([
      {
        $match: {
          fecha_solicitud: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin)
          }
        }
      },
      {
        $group: {
          _id: '$estado',
          cantidad: { $sum: 1 },
          monto_total: { $sum: '$totales.monto_aprobado_reembolso' },
          tiempo_promedio_resolucion: { 
            $avg: { 
              $subtract: ['$fecha_resolucion', '$fecha_solicitud'] 
            } 
          }
        }
      }
    ]);
    
    // Motivos más comunes
    const motivosFrecuentes = await Devolucion.aggregate([
      {
        $match: {
          fecha_solicitud: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin)
          }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.motivo',
          cantidad: { $sum: 1 },
          monto_promedio: { $avg: '$items.monto_reembolso' }
        }
      },
      { $sort: { cantidad: -1 } },
      { $limit: 5 }
    ]);
    
    // Estadísticas de tiempo de procesamiento
    const tiemposProcesamiento = await Devolucion.aggregate([
      {
        $match: {
          fecha_solicitud: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin)
          },
          estado: { $in: ['reembolso_completado', 'cerrada'] }
        }
      },
      {
        $project: {
          tiempo_total_dias: {
            $divide: [
              { $subtract: ['$fecha_resolucion', '$fecha_solicitud'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          tiempo_promedio: { $avg: '$tiempo_total_dias' },
          tiempo_minimo: { $min: '$tiempo_total_dias' },
          tiempo_maximo: { $max: '$tiempo_total_dias' }
        }
      }
    ]);
    
    return {
      por_estado: estadisticas,
      motivos_frecuentes: motivosFrecuentes,
      tiempos_procesamiento: tiemposProcesamiento[0] || {
        tiempo_promedio: 0,
        tiempo_minimo: 0,
        tiempo_maximo: 0
      }
    };
  }
  
  /**
   * NUEVO: Obtener resumen de devoluciones por venta
   */
  async obtenerResumenDevolucionesPorVenta(numeroVenta) {
    try {
      const venta = await Venta.findOne({ numero_venta: numeroVenta })
        .select('numero_venta sistema_devolucion totales');
      
      if (!venta) {
        throw new Error('Venta no encontrada');
      }
      
      const devoluciones = await Devolucion.find({ id_venta: venta._id })
        .select('codigo_devolucion estado fecha_solicitud totales');
      
      return {
        venta_info: {
          numero_venta: venta.numero_venta,
          total_venta: venta.totales.total_final,
          sistema_devolucion: venta.sistema_devolucion
        },
        devoluciones: devoluciones,
        resumen: venta.obtenerResumenDevoluciones()
      };
    } catch (error) {
      throw new Error(`Error obteniendo resumen de devoluciones: ${error.message}`);
    }
  }
  
  /**
   * NUEVO: Procesar devoluciones expiradas automáticamente
   */
  async procesarDevolucionesExpiradas() {
    try {
      // Buscar devoluciones que han expirado (más de 15 días sin envío)
      const fechaExpiracion = new Date();
      fechaExpiracion.setDate(fechaExpiracion.getDate() - 15);
      
      const devolucionesExpiradas = await Devolucion.find({
        estado: 'esperando_envio',
        fecha_limite_envio: { $lt: new Date() }
      });
      
      console.log(`Procesando ${devolucionesExpiradas.length} devoluciones expiradas`);
      
      for (const devolucion of devolucionesExpiradas) {
        await this.cancelarDevolucion(
          devolucion.codigo_devolucion,
          null, // usuario del sistema
          'Expiración automática - tiempo límite excedido',
          true // es operación administrativa
        );
      }
      
      return {
        procesadas: devolucionesExpiradas.length,
        fecha_ejecucion: new Date()
      };
      
    } catch (error) {
      console.error('Error procesando devoluciones expiradas:', error);
      throw error;
    }
  }
  
  // Métodos de notificación privados (actualizados)
  async _enviarEmailSolicitudDevolucion(devolucion, idCliente) {
    try {
      const usuario = await mongoose.model('Usuario').findById(idCliente);
      await emailService.sendReturnRequest(usuario.email, devolucion);
    } catch (error) {
      console.error('Error enviando email de solicitud:', error);
    }
  }
  
  async _enviarNotificacionAprobacion(devolucion) {
    try {
      const usuario = await mongoose.model('Usuario').findById(devolucion.id_cliente);
      await emailService.sendReturnApproval(usuario.email, devolucion);
    } catch (error) {
      console.error('Error enviando notificación de aprobación:', error);
    }
  }
  
  async _enviarNotificacionRechazo(devolucion, motivo) {
    try {
      const usuario = await mongoose.model('Usuario').findById(devolucion.id_cliente);
      await emailService.sendReturnRejection(usuario.email, devolucion, motivo);
    } catch (error) {
      console.error('Error enviando notificación de rechazo:', error);
    }
  }
  
  async _enviarNotificacionInspeccion(devolucion) {
    try {
      const usuario = await mongoose.model('Usuario').findById(devolucion.id_cliente);
      await emailService.sendInspectionResult(usuario.email, devolucion);
    } catch (error) {
      console.error('Error enviando notificación de inspección:', error);
    }
  }
  
  async _enviarNotificacionReembolso(devolucion) {
    try {
      const usuario = await mongoose.model('Usuario').findById(devolucion.id_cliente);
      await emailService.sendRefundConfirmation(usuario.email, devolucion);
    } catch (error) {
      console.error('Error enviando notificación de reembolso:', error);
    }
  }
}

module.exports = new DevolucionService();