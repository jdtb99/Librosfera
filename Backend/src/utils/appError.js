// src/utils/appError.js
/**
 * Clase para errores operacionales de la aplicación
 * Permite crear errores con detalles específicos y códigos de estado HTTP
 */
class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
      
      // Capturar stack trace para debugging
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = AppError;