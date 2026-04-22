const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const noticiaSchema = new Schema({
  id_noticia: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true,
    index: true
  },
  
  id_libro: {
    type: Schema.Types.ObjectId,
    ref: 'Libro',
    index: true
  },
  
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  
  descripcion: {
    type: String,
    required: true
  },
  
  contenido: {
    type: String,
    required: true
  },
  
  tipo: {
    type: String,
    enum: ['nuevo_libro', 'oferta', 'evento', 'actualización'],
    required: true
  },
  
  imagen: String,
  
  fecha_publicacion: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  estado: {
    type: String,
    enum: ['borrador', 'publicada', 'archivada'],
    default: 'publicada'
  },
  
  destacada: {
    type: Boolean,
    default: false
  },
  
  autor: {
    id_admin: {
      type: Schema.Types.ObjectId,
      ref: 'Administrador'
    },
    nombre: String
  }
});

// MÉTODOS ESTÁTICOS

// Obtener noticias sobre un libro
noticiaSchema.statics.obtenerNoticiasLibro = function(idLibro) {
  return this.find({ 
    id_libro: idLibro, 
    estado: 'publicada'
  })
  .sort({ fecha_publicacion: -1 });
};

// Obtener noticias recientes
noticiaSchema.statics.obtenerRecientes = function(limite = 10) {
  return this.find({
    estado: 'publicada'
  })
  .sort({ fecha_publicacion: -1 })
  .limit(limite);
};

// Obtener noticias destacadas
noticiaSchema.statics.obtenerDestacadas = function() {
  return this.find({
    estado: 'publicada',
    destacada: true
  })
  .sort({ fecha_publicacion: -1 });
};

// Crear noticia automática para nuevo libr
noticiaSchema.statics.crearNoticiaLibro = async function(libro, idAdmin, nombreAdmin) {
  return new this({
    id_libro: libro._id,
    titulo: `Nuevo libro: ${libro.titulo}`,
    descripcion: `Hemos añadido "${libro.titulo}" de ${libro.autor_nombre_completo} a nuestro catálogo.`,
    contenido: `Nos complace anunciar la incorporación de "${libro.titulo}" de ${libro.autor_nombre_completo} a nuestro catálogo. Este ${libro.estado === 'nuevo' ? 'nuevo' : 'usado'} ejemplar ya está disponible para su compra.`,
    tipo: 'nuevo_libro',
    imagen: libro.imagenes?.portada || '',
    autor: {
      id_admin: idAdmin,
      nombre: nombreAdmin
    }
  }).save();
};

const Noticia = mongoose.model('Noticia', noticiaSchema);

module.exports = Noticia;