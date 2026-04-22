// Database/models/passwordResetModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Esquema para tokens de restablecimiento de contraseña
 * Almacena tokens temporales con tiempo de expiración
 */
const passwordResetSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Usuario'
  },
  email: {
    type: String,
    required: true
  },
  token: {
    type: String,
    required: true
  },
  verificationCode: {
    type: String,
    required: true,
    length: 6
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // El documento expirará después de 1 hora (3600 segundos)
  }
});

// Crear índice por token para búsquedas rápidas
passwordResetSchema.index({ token: 1 });
// Crear índice por email para búsquedas rápidas
passwordResetSchema.index({ email: 1 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);