// src/controllers/authController.js
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { userService } = require('../../Database/services');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Verificar validez del token y obtener información del usuario
 * @route   GET /api/v1/auth/verify-token
 * @access  Public
 */
const verifyToken = catchAsync(async (req, res, next) => {
  // 1) Obtener token
  let token;
  
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({
      status: 'fail',
      valid: false,
      message: 'No se proporcionó token'
    });
  }
  
  try {
    // 2) Verificar token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    
    // 3) Verificar si el usuario todavía existe
    const currentUser = await userService.obtenerUsuarioCompleto(decoded.id);
    
    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        valid: false,
        message: 'El usuario asociado a este token ya no existe'
      });
    }
    
    // 4) Verificar si el usuario está activo
    if (!currentUser.activo) {
      return res.status(401).json({
        status: 'fail',
        valid: false,
        message: 'El usuario está desactivado'
      });
    }
    
    // 5) Verificar si el usuario cambió su contraseña después de que se emitió el token
    if (currentUser.fecha_cambio_password && 
        currentUser.fecha_cambio_password.getTime() > decoded.iat * 1000) {
      return res.status(401).json({
        status: 'fail',
        valid: false,
        message: 'La contraseña fue cambiada recientemente. Por favor inicie sesión nuevamente'
      });
    }
    
    // 6) Calcular tiempo restante de validez
    const expirationTime = decoded.exp;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemaining = expirationTime - currentTime;
    
    // Token válido, enviar información del usuario (sin datos sensibles)
    res.status(200).json({
      status: 'success',
      valid: true,
      user: {
        id: currentUser._id,
        usuario: currentUser.usuario,
        email: currentUser.email,
        tipo_usuario: currentUser.tipo_usuario,
        id_cliente: currentUser.id_cliente || null,
        id_root: currentUser.id_root || null,
        nombres: currentUser.nombres || null,
        apellidos: currentUser.apellidos || null,
        foto_perfil: currentUser.foto_perfil || null
      },
      tokenInfo: {
        expiresIn: timeRemaining,
        expirationDate: new Date(expirationTime * 1000).toISOString()
      }
    });
  } catch (error) {
    // Error de JWT (token inválido, expirado, etc.)
    return res.status(401).json({
      status: 'fail',
      valid: false,
      message: error.name === 'TokenExpiredError' 
        ? 'El token ha expirado. Por favor inicie sesión nuevamente' 
        : 'Token inválido'
    });
  }
});

module.exports = { verifyToken };