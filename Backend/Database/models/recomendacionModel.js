const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const recomendacionSchema = new Schema({
  // Identificador único de la recomendación
  id_recomendacion: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true
  },
  
  // Usuario al que se dirige la recomendación (solo clientes registrados)
  id_usuario: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  // Libro que se recomienda
  id_libro: {
    type: Schema.Types.ObjectId,
    ref: 'Libro',
    required: true
  },
  
  // Cuándo se generó la recomendación
  fecha_generacion: {
    type: Date,
    default: Date.now
  },
  
  // Cuándo se envió la recomendación al usuario
  fecha_envio: {
    type: Date
  },
  
  // Estado de la recomendación
  estado: {
    type: String,
    enum: ['pendiente', 'enviada', 'vista', 'comprada', 'ignorada'],
    default: 'pendiente'
  },
  
  // Origen de la recomendación
  origen: {
    tipo: {
      type: String,
      enum: ['busqueda', 'compra_previa', 'tema_preferencia', 'autor_preferido', 'tendencia', 'similar_a_comprado'],
      required: true
    },
    // Guarda referencia al origen específico (si aplica)
    referencia_id: Schema.Types.ObjectId,
    puntuacion: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5 // Qué tan fuerte es la recomendación (0-1)
    }
  },
  
  // Registro de interacciones con esta recomendación
  interacciones: [{
    tipo: {
      type: String,
      enum: ['email_abierto', 'click', 'visto_detalle', 'agregado_carrito', 'agregado_wishlist', 'comprado']
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    duracion_segundos: Number // Si es aplicable (ej: tiempo viendo detalles)
  }],
  
  // Metadatos para analíticas
  metadatos: {
    canal: {
      type: String,
      enum: ['email', 'notificacion_app', 'pagina_principal', 'seccion_recomendados'],
      default: 'email'
    },
    posicion_en_lista: Number, // Si se mostró en una lista
    texto_personalizado: String // Texto usado para presentar la recomendación
  }
});

// Índices para mejorar rendimiento en consultas comunes
recomendacionSchema.index({ id_usuario: 1, fecha_generacion: -1 });
recomendacionSchema.index({ id_libro: 1, fecha_generacion: -1 });
recomendacionSchema.index({ estado: 1 });
recomendacionSchema.index({ 'origen.tipo': 1 });

// MÉTODOS DE INSTANCIA

// Registrar una interacción con la recomendación
recomendacionSchema.methods.registrarInteraccion = function(tipoInteraccion, duracion = null) {
  this.interacciones.push({
    tipo: tipoInteraccion,
    fecha: new Date(),
    duracion_segundos: duracion
  });
  
  // Actualización del estado según la interacción
  if (tipoInteraccion === 'visto_detalle') {
    this.estado = 'vista';
  } else if (tipoInteraccion === 'comprado') {
    this.estado = 'comprada';
  }
  
  return this.save();
};

// Marcar como enviada
recomendacionSchema.methods.marcarComoEnviada = function() {
  this.fecha_envio = new Date();
  this.estado = 'enviada';
  return this.save();
};

// MÉTODOS ESTÁTICOS

// Encontrar recomendaciones pendientes para enviar
recomendacionSchema.statics.obtenerPendientesDeEnvio = function(limite = 100) {
  return this.find({ 
    estado: 'pendiente',
    fecha_generacion: { $exists: true }
  })
  .sort({ fecha_generacion: 1 })
  .limit(limite)
  .populate('id_libro', 'titulo autor genero precio')
  .populate('id_usuario', 'email nombres');
};

// Obtener libros recomendados para un usuario específico
recomendacionSchema.statics.obtenerRecomendacionesUsuario = function(idUsuario, limite = 5) {
  return this.find({ 
    id_usuario: idUsuario,
    estado: { $in: ['enviada', 'vista'] }
  })
  .sort({ 
    'origen.puntuacion': -1,
    fecha_generacion: -1 
  })
  .limit(limite)
  .populate('id_libro');
};

const Recomendacion = mongoose.model('Recomendacion', recomendacionSchema);

module.exports = Recomendacion;