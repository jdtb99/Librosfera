// src/middleware/errorMiddleware.js
const AppError = require('../utils/appError');

/**
 * Maneja errores de validación de Mongoose
 */
const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Datos inválidos. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Maneja errores de clave duplicada de MongoDB
 */
const handleDuplicateFieldsDB = err => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Valor duplicado: ${value}. Por favor use otro valor.`;
  return new AppError(message, 400);
};

/**
 * Maneja errores de validación de ID de MongoDB
 */
const handleCastErrorDB = err => {
  // Proporcionar mensaje más detallado para ayudar en la depuración
  const message = `ID inválido: ${err.value}. Para usuarios, use el ObjectId de MongoDB o alternativamente puede buscar por email, usuario, id_cliente o id_root.`;
  return new AppError(message, 400);
};

/**
 * Maneja errores de JWT
 */
const handleJWTError = () => 
  new AppError('Token inválido. Por favor inicie sesión nuevamente.', 401);

/**
 * Maneja errores de expiración de JWT
 */
const handleJWTExpiredError = () => 
  new AppError('Su sesión ha expirado. Por favor inicie sesión nuevamente.', 401);

/**
 * Envía respuesta de error en desarrollo (con detalles)
 */
const sendErrorDev = (err, req, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

/**
 * Envía respuesta de error en producción (sin detalles técnicos)
 */
const sendErrorProd = (err, req, res) => {
  // Error operacional, de confianza: enviar mensaje al cliente
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  }
  
  // Error de programación o desconocido: no filtrar detalles
  console.error('ERROR 💥', err);
  
  // Enviar mensaje genérico
  return res.status(500).json({
    status: 'error',
    message: 'Algo salió mal. Por favor intente más tarde.'
  });
};

/**
 * Middleware para manejar rutas no encontradas
 */
const notFound = (req, res, next) => {
  next(new AppError(`No se encontró la ruta ${req.originalUrl} en este servidor.`, 404));
};

/**
 * Middleware para manejar errores
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    
    // Errores específicos de MongoDB/Mongoose
    if (err.name === 'CastError') error = handleCastErrorDB(err);
    if (err.code === 11000) error = handleDuplicateFieldsDB(err);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    sendErrorProd(error, req, res);
  }
};

module.exports = { notFound, errorHandler };