// src/controllers/devolucionController.js
const devolucionService = require('../../Database/services/devolucionService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Obtener mis devoluciones ACTUALIZADO CON INFORMACIÓN DE VENTA
 * @route   GET /api/v1/devoluciones/mis-devoluciones
 * @access  Private/Cliente
 */
const obtenerMisDevoluciones = catchAsync(async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      estado,
      incluir_venta = 'true'
    } = req.query;

    const resultado = await devolucionService.obtenerDevolucionesCliente(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      estado,
      incluir_venta: incluir_venta === 'true'
    });

    res.status(200).json({
      status: 'success',
      resultados: resultado.devoluciones.length,
      estadisticas: resultado.estadisticas,
      data: resultado.devoluciones
    });
  } catch (error) {
    console.error('Error obteniendo devoluciones:', error);
    return next(new AppError('Error al obtener las devoluciones', 500));
  }
});

/**
 * @desc    Obtener detalle de una devolución ACTUALIZADO CON INFORMACIÓN COMPLETA
 * @route   GET /api/v1/devoluciones/:codigoDevolucion
 * @access  Private/Cliente o Admin
 */
const obtenerDetalleDevolucion = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    
    // Si es cliente, solo puede ver sus propias devoluciones
    const idCliente = req.user.tipo_usuario === 'cliente' ? req.user._id : null;
    
    const resultado = await devolucionService.obtenerDetalleDevolucion(
      codigoDevolucion,
      idCliente
    );

    res.status(200).json({
      status: 'success',
      data: {
        devolucion: resultado.devolucion,
        venta_info: resultado.venta_info,
        resumen_devolucion_venta: resultado.resumen_devolucion_venta
      }
    });
  } catch (error) {
    console.error('Error obteniendo detalle de devolución:', error);
    
    if (error.message === 'Devolución no encontrada') {
      return next(new AppError('Devolución no encontrada', 404));
    }
    
    if (error.message.includes('No tienes permisos')) {
      return next(new AppError(error.message, 403));
    }
    
    return next(new AppError('Error al obtener detalle de la devolución', 500));
  }
});

/**
 * @desc    Cancelar devolución (cliente)
 * @route   PATCH /api/v1/devoluciones/:codigoDevolucion/cancelar
 * @access  Private/Cliente
 */
const cancelarDevolucionCliente = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      return next(new AppError('Debe proporcionar un motivo para la cancelación', 400));
    }

    const devolucionCancelada = await devolucionService.cancelarDevolucion(
      codigoDevolucion,
      req.user._id,
      motivo,
      false // no es admin
    );

    await req.logActivity('devolucion', 'cancelar_devolucion_cliente', {
      entidad_afectada: {
        tipo: 'devolucion',
        id: devolucionCancelada._id,
        codigo_devolucion: devolucionCancelada.codigo_devolucion
      },
      detalles: { motivo },
      nivel_importancia: 'medio'
    });

    res.status(200).json({
      status: 'success',
      message: 'Devolución cancelada exitosamente',
      data: {
        codigo_devolucion: devolucionCancelada.codigo_devolucion,
        estado: devolucionCancelada.estado
      }
    });
  } catch (error) {
    console.error('Error cancelando devolución:', error);
    
    if (error.message.includes('No tienes permisos')) {
      return next(new AppError(error.message, 403));
    }
    
    if (error.message.includes('No se puede cancelar')) {
      return next(new AppError(error.message, 400));
    }
    
    return next(new AppError('Error al cancelar la devolución', 500));
  }
});

/**
 * @desc    Subir documento para devolución
 * @route   POST /api/v1/devoluciones/:codigoDevolucion/documentos
 * @access  Private/Cliente o Admin
 */
const subirDocumento = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    const { tipo = 'foto_producto' } = req.body;

    if (!req.file) {
      return next(new AppError('No se ha subido ningún archivo', 400));
    }

    const tiposValidos = ['foto_producto', 'video', 'comprobante', 'otro'];
    if (!tiposValidos.includes(tipo)) {
      return next(new AppError('Tipo de documento no válido', 400));
    }

    const devolucionActualizada = await devolucionService.agregarDocumento(
      codigoDevolucion,
      req.file,
      tipo,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      message: 'Documento subido exitosamente',
      data: {
        codigo_devolucion: devolucionActualizada.codigo_devolucion,
        documentos: devolucionActualizada.documentos
      }
    });
  } catch (error) {
    console.error('Error subiendo documento:', error);
    
    if (error.message.includes('No tienes permisos')) {
      return next(new AppError(error.message, 403));
    }
    
    return next(new AppError('Error al subir el documento', 500));
  }
});

// CONTROLADORES ADMINISTRATIVOS

/**
 * @desc    Obtener todas las devoluciones (admin) ACTUALIZADO CON INFORMACIÓN DE VENTA
 * @route   GET /api/v1/devoluciones
 * @access  Private/Admin
 */
const obtenerDevoluciones = catchAsync(async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      estado,
      cliente,
      codigo,
      fecha_desde,
      fecha_hasta,
      incluir_venta = 'true',
      ordenar = '-fecha_solicitud'
    } = req.query;

    const resultado = await devolucionService.obtenerDevolucionesAdmin({
      estado,
      cliente,
      codigo,
      fecha_desde,
      fecha_hasta
    }, {
      page: parseInt(page),
      limit: parseInt(limit),
      ordenar,
      incluir_venta: incluir_venta === 'true'
    });

    res.status(200).json({
      status: 'success',
      resultados: resultado.devoluciones.length,
      paginacion: resultado.paginacion,
      data: resultado.devoluciones
    });
  } catch (error) {
    console.error('Error obteniendo devoluciones:', error);
    return next(new AppError('Error al obtener las devoluciones', 500));
  }
});

/**
 * @desc    Aprobar devolución
 * @route   PATCH /api/v1/devoluciones/:codigoDevolucion/aprobar
 * @access  Private/Admin
 */
const aprobarDevolucion = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    const { notas = '' } = req.body;

    const devolucionAprobada = await devolucionService.aprobarDevolucion(
      codigoDevolucion,
      req.user._id,
      notas
    );

    await req.logActivity('administracion', 'aprobar_devolucion', {
      entidad_afectada: {
        tipo: 'devolucion',
        id: devolucionAprobada._id,
        codigo_devolucion: devolucionAprobada.codigo_devolucion
      },
      detalles: {
        notas,
        cliente: devolucionAprobada.id_cliente
      },
      nivel_importancia: 'alto'
    });

    res.status(200).json({
      status: 'success',
      message: 'Devolución aprobada exitosamente',
      data: {
        codigo_devolucion: devolucionAprobada.codigo_devolucion,
        estado: devolucionAprobada.estado,
        fecha_limite_envio: devolucionAprobada.fecha_limite_envio
      }
    });
  } catch (error) {
    console.error('Error aprobando devolución:', error);
    return next(new AppError('Error al aprobar la devolución', 500));
  }
});

/**
 * @desc    Rechazar devolución
 * @route   PATCH /api/v1/devoluciones/:codigoDevolucion/rechazar
 * @access  Private/Admin
 */
const rechazarDevolucion = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      return next(new AppError('Debe proporcionar un motivo para el rechazo', 400));
    }

    const devolucionRechazada = await devolucionService.rechazarDevolucion(
      codigoDevolucion,
      req.user._id,
      motivo
    );

    await req.logActivity('administracion', 'rechazar_devolucion', {
      entidad_afectada: {
        tipo: 'devolucion',
        id: devolucionRechazada._id,
        codigo_devolucion: devolucionRechazada.codigo_devolucion
      },
      detalles: {
        motivo,
        cliente: devolucionRechazada.id_cliente
      },
      nivel_importancia: 'alto'
    });

    res.status(200).json({
      status: 'success',
      message: 'Devolución rechazada',
      data: {
        codigo_devolucion: devolucionRechazada.codigo_devolucion,
        estado: devolucionRechazada.estado
      }
    });
  } catch (error) {
    console.error('Error rechazando devolución:', error);
    return next(new AppError('Error al rechazar la devolución', 500));
  }
});

/**
 * @desc    Marcar devolución como recibida
 * @route   PATCH /api/v1/devoluciones/:codigoDevolucion/recibir
 * @access  Private/Admin
 */
const marcarComoRecibida = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    const { notas } = req.body;

    const devolucionRecibida = await devolucionService.marcarComoRecibida(
      codigoDevolucion,
      req.user._id,
      { notas }
    );

    await req.logActivity('administracion', 'recibir_devolucion', {
      entidad_afectada: {
        tipo: 'devolucion',
        id: devolucionRecibida._id,
        codigo_devolucion: devolucionRecibida.codigo_devolucion
      },
      detalles: { notas },
      nivel_importancia: 'medio'
    });

    res.status(200).json({
      status: 'success',
      message: 'Productos recibidos, iniciando inspección',
      data: {
        codigo_devolucion: devolucionRecibida.codigo_devolucion,
        estado: devolucionRecibida.estado
      }
    });
  } catch (error) {
    console.error('Error marcando como recibida:', error);
    return next(new AppError('Error al marcar como recibida', 500));
  }
});

/**
 * @desc    Inspeccionar item de devolución
 * @route   PATCH /api/v1/devoluciones/:codigoDevolucion/items/:idItem/inspeccionar
 * @access  Private/Admin
 */
const inspeccionarItem = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion, idItem } = req.params;
    const { resultado, notas, porcentajeReembolso } = req.body;

    if (!resultado || !['aprobado', 'rechazado', 'aprobado_parcial'].includes(resultado)) {
      return next(new AppError('Resultado de inspección no válido', 400));
    }

    if (resultado === 'aprobado_parcial' && (!porcentajeReembolso || porcentajeReembolso < 0 || porcentajeReembolso > 100)) {
      return next(new AppError('Porcentaje de reembolso no válido', 400));
    }

    const devolucionActualizada = await devolucionService.inspeccionarItem(
      codigoDevolucion,
      idItem,
      { resultado, notas, porcentajeReembolso },
      req.user._id
    );

    await req.logActivity('administracion', 'inspeccionar_item_devolucion', {
      entidad_afectada: {
        tipo: 'devolucion',
        id: devolucionActualizada._id,
        codigo_devolucion: devolucionActualizada.codigo_devolucion
      },
      detalles: {
        id_item: idItem,
        resultado,
        porcentajeReembolso
      },
      nivel_importancia: 'medio'
    });

    res.status(200).json({
      status: 'success',
      message: 'Inspección registrada',
      data: {
        codigo_devolucion: devolucionActualizada.codigo_devolucion,
        estado: devolucionActualizada.estado,
        item_inspeccionado: idItem,
        monto_aprobado_total: devolucionActualizada.totales.monto_aprobado_reembolso
      }
    });
  } catch (error) {
    console.error('Error inspeccionando item:', error);
    return next(new AppError(`Error en inspección: ${error.message}`, 400));
  }
});

/**
 * @desc    Procesar reembolso
 * @route   PATCH /api/v1/devoluciones/:codigoDevolucion/reembolsar
 * @access  Private/Admin
 */
const procesarReembolso = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;

    const devolucionReembolsada = await devolucionService.procesarReembolso(
      codigoDevolucion,
      req.user._id
    );

    await req.logActivity('administracion', 'procesar_reembolso', {
      entidad_afectada: {
        tipo: 'devolucion',
        id: devolucionReembolsada._id,
        codigo_devolucion: devolucionReembolsada.codigo_devolucion
      },
      detalles: {
        monto_reembolsado: devolucionReembolsada.totales.monto_reembolsado,
        referencia: devolucionReembolsada.reembolso.referencia_reembolso
      },
      nivel_importancia: 'critico'
    });

    res.status(200).json({
      status: 'success',
      message: 'Reembolso procesado exitosamente',
      data: {
        codigo_devolucion: devolucionReembolsada.codigo_devolucion,
        estado: devolucionReembolsada.estado,
        monto_reembolsado: devolucionReembolsada.totales.monto_reembolsado,
        referencia: devolucionReembolsada.reembolso.referencia_reembolso
      }
    });
  } catch (error) {
    console.error('Error procesando reembolso:', error);
    return next(new AppError(`Error al procesar reembolso: ${error.message}`, 500));
  }
});

/**
 * @desc    Obtener estadísticas de devoluciones ACTUALIZADO
 * @route   GET /api/v1/devoluciones/estadisticas
 * @access  Private/Admin
 */
const obtenerEstadisticas = catchAsync(async (req, res, next) => {
  try {
    const {
      fecha_inicio = new Date(new Date().setMonth(new Date().getMonth() - 1)),
      fecha_fin = new Date()
    } = req.query;

    const estadisticas = await devolucionService.obtenerEstadisticasDevoluciones(
      fecha_inicio,
      fecha_fin
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...estadisticas,
        periodo: {
          fecha_inicio,
          fecha_fin
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return next(new AppError('Error al obtener estadísticas', 500));
  }
});

/**
 * NUEVO ENDPOINT: Obtener resumen de devoluciones por venta
 * @route   GET /api/v1/devoluciones/venta/:numeroVenta/resumen
 * @access  Private/Admin
 */
const obtenerResumenDevolucionesPorVenta = catchAsync(async (req, res, next) => {
  try {
    const { numeroVenta } = req.params;

    const resumen = await devolucionService.obtenerResumenDevolucionesPorVenta(numeroVenta);

    res.status(200).json({
      status: 'success',
      data: resumen
    });
  } catch (error) {
    console.error('Error obteniendo resumen de devoluciones por venta:', error);
    
    if (error.message.includes('Venta no encontrada')) {
      return next(new AppError('Venta no encontrada', 404));
    }
    
    return next(new AppError('Error al obtener resumen de devoluciones', 500));
  }
});

/**
 * NUEVO ENDPOINT: Procesar devoluciones expiradas
 * @route   POST /api/v1/devoluciones/procesar-expiradas
 * @access  Private/Admin
 */
const procesarDevolucionesExpiradas = catchAsync(async (req, res, next) => {
  try {
    const resultado = await devolucionService.procesarDevolucionesExpiradas();

    await req.logActivity('administracion', 'procesar_devoluciones_expiradas', {
      cantidad_procesada: resultado.procesadas,
      fecha_ejecucion: resultado.fecha_ejecucion
    }, 'medio');

    res.status(200).json({
      status: 'success',
      message: `Se procesaron ${resultado.procesadas} devoluciones expiradas`,
      data: resultado
    });
  } catch (error) {
    console.error('Error procesando devoluciones expiradas:', error);
    return next(new AppError('Error al procesar devoluciones expiradas', 500));
  }
});

/**
 * @desc    Cancelar devolución (admin)
 * @route   DELETE /api/v1/devoluciones/:codigoDevolucion
 * @access  Private/Admin
 */
const cancelarDevolucionAdmin = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      return next(new AppError('Debe proporcionar un motivo para la cancelación', 400));
    }

    const devolucionCancelada = await devolucionService.cancelarDevolucion(
      codigoDevolucion,
      req.user._id,
      motivo,
      true // es admin
    );

    await req.logActivity('administracion', 'cancelar_devolucion_admin', {
      entidad_afectada: {
        tipo: 'devolucion',
        id: devolucionCancelada._id,
        codigo_devolucion: devolucionCancelada.codigo_devolucion
      },
      detalles: {
        motivo,
        cliente_afectado: devolucionCancelada.id_cliente
      },
      nivel_importancia: 'alto'
    });

    res.status(200).json({
      status: 'success',
      message: 'Devolución cancelada por administrador',
      data: {
        codigo_devolucion: devolucionCancelada.codigo_devolucion,
        estado: devolucionCancelada.estado
      }
    });
  } catch (error) {
    console.error('Error cancelando devolución (admin):', error);
    return next(new AppError('Error al cancelar la devolución', 500));
  }
});

/**
 * @desc    Agregar comunicación a devolución
 * @route   POST /api/v1/devoluciones/:codigoDevolucion/comunicaciones
 * @access  Private/Admin
 */
const agregarComunicacion = catchAsync(async (req, res, next) => {
  try {
    const { codigoDevolucion } = req.params;
    const { tipo, asunto, mensaje } = req.body;

    if (!tipo || !asunto || !mensaje) {
      return next(new AppError('Tipo, asunto y mensaje son obligatorios', 400));
    }

    const tiposValidos = ['email', 'sms', 'llamada', 'nota_interna'];
    if (!tiposValidos.includes(tipo)) {
      return next(new AppError('Tipo de comunicación no válido', 400));
    }

    const devolucion = await devolucionService.obtenerDetalleDevolucion(codigoDevolucion);
    
    await devolucion.devolucion.agregarComunicacion(
      tipo,
      asunto,
      mensaje,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      message: 'Comunicación registrada exitosamente'
    });
  } catch (error) {
    console.error('Error agregando comunicación:', error);
    return next(new AppError('Error al agregar comunicación', 500));
  }
});

module.exports = {
  // Cliente
  obtenerMisDevoluciones,
  obtenerDetalleDevolucion,
  cancelarDevolucionCliente,
  subirDocumento,
  
  // Admin
  obtenerDevoluciones,
  aprobarDevolucion,
  rechazarDevolucion,
  marcarComoRecibida,
  inspeccionarItem,
  procesarReembolso,
  obtenerEstadisticas,
  cancelarDevolucionAdmin,
  agregarComunicacion,
  obtenerResumenDevolucionesPorVenta,
  procesarDevolucionesExpiradas
};