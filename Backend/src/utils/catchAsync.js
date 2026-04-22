// src/utils/catchAsync.js
/**
 * Wrapper para manejar errores en funciones asincrónicas
 * Evita tener que usar try/catch en cada controlador
 * 
 * @param {Function} fn - Función asincrónica a ejecutar
 * @returns {Function} Middleware que maneja errores automáticamente
 */
module.exports = fn => {
    return (req, res, next) => {
      // Ejecuta la función y captura cualquier error en la cadena de promesas
      fn(req, res, next).catch(next);
    };
  };