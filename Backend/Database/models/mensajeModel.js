//Database/models/mensajeModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const archivoMensajeSchema = require('./schemas/archivoMensajeSchema');

const mensajeSchema = new Schema({
  // Identificador único del mensaje
  id_mensaje: {
    type: String,
    default: function() {
      return `MSG${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    },
    unique: true,
    index: true
  },
  
  // Conversación a la que pertenece el mensaje
  conversacion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversacion',
    required: true,
    index: true
  },
  
  // Remitente del mensaje
  remitente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  // Información del remitente para queries más rápidas
  remitente_info: {
    tipo: {
      type: String,
      enum: ['cliente', 'administrador'],
      required: true
    },
    nombre: String,
    email: String,
    id_cliente: String // Solo para clientes
  },
  
  // Contenido del mensaje
  contenido: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  // Tipo de mensaje
  tipo: {
    type: String,
    enum: ['mensaje', 'nota_interna', 'cambio_estado', 'asignacion'],
    default: 'mensaje'
  },
  
  // Archivos adjuntos
  archivos: [archivoMensajeSchema],
  
  // Control de lectura
  leido_por: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    fecha_lectura: {
      type: Date,
      default: Date.now
    },
    tipo_usuario: {
      type: String,
      enum: ['cliente', 'administrador']
    }
  }],
  
  // Respuesta a otro mensaje (threading)
  respuesta_a: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mensaje',
    sparse: true
  },
  
  // Mensaje editado
  editado: {
    type: Boolean,
    default: false
  },
  
  fecha_edicion: {
    type: Date
  },
  
  contenido_original: {
    type: String
  },
  
  // Metadatos
  fecha_envio: {
    type: Date,
    default: Date.now
  },
  
  // Estado del mensaje
  estado: {
    type: String,
    enum: ['enviado', 'entregado', 'leido', 'eliminado'],
    default: 'enviado'
  },
  
  // Metadata adicional
  metadata: {
    ip_remitente: String,
    user_agent: String,
    dispositivo: String
  },
  
  // Control de versiones
  version: {
    type: Number,
    default: 0
  }
});

// ÍNDICES
mensajeSchema.index({ conversacion: 1, fecha_envio: 1 });
mensajeSchema.index({ remitente: 1, fecha_envio: -1 });
mensajeSchema.index({ 'remitente_info.tipo': 1, fecha_envio: -1 });
mensajeSchema.index({ estado: 1 });
mensajeSchema.index({ tipo: 1 });

// Índice de texto para búsquedas
mensajeSchema.index({
  contenido: 'text',
  'remitente_info.nombre': 'text'
}, {
  weights: {
    contenido: 5,
    'remitente_info.nombre': 2
  },
  name: 'mensaje_text_index'
});

// MIDDLEWARES
mensajeSchema.pre('save', function(next) {
  if (this.isModified('contenido') && !this.isNew) {
    this.editado = true;
    this.fecha_edicion = new Date();
  }
  this.version += 1;
  next();
});

// MÉTODOS DE INSTANCIA
mensajeSchema.methods.marcarComoLeido = function(usuarioId, tipoUsuario) {
  const yaLeido = this.leido_por.find(l => l.usuario.toString() === usuarioId.toString());
  
  if (!yaLeido) {
    this.leido_por.push({
      usuario: usuarioId,
      fecha_lectura: new Date(),
      tipo_usuario: tipoUsuario
    });
    
    // Actualizar estado si es necesario
    if (this.estado === 'enviado' || this.estado === 'entregado') {
      this.estado = 'leido';
    }
    
    return this.save();
  }
  
  return Promise.resolve(this);
};

mensajeSchema.methods.editarContenido = function(nuevoContenido) {
  if (!this.contenido_original) {
    this.contenido_original = this.contenido;
  }
  
  this.contenido = nuevoContenido;
  return this.save();
};

mensajeSchema.methods.agregarArchivo = function(archivoData) {
  this.archivos.push(archivoData);
  return this.save();
};

// MÉTODOS ESTÁTICOS
mensajeSchema.statics.buscarEnConversacion = function(conversacionId, criterios = {}) {
  const query = { conversacion: conversacionId };
  
  if (criterios.tipo) {
    query.tipo = criterios.tipo;
  }
  
  if (criterios.remitente_tipo) {
    query['remitente_info.tipo'] = criterios.remitente_tipo;
  }
  
  if (criterios.buscar_texto) {
    query.$text = { $search: criterios.buscar_texto };
  }
  
  if (criterios.desde) {
    if (!query.fecha_envio) query.fecha_envio = {};
    query.fecha_envio.$gte = new Date(criterios.desde);
  }
  
  if (criterios.hasta) {
    if (!query.fecha_envio) query.fecha_envio = {};
    query.fecha_envio.$lte = new Date(criterios.hasta);
  }
  
  return this.find(query)
             .populate('remitente', 'nombres apellidos usuario email id_cliente')
             .populate('respuesta_a', 'contenido remitente_info fecha_envio')
             .sort({ fecha_envio: 1 });
};

mensajeSchema.statics.obtenerNoLeidos = function(usuarioId, tipoUsuario) {
  const query = {
    'leido_por.usuario': { $ne: usuarioId },
    estado: { $in: ['enviado', 'entregado'] }
  };
  
  // Si es cliente, solo sus conversaciones
  if (tipoUsuario === 'cliente') {
    // Necesitamos hacer un populate o lookup para filtrar por cliente
    return this.aggregate([
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
          'conv_info.cliente': mongoose.Types.ObjectId(usuarioId),
          'leido_por.usuario': { $ne: mongoose.Types.ObjectId(usuarioId) },
          'estado': { $in: ['enviado', 'entregado'] }
        }
      }
    ]);
  }
  
  return this.find(query).populate('conversacion');
};

const Mensaje = mongoose.model('Mensaje', mensajeSchema);

module.exports = Mensaje;