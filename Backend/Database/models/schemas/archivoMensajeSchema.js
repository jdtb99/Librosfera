//Database/models/schemas/archivoMensajeSchema.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const archivoMensajeSchema = new Schema({
  nombre_original: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  nombre_archivo: {
    type: String,
    required: true,
    default: function() {
      return crypto.randomUUID();
    },
  },
  url: {
    type: String,
    required: true
  },
  tipo_mime: {
    type: String,
    required: true
  },
  tamaño: {
    type: Number,
    required: true,
    min: 0,
    max: 10 * 1024 * 1024 // 10MB máximo
  },
  fecha_subida: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

module.exports = archivoMensajeSchema;