// Database/models/userModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const addressSchema = require('./schemas/addressSchema');


/**
 * Configuración de opciones para el discriminador
 */
const options = {
  discriminatorKey: 'tipo_usuario',
  collection: 'usuarios',
  timestamps: { 
    createdAt: 'fecha_registro', 
    updatedAt: 'fecha_actualizacion' 
  }
};

/**
 * Esquema base para todos los usuarios
 */
const userSchema = new Schema({
  usuario: {
    type: String,
    required: [true, 'El nombre de usuario es obligatorio'],
    unique: true,
    trim: true,
    minlength: [4, 'El nombre de usuario debe tener al menos 4 caracteres']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un email válido']
  },
  ultimo_acceso: {
    type: Date
  },
  activo: {
    type: Boolean,
    default: true
  },
  // Necesario para discriminadores pero se rellena automáticamente
  tipo_usuario: {
    type: String,
    enum: ['cliente', 'administrador', 'root'],
    required: true
  }
}, options);

// Índices para mejorar búsquedas comunes
// Los campos email y usuario ya tienen índice único por su definición con unique: true
userSchema.index({ tipo_usuario: 1 });
userSchema.index({ activo: 1 });

// Crear el modelo base
const Usuario = mongoose.model('Usuario', userSchema);

/**
 * Esquema común para usuario cliente y administrador
 * Contiene campos compartidos por ambos tipos
 */
const personaSchema = new Schema({
  DNI: {
    type: String,
    required: [true, 'El DNI es obligatorio'],
    unique: true,
    trim: true
  },
  nombres: {
    type: String,
    required: [true, 'Los nombres son obligatorios'],
    trim: true
  },
  apellidos: {
    type: String,
    required: [true, 'Los apellidos son obligatorios'],
    trim: true
  },
  fecha_nacimiento: {
    type: Date,
    required: [true, 'La fecha de nacimiento es obligatoria']
  },
  lugar_nacimiento: {
    type: String,
    required: [true, 'El lugar de nacimiento es obligatorio']
  },
  genero: {
    type: String,
    enum: ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir'],
    default: 'Prefiero no decir'
  },
  direcciones: {
    type: [addressSchema],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Debe proporcionar al menos una dirección'
    }
  },
  telefono: {
    type: String,
    trim: true
  },
  telefono_alternativo: {
    type: String,
    trim: true
  },
  foto_perfil: {
    type: String,
    default: 'https://librosfera.onrender.com/uploads/profiles/default.jpg'
  }
});

// Discriminador para Usuario Root
const Root = Usuario.discriminator('root', new Schema({
  id_root: {
    type: String,
    required: [true, 'El ID de root es obligatorio'],
    unique: true
  },
  permisos_especiales: {
    type: [String],
    default: ['todos']
  }
}));

// Discriminador para Usuario Administrador
const Administrador = Usuario.discriminator('administrador', new Schema({
  ...personaSchema.obj,  // Usar los campos de personaSchema pero ninguno será obligatorio
  DNI: {
    type: String,
    unique: true,
    sparse: true, // Permite múltiples documentos con valor null
    required: false // Era obligatorio, ahora es opcional
  },
  nombres: {
    type: String,
    required: false // Era obligatorio, ahora es opcional
  },
  apellidos: {
    type: String,
    required: false // Era obligatorio, ahora es opcional
  },
  fecha_nacimiento: {
    type: Date,
    required: false // Era obligatorio, ahora es opcional
  },
  lugar_nacimiento: {
    type: String,
    required: false // Era obligatorio, ahora es opcional
  },
  direcciones: {
    type: [addressSchema],
    default: [] // Valor predeterminado como array vacío
  },
  cargo: {
    type: String,
    default: 'Pendiente de asignar',
    required: false // Era obligatorio, ahora es opcional
  },
  departamento: {
    type: String,
    default: 'General',
    required: false // Era obligatorio, ahora es opcional
  },
  permisos: {
    type: [String],
    default: []
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  // Campos adicionales para control
  perfil_completo: {
    type: Boolean,
    default: false // Indica si el administrador ha completado su perfil
  }
}));

// Discriminador para Usuario Cliente
const Cliente = Usuario.discriminator('cliente', new Schema({
  ...personaSchema.obj,  // Usar los campos de personaSchema
  id_cliente: {
    type: String,
    unique: true,
    required: [true, 'El ID de cliente es obligatorio']
  },
  preferencias: {
    temas: [{
      type: String,
      enum: ['Ficción', 'No Ficción', 'Ciencia Ficción', 'Fantasía', 'Romance', 'Biografía', 'Historia', 'Ciencia', 'Filosofía', 'Arte', 'Tecnología']
    }],
    autores: [{
      type: String
    }]
  },

  
  historial_compras: {
    type: [{
      fecha: {
        type: Date,
        default: Date.now
      },
      total: Number,
      productos: [
        {
          id_producto: {
            type: mongoose.Schema.Types.ObjectId
          },
          cantidad: Number,
          precio_unitario: Number
        }
      ]
    }],
    default: []
  },
  suscrito_noticias: {
    type: Boolean,
    default: false
  }
}));

// Exportar todos los modelos
module.exports = {
  Usuario,       // Modelo base
  Root,          // Discriminador Root
  Administrador, // Discriminador Administrador
  Cliente        // Discriminador Cliente
};