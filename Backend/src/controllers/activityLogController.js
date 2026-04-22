// src/controllers/activityLogController.js
const mongoose = require('mongoose');
const activityLogService = require('../../Database/services/activityLogService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc   Obtener actividades recientes
 * @route  GET /api/v1/activities/recent
 * @access Private/Admin
 */
const getRecentActivities = catchAsync(async (req, res, next) => {
  // Extraer parámetros de consulta
  const { limite = 50, tipo = null } = req.query;
  
  // Obtener actividades
  const actividades = await activityLogService.obtenerActividadesRecientes({
    limite: parseInt(limite),
    tipo,
    nivel_importancia: ['alto', 'medio'] // Por defecto, excluir actividades de baja importancia
  });
  
  res.status(200).json({
    status: 'success',
    resultados: actividades.length,
    data: actividades
  });
});

/**
 * @desc   Búsqueda avanzada de actividades
 * @route  POST /api/v1/activities/search
 * @access Private/Admin
 */
const searchActivities = catchAsync(async (req, res, next) => {
  // Realizar búsqueda con los criterios proporcionados
  const resultado = await activityLogService.busquedaAvanzada(req.body);
  
  res.status(200).json({
    status: 'success',
    resultados: resultado.resultados.length,
    paginacion: resultado.paginacion,
    data: resultado.resultados
  });
});

/**
 * @desc   Obtener actividades destacadas para el dashboard
 * @route  GET /api/v1/activities/dashboard
 * @access Private/Admin
 */
const getDashboardActivities = catchAsync(async (req, res, next) => {
  // Obtener actividades destacadas (solo las importantes)
  const actividades = await activityLogService.obtenerActividadesRecientes({
    limite: 10,
    nivel_importancia: ['alto']
  });
  
  res.status(200).json({
    status: 'success',
    resultados: actividades.length,
    data: actividades
  });
});

/**
 * @desc   Obtener actividades de un usuario específico
 * @route  GET /api/v1/activities/user/:id
 * @access Private/Admin
 */
const getUserActivities = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  // Validar que el id sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('ID de usuario inválido', 400));
  }
  
  // Obtener actividades del usuario
  const actividades = await activityLogService.obtenerActividadesRecientes({
    limite: 100,
    id_usuario: id
  });
  
  res.status(200).json({
    status: 'success',
    resultados: actividades.length,
    data: actividades
  });
});

/**
 * @desc   Obtener actividades relacionadas con una entidad
 * @route  GET /api/v1/activities/entity/:tipo/:id
 * @access Private/Admin
 */
const getEntityActivities = catchAsync(async (req, res, next) => {
  const { tipo, id } = req.params;
  
  // Validar que el id sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('ID de entidad inválido', 400));
  }
  
  // Validar tipo
  const tiposPermitidos = ['libro', 'usuario', 'inventario', 'venta', 'sistema'];
  if (!tiposPermitidos.includes(tipo)) {
    return next(new AppError('Tipo de entidad inválido', 400));
  }
  
  // Obtener actividades de la entidad
  const actividades = await activityLogService.obtenerActividadesRecientes({
    limite: 100,
    entidad_tipo: tipo,
    entidad_id: id
  });
  
  res.status(200).json({
    status: 'success',
    resultados: actividades.length,
    data: actividades
  });
});

module.exports = {
  getRecentActivities,
  searchActivities,
  getDashboardActivities,
  getUserActivities,
  getEntityActivities
};