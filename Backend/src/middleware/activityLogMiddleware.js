// src/middleware/activityLogMiddleware.js
const activityLogService = require('../../Database/services/activityLogService');

/**
 * Middleware para capturar información de la petición
 * y facilitar el registro de actividades
 */
const activityLogger = (req, res, next) => {
  // Agregar función de logging a la request para
  // usarla en los controladores
  req.logActivity = async (tipo, accion, datos = {}) => {
    // Obtener información de la petición
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Preparar datos básicos
    const logData = {
      ...datos,
      ip,
      user_agent: userAgent
    };
    
    // Si hay usuario autenticado, agregar su información
    if (req.user) {
      logData.id_usuario = req.user._id;
      logData.usuario_info = {
        usuario: req.user.usuario,
        email: req.user.email,
        tipo_usuario: req.user.tipo_usuario
      };
    }
    
    // Registrar según el tipo de actividad
    switch (tipo) {
      case 'usuario':
        return activityLogService.registrarActividadUsuario(accion, logData);
      case 'libro':
        return activityLogService.registrarActividadLibro(accion, logData);
      case 'inventario':
        return activityLogService.registrarActividadInventario(accion, logData);
      case 'venta':
        return activityLogService.registrarActividadVenta(accion, logData);
      default:
        return activityLogService.registrarActividad({
          tipo_actividad: tipo,
          accion,
          ...logData
        });
    }
  };
  
  next();
};

module.exports = activityLogger;