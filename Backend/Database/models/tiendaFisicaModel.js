// Database/models/tiendaFisicaModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const addressSchema = require('./schemas/addressSchema');

const tiendaFisicaSchema = new Schema({
  // Identificador único de la tienda
  id_tienda: {
    type: String,
    default: function() {
      return `TIENDA${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
    },
    unique: true,
    index: true
  },
  
  // Información básica
  nombre: {
    type: String,
    required: [true, 'El nombre de la tienda es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  
  codigo: {
    type: String,
    required: [true, 'El código de la tienda es obligatorio'],
    trim: true,
    uppercase: true,
    maxlength: [10, 'El código no puede exceder 10 caracteres'],
    match: [/^[A-Z0-9]{2,10}$/, 'El código debe contener solo letras mayúsculas y números']
  },
  
  // Dirección completa de la tienda usando addressSchema
  direccion: {
    type: addressSchema,
    required: [true, 'La dirección es obligatoria']
  },
  
  // Coordenadas para Google Maps y búsqueda geográfica
  coordenadas: {
    latitud: {
      type: Number,
      required: [true, 'La latitud es obligatoria'],
      min: [-90, 'La latitud debe estar entre -90 y 90'],
      max: [90, 'La latitud debe estar entre -90 y 90']
    },
    longitud: {
      type: Number,
      required: [true, 'La longitud es obligatoria'],
      min: [-180, 'La longitud debe estar entre -180 y 180'],
      max: [180, 'La longitud debe estar entre -180 y 180']
    }
  },
  
  // Información de contacto
  telefono_principal: {
    type: String,
    required: [true, 'El teléfono principal es obligatorio'],
    validate: {
      validator: function(v) {
        return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(v);
      },
      message: 'Formato de teléfono inválido'
    }
  },
  
  telefono_secundario: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(v);
      },
      message: 'Formato de teléfono inválido'
    }
  },
  
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Formato de email inválido'
    }
  },
  
  // Horarios de atención
  horarios: {
    lunes: {
      activo: { type: Boolean, default: true },
      apertura: { type: String, default: '08:00' },
      cierre: { type: String, default: '18:00' }
    },
    martes: {
      activo: { type: Boolean, default: true },
      apertura: { type: String, default: '08:00' },
      cierre: { type: String, default: '18:00' }
    },
    miercoles: {
      activo: { type: Boolean, default: true },
      apertura: { type: String, default: '08:00' },
      cierre: { type: String, default: '18:00' }
    },
    jueves: {
      activo: { type: Boolean, default: true },
      apertura: { type: String, default: '08:00' },
      cierre: { type: String, default: '18:00' }
    },
    viernes: {
      activo: { type: Boolean, default: true },
      apertura: { type: String, default: '08:00' },
      cierre: { type: String, default: '18:00' }
    },
    sabado: {
      activo: { type: Boolean, default: true },
      apertura: { type: String, default: '09:00' },
      cierre: { type: String, default: '17:00' }
    },
    domingo: {
      activo: { type: Boolean, default: false },
      apertura: { type: String, default: '10:00' },
      cierre: { type: String, default: '15:00' }
    }
  },
  
  // Servicios que ofrece la tienda
  servicios: {
    venta_presencial: {
      type: Boolean,
      default: true
    },
    recogida_productos: {
      type: Boolean,
      default: true
    },
    devoluciones: {
      type: Boolean,
      default: true
    },
    eventos: {
      type: Boolean,
      default: false
    },
    consulta_libreria: {
      type: Boolean,
      default: true
    },
    transferencias_tiendas: {
      type: Boolean,
      default: true
    }
  },
  
  // Capacidades y límites operativos
  capacidad: {
    max_recogidas_dia: {
      type: Number,
      default: 50,
      min: [1, 'La capacidad mínima es 1']
    },
    max_transferencias_dia: {
      type: Number,
      default: 20,
      min: [1, 'La capacidad mínima es 1']
    },
    espacio_almacen_m2: {
      type: Number,
      default: 100,
      min: [1, 'El espacio mínimo es 1 m²']
    },
    capacidad_maxima_libros: {
      type: Number,
      default: 5000,
      min: [1, 'La capacidad mínima es 1 libro']
    }
  },
  
  // Estado operativo de la tienda
  estado: {
    type: String,
    enum: ['activa', 'mantenimiento', 'cerrada_temporal', 'cerrada_permanente'],
    default: 'activa',
    index: true
  },
  
  // Información del responsable/gerente
  responsable: {
    nombre: {
      type: String,
      required: [true, 'El nombre del responsable es obligatorio']
    },
    telefono: {
      type: String,
      required: [true, 'El teléfono del responsable es obligatorio']
    },
    email: {
      type: String,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: 'Formato de email inválido'
      }
    },
    id_usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    }
  },
  
  // Configuración de zona de cobertura
  zona_cobertura: {
    radio_km: {
      type: Number,
      default: 15,
      min: [1, 'El radio mínimo es 1 km']
    },
    ciudades_cobertura: [{
      type: String,
      trim: true
    }],
    departamentos_cobertura: [{
      type: String,
      trim: true
    }]
  },
  
  // Estadísticas operativas
  estadisticas: {
    total_recogidas: {
      type: Number,
      default: 0
    },
    total_ventas_presenciales: {
      type: Number,
      default: 0
    },
    total_devoluciones: {
      type: Number,
      default: 0
    },
    calificacion_promedio: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    total_calificaciones: {
      type: Number,
      default: 0
    },
    inventario_actual: {
      type: Number,
      default: 0
    },
    valor_inventario: {
      type: Number,
      default: 0
    }
  },
  
  // Información adicional
  descripcion: {
    type: String,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },
  
  caracteristicas_especiales: [{
    type: String,
    enum: ['parking', 'acceso_discapacitados', 'wifi_gratuito', 'zona_lectura', 'eventos', 'cafe']
  }],
  
  // Imágenes de la tienda
  imagenes: [{
    url: String,
    tipo: {
      type: String,
      enum: ['fachada', 'interior', 'zona_lectura', 'almacen', 'otra'],
      default: 'otra'
    },
    descripcion: String,
    orden: {
      type: Number,
      default: 0
    }
  }],
  
  // Notas internas para administración
  notas_internas: [{
    fecha: {
      type: Date,
      default: Date.now
    },
    nota: String,
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    categoria: {
      type: String,
      enum: ['operativa', 'mantenimiento', 'incidencia', 'mejora', 'otra'],
      default: 'otra'
    }
  }],
  
  // Configuración de notificaciones
  configuracion_notificaciones: {
    email_stock_bajo: {
      type: Boolean,
      default: true
    },
    email_recogidas_pendientes: {
      type: Boolean,
      default: true
    },
    email_transferencias: {
      type: Boolean,
      default: true
    }
  },
  
  // Fechas importantes
  fecha_apertura: {
    type: Date,
    required: [true, 'La fecha de apertura es obligatoria']
  },
  
  fecha_cierre: Date,
  
  fecha_ultima_auditoria: Date,
  
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  ultima_actualizacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'fecha_creacion',
    updatedAt: 'ultima_actualizacion'
  }
});

// ÍNDICES PARA OPTIMIZACIÓN
tiendaFisicaSchema.index({ estado: 1, 'servicios.recogida_productos': 1 });
tiendaFisicaSchema.index({ 'direccion.ciudad': 1, estado: 1 });
tiendaFisicaSchema.index({ 'direccion.departamento': 1, estado: 1 });
tiendaFisicaSchema.index({ coordenadas: '2dsphere' });
tiendaFisicaSchema.index({ codigo: 1 });
tiendaFisicaSchema.index({ nombre: 'text', descripcion: 'text' });

// MIDDLEWARE
tiendaFisicaSchema.pre('save', function(next) {
  this.ultima_actualizacion = new Date();
  
  // Asegurar que la dirección esté marcada como activa
  if (this.direccion) {
    this.direccion.activa = true;
  }
  
  next();
});

// Validar horarios antes de guardar
tiendaFisicaSchema.pre('save', function(next) {
  const validarHora = (hora) => {
    if (!hora) return true;
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hora);
  };
  
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  
  for (const dia of dias) {
    const horario = this.horarios[dia];
    if (horario.activo) {
      if (!validarHora(horario.apertura)) {
        return next(new Error(`Formato de hora de apertura inválido para ${dia}`));
      }
      if (!validarHora(horario.cierre)) {
        return next(new Error(`Formato de hora de cierre inválido para ${dia}`));
      }
    }
  }
  
  next();
});

// MÉTODOS DE INSTANCIA

// Verificar si la tienda está operativa
tiendaFisicaSchema.methods.estaOperativa = function() {
  return this.estado === 'activa';
};

// Verificar si puede recibir recogidas
tiendaFisicaSchema.methods.puedeRecibirRecogidas = function() {
  return this.estaOperativa() && this.servicios.recogida_productos;
};

// Verificar si está en horario de atención
tiendaFisicaSchema.methods.estaAbierta = function(fecha = new Date()) {
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaNombre = diasSemana[fecha.getDay()];
  const horario = this.horarios[diaNombre];
  
  if (!horario || !horario.activo) {
    return false;
  }
  
  const hora = fecha.getHours();
  const minutos = fecha.getMinutes();
  const horaActual = hora + (minutos / 60);
  
  const [aperturaH, aperturaM] = horario.apertura.split(':').map(Number);
  const [cierreH, cierreM] = horario.cierre.split(':').map(Number);
  
  const horaApertura = aperturaH + (aperturaM / 60);
  const horaCierre = cierreH + (cierreM / 60);
  
  return horaActual >= horaApertura && horaActual < horaCierre;
};

// Calcular distancia a unas coordenadas
tiendaFisicaSchema.methods.calcularDistancia = function(lat, lng) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat - this.coordenadas.latitud) * Math.PI / 180;
  const dLng = (lng - this.coordenadas.longitud) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.coordenadas.latitud * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distancia = R * c;
  
  return Math.round(distancia * 100) / 100;
};

// Verificar disponibilidad de un libro en esta tienda
tiendaFisicaSchema.methods.verificarDisponibilidadLibro = async function(idLibro, cantidad = 1) {
  const Inventario = mongoose.model('Inventario');
  
  const inventario = await Inventario.findOne({
    id_libro: idLibro,
    id_tienda: this._id,
    estado: 'disponible'
  });
  
  return inventario ? inventario.stock_disponible : 0;
};

// Obtener inventario de la tienda
tiendaFisicaSchema.methods.obtenerInventario = async function(filtros = {}) {
  const Inventario = mongoose.model('Inventario');
  
  const query = { id_tienda: this._id, ...filtros };
  
  return await Inventario.find(query)
    .populate('id_libro', 'titulo autor_nombre_completo precio stock imagen_portada')
    .sort({ ultima_actualizacion: -1 });
};

// Verificar si está en zona de cobertura
tiendaFisicaSchema.methods.estaEnZonaCobertura = function(direccionDestino) {
  // Verificar por ciudad
  if (this.zona_cobertura.ciudades_cobertura.length > 0) {
    const ciudadDestino = direccionDestino.ciudad.toLowerCase();
    const ciudadesCubiertas = this.zona_cobertura.ciudades_cobertura.map(c => c.toLowerCase());
    return ciudadesCubiertas.includes(ciudadDestino);
  }
  
  // Verificar por departamento
  if (this.zona_cobertura.departamentos_cobertura.length > 0) {
    const deptoDestino = direccionDestino.departamento.toLowerCase();
    const deptosCubiertos = this.zona_cobertura.departamentos_cobertura.map(d => d.toLowerCase());
    return deptosCubiertos.includes(deptoDestino);
  }
  
  return true; // Si no hay restricciones específicas
};

// Agregar nota interna
tiendaFisicaSchema.methods.agregarNota = function(nota, idUsuario, categoria = 'otra') {
  this.notas_internas.push({
    nota,
    usuario: idUsuario,
    categoria,
    fecha: new Date()
  });
  return this.save();
};

// Actualizar estadísticas
tiendaFisicaSchema.methods.actualizarEstadisticas = async function() {
  try {
    const RecogidaTienda = mongoose.model('RecogidaTienda');
    const Venta = mongoose.model('Venta');
    const Inventario = mongoose.model('Inventario');
    
    // Contar recogidas completadas
    const totalRecogidas = await RecogidaTienda.countDocuments({
      id_tienda: this._id,
      estado: 'RECOGIDO'
    });
    
    // Contar ventas presenciales
    const totalVentasPresenciales = await Venta.countDocuments({
      'envio.tipo': 'recogida_tienda',
      'envio.id_tienda_recogida': this._id,
      estado: 'entregado'
    });
    
    // Calcular inventario actual
    const statsInventario = await Inventario.aggregate([
      { $match: { id_tienda: this._id } },
      {
        $group: {
          _id: null,
          total_libros: { $sum: '$stock_total' },
          valor_total: { $sum: { $multiply: ['$stock_total', '$precio_promedio'] } }
        }
      }
    ]);
    
    this.estadisticas.total_recogidas = totalRecogidas;
    this.estadisticas.total_ventas_presenciales = totalVentasPresenciales;
    
    if (statsInventario.length > 0) {
      this.estadisticas.inventario_actual = statsInventario[0].total_libros || 0;
      this.estadisticas.valor_inventario = statsInventario[0].valor_total || 0;
    }
    
    return this.save();
  } catch (error) {
    console.error('Error actualizando estadísticas de tienda:', error);
    throw error;
  }
};

// MÉTODOS ESTÁTICOS

// Buscar tiendas cercanas
tiendaFisicaSchema.statics.buscarCercanas = function(lat, lng, radioKm = 10, limite = 10) {
  return this.find({
    estado: 'activa',
    coordenadas: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: radioKm * 1000
      }
    }
  }).limit(limite);
};

// Buscar por ciudad
tiendaFisicaSchema.statics.buscarPorCiudad = function(ciudad) {
  return this.find({
    'direccion.ciudad': { $regex: ciudad, $options: 'i' },
    estado: 'activa'
  }).sort({ nombre: 1 });
};

// Buscar tiendas que tengan un libro disponible
tiendaFisicaSchema.statics.buscarConLibroDisponible = async function(idLibro, cantidad = 1) {
  const Inventario = mongoose.model('Inventario');
  
  const inventarios = await Inventario.find({
    id_libro: idLibro,
    stock_disponible: { $gte: cantidad },
    estado: 'disponible'
  }).populate({
    path: 'id_tienda',
    match: { estado: 'activa' }
  });
  
  return inventarios
    .filter(inv => inv.id_tienda)
    .map(inv => inv.id_tienda);
};

// Obtener estadísticas generales
tiendaFisicaSchema.statics.obtenerEstadisticasGenerales = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$estado',
        cantidad: { $sum: 1 },
        total_recogidas: { $sum: '$estadisticas.total_recogidas' },
        total_ventas: { $sum: '$estadisticas.total_ventas_presenciales' },
        inventario_total: { $sum: '$estadisticas.inventario_actual' }
      }
    }
  ]);
  
  const totalTiendas = await this.countDocuments();
  const tiendasActivas = await this.countDocuments({ estado: 'activa' });
  
  return {
    total_tiendas: totalTiendas,
    tiendas_activas: tiendasActivas,
    por_estado: stats,
    fecha_consulta: new Date()
  };
};

const TiendaFisica = mongoose.model('Tienda_Fisica', tiendaFisicaSchema);

module.exports = TiendaFisica;