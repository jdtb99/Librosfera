const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const busquedaSchema = new Schema({
  // Campo para identificar unívocamente cada búsqueda
  id_busqueda: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true
  },
  
  // Referencia al usuario que realizó la búsqueda (si está registrado)
  id_usuario: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    // Nota: No es required porque los visitantes pueden buscar sin estar registrados
    index: true
  },
  
  // El término que el usuario buscó
  termino: {
    type: String,
    required: true,
    trim: true,
    index: true // Indexamos para búsquedas más rápidas por término
  },
  
  // Cuándo se realizó la búsqueda
  fecha_busqueda: {
    type: Date,
    default: Date.now,
    index: true // Indexamos para consultas por rango de fechas
  },
  
  // Campos adicionales que podrían ser útiles para análisis
  // Filtros utilizados en la búsqueda (opcional)
  filtros: {
    autor: String,
    genero: String,
    editorial: String,
    anio_publicacion: Number,
    precio_min: Number,
    precio_max: Number,
    idioma: String,
    estado: {
      type: String,
      enum: ['nuevo', 'usado', 'todos']
    }
  },
  
  // Resultados de la búsqueda (cantidad)
  total_resultados: {
    type: Number,
    default: 0
  },
  
  // Si el usuario interactuó con algún resultado
  interaccion: {
    hubo_interaccion: {
      type: Boolean,
      default: false
    },
    libros_vistos: [{
      type: Schema.Types.ObjectId,
      ref: 'Libro'
    }]
  }
});

// Índice compuesto para consultas frecuentes
busquedaSchema.index({ id_usuario: 1, fecha_busqueda: -1 }); 

// Método para marcar interacción con un libro
busquedaSchema.methods.agregarLibroVisto = function(idLibro) {
  if (!this.interaccion.libros_vistos.includes(idLibro)) {
    this.interaccion.libros_vistos.push(idLibro);
    this.interaccion.hubo_interaccion = true;
    return this.save();
  }
  return Promise.resolve(this);
};

// Método estático para obtener términos de búsqueda populares
busquedaSchema.statics.obtenerTerminosPopulares = async function(limite = 10, diasAtras = 30) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasAtras);
  
  return this.aggregate([
    {
      $match: {
        fecha_busqueda: { $gte: fechaLimite }
      }
    },
    {
      $group: {
        _id: "$termino",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limite
    }
  ]);
};

// Método estático para obtener búsquedas recientes de un usuario
busquedaSchema.statics.busquedasRecientesUsuario = function(idUsuario, limite = 10) {
  return this.find({ id_usuario: idUsuario })
    .sort({ fecha_busqueda: -1 })
    .limit(limite)
    .select('termino fecha_busqueda total_resultados');
};

const Busqueda = mongoose.model('Busqueda', busquedaSchema);

module.exports = Busqueda;