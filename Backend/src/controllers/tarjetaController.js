// src/controllers/tarjetaController.js
const { tarjetaService } = require('../../Database/services');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Registrar una nueva tarjeta
 * @route   POST /api/v1/tarjetas
 * @access  Private
 */
const registrarTarjeta = catchAsync(async (req, res, next) => {
  // Sanitizar y validar datos de entrada
  const {
    numero_tarjeta,
    nombre_titular,
    mes_expiracion,
    anio_expiracion,
    cvv,
    tipo,
    marca
  } = req.body;
  
  // Validaciones básicas
  if (!numero_tarjeta) {
    return next(new AppError('El número de tarjeta es obligatorio', 400));
  }
  
  if (!nombre_titular) {
    return next(new AppError('El nombre del titular es obligatorio', 400));
  }
  
  if (!mes_expiracion || !anio_expiracion) {
    return next(new AppError('La fecha de expiración es obligatoria', 400));
  }
  
  if (!cvv) {
    return next(new AppError('El código de seguridad (CVV) es obligatorio', 400));
  }
  
  // Validar que el tipo sea válido
  if (!tipo || !['credito', 'debito'].includes(tipo)) {
    return next(new AppError('El tipo de tarjeta debe ser crédito o débito', 400));
  }
  
  // Formatear datos para el servicio
  const datosTarjeta = {
    numero_tarjeta,
    nombre_titular,
    fecha_expiracion: {
      mes: parseInt(mes_expiracion),
      anio: parseInt(anio_expiracion)
    },
    tipo,
    marca: marca || undefined // Si no se proporciona, el servicio lo determinará
  };
  
  try {
    const nuevaTarjeta = await tarjetaService.registrarTarjeta(req.user._id, datosTarjeta);
    
    // No devolver datos sensibles
    delete nuevaTarjeta.token_seguro;
    
    // Registrar actividad
    await req.logActivity('usuario', 'registro_tarjeta', {
      id_tarjeta: nuevaTarjeta.id_tarjeta,
      tipo: nuevaTarjeta.tipo,
      marca: nuevaTarjeta.marca
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Tarjeta registrada correctamente',
      data: nuevaTarjeta
    });
  } catch (error) {
    return next(new AppError(`Error al registrar tarjeta: ${error.message}`, 400));
  }
});

/**
 * @desc    Establecer saldo absoluto en tarjeta de débito
 * @route   PUT /api/v1/tarjetas/:id/saldo/absoluto
 * @access  Private
 */
const establecerSaldoAbsoluto = catchAsync(async (req, res, next) => {
  const { saldo, descripcion } = req.body;
  
  // Validar que se proporcione el saldo
  if (saldo === undefined || saldo === null) {
    return next(new AppError('El saldo es obligatorio', 400));
  }
  
  // Convertir a número
  const saldoNumerico = parseFloat(saldo);
  
  if (isNaN(saldoNumerico)) {
    return next(new AppError('El saldo debe ser un número válido', 400));
  }
  
  // Validar que no sea negativo
  if (saldoNumerico < 0) {
    return next(new AppError('El saldo no puede ser negativo', 400));
  }
  
  // Validar límite máximo razonable (opcional - ajusta según tus necesidades)
  const SALDO_MAXIMO = 10000000;
  if (saldoNumerico > SALDO_MAXIMO) {
    return next(new AppError(`El saldo no puede exceder ${SALDO_MAXIMO}`, 400));
  }
  
  try {
    const resultado = await tarjetaService.establecerSaldoAbsoluto(
      req.params.id,
      req.user._id,
      saldoNumerico,
      descripcion || 'Establecimiento de saldo absoluto'
    );
    
    // Registrar actividad
    await req.logActivity('usuario', 'establecimiento_saldo_absoluto', {
      id_tarjeta: req.params.id,
      saldo_anterior: resultado.saldo_anterior,
      saldo_establecido: resultado.saldo_establecido,
      diferencia: resultado.diferencia,
      descripcion: resultado.descripcion
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Saldo establecido correctamente',
      data: resultado
    });
  } catch (error) {
    return next(new AppError(`Error al establecer saldo: ${error.message}`, 400));
  }
});

/**
 * @desc    Establecer saldo absoluto en cualquier tarjeta (Solo administradores)
 * @route   PUT /api/v1/admin/tarjetas/:id/saldo/absoluto
 * @access  Private/Admin
 */
const establecerSaldoAbsolutoAdmin = catchAsync(async (req, res, next) => {
  const { saldo, descripcion, motivo } = req.body;
  
  // Validar que se proporcione el saldo
  if (saldo === undefined || saldo === null) {
    return next(new AppError('El saldo es obligatorio', 400));
  }
  
  // Convertir a número
  const saldoNumerico = parseFloat(saldo);
  
  if (isNaN(saldoNumerico)) {
    return next(new AppError('El saldo debe ser un número válido', 400));
  }
  
  // Validar que no sea negativo
  if (saldoNumerico < 0) {
    return next(new AppError('El saldo no puede ser negativo', 400));
  }
  
  // Validar límite máximo
  const SALDO_MAXIMO = 10000000;
  if (saldoNumerico > SALDO_MAXIMO) {
    return next(new AppError(`El saldo no puede exceder ${SALDO_MAXIMO}`, 400));
  }
  
  // Para administradores, el motivo es obligatorio
  if (!motivo) {
    return next(new AppError('Los administradores deben proporcionar un motivo para la modificación', 400));
  }
  
  try {
    // Primero obtener información de la tarjeta para logs
    const tarjetaInfo = await tarjetaService.obtenerTarjetaPorId(req.params.id);
    
    if (!tarjetaInfo) {
      return next(new AppError('Tarjeta no encontrada', 404));
    }
    
    const resultado = await tarjetaService.establecerSaldoAbsoluto(
      req.params.id,
      tarjetaInfo.id_usuario, // Usar el usuario propietario de la tarjeta
      saldoNumerico,
      descripcion || `Ajuste administrativo: ${motivo}`
    );
    
    // Registrar actividad administrativa (más detallada)
    await req.logActivity('administracion', 'establecimiento_saldo_absoluto_admin', {
      id_tarjeta: req.params.id,
      usuario_afectado: tarjetaInfo.id_usuario,
      saldo_anterior: resultado.saldo_anterior,
      saldo_establecido: resultado.saldo_establecido,
      diferencia: resultado.diferencia,
      motivo: motivo,
      descripcion: resultado.descripcion,
      administrador_id: req.user._id,
      administrador_usuario: req.user.usuario
    }, 'alto'); // Nivel de importancia alto para acciones administrativas
    
    res.status(200).json({
      status: 'success',
      message: 'Saldo establecido correctamente por administrador',
      data: {
        ...resultado,
        motivo: motivo,
        administrador: {
          id: req.user._id,
          usuario: req.user.usuario
        },
        tarjeta_propietario: tarjetaInfo.id_usuario
      }
    });
  } catch (error) {
    return next(new AppError(`Error al establecer saldo: ${error.message}`, 400));
  }
});

/**
 * @desc    Obtener todas las tarjetas del usuario
 * @route   GET /api/v1/tarjetas
 * @access  Private
 */
const obtenerTarjetas = catchAsync(async (req, res, next) => {
  const tarjetas = await tarjetaService.obtenerTarjetasUsuario(req.user._id);
  
  // Eliminar datos sensibles
  tarjetas.forEach(tarjeta => {
    delete tarjeta.token_seguro;
  });
  
  res.status(200).json({
    status: 'success',
    resultados: tarjetas.length,
    data: tarjetas
  });
});

/**
 * @desc    Obtener una tarjeta específica
 * @route   GET /api/v1/tarjetas/:id
 * @access  Private
 */
const obtenerTarjeta = catchAsync(async (req, res, next) => {
  const tarjeta = await tarjetaService.obtenerTarjetaPorId(req.params.id, req.user._id);
  
  if (!tarjeta) {
    return next(new AppError('Tarjeta no encontrada', 404));
  }
  
  // Eliminar datos sensibles
  delete tarjeta.token_seguro;
  
  res.status(200).json({
    status: 'success',
    data: tarjeta
  });
});

/**
 * @desc    Actualizar una tarjeta
 * @route   PUT /api/v1/tarjetas/:id
 * @access  Private
 */
const actualizarTarjeta = catchAsync(async (req, res, next) => {
  const {
    nombre_titular,
    numero_tarjeta,
    mes_expiracion,
    anio_expiracion,
    tipo,
    marca,
    predeterminada
  } = req.body;
  
  // Formatear datos para el servicio
  const datosTarjeta = {};
  
  if (nombre_titular) datosTarjeta.nombre_titular = nombre_titular;
  if (numero_tarjeta) datosTarjeta.numero_tarjeta = numero_tarjeta;
  if (marca) datosTarjeta.marca = marca;
  if (tipo) datosTarjeta.tipo = tipo;
  if (predeterminada !== undefined) datosTarjeta.predeterminada = predeterminada;
  
  // Si se proporciona fecha de expiración
  if (mes_expiracion !== undefined || anio_expiracion !== undefined) {
    datosTarjeta.fecha_expiracion = {};
    
    // Obtener tarjeta actual para mantener valores existentes
    const tarjetaActual = await tarjetaService.obtenerTarjetaPorId(req.params.id, req.user._id);
    
    if (!tarjetaActual) {
      return next(new AppError('Tarjeta no encontrada', 404));
    }
    
    datosTarjeta.fecha_expiracion.mes = mes_expiracion !== undefined
      ? parseInt(mes_expiracion)
      : tarjetaActual.fecha_expiracion.mes;
      
    datosTarjeta.fecha_expiracion.anio = anio_expiracion !== undefined
      ? parseInt(anio_expiracion)
      : tarjetaActual.fecha_expiracion.anio;
  }
  
  try {
    const tarjetaActualizada = await tarjetaService.actualizarTarjeta(
      req.params.id,
      req.user._id,
      datosTarjeta
    );
    
    // Eliminar datos sensibles
    delete tarjetaActualizada.token_seguro;
    
    // Registrar actividad
    await req.logActivity('usuario', 'actualizacion_tarjeta', {
      id_tarjeta: tarjetaActualizada.id_tarjeta,
      campos_actualizados: Object.keys(datosTarjeta)
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Tarjeta actualizada correctamente',
      data: tarjetaActualizada
    });
  } catch (error) {
    return next(new AppError(`Error al actualizar tarjeta: ${error.message}`, 400));
  }
});

/**
 * @desc    Eliminar una tarjeta
 * @route   DELETE /api/v1/tarjetas/:id
 * @access  Private
 */
const eliminarTarjeta = catchAsync(async (req, res, next) => {
  try {
    await tarjetaService.eliminarTarjeta(req.params.id, req.user._id);
    
    // Registrar actividad
    await req.logActivity('usuario', 'eliminacion_tarjeta', {
      id_tarjeta: req.params.id
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Tarjeta eliminada correctamente'
    });
  } catch (error) {
    return next(new AppError(`Error al eliminar tarjeta: ${error.message}`, 400));
  }
});

/**
 * @desc    Establecer tarjeta predeterminada
 * @route   PATCH /api/v1/tarjetas/:id/predeterminada
 * @access  Private
 */
const establecerPredeterminada = catchAsync(async (req, res, next) => {
  try {
    const tarjeta = await tarjetaService.establecerTarjetaPredeterminada(req.params.id, req.user._id);
    
    // Eliminar datos sensibles
    delete tarjeta.token_seguro;
    
    // Registrar actividad
    await req.logActivity('usuario', 'cambio_tarjeta_predeterminada', {
      id_tarjeta: tarjeta.id_tarjeta
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Tarjeta establecida como predeterminada',
      data: tarjeta
    });
  } catch (error) {
    return next(new AppError(`Error al establecer tarjeta predeterminada: ${error.message}`, 400));
  }
});

/**
 * @desc    Verificar validez de tarjeta
 * @route   GET /api/v1/tarjetas/:id/verificar
 * @access  Private
 */
const verificarTarjeta = catchAsync(async (req, res, next) => {
  const resultado = await tarjetaService.verificarTarjeta(req.params.id);
  
  res.status(200).json({
    status: 'success',
    data: resultado
  });
});

/**
 * @desc    Verificar saldo de tarjeta de débito
 * @route   GET /api/v1/tarjetas/:id/saldo
 * @access  Private
 */
const verificarSaldo = catchAsync(async (req, res, next) => {
  try {
    const resultado = await tarjetaService.verificarSaldo(req.params.id, req.user._id);
    
    res.status(200).json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    return next(new AppError(`Error al verificar saldo: ${error.message}`, 400));
  }
});

/**
 * @desc    Modificar saldo de tarjeta de débito
 * @route   PATCH /api/v1/tarjetas/:id/saldo
 * @access  Private
 */
const modificarSaldo = catchAsync(async (req, res, next) => {
  const { monto, descripcion } = req.body;
  
  if (monto === undefined) {
    return next(new AppError('El monto es obligatorio', 400));
  }
  
  // Convertir a número
  const montoNumerico = parseFloat(monto);
  
  if (isNaN(montoNumerico)) {
    return next(new AppError('El monto debe ser un número válido', 400));
  }
  
  try {
    const resultado = await tarjetaService.modificarSaldo(
      req.params.id,
      req.user._id,
      montoNumerico,
      descripcion || 'Ajuste de saldo'
    );
    
    // Registrar actividad
    await req.logActivity('usuario', 'modificacion_saldo_tarjeta', {
      id_tarjeta: req.params.id,
      monto: montoNumerico,
      saldo_anterior: resultado.saldo_anterior,
      saldo_actual: resultado.saldo_actual
    });
    
    res.status(200).json({
      status: 'success',
      message: montoNumerico >= 0 
        ? 'Saldo incrementado correctamente' 
        : 'Saldo disminuido correctamente',
      data: resultado
    });
  } catch (error) {
    return next(new AppError(`Error al modificar saldo: ${error.message}`, 400));
  }
});

/**
 * @desc    Obtener tarjeta predeterminada del usuario
 * @route   GET /api/v1/tarjetas/predeterminada
 * @access  Private
 */
const obtenerTarjetaPredeterminada = catchAsync(async (req, res, next) => {
  const tarjeta = await tarjetaService.obtenerTarjetaPredeterminada(req.user._id);
  
  if (!tarjeta) {
    return res.status(200).json({
      status: 'success',
      message: 'El usuario no tiene tarjetas registradas',
      data: null
    });
  }
  
  // Eliminar datos sensibles
  delete tarjeta.token_seguro;
  
  res.status(200).json({
    status: 'success',
    data: tarjeta
  });
});

/**
 * @desc    Obtener estadísticas de tarjetas (para administradores)
 * @route   GET /api/v1/tarjetas/stats
 * @access  Private/Admin
 */
const obtenerEstadisticasTarjetas = catchAsync(async (req, res, next) => {
  const stats = await tarjetaService.obtenerEstadisticasTarjetas();
  
  res.status(200).json({
    status: 'success',
    data: stats
  });
});

/**
 * @desc    Obtener estadísticas de tarjetas de un usuario específico (para administradores)
 * @route   GET /api/v1/tarjetas/stats/:userId
 * @access  Private/Admin
 */
const obtenerEstadisticasTarjetasUsuario = catchAsync(async (req, res, next) => {
  const stats = await tarjetaService.obtenerEstadisticasTarjetas(req.params.userId);
  
  res.status(200).json({
    status: 'success',
    data: stats
  });
});

module.exports = {
  registrarTarjeta,
  obtenerTarjetas,
  obtenerTarjeta,
  actualizarTarjeta,
  eliminarTarjeta,
  establecerPredeterminada,
  verificarTarjeta,
  verificarSaldo,
  modificarSaldo,
  obtenerTarjetaPredeterminada,
  obtenerEstadisticasTarjetas,
  obtenerEstadisticasTarjetasUsuario,
  establecerSaldoAbsoluto,
  establecerSaldoAbsolutoAdmin,
};