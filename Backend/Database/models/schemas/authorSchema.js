const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Esquema para autores de libros
const authorSchema = new Schema({
  // Nombre del autor
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  
  // Apellidos del autor
  apellidos: {
    type: String,
    required: true,
    trim: true
  },
  
  // Información biográfica (opcional)
  biografia: {
    type: String,
    trim: true
  },
  
  // Nacionalidad del autor
  nacionalidad: {
    type: String,
    trim: true
  },
  
  // Fechas de nacimiento y fallecimiento (opcionales)
  fechas: {
    nacimiento: Date,
    fallecimiento: Date
  },
  
  // Referencias externas (opcionales)
  referencias: {
    web_personal: String,
    wikipedia: String,
    goodreads: String
  }
}, { _id: true }); // Aseguramos que tenga _id para poder referenciar autores específicos

// Método virtual para obtener nombre completo
authorSchema.virtual('nombre_completo').get(function() {
  return `${this.nombre} ${this.apellidos}`;
});

// Método para verificar si el autor está vivo
authorSchema.methods.estaVivo = function() {
  return !this.fechas.fallecimiento;
};

module.exports = authorSchema;