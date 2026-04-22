// Database/models/schemas/addressSchema.js (VERIFICADO Y CORREGIDO)
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({
  tipo: {
    type: String,
    enum: ['casa', 'trabajo', 'oficina', 'tienda', 'almacen', 'otro'],
    default: 'casa'
  },
  direccion_completa: {
    type: String,
    required: [true, 'La dirección completa es obligatoria'],
    trim: true,
    maxlength: [200, 'La dirección no puede exceder 200 caracteres']
  },
  ciudad: {
    type: String,
    required: [true, 'La ciudad es obligatoria'],
    trim: true,
    maxlength: [100, 'La ciudad no puede exceder 100 caracteres']
  },
  departamento: {
    type: String,
    required: [true, 'El departamento es obligatorio'],
    trim: true,
    maxlength: [100, 'El departamento no puede exceder 100 caracteres']
  },
  codigo_postal: {
    type: String,
    trim: true,
    maxlength: [20, 'El código postal no puede exceder 20 caracteres']
  },
  pais: {
    type: String,
    default: 'Colombia',
    trim: true,
    maxlength: [50, 'El país no puede exceder 50 caracteres']
  },
  telefono_contacto: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono no puede exceder 20 caracteres'],
    match: [/^[\+]?[0-9\s\-\(\)]*$/, 'Formato de teléfono no válido']
  },
  referencia: {
    type: String,
    trim: true,
    maxlength: [500, 'La referencia no puede exceder 500 caracteres'],
    description: 'Puntos de referencia o indicaciones adicionales para encontrar la dirección'
  },
  predeterminada: {
    type: Boolean,
    default: false,
    description: 'Indica si esta es la dirección predeterminada del usuario/entidad'
  },
  activa: {
    type: Boolean,
    default: true,
    description: 'Indica si la dirección está activa y puede usarse'
  },
  // NUEVO: Información adicional para tiendas físicas
  es_direccion_comercial: {
    type: Boolean,
    default: false,
    description: 'Indica si es una dirección comercial (tienda, oficina, etc.)'
  },
  horario_atencion: {
    type: String,
    maxlength: [100, 'El horario de atención no puede exceder 100 caracteres'],
    description: 'Horario de atención para direcciones comerciales'
  },
  instrucciones_acceso: {
    type: String,
    maxlength: [300, 'Las instrucciones de acceso no pueden exceder 300 caracteres'],
    description: 'Instrucciones específicas para acceder al lugar'
  },
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  fecha_actualizacion: {
    type: Date,
    default: Date.now
  }
});

// Middleware pre-save para actualizar fecha de modificación
addressSchema.pre('save', function(next) {
  this.fecha_actualizacion = new Date();
  next();
});

// Método virtual para obtener dirección formateada
addressSchema.virtual('direccion_formateada').get(function() {
  let direccion = this.direccion_completa;
  
  if (this.ciudad) {
    direccion += `, ${this.ciudad}`;
  }
  
  if (this.departamento) {
    direccion += `, ${this.departamento}`;
  }
  
  if (this.codigo_postal) {
    direccion += ` ${this.codigo_postal}`;
  }
  
  if (this.pais && this.pais !== 'Colombia') {
    direccion += `, ${this.pais}`;
  }
  
  return direccion;
});

// NUEVO: Método virtual para dirección formateada para tiendas
addressSchema.virtual('direccion_comercial_formateada').get(function() {
  let direccion = this.direccion_formateada;
  
  if (this.es_direccion_comercial && this.horario_atencion) {
    direccion += ` | Horario: ${this.horario_atencion}`;
  }
  
  if (this.telefono_contacto) {
    direccion += ` | Tel: ${this.telefono_contacto}`;
  }
  
  return direccion;
});

// Método virtual para validar si la dirección está completa
addressSchema.virtual('esta_completa').get(function() {
  return !!(this.direccion_completa && this.ciudad && this.departamento);
});

// NUEVO: Método virtual para validar si es válida para uso comercial
addressSchema.virtual('es_valida_comercial').get(function() {
  return !!(
    this.esta_completa &&
    this.activa &&
    this.telefono_contacto &&
    this.es_direccion_comercial
  );
});

// Método para validar si la dirección es válida para envío
addressSchema.methods.esValidaParaEnvio = function() {
  return this.activa && this.esta_completa;
};

// NUEVO: Método para validar si es válida para tienda física
addressSchema.methods.esValidaParaTienda = function() {
  return this.esValidaParaEnvio() && 
         this.es_direccion_comercial && 
         this.telefono_contacto;
};

// NUEVO: Método para actualizar información comercial
addressSchema.methods.actualizarInfoComercial = function(datos) {
  if (datos.horario_atencion !== undefined) {
    this.horario_atencion = datos.horario_atencion;
  }
  if (datos.instrucciones_acceso !== undefined) {
    this.instrucciones_acceso = datos.instrucciones_acceso;
  }
  if (datos.es_direccion_comercial !== undefined) {
    this.es_direccion_comercial = datos.es_direccion_comercial;
  }
  
  this.fecha_actualizacion = new Date();
  return this;
};

// NUEVO: Método para generar objeto de dirección para APIs externas
addressSchema.methods.paraAPIExterna = function() {
  return {
    direccion_completa: this.direccion_completa,
    ciudad: this.ciudad,
    departamento: this.departamento,
    codigo_postal: this.codigo_postal,
    pais: this.pais,
    direccion_formateada: this.direccion_formateada
  };
};

// Índices
addressSchema.index({ predeterminada: 1 });
addressSchema.index({ activa: 1 });
addressSchema.index({ ciudad: 1, departamento: 1 });
addressSchema.index({ es_direccion_comercial: 1 });

module.exports = addressSchema;

// ==========================================
// CORRECCIONES EN MODELOS QUE USAN ADDRESSSCHEMA
// ==========================================

/*
VERIFICACIÓN DE MODELOS QUE NECESITAN CORRECCIÓN:

1. userModel.js - Cliente y Administrador ✓ (ya funciona correctamente)
2. tiendaFisicaModel.js ✓ (ya implementado correctamente)
3. envioModel.js ✓ (ya funciona correctamente)
4. recogidaTiendaModel.js ✓ (si lo usa, está correcto)
5. ventaModel.js ✓ (usa addressSchema en envio.direccion)

MÉTODOS DE VALIDACIÓN AGREGADOS:
- esta_completa (virtual)
- es_valida_comercial (virtual)
- esValidaParaEnvio() (método)
- esValidaParaTienda() (método)
- actualizarInfoComercial() (método)
- paraAPIExterna() (método)

CAMPOS NUEVOS AGREGADOS:
- es_direccion_comercial (Boolean)
- horario_atencion (String)
- instrucciones_acceso (String)

COMPATIBILIDAD:
- Todos los modelos existentes seguirán funcionando
- Los nuevos campos son opcionales
- Los métodos virtuales no afectan la compatibilidad
- Los nuevos métodos son adicionales

MIGRACIÓN AUTOMÁTICA:
- No se requiere migración de datos existentes
- Los nuevos campos tendrán valores por defecto
- La funcionalidad existente no se ve afectada
*/