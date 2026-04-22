// Database/models/schemas/tarjetaSchema.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

/**
 * Esquema para tarjetas (crédito/débito)
 * Almacena la información de las tarjetas de forma segura
 */
const tarjetaSchema = new Schema({
  // Identificador único de la tarjeta
  id_tarjeta: {
    type: String,
    default: function() {
      return `CARD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
    },
    unique: true,
    index: true
  },
  
  // Usuario propietario de la tarjeta
  id_usuario: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El ID de usuario es obligatorio'],
    index: true
  },
  
  // Tipo de tarjeta
  tipo: {
    type: String,
    enum: ['credito', 'debito'],
    required: [true, 'El tipo de tarjeta es obligatorio']
  },
  
  // Nombre como aparece en la tarjeta
  nombre_titular: {
    type: String,
    required: [true, 'El nombre del titular es obligatorio'],
    trim: true
  },
  
  // Últimos 4 dígitos (por seguridad solo almacenamos estos)
  ultimos_digitos: {
    type: String,
    required: [true, 'Los últimos 4 dígitos son obligatorios'],
    match: [/^\d{4}$/, 'Los últimos dígitos deben ser 4 números']
  },
  
  // Marca de la tarjeta
  marca: {
    type: String,
    enum: ['visa', 'mastercard', 'american_express', 'diners', 'otra'],
    required: [true, 'La marca de la tarjeta es obligatoria']
  },
  
  // Fecha de expiración
  fecha_expiracion: {
    mes: {
      type: Number,
      required: [true, 'El mes de expiración es obligatorio'],
      min: [1, 'El mes debe estar entre 1 y 12'],
      max: [12, 'El mes debe estar entre 1 y 12']
    },
    anio: {
      type: Number,
      required: [true, 'El año de expiración es obligatorio'],
      validate: {
        validator: function(v) {
          return v >= new Date().getFullYear();
        },
        message: 'La tarjeta ha expirado'
      }
    }
  },
  
  // Token seguro para operaciones (en producción usarías un servicio de pago)
  token_seguro: {
    type: String,
    required: true
  },
  
  // Si es la tarjeta predeterminada del usuario
  predeterminada: {
    type: Boolean,
    default: false
  },

  // Saldo disponible (solo aplicable para tarjetas de débito)
  saldo: {
    type: Number,
    default: 0,
    min: [0, 'El saldo no puede ser negativo']
  },
  
  // Estado de la tarjeta
  activa: {
    type: Boolean,
    default: true
  },
  
  // Metadatos
  fecha_registro: {
    type: Date,
    default: Date.now
  },
  
  ultima_actualizacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'fecha_registro',
    updatedAt: 'ultima_actualizacion'
  }
});

// Índices para mejorar búsquedas comunes
tarjetaSchema.index({ id_usuario: 1, predeterminada: -1 });
tarjetaSchema.index({ activa: 1 });
tarjetaSchema.index({ marca: 1 });

// Middleware pre-save para actualizar fecha
tarjetaSchema.pre('save', function(next) {
  this.ultima_actualizacion = new Date();
  
  // Asegurar que solo haya una tarjeta predeterminada por usuario
  if (this.predeterminada && this.isModified('predeterminada')) {
    this.constructor.updateMany(
      { id_usuario: this.id_usuario, _id: { $ne: this._id } },
      { $set: { predeterminada: false } }
    ).then(() => next())
    .catch(err => next(err));
  } else {
    next();
  }
});

// MÉTODOS DE INSTANCIA

// Verificar si la tarjeta es válida (no expirada)
tarjetaSchema.methods.esValida = function() {
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1; // getMonth() es 0-indexed
  
  return (this.fecha_expiracion.anio > anioActual) || 
         (this.fecha_expiracion.anio === anioActual && this.fecha_expiracion.mes >= mesActual);
};

// Verificar si tiene saldo suficiente
tarjetaSchema.methods.tieneSaldoSuficiente = function(monto) {
  // Para tarjetas de crédito no verificamos saldo
  if (this.tipo === 'credito') return true;
  
  // Para tarjetas de débito, verificar saldo disponible
  return this.saldo >= monto;
};

// Modificar saldo (solo para tarjetas de débito)
tarjetaSchema.methods.modificarSaldo = async function(monto, descripcion = '') {
  if (this.tipo !== 'debito') {
    throw new Error('No se puede modificar el saldo de una tarjeta de crédito');
  }
  
  const saldoAnterior = this.saldo;
  this.saldo += monto;
  
  // Evitar saldos negativos
  if (this.saldo < 0) {
    this.saldo = 0;
    throw new Error('El saldo no puede ser negativo');
  }
  
  this.ultima_actualizacion = new Date();
  
  // Crear un registro de la transacción en el historial
  // (Esto podría implementarse en otro modelo si prefieres separar la lógica)
  
  return this.save();
};

// MÉTODOS ESTÁTICOS

// Obtener todas las tarjetas de un usuario
tarjetaSchema.statics.obtenerTarjetasUsuario = function(idUsuario) {
  return this.find({ id_usuario: idUsuario, activa: true })
    .sort({ predeterminada: -1, fecha_registro: -1 });
};

// Establecer una tarjeta como predeterminada
tarjetaSchema.statics.establecerPredeterminada = async function(idTarjeta, idUsuario) {
  // Primero, quitar predeterminada de todas las tarjetas del usuario
  await this.updateMany(
    { id_usuario: idUsuario },
    { $set: { predeterminada: false } }
  );
  
  // Establecer la tarjeta seleccionada como predeterminada
  return this.findOneAndUpdate(
    { id_tarjeta: idTarjeta, id_usuario: idUsuario },
    { $set: { predeterminada: true } },
    { new: true }
  );
};

// Generar un token seguro para la tarjeta (simulado)
tarjetaSchema.statics.generarTokenSeguro = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Determinar marca de tarjeta según número
tarjetaSchema.statics.determinarMarcaTarjeta = function(numeroTarjeta) {
  // Implementación simple - en producción usarías algo más completo
  const firstDigit = numeroTarjeta.charAt(0);
  const firstTwo = numeroTarjeta.substring(0, 2);
  
  if (firstDigit === '4') return 'visa';
  if (['51', '52', '53', '54', '55'].includes(firstTwo)) return 'mastercard';
  if (['34', '37'].includes(firstTwo)) return 'american_express';
  if (['36', '38', '39'].includes(firstTwo)) return 'diners';
  
  return 'otra';
};

// Validar número de tarjeta usando algoritmo de Luhn (implementación básica)
tarjetaSchema.statics.validarNumeroTarjeta = function(numeroTarjeta) {
  if (!numeroTarjeta || typeof numeroTarjeta !== 'string') return false;
  
  // Eliminar espacios y guiones
  const numero = numeroTarjeta.replace(/[\s-]/g, '');
  
  // Verificar que solo contenga dígitos y longitud válida (13-19 dígitos)
  if (!/^\d{13,19}$/.test(numero)) return false;
  
  // Algoritmo de Luhn
  let suma = 0;
  let doble = false;
  
  // Empezar desde el último dígito
  for (let i = numero.length - 1; i >= 0; i--) {
    let digito = parseInt(numero.charAt(i), 10);
    
    if (doble) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    
    suma += digito;
    doble = !doble;
  }
  
  return suma % 10 === 0;
};

// Exportar modelo
const Tarjeta = mongoose.model('Tarjeta', tarjetaSchema);

module.exports = Tarjeta;