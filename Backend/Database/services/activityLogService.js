// Database/services/activityLogService.js
const ActivityLog = require('../models/activityLogModel');

/**
 * Servicio para gestionar logs de actividad en el sistema
 * Proporciona métodos para registrar diferentes tipos de actividades
 * y consultar el historial de actividades
 */
const activityLogService = {
  /**
   * Registra una actividad en el sistema
   * @param {Object} datos - Datos de la actividad
   * @returns {Promise<Object>} El log creado
   */
  async registrarActividad(datos) {
    try {
      // Validar datos mínimos
      if (!datos.tipo_actividad || !datos.accion || !datos.entidad_afectada) {
        throw new Error('Datos incompletos para registrar actividad');
      }
      
      // Si se proporciona un usuario, guardar también su información 
      // (para mantener disponible incluso si el usuario se elimina)
      if (datos.id_usuario && !datos.usuario_info) {
        try {
          const Usuario = require('../models/userModel').Usuario;
          const usuario = await Usuario.findById(datos.id_usuario);
          
          if (usuario) {
            datos.usuario_info = {
              usuario: usuario.usuario,
              email: usuario.email,
              tipo_usuario: usuario.tipo_usuario
            };
          }
        } catch (err) {
          console.warn('No se pudo obtener información del usuario:', err.message);
        }
      }
      
      // Crear y guardar el log
      const log = new ActivityLog(datos);
      await log.save();
      
      return log;
    } catch (error) {
      console.error('Error al registrar actividad:', error);
      // No propagar el error para evitar que un fallo en el logging interrumpa la operación principal
      return null;
    }
  },
  
  /**
   * Registra actividad relacionada con usuarios (registro, login, etc.)
   * @param {String} accion - Acción realizada
   * @param {Object} datos - Detalles de la acción
   * @returns {Promise<Object>} El log creado
   */
  async registrarActividadUsuario(accion, datos) {
    const { 
      id_usuario, 
      usuario_info,
      detalles, 
      estado_anterior, 
      estado_nuevo,
      nivel_importancia = 'medio',
      ip,
      user_agent
    } = datos;
    
    // Determinar nivel de importancia adecuado según la acción
    let nivelImportancia = nivel_importancia;
    
    if (accion === 'registro' || accion === 'eliminacion') {
      nivelImportancia = 'alto';
    } else if (accion === 'login' || accion === 'logout') {
      nivelImportancia = 'bajo';
    }
    
    return this.registrarActividad({
      tipo_actividad: 'usuario',
      accion,
      id_usuario,
      usuario_info,
      entidad_afectada: {
        tipo: 'usuario',
        id: id_usuario,
        nombre: usuario_info ? usuario_info.usuario : undefined
      },
      detalles,
      estado_anterior,
      estado_nuevo,
      nivel_importancia: nivelImportancia,
      ip,
      user_agent,
      modulo: 'usuarios'
    });
  },
  
  /**
   * Registra actividad relacionada con libros (creación, actualización, etc.)
   * @param {String} accion - Acción realizada
   * @param {Object} datos - Detalles de la acción
   * @returns {Promise<Object>} El log creado
   */
  async registrarActividadLibro(accion, datos) {
    const { 
      id_usuario, 
      usuario_info,
      id_libro,
      titulo_libro,
      detalles, 
      estado_anterior, 
      estado_nuevo,
      nivel_importancia = 'medio',
      ip,
      user_agent
    } = datos;
    
    // Determinar nivel de importancia adecuado según la acción
    let nivelImportancia = nivel_importancia;
    
    if (accion === 'creacion' || accion === 'eliminacion_permanente') {
      nivelImportancia = 'alto';
    } else if (accion === 'actualizacion') {
      nivelImportancia = 'medio';
    }
    
    return this.registrarActividad({
      tipo_actividad: 'libro',
      accion,
      id_usuario,
      usuario_info,
      entidad_afectada: {
        tipo: 'libro',
        id: id_libro,
        nombre: titulo_libro
      },
      detalles,
      estado_anterior,
      estado_nuevo,
      nivel_importancia: nivelImportancia,
      ip,
      user_agent,
      modulo: 'libros'
    });
  },
  
  /**
   * Registra actividad relacionada con inventario
   * @param {String} accion - Acción realizada
   * @param {Object} datos - Detalles de la acción
   * @returns {Promise<Object>} El log creado
   */
  async registrarActividadInventario(accion, datos) {
    const { 
      id_usuario, 
      usuario_info,
      id_libro,
      titulo_libro,
      id_inventario,
      cantidad,
      detalles, 
      estado_anterior, 
      estado_nuevo,
      nivel_importancia = 'medio',
      ip,
      user_agent
    } = datos;
    
    return this.registrarActividad({
      tipo_actividad: 'inventario',
      accion,
      id_usuario,
      usuario_info,
      entidad_afectada: {
        tipo: 'libro',
        id: id_libro,
        nombre: titulo_libro
      },
      detalles: {
        ...detalles,
        id_inventario,
        cantidad
      },
      estado_anterior,
      estado_nuevo,
      nivel_importancia,
      ip,
      user_agent,
      modulo: 'inventario'
    });
  },
  
  /**
   * Registra actividad relacionada con ventas
   * @param {String} accion - Acción realizada
   * @param {Object} datos - Detalles de la acción
   * @returns {Promise<Object>} El log creado
   */
  async registrarActividadVenta(accion, datos) {
    const { 
      id_usuario, 
      usuario_info,
      id_transaccion,
      monto,
      detalles, 
      estado_anterior, 
      estado_nuevo,
      nivel_importancia = 'alto',
      ip,
      user_agent
    } = datos;
    
    return this.registrarActividad({
      tipo_actividad: 'venta',
      accion,
      id_usuario,
      usuario_info,
      entidad_afectada: {
        tipo: 'venta',
        id: id_transaccion,
        nombre: `Venta #${id_transaccion}`
      },
      detalles: {
        ...detalles,
        monto
      },
      estado_anterior,
      estado_nuevo,
      nivel_importancia,
      ip,
      user_agent,
      modulo: 'ventas'
    });
  },
  
  /**
   * Registra un error en el sistema
   * @param {String} modulo - Módulo donde ocurrió el error
   * @param {Error} error - Objeto de error
   * @param {Object} datos - Datos adicionales
   * @returns {Promise<Object>} El log creado
   */
  async registrarError(modulo, error, datos = {}) {
    const {
      id_usuario,
      entidad_tipo,
      entidad_id,
      entidad_nombre,
      ip,
      user_agent
    } = datos;
    
    return this.registrarActividad({
      tipo_actividad: 'sistema',
      accion: 'error',
      id_usuario,
      entidad_afectada: {
        tipo: entidad_tipo || 'sistema',
        id: entidad_id,
        nombre: entidad_nombre || `Error en ${modulo}`
      },
      detalles: {
        mensaje: error.message
      },
      error: {
        mensaje: error.message,
        stack: error.stack
      },
      nivel_importancia: 'alto',
      ip,
      user_agent,
      modulo
    });
  },
  
  /**
   * Obtiene actividades recientes para mostrar en panel de administración
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de actividades
   */
  async obtenerActividadesRecientes(options = {}) {
    try {
      return await ActivityLog.obtenerActividadesRecientes(options);
    } catch (error) {
      console.error('Error al obtener actividades recientes:', error);
      return [];
    }
  },
  
  /**
   * Realiza una búsqueda avanzada de actividades
   * @param {Object} criterios - Criterios de búsqueda
   * @returns {Promise<Object>} Resultados paginados
   */
  async busquedaAvanzada(criterios = {}) {
    try {
      return await ActivityLog.busquedaAvanzada(criterios);
    } catch (error) {
      console.error('Error en búsqueda avanzada de actividades:', error);
      throw error;
    }
  }
};

module.exports = activityLogService;