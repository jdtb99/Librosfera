//src/controllers/mensajeriaController.js
const { mensajeriaService } = require('../../Database/services');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Crear una nueva conversación
 * @route   POST /api/v1/mensajeria/conversaciones
 * @access  Private/Cliente
 */
const crearConversacion = catchAsync(async (req, res, next) => {
  const { asunto, categoria, prioridad, mensaje_inicial } = req.body;
  
  // Validaciones
  if (!asunto || !mensaje_inicial) {
    return next(new AppError('El asunto y mensaje inicial son obligatorios', 400));
  }
  
  if (req.user.tipo_usuario !== 'cliente') {
    return next(new AppError('Solo los clientes pueden crear conversaciones', 403));
  }
  
  try {
    // Crear conversación
    const conversacion = await mensajeriaService.crearConversacion(req.user._id, {
      asunto,
      categoria,
      prioridad
    });
    
    // Enviar mensaje inicial
    const primerMensaje = await mensajeriaService.enviarMensaje(
      conversacion._id,
      req.user._id,
      {
        contenido: mensaje_inicial,
        archivos: req.archivosData || []
      }
    );
    
    await req.logActivity('mensajeria', 'conversacion_creada', {
      entidad_afectada: {
        tipo: 'conversacion',
        id: conversacion._id,
        asunto: conversacion.asunto
      },
      detalles: {
        categoria: conversacion.categoria,
        prioridad: conversacion.prioridad
      }
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        conversacion,
        primer_mensaje: primerMensaje
      }
    });
    
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * @desc    Obtener conversaciones del usuario
 * @route   GET /api/v1/mensajeria/conversaciones
 * @access  Private
 */
const obtenerConversaciones = catchAsync(async (req, res, next) => {
  const {
    estado,
    categoria,
    prioridad,
    admin_asignado,
    no_leidas,
    buscar,
    fecha_desde,
    fecha_hasta,
    page = 1,
    limit = 10,
    ordenar_por = 'fecha_actualizacion',
    orden_desc = true
  } = req.query;
  
  const filtros = {};
  
  if (estado) filtros.estado = Array.isArray(estado) ? estado : [estado];
  if (categoria) filtros.categoria = categoria;
  if (prioridad) filtros.prioridad = prioridad;
  if (admin_asignado) filtros.admin_asignado = admin_asignado;
  if (buscar) filtros.buscar_texto = buscar;
  if (fecha_desde) filtros.fecha_desde = fecha_desde;
  if (fecha_hasta) filtros.fecha_hasta = fecha_hasta;
  
  // Filtro específico para mensajes no leídos
  if (no_leidas === 'true') {
    if (req.user.tipo_usuario === 'cliente') {
      filtros.no_leidas_cliente = true;
    } else {
      filtros.no_leidas_admin = true;
    }
  }
  
  filtros.ordenar_por = ordenar_por;
  filtros.orden_desc = orden_desc === 'true';
  
  try {
    const resultado = await mensajeriaService.obtenerConversaciones(
      req.user._id,
      filtros,
      parseInt(page),
      parseInt(limit)
    );
    
    res.status(200).json({
      status: 'success',
      resultados: resultado.conversaciones.length,
      ...resultado
    });
    
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * @desc    Obtener una conversación específica con sus mensajes
 * @route   GET /api/v1/mensajeria/conversaciones/:id
 * @access  Private
 */
const obtenerConversacion = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 50 } = req.query;
  
  try {
    const resultado = await mensajeriaService.obtenerMensajesConversacion(
      req.params.id,
      req.user._id,
      parseInt(page),
      parseInt(limit)
    );
    
    res.status(200).json({
      status: 'success',
      data: resultado
    });
    
  } catch (error) {
    return next(new AppError(error.message, error.message.includes('permisos') ? 403 : 404));
  }
});

/**
 * @desc    Enviar mensaje en una conversación
 * @route   POST /api/v1/mensajeria/conversaciones/:id/mensajes
 * @access  Private
 */
const enviarMensaje = catchAsync(async (req, res, next) => {
  const { contenido, respuesta_a, tipo = 'mensaje' } = req.body;
  
  if (!contenido || contenido.trim() === '') {
    return next(new AppError('El contenido del mensaje es obligatorio', 400));
  }
  
  // Validar que solo admins puedan enviar ciertos tipos de mensaje
  if (['nota_interna', 'cambio_estado', 'asignacion'].includes(tipo) && 
      !['administrador', 'root'].includes(req.user.tipo_usuario)) {
    return next(new AppError('No tiene permisos para enviar este tipo de mensaje', 403));
  }
  
  try {
    const datosDelMensaje = {
      contenido: contenido.trim(),
      tipo,
      respuesta_a,
      archivos: req.archivosData || [],
      metadata: {
        ip_remitente: req.ip,
        user_agent: req.get('User-Agent')
      }
    };
    
    const mensaje = await mensajeriaService.enviarMensaje(
      req.params.id,
      req.user._id,
      datosDelMensaje
    );
    
    await req.logActivity('mensajeria', 'mensaje_enviado', {
      entidad_afectada: {
        tipo: 'conversacion',
        id: req.params.id
      },
      detalles: {
        tipo_mensaje: tipo,
        con_archivos: req.archivosData?.length > 0,
        longitud_contenido: contenido.length
      }
    });
    
    res.status(201).json({
      status: 'success',
      data: mensaje
    });
    
  } catch (error) {
    return next(new AppError(error.message, error.message.includes('permisos') ? 403 : 400));
  }
});

/**
 * @desc    Marcar conversación como leída
 * @route   PATCH /api/v1/mensajeria/conversaciones/:id/leer
 * @access  Private
 */
const marcarComoLeida = catchAsync(async (req, res, next) => {
  try {
    const tipoUsuario = req.user.tipo_usuario === 'cliente' ? 'cliente' : 'administrador';
    
    await mensajeriaService.marcarMensajesComoLeidos(
      req.params.id,
      req.user._id,
      tipoUsuario
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Conversación marcada como leída'
    });
    
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * @desc    Cambiar estado de conversación (Admin)
 * @route   PATCH /api/v1/mensajeria/conversaciones/:id/estado
 * @access  Private/Admin
 */
const cambiarEstado = catchAsync(async (req, res, next) => {
  const { estado } = req.body;
  
  if (!['administrador', 'root'].includes(req.user.tipo_usuario)) {
    return next(new AppError('Solo los administradores pueden cambiar el estado', 403));
  }
  
  const estadosValidos = ['abierta', 'en_progreso', 'esperando_cliente', 'cerrada', 'archivada'];
  if (!estado || !estadosValidos.includes(estado)) {
    return next(new AppError('Estado no válido', 400));
  }
  
  try {
    const conversacion = await mensajeriaService.cambiarEstadoConversacion(
      req.params.id,
      estado,
      req.user._id
    );
    
    await req.logActivity('mensajeria', 'cambio_estado_conversacion', {
      entidad_afectada: {
        tipo: 'conversacion',
        id: req.params.id
      },
      detalles: {
        estado_nuevo: estado,
        cambiado_por: req.user.usuario
      },
      nivel_importancia: 'medio'
    });
    
    res.status(200).json({
      status: 'success',
      data: conversacion
    });
    
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * @desc    Asignar administrador a conversación (Admin)
 * @route   PATCH /api/v1/mensajeria/conversaciones/:id/asignar
 * @access  Private/Admin
 */
const asignarAdministrador = catchAsync(async (req, res, next) => {
  const { admin_id } = req.body;
  
  if (!['administrador', 'root'].includes(req.user.tipo_usuario)) {
    return next(new AppError('Solo los administradores pueden asignar conversaciones', 403));
  }
  
  if (!admin_id) {
    return next(new AppError('ID del administrador es obligatorio', 400));
  }
  
  try {
    const conversacion = await mensajeriaService.asignarAdministrador(
      req.params.id,
      admin_id,
      req.user._id
    );
    
    await req.logActivity('mensajeria', 'asignacion_conversacion', {
      entidad_afectada: {
        tipo: 'conversacion',
        id: req.params.id
      },
      detalles: {
        admin_asignado: admin_id,
        asignado_por: req.user.usuario
      },
      nivel_importancia: 'medio'
    });
    
    res.status(200).json({
      status: 'success',
      data: conversacion
    });
    
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * @desc    Buscar en conversaciones y mensajes
 * @route   GET /api/v1/mensajeria/buscar
 * @access  Private
 */
const buscar = catchAsync(async (req, res, next) => {
  const { q, categoria, estado, fecha_desde, fecha_hasta } = req.query;
  
  if (!q || q.trim() === '') {
    return next(new AppError('Término de búsqueda es obligatorio', 400));
  }
  
  const filtros = {};
  if (categoria) filtros.categoria = categoria;
  if (estado) filtros.estado = estado;
  if (fecha_desde) filtros.fecha_desde = fecha_desde;
  if (fecha_hasta) filtros.fecha_hasta = fecha_hasta;
  
  try {
    const resultados = await mensajeriaService.buscar(
      q.trim(),
      req.user._id,
      filtros
    );
    
    res.status(200).json({
      status: 'success',
      data: resultados
    });
    
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * @desc    Obtener estadísticas de mensajería (Admin)
 * @route   GET /api/v1/mensajeria/estadisticas
 * @access  Private/Admin
 */
const obtenerEstadisticas = catchAsync(async (req, res, next) => {
  if (!['administrador', 'root'].includes(req.user.tipo_usuario)) {
    return next(new AppError('Solo los administradores pueden ver estadísticas', 403));
  }
  
  const { admin_id, fecha_desde, fecha_hasta } = req.query;
  
  try {
    const estadisticas = await mensajeriaService.obtenerEstadisticas(
      admin_id,
      fecha_desde,
      fecha_hasta
    );
    
    res.status(200).json({
      status: 'success',
      data: estadisticas
    });
    
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * @desc    Obtener contadores de mensajes no leídos
 * @route   GET /api/v1/mensajeria/contadores
 * @access  Private
 */
const obtenerContadores = catchAsync(async (req, res, next) => {
  try {
    const contadores = await mensajeriaService.obtenerContadoresNoLeidos(req.user._id);
    
    res.status(200).json({
      status: 'success',
      data: contadores
    });
    
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

module.exports = {
  crearConversacion,
  obtenerConversaciones,
  obtenerConversacion,
  enviarMensaje,
  marcarComoLeida,
  cambiarEstado,
  asignarAdministrador,
  buscar,
  obtenerEstadisticas,
  obtenerContadores
};