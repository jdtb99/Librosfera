//Database/models/conversacionModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const conversacionSchema = new Schema({
  // Identificador único de la conversación
  id_conversacion: {
    type: String,
    default: function() {
      return `CONV${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    },
    unique: true,
    index: true
  },
  
  // Cliente que inicia la conversación
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  // Información del cliente para queries más rápidas
  cliente_info: {
    id_cliente: String,
    nombres: String,
    apellidos: String,
    email: String
  },
  
  // Asunto/tema de la conversación
  asunto: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  // Categoría del mensaje
  categoria: {
    type: String,
    enum: [
      'consulta_general',
      'problema_tecnico', 
      'consulta_producto',
      'devolucion',
      'facturacion',
      'sugerencia',
      'queja',
      'otro'
    ],
    default: 'consulta_general'
  },
  
  // Prioridad de la conversación
  prioridad: {
    type: String,
    enum: ['baja', 'media', 'alta', 'urgente'],
    default: 'media'
  },
  
  // Estado de la conversación
  estado: {
    type: String,
    enum: ['abierta', 'en_progreso', 'esperando_cliente', 'cerrada', 'archivada'],
    default: 'abierta'
  },
  
  // Último mensaje enviado
  ultimo_mensaje: {
    contenido: String,
    fecha: Date,
    enviado_por: {
      type: String,
      enum: ['cliente', 'administrador']
    },
    admin_info: {
      id: mongoose.Schema.Types.ObjectId,
      nombre: String
    }
  },
  
  // Administrador asignado (opcional)
  admin_asignado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    sparse: true
  },
  
  // Control de lectura
  leido_por_cliente: {
    type: Boolean,
    default: true // El cliente que crea la conversación ya la ha "leído"
  },
  
  leido_por_admin: {
    type: Boolean,
    default: false
  },
  
  fecha_ultimo_mensaje_cliente: {
    type: Date
  },
  
  fecha_ultimo_mensaje_admin: {
    type: Date
  },
  
  // Contadores
  total_mensajes: {
    type: Number,
    default: 0
  },
  
  mensajes_cliente: {
    type: Number,
    default: 0
  },
  
  mensajes_admin: {
    type: Number,
    default: 0
  },
  
  // Metadatos
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  fecha_actualizacion: {
    type: Date,
    default: Date.now
  },
  
  fecha_cierre: {
    type: Date
  },
  
  // Etiquetas para organización
  etiquetas: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Control de versiones
  version: {
    type: Number,
    default: 0
  }
});

// ÍNDICES
conversacionSchema.index({ cliente: 1, fecha_creacion: -1 });
conversacionSchema.index({ estado: 1, fecha_actualizacion: -1 });
conversacionSchema.index({ admin_asignado: 1, estado: 1 });
conversacionSchema.index({ categoria: 1, prioridad: 1 });
conversacionSchema.index({ leido_por_admin: 1, estado: 1 });
conversacionSchema.index({ 'cliente_info.email': 1 });

// Índice de texto para búsquedas
conversacionSchema.index({
  asunto: 'text',
  'cliente_info.nombres': 'text',
  'cliente_info.apellidos': 'text',
  'cliente_info.email': 'text',
  etiquetas: 'text'
}, {
  weights: {
    asunto: 5,
    'cliente_info.nombres': 3,
    'cliente_info.apellidos': 3,
    'cliente_info.email': 2,
    etiquetas: 1
  },
  name: 'conversacion_text_index'
});

// MIDDLEWARES
conversacionSchema.pre('save', function(next) {
  this.fecha_actualizacion = new Date();
  this.version += 1;
  next();
});

conversacionSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  
  if (!update.$set) {
    update.$set = {};
  }
  update.$set.fecha_actualizacion = new Date();
  
  if (!update.$inc) {
    update.$inc = {};
  }
  update.$inc.version = 1;
  
  this.setUpdate(update);
  next();
});

// MÉTODOS DE INSTANCIA
conversacionSchema.methods.marcarComoLeida = function(tipoUsuario) {
  if (tipoUsuario === 'cliente') {
    this.leido_por_cliente = true;
  } else if (tipoUsuario === 'administrador') {
    this.leido_por_admin = true;
  }
  return this.save();
};

conversacionSchema.methods.cambiarEstado = function(nuevoEstado, adminId = null) {
  this.estado = nuevoEstado;
  
  if (nuevoEstado === 'cerrada' || nuevoEstado === 'archivada') {
    this.fecha_cierre = new Date();
  }
  
  if (adminId && nuevoEstado === 'en_progreso') {
    this.admin_asignado = adminId;
  }
  
  return this.save();
};

conversacionSchema.methods.actualizarUltimoMensaje = function(mensaje, tipoRemitente, adminInfo = null) {
  this.ultimo_mensaje = {
    contenido: mensaje.contenido.substring(0, 100) + (mensaje.contenido.length > 100 ? '...' : ''),
    fecha: mensaje.fecha_envio,
    enviado_por: tipoRemitente,
    admin_info: adminInfo
  };
  
  this.total_mensajes += 1;
  
  if (tipoRemitente === 'cliente') {
    this.mensajes_cliente += 1;
    this.fecha_ultimo_mensaje_cliente = mensaje.fecha_envio;
    this.leido_por_admin = false;
  } else {
    this.mensajes_admin += 1;
    this.fecha_ultimo_mensaje_admin = mensaje.fecha_envio;
    this.leido_por_cliente = false;
  }
  
  return this.save();
};

// MÉTODOS ESTÁTICOS
conversacionSchema.statics.buscarPorCriterios = function(criterios, esAdmin = false) {
  const query = {};
  
  // Si no es admin, solo puede ver sus propias conversaciones
  if (!esAdmin && criterios.cliente_id) {
    query.cliente = criterios.cliente_id;
  }
  
  if (criterios.estado) {
    if (Array.isArray(criterios.estado)) {
      query.estado = { $in: criterios.estado };
    } else {
      query.estado = criterios.estado;
    }
  }
  
  if (criterios.categoria) {
    query.categoria = criterios.categoria;
  }
  
  if (criterios.prioridad) {
    query.prioridad = criterios.prioridad;
  }
  
  if (criterios.admin_asignado) {
    query.admin_asignado = criterios.admin_asignado;
  }
  
  if (criterios.no_leidas_admin && esAdmin) {
    query.leido_por_admin = false;
    query.estado = { $in: ['abierta', 'en_progreso', 'esperando_cliente'] };
  }
  
  if (criterios.no_leidas_cliente && !esAdmin) {
    query.leido_por_cliente = false;
  }
  
  if (criterios.buscar_texto) {
    query.$text = { $search: criterios.buscar_texto };
  }
  
  if (criterios.fecha_desde) {
    if (!query.fecha_creacion) query.fecha_creacion = {};
    query.fecha_creacion.$gte = new Date(criterios.fecha_desde);
  }
  
  if (criterios.fecha_hasta) {
    if (!query.fecha_creacion) query.fecha_creacion = {};
    query.fecha_creacion.$lte = new Date(criterios.fecha_hasta);
  }
  
  return this.find(query).populate('cliente', 'nombres apellidos email id_cliente')
                           .populate('admin_asignado', 'nombres apellidos usuario');
};

conversacionSchema.statics.obtenerEstadisticas = function(adminId = null, desde = null, hasta = null) {
  const pipeline = [];
  
  // Filtros de fecha
  if (desde || hasta) {
    const dateFilter = {};
    if (desde) dateFilter.$gte = new Date(desde);
    if (hasta) dateFilter.$lte = new Date(hasta);
    pipeline.push({ $match: { fecha_creacion: dateFilter } });
  }
  
  // Filtro por admin asignado
  if (adminId) {
    pipeline.push({ $match: { admin_asignado: mongoose.Types.ObjectId(adminId) } });
  }
  
  pipeline.push({
    $group: {
      _id: null,
      total_conversaciones: { $sum: 1 },
      abiertas: { $sum: { $cond: [{ $eq: ['$estado', 'abierta'] }, 1, 0] } },
      en_progreso: { $sum: { $cond: [{ $eq: ['$estado', 'en_progreso'] }, 1, 0] } },
      cerradas: { $sum: { $cond: [{ $eq: ['$estado', 'cerrada'] }, 1, 0] } },
      no_leidas: { $sum: { $cond: ['$leido_por_admin', 0, 1] } },
      promedio_mensajes: { $avg: '$total_mensajes' },
      por_categoria: {
        $push: {
          categoria: '$categoria',
          prioridad: '$prioridad'
        }
      }
    }
  });
  
  return this.aggregate(pipeline);
};

const Conversacion = mongoose.model('Conversacion', conversacionSchema);

module.exports = Conversacion;