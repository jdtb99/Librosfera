//Database/services/mensajeriaService.js
const mongoose = require('mongoose');
const Conversacion = require('../models/conversacionModel');
const Mensaje = require('../models/mensajeModel');
const userService = require('./userService');

const mensajeriaService = {
  /**
   * Crear una nueva conversación
   */
  async crearConversacion(clienteId, datosConversacion) {
    try {
      
      // Obtener información del cliente
      const cliente = await userService.obtenerUsuarioCompleto(clienteId);
      if (!cliente || cliente.tipo_usuario !== 'cliente') {
        throw new Error('Cliente no encontrado o inválido');
      }
      
      const nuevaConversacion = new Conversacion({
        cliente: cliente._id,
        cliente_info: {
          id_cliente: cliente.id_cliente,
          nombres: cliente.nombres,
          apellidos: cliente.apellidos,
          email: cliente.email
        },
        asunto: datosConversacion.asunto,
        categoria: datosConversacion.categoria || 'consulta_general',
        prioridad: datosConversacion.prioridad || 'media'
      });
      
      await nuevaConversacion.save();
      return nuevaConversacion.toObject();
    } catch (error) {
      console.error('Error creando conversación:', error);
      throw error;
    }
  },
  
  /**
   * Enviar mensaje en una conversación
   */
  async enviarMensaje(conversacionId, remitenteId, datosDelMensaje) {
    try {
      // Verificar que la conversación existe
      const conversacion = await Conversacion.findById(conversacionId);
      if (!conversacion) {
        throw new Error('Conversación no encontrada');
      }
      
      // Obtener información del remitente
      const remitente = await userService.obtenerUsuarioCompleto(remitenteId);
      if (!remitente) {
        throw new Error('Remitente no encontrado');
      }
      
      // Verificar permisos
      if (remitente.tipo_usuario === 'cliente' && 
          conversacion.cliente.toString() !== remitente._id.toString()) {
        throw new Error('No tiene permisos para escribir en esta conversación');
      }
      
      // Determinar tipo de remitente
      const tipoRemitente = remitente.tipo_usuario === 'cliente' ? 'cliente' : 'administrador';
      
      // Crear el mensaje
      const nuevoMensaje = new Mensaje({
        conversacion: conversacionId,
        remitente: remitente._id,
        remitente_info: {
          tipo: tipoRemitente,
          nombre: tipoRemitente === 'cliente' 
            ? `${remitente.nombres} ${remitente.apellidos}` 
            : remitente.usuario,
          email: remitente.email,
          id_cliente: remitente.id_cliente || undefined
        },
        contenido: datosDelMensaje.contenido,
        tipo: datosDelMensaje.tipo || 'mensaje',
        respuesta_a: datosDelMensaje.respuesta_a || undefined,
        metadata: datosDelMensaje.metadata || {}
      });
      
      // Si hay archivos adjuntos
      if (datosDelMensaje.archivos && datosDelMensaje.archivos.length > 0) {
        nuevoMensaje.archivos = datosDelMensaje.archivos;
      }
      
      await nuevoMensaje.save();
      
      // Actualizar la conversación
      await conversacion.actualizarUltimoMensaje(
        nuevoMensaje, 
        tipoRemitente,
        tipoRemitente === 'administrador' ? {
          id: remitente._id,
          nombre: remitente.usuario
        } : null
      );
      
      // Si la conversación estaba cerrada y un cliente envía mensaje, reabrirla
      if (tipoRemitente === 'cliente' && conversacion.estado === 'cerrada') {
        conversacion.estado = 'abierta';
        await conversacion.save();
      }
      
      // Si es un admin respondiendo, cambiar estado si está abierta
      if (tipoRemitente === 'administrador' && conversacion.estado === 'abierta') {
        conversacion.estado = 'en_progreso';
        conversacion.admin_asignado = remitente._id;
        await conversacion.save();
      }
      
      return await Mensaje.findById(nuevoMensaje._id)
                          .populate('remitente', 'nombres apellidos usuario email')
                          .populate('respuesta_a', 'contenido remitente_info');
      
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      throw error;
    }
  },
  
  /**
   * Obtener conversaciones con filtros
   */
  async obtenerConversaciones(usuarioId, filtros = {}, pagina = 1, limite = 10) {
    try {
      const usuario = await userService.obtenerUsuarioCompleto(usuarioId);
      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }
      
      const esAdmin = ['administrador', 'root'].includes(usuario.tipo_usuario);
      
      // Si es cliente, filtrar solo sus conversaciones
      if (!esAdmin) {
        filtros.cliente_id = usuario._id;
      }
      
      const skip = (pagina - 1) * limite;
      
      // Construir query
      let queryConversaciones = Conversacion.buscarPorCriterios(filtros, esAdmin);
      
      // Ordenamiento
      const ordenamiento = filtros.ordenar_por || 'fecha_actualizacion';
      const direccion = filtros.orden_desc ? -1 : 1;
      queryConversaciones = queryConversaciones.sort({ [ordenamiento]: direccion });
      
      // Total para paginación
      const total = await Conversacion.countDocuments(queryConversaciones.getQuery());
      
      // Ejecutar query con paginación
      const conversaciones = await queryConversaciones
        .skip(skip)
        .limit(limite)
        .lean();
      
      return {
        conversaciones,
        paginacion: {
          total,
          pagina,
          limite,
          totalPaginas: Math.ceil(total / limite)
        }
      };
      
    } catch (error) {
      console.error('Error obteniendo conversaciones:', error);
      throw error;
    }
  },
  
  /**
   * Obtener mensajes de una conversación
   */
  async obtenerMensajesConversacion(conversacionId, usuarioId, pagina = 1, limite = 50) {
    try {
      const usuario = await userService.obtenerUsuarioCompleto(usuarioId);
      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }
      
      // Verificar que la conversación existe
      const conversacion = await Conversacion.findById(conversacionId);
      if (!conversacion) {
        throw new Error('Conversación no encontrada');
      }
      
      // Verificar permisos
      const esAdmin = ['administrador', 'root'].includes(usuario.tipo_usuario);
      if (!esAdmin && conversacion.cliente.toString() !== usuario._id.toString()) {
        throw new Error('No tiene permisos para ver esta conversación');
      }
      
      const skip = (pagina - 1) * limite;
      
      // Obtener mensajes
      const mensajes = await Mensaje.find({ conversacion: conversacionId })
        .populate('remitente', 'nombres apellidos usuario email id_cliente')
        .populate('respuesta_a', 'contenido remitente_info fecha_envio')
        .sort({ fecha_envio: 1 })
        .skip(skip)
        .limit(limite)
        .lean();
      
      // Marcar mensajes como leídos
      const tipoUsuario = usuario.tipo_usuario === 'cliente' ? 'cliente' : 'administrador';
      await this.marcarMensajesComoLeidos(conversacionId, usuarioId, tipoUsuario);
      
      // Contar total de mensajes
      const totalMensajes = await Mensaje.countDocuments({ conversacion: conversacionId });
      
      return {
        conversacion: conversacion.toObject(),
        mensajes,
        paginacion: {
          total: totalMensajes,
          pagina,
          limite,
          totalPaginas: Math.ceil(totalMensajes / limite)
        }
      };
      
    } catch (error) {
      console.error('Error obteniendo mensajes:', error);
      throw error;
    }
  },
  
  /**
   * Marcar mensajes como leídos
   */
  async marcarMensajesComoLeidos(conversacionId, usuarioId, tipoUsuario) {
    try {
      // Actualizar mensajes no leídos de la conversación
      const mensajesNoLeidos = await Mensaje.find({
        conversacion: conversacionId,
        'leido_por.usuario': { $ne: usuarioId }
      });
      
      const promesasActualizacion = mensajesNoLeidos.map(mensaje => 
        mensaje.marcarComoLeido(usuarioId, tipoUsuario)
      );
      
      await Promise.all(promesasActualizacion);
      
      // Actualizar estado de lectura en la conversación
      const conversacion = await Conversacion.findById(conversacionId);
      if (conversacion) {
        await conversacion.marcarComoLeida(tipoUsuario);
      }
      
      return true;
    } catch (error) {
      console.error('Error marcando mensajes como leídos:', error);
      throw error;
    }
  },
  
  /**
   * Cambiar estado de conversación
   */
  async cambiarEstadoConversacion(conversacionId, nuevoEstado, adminId) {
    try {
      const conversacion = await Conversacion.findById(conversacionId);
      if (!conversacion) {
        throw new Error('Conversación no encontrada');
      }
      
      await conversacion.cambiarEstado(nuevoEstado, adminId);
      
      // Crear mensaje de sistema sobre el cambio de estado
      if (adminId) {
        const admin = await userService.obtenerUsuarioCompleto(adminId);
        if (admin) {
          await this.enviarMensaje(conversacionId, adminId, {
            contenido: `Estado de conversación cambiado a: ${nuevoEstado}`,
            tipo: 'cambio_estado'
          });
        }
      }
      
      return conversacion.toObject();
    } catch (error) {
      console.error('Error cambiando estado de conversación:', error);
      throw error;
    }
  },
  
  /**
   * Asignar administrador a conversación
   */
  async asignarAdministrador(conversacionId, adminId, asignadoPorId) {
    try {
      const conversacion = await Conversacion.findById(conversacionId);
      if (!conversacion) {
        throw new Error('Conversación no encontrada');
      }
      
      const admin = await userService.obtenerUsuarioCompleto(adminId);
      if (!admin || !['administrador', 'root'].includes(admin.tipo_usuario)) {
        throw new Error('Administrador no válido');
      }
      
      conversacion.admin_asignado = adminId;
      if (conversacion.estado === 'abierta') {
        conversacion.estado = 'en_progreso';
      }
      
      await conversacion.save();
      
      // Crear mensaje de sistema sobre la asignación
      if (asignadoPorId) {
        await this.enviarMensaje(conversacionId, asignadoPorId, {
          contenido: `Conversación asignada a ${admin.usuario}`,
          tipo: 'asignacion'
        });
      }
      
      return conversacion.toObject();
    } catch (error) {
      console.error('Error asignando administrador:', error);
      throw error;
    }
  },
  
  /**
   * Obtener estadísticas de mensajería
   */
  async obtenerEstadisticas(adminId = null, fechaDesde = null, fechaHasta = null) {
    try {
      const estadisticasConversaciones = await Conversacion.obtenerEstadisticas(
        adminId, fechaDesde, fechaHasta
      );
      
      // Estadísticas adicionales de mensajes
      const pipelineMensajes = [];
      
      if (fechaDesde || fechaHasta) {
        const dateFilter = {};
        if (fechaDesde) dateFilter.$gte = new Date(fechaDesde);
        if (fechaHasta) dateFilter.$lte = new Date(fechaHasta);
        pipelineMensajes.push({ $match: { fecha_envio: dateFilter } });
      }
      
      pipelineMensajes.push({
        $group: {
          _id: null,
          total_mensajes: { $sum: 1 },
          mensajes_cliente: { 
            $sum: { $cond: [{ $eq: ['$remitente_info.tipo', 'cliente'] }, 1, 0] } 
          },
          mensajes_admin: { 
            $sum: { $cond: [{ $eq: ['$remitente_info.tipo', 'administrador'] }, 1, 0] } 
          },
          promedio_longitud: { $avg: { $strLenCP: '$contenido' } },
          con_archivos: { $sum: { $cond: [{ $gt: [{ $size: '$archivos' }, 0] }, 1, 0] } }
        }
      });
      
      const estadisticasMensajes = await Mensaje.aggregate(pipelineMensajes);
      
      return {
        conversaciones: estadisticasConversaciones[0] || {},
        mensajes: estadisticasMensajes[0] || {}
      };
      
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  },
  
  /**
   * Buscar en conversaciones y mensajes
   */
  async buscar(termino, usuarioId, filtros = {}) {
    try {
      const usuario = await userService.obtenerUsuarioCompleto(usuarioId);
      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }
      
      const esAdmin = ['administrador', 'root'].includes(usuario.tipo_usuario);
      
      // Buscar en conversaciones
      const criteriosConversaciones = {
        ...filtros,
        buscar_texto: termino
      };
      
      if (!esAdmin) {
        criteriosConversaciones.cliente_id = usuario._id;
      }
      
      const conversaciones = await Conversacion.buscarPorCriterios(criteriosConversaciones, esAdmin)
        .limit(20)
        .lean();
      
      // Buscar en mensajes
      let queryMensajes = {
        $text: { $search: termino }
      };
      
      if (!esAdmin) {
        // Para clientes, solo buscar en sus conversaciones
        const conversacionesIds = await Conversacion.find({ cliente: usuario._id })
          .select('_id').lean();
        queryMensajes.conversacion = { 
          $in: conversacionesIds.map(c => c._id) 
        };
      }
      
      const mensajes = await Mensaje.find(queryMensajes)
        .populate('conversacion', 'asunto cliente_info')
        .populate('remitente', 'nombres apellidos usuario')
        .sort({ score: { $meta: 'textScore' } })
        .limit(50)
        .lean();
      
      return {
        conversaciones,
        mensajes
      };
      
    } catch (error) {
      console.error('Error en búsqueda:', error);
      throw error;
    }
  },
  
  /**
   * Obtener contadores de mensajes no leídos
   */
  async obtenerContadoresNoLeidos(usuarioId) {
    try {
      const usuario = await userService.obtenerUsuarioCompleto(usuarioId);
      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }
      
      const esAdmin = ['administrador', 'root'].includes(usuario.tipo_usuario);
      
      if (esAdmin) {
        // Para admins: conversaciones no leídas por admins
        const conversacionesNoLeidas = await Conversacion.countDocuments({
          leido_por_admin: false,
          estado: { $in: ['abierta', 'en_progreso', 'esperando_cliente'] }
        });
        
        const mensajesNoLeidos = await Mensaje.aggregate([
          {
            $match: {
              'remitente_info.tipo': 'cliente',
              'leido_por.usuario': { $ne: new mongoose.Types.ObjectId(usuarioId) }
            }
          },
          {
            $count: 'total'
          }
        ]);
        
        return {
          conversaciones_no_leidas: conversacionesNoLeidas,
          mensajes_no_leidos: mensajesNoLeidos[0]?.total || 0
        };
        
      } else {
        // Para clientes: solo sus conversaciones
        const conversacionesNoLeidas = await Conversacion.countDocuments({
          cliente: usuario._id,
          leido_por_cliente: false
        });
        
        const mensajesNoLeidos = await Mensaje.aggregate([
          {
            $lookup: {
              from: 'conversacions',
              localField: 'conversacion',
              foreignField: '_id',
              as: 'conv_info'
            }
          },
          {
            $match: {
              'conv_info.cliente': new mongoose.Types.ObjectId(usuarioId),
              'remitente_info.tipo': 'administrador',
              'leido_por.usuario': { $ne: new mongoose.Types.ObjectId(usuarioId) }
            }
          },
          {
            $count: 'total'
          }
        ]);
        
        return {
          conversaciones_no_leidas: conversacionesNoLeidas,
          mensajes_no_leidos: mensajesNoLeidos[0]?.total || 0
        };
      }
      
    } catch (error) {
      console.error('Error obteniendo contadores:', error);
      throw error;
    }
  }
};

module.exports = mensajeriaService;