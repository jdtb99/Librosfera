// Database/models/activityLogModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const activityLogSchema = new Schema({
  // Tipo de actividad (categoría principal)
  tipo_actividad: {
    type: String,
    enum: ['usuario', 'libro', 'inventario', 'venta', 'sistema', 'seguridad', 'administracion'],
    required: true,
    index: true
  },
  
  // Acción específica dentro de la categoría
  accion: {
    type: String,
    required: true,
    index: true
  },
  
  // Usuario que realizó la acción
  id_usuario: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    index: true
  },
  
  // Datos del usuario (para mantener información incluso si el usuario se elimina)
  usuario_info: {
    usuario: String,
    email: String,
    tipo_usuario: String
  },
  
  // Entidad afectada (libro, usuario, etc.)
  entidad_afectada: {
    tipo: {
      type: String,
      enum: ['libro', 'usuario', 'inventario', 'venta', 'sistema', 'otro', 'devolucion'],
      required: true
    },
    id: Schema.Types.ObjectId,
    nombre: String // Para buscar fácilmente sin necesidad de joins (ej: título del libro)
  },
  
  // Datos adicionales específicos de la acción (formato flexible)
  detalles: {
    type: Schema.Types.Mixed
  },
  
  // Datos antes del cambio (para auditoría)
  estado_anterior: Schema.Types.Mixed,
  
  // Datos después del cambio (para auditoría)
  estado_nuevo: Schema.Types.Mixed,
  
  // IP del usuario
  ip: String,
  
  // User Agent
  user_agent: String,
  
  // Timestamp
  fecha: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Nivel de importancia para filtrado
  nivel_importancia: {
    type: String,
    enum: ['alto', 'medio', 'bajo', 'debug'],
    default: 'medio',
    index: true
  },
  
  // Módulo o componente del sistema
  modulo: String,
  
  // Para posible agrupación o correlación de eventos
  id_sesion: String,
  
  // Si hay un error asociado a esta actividad
  error: {
    mensaje: String,
    stack: String
  }
});

// Índices compuestos para consultas comunes
activityLogSchema.index({ tipo_actividad: 1, fecha: -1 });
activityLogSchema.index({ nivel_importancia: 1, fecha: -1 });
activityLogSchema.index({ 'entidad_afectada.tipo': 1, 'entidad_afectada.id': 1, fecha: -1 });

// Método para filtrar información sensible antes de guardar
activityLogSchema.pre('save', function(next) {
  // Si hay datos de usuario, asegurarse de no incluir password
  if (this.estado_anterior && this.estado_anterior.password) {
    delete this.estado_anterior.password;
  }
  
  if (this.estado_nuevo && this.estado_nuevo.password) {
    delete this.estado_nuevo.password;
  }
  
  // Limitar tamaño de datos para evitar documentos enormes
  if (this.detalles && JSON.stringify(this.detalles).length > 10000) {
    this.detalles = {
      mensaje: 'Datos demasiado grandes para ser almacenados',
      tamaño_original: JSON.stringify(this.detalles).length
    };
  }
  
  next();
});

// Método estático para obtener actividades recientes
activityLogSchema.statics.obtenerActividadesRecientes = function(options = {}) {
  const { 
    limite = 50, 
    tipo = null, 
    nivel_importancia = ['alto', 'medio'],
    entidad_tipo = null,
    entidad_id = null,
    id_usuario = null
  } = options;
  
  const query = {};
  
  // Filtrar por tipo de actividad
  if (tipo) {
    query.tipo_actividad = tipo;
  }
  
  // Filtrar por nivel de importancia
  if (nivel_importancia && nivel_importancia.length > 0) {
    query.nivel_importancia = { $in: nivel_importancia };
  }
  
  // Filtrar por entidad
  if (entidad_tipo) {
    query['entidad_afectada.tipo'] = entidad_tipo;
    
    if (entidad_id) {
      query['entidad_afectada.id'] = entidad_id;
    }
  }
  
  // Filtrar por usuario
  if (id_usuario) {
    query.id_usuario = id_usuario;
  }
  
  return this.find(query)
    .sort({ fecha: -1 })
    .limit(limite)
    .populate('id_usuario', 'usuario email tipo_usuario');
};

// Método estático para búsqueda avanzada
activityLogSchema.statics.busquedaAvanzada = function(criterios) {
  const {
    fechaInicio,
    fechaFin,
    tipo_actividad,
    accion,
    id_usuario,
    entidad_tipo,
    entidad_id,
    nivel_importancia,
    texto_busqueda,
    pagina = 1,
    limite = 50
  } = criterios;
  
  const query = {};
  
  // Rango de fechas
  if (fechaInicio || fechaFin) {
    query.fecha = {};
    if (fechaInicio) query.fecha.$gte = new Date(fechaInicio);
    if (fechaFin) query.fecha.$lte = new Date(fechaFin);
  }
  
  // Filtros exactos
  if (tipo_actividad) query.tipo_actividad = tipo_actividad;
  if (accion) query.accion = accion;
  if (id_usuario) query.id_usuario = id_usuario;
  if (nivel_importancia) query.nivel_importancia = nivel_importancia;
  
  // Filtros de entidad
  if (entidad_tipo) {
    query['entidad_afectada.tipo'] = entidad_tipo;
    if (entidad_id) query['entidad_afectada.id'] = entidad_id;
  }
  
  // Búsqueda de texto
  if (texto_busqueda) {
    const regex = new RegExp(texto_busqueda, 'i');
    query.$or = [
      { 'entidad_afectada.nombre': regex },
      { 'usuario_info.usuario': regex },
      { 'usuario_info.email': regex },
      { 'detalles.mensaje': regex }
    ];
  }
  
  // Calcular skip para paginación
  const skip = (pagina - 1) * limite;
  
  return Promise.all([
    this.find(query)
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(limite)
      .populate('id_usuario', 'usuario email tipo_usuario'),
    
    this.countDocuments(query)
  ]).then(([resultados, total]) => {
    return {
      resultados,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite) || 1
      }
    };
  });
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;