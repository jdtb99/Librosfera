// src/middleware/debugMiddleware.js
/**
 * Middleware para depuración que registra todas las solicitudes y respuestas
 * Util para diagnosticar problemas con las APIs
 */
const debugMiddleware = (req, res, next) => {
    // Capturar la hora de inicio
    const start = Date.now();
    
    // Registrar información de solicitud
    console.log(`[${new Date().toISOString()}] REQUEST: ${req.method} ${req.originalUrl}`);
    
    // Si hay datos en el cuerpo de la solicitud, registrarlos
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyStr = JSON.stringify(req.body);
      console.log('REQUEST BODY:', 
        bodyStr.length > 500 
          ? bodyStr.slice(0, 500) + '...' 
          : bodyStr
      );
    }
    
    // Si hay archivos adjuntos, registrarlos
    if (req.file) {
      console.log('REQUEST FILE:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    } else if (req.files) {
      console.log('REQUEST FILES:', 
        req.files.map(f => ({
          fieldname: f.fieldname,
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size
        }))
      );
    }
    
    // Capturar original res.json para poder interceptarlo
    const originalJson = res.json;
    
    // Sobrescribir res.json para capturar la respuesta
    res.json = function(data) {
      // Registrar información de respuesta
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] RESPONSE: ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
      
      // Evitar imprimir respuestas muy grandes para mantener los logs limpios
      if (data) {
        const stringData = JSON.stringify(data);
        console.log('RESPONSE DATA:', 
          stringData.length > 500 
            ? stringData.slice(0, 500) + '...' 
            : stringData
        );
      } else {
        console.warn('RESPONSE DATA: Empty or undefined');
      }
      
      // Restaurar original res.json y continuar
      res.json = originalJson;
      return res.json(data);
    };
    
    // También interceptar res.send para casos donde no se usa json
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] RESPONSE (send): ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
      
      // Restaurar original res.send y continuar
      res.send = originalSend;
      return res.send(data);
    };
    
    next();
  };
  
  module.exports = debugMiddleware;