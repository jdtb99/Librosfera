// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { userService } = require('../../Database/services');
const { Usuario } = require('../../Database/models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * Middleware para proteger rutas - verifica que el usuario esté autenticado
 */
const protect = catchAsync(async (req, res, next) => {
  // 1) Verificar si hay token en los headers
  let token;
  
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return next(new AppError('No ha iniciado sesión. Por favor inicie sesión para obtener acceso.', 401));
  }
  
  // 2) Verificar token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  
  // 3) Verificar si el usuario todavía existe
  const currentUser = await userService.obtenerUsuarioCompleto(decoded.id);
  
  if (!currentUser) {
    return next(new AppError('El usuario al que pertenece este token ya no existe.', 401));
  }
  
  // 4) Verificar si el usuario está activo
  if (!currentUser.activo) {
    return next(new AppError('Esta cuenta ha sido desactivada. Por favor contacte al administrador.', 401));
  }
  
  // 5) Verificar si el usuario cambió su contraseña después de que se emitió el token
  if (currentUser.fecha_cambio_password && 
      currentUser.fecha_cambio_password.getTime() > decoded.iat * 1000) {
    return next(new AppError('La contraseña ha sido cambiada recientemente. Por favor inicie sesión nuevamente.', 401));
  }
  
  // 6) Actualizar último acceso
  await Usuario.findByIdAndUpdate(currentUser._id, {
    ultimo_acceso: Date.now()
  });
  
  // Almacenar usuario en req para su uso en las rutas protegidas
  req.user = currentUser;
  req.user.tipo_usuario = currentUser.tipo_usuario;
  
  next();
});

/**
 * Middleware para verificar roles de usuario
 * @param {...String} roles - Roles permitidos
 * @returns {Function} Middleware que verifica roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Verificar si el usuario tiene el rol requerido
    if (!req.user || !roles.includes(req.user.tipo_usuario)) {
      return next(new AppError('No tiene permiso para realizar esta acción.', 403));
    }
    
    next();
  };
};

/**
 * Middleware para verificar la propiedad del recurso
 * Solo permite acceso al propietario o a usuarios con roles permitidos
 * 
 * @param {Function} getResourceUserId - Función para obtener el ID del propietario del recurso
 * @param {Array<String>} allowedRoles - Roles que siempre pueden acceder
 * @returns {Function} Middleware que verifica propiedad
 */
const checkOwnership = (getResourceUserId, allowedRoles = ['administrador', 'root']) => {
  return catchAsync(async (req, res, next) => {
    // Siempre permitir acceso a roles administrativos
    if (allowedRoles.includes(req.user.tipo_usuario)) {
      return next();
    }
    
    // Obtener el ID del propietario del recurso
    const resourceUserId = await getResourceUserId(req);
    
    // Verificar si el usuario actual es el propietario
    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }
    
    // Denegar acceso si no es propietario ni tiene rol permitido
    return next(new AppError('No tiene permiso para acceder a este recurso.', 403));
  });
};

module.exports = { 
  protect, 
  authorize,
  checkOwnership
};