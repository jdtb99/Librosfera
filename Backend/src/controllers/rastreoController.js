// src/controllers/rastreoController.js
const devolucionService = require('../../Database/services/devolucionService');
const ventaService = require('../../Database/services/ventaService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Rastrear devolución por código QR (público)
 * @route   GET /api/v1/rastreo/devolucion/:codigoDevolucion
 * @access  Public
 */
const rastrearDevolucion = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    
    if (!codigoDevolucion) {
      return next(new AppError('Código de devolución requerido', 400));
    }
    
    // Obtener información básica de la devolución (sin datos sensibles)
    const resultado = await devolucionService.obtenerDetalleDevolucion(codigoDevolucion);
    
    if (!resultado) {
      return next(new AppError('Devolución no encontrada', 404));
    }
    
    // Filtrar información sensible para rastreo público
    const informacionPublica = {
      codigo_devolucion: resultado.devolucion.codigo_devolucion,
      estado: resultado.devolucion.estado,
      fecha_solicitud: resultado.devolucion.fecha_solicitud,
      fecha_limite_envio: resultado.devolucion.fecha_limite_envio,
      fecha_resolucion: resultado.devolucion.fecha_resolucion,
      items: resultado.devolucion.items.map(item => ({
        titulo: item.info_libro.titulo,
        cantidad: item.cantidad_a_devolver,
        motivo: item.motivo,
        estado_item: item.estado_item
      })),
      totales: {
        monto_items_devolucion: resultado.devolucion.totales.monto_items_devolucion,
        monto_aprobado_reembolso: resultado.devolucion.totales.monto_aprobado_reembolso,
        monto_reembolsado: resultado.devolucion.totales.monto_reembolsado
      },
      historial: resultado.devolucion.historial.map(evento => ({
        evento: evento.evento,
        fecha: evento.fecha,
        descripcion: evento.descripcion
      })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
      venta_info: {
        numero_venta: resultado.venta_info?.numero_venta,
        fecha_compra: resultado.venta_info?.fecha_creacion
      }
    };
    
    res.status(200).json({
      status: 'success',
      data: informacionPublica
    });
  } catch (error) {
    console.error('Error rastreando devolución:', error);
    
    if (error.message === 'Devolución no encontrada') {
      return next(new AppError('Devolución no encontrada', 404));
    }
    
    return next(new AppError('Error al rastrear la devolución', 500));
  }
});

/**
 * @desc    Rastrear venta por número de guía (público)
 * @route   GET /api/v1/rastreo/envio/:numeroGuia
 * @access  Public
 */
const rastrearEnvio = catchAsync(async (req, res, next) => {
  try {
    const { numeroGuia } = req.params;
    
    if (!numeroGuia) {
      return next(new AppError('Número de guía requerido', 400));
    }
    
    // Buscar venta por número de guía
    const Venta = require('../../Database/models/ventaModel');
    const venta = await Venta.findOne({ 
      'envio.numero_guia': numeroGuia,
      estado: { $in: ['enviado', 'en_transito', 'entregado'] }
    }).select('numero_venta estado envio fecha_creacion items.snapshot.titulo items.cantidad');
    
    if (!venta) {
      return next(new AppError('Envío no encontrado', 404));
    }
    
    // Información pública del envío
    const informacionEnvio = {
      numero_venta: venta.numero_venta,
      numero_guia: venta.envio.numero_guia,
      empresa_envio: venta.envio.empresa_envio,
      estado: venta.estado,
      fecha_envio: venta.envio.fecha_envio,
      fecha_entrega_estimada: venta.envio.fecha_entrega_estimada,
      fecha_entrega_real: venta.envio.fecha_entrega_real,
      items: venta.items.map(item => ({
        titulo: item.snapshot.titulo,
        cantidad: item.cantidad
      })),
      historial: venta.historial.filter(evento => 
        ['cambio_estado', 'envio'].some(tipo => evento.evento.includes(tipo))
      ).map(evento => ({
        evento: evento.evento,
        fecha: evento.fecha,
        descripcion: evento.descripcion
      })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    };
    
    res.status(200).json({
      status: 'success',
      data: informacionEnvio
    });
  } catch (error) {
    console.error('Error rastreando envío:', error);
    return next(new AppError('Error al rastrear el envío', 500));
  }
});

/**
 * @desc    Validar código QR de devolución
 * @route   POST /api/v1/rastreo/validar-qr
 * @access  Public
 */
const validarCodigoQR = catchAsync(async (req, res, next) => {
  try {
    const { codigo_qr } = req.body;
    
    if (!codigo_qr) {
      return next(new AppError('Código QR requerido', 400));
    }
    
    // Buscar devolución por código QR
    const Devolucion = require('../../Database/models/devolucionModel');
    const devolucion = await Devolucion.buscarPorCodigoQR(codigo_qr);
    
    if (!devolucion) {
      return res.status(200).json({
        status: 'success',
        data: {
          valido: false,
          mensaje: 'Código QR no válido o no encontrado'
        }
      });
    }
    
    // QR válido
    res.status(200).json({
      status: 'success',
      data: {
        valido: true,
        codigo_devolucion: devolucion.codigo_devolucion,
        estado: devolucion.estado,
        url_rastreo: devolucion.qr_code.url_rastreo
      }
    });
  } catch (error) {
    console.error('Error validando código QR:', error);
    return next(new AppError('Error al validar el código QR', 500));
  }
});

/**
 * @desc    Obtener información básica de estado para dashboard público
 * @route   GET /api/v1/rastreo/estados
 * @access  Public
 */
const obtenerEstadosDisponibles = catchAsync(async (req, res, next) => {
  try {
    const estadosVenta = {
      'pendiente_pago': 'Pendiente de Pago',
      'pago_aprobado': 'Pago Aprobado',
      'preparando': 'En Preparación',
      'listo_para_envio': 'Listo para Envío',
      'enviado': 'Enviado',
      'en_transito': 'En Tránsito',
      'entregado': 'Entregado',
      'cancelado': 'Cancelado'
    };
    
    const estadosDevolucion = {
      'solicitada': 'Solicitada',
      'aprobada': 'Aprobada',
      'rechazada': 'Rechazada',
      'esperando_envio': 'Esperando Envío del Cliente',
      'en_transito': 'En Tránsito',
      'recibida': 'Recibida en Almacén',
      'en_inspeccion': 'En Inspección',
      'reembolso_aprobado': 'Reembolso Aprobado',
      'reembolso_procesando': 'Procesando Reembolso',
      'reembolso_completado': 'Reembolso Completado',
      'cerrada': 'Proceso Cerrado',
      'cancelada': 'Cancelada'
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        estados_venta: estadosVenta,
        estados_devolucion: estadosDevolucion
      }
    });
  } catch (error) {
    console.error('Error obteniendo estados:', error);
    return next(new AppError('Error al obtener estados', 500));
  }
});

module.exports = {
  rastrearDevolucion,
  rastrearEnvio,
  validarCodigoQR,
  obtenerEstadosDisponibles
};