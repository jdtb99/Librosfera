// Database/models/recogidaTiendaModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const QRCode = require('qrcode');
const crypto = require('crypto');

const recogidaTiendaSchema = new Schema({
  // Identificador único
  id_recogida: {
    type: String,
    default: function() {
      return `REC${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
    },
    unique: true,
    index: true
  },

  id_transaccion: {
    type: String,
    default: function() {
      return crypto.randomUUID();
    },
    unique: true,
    index: true
  },
  
  // Venta asociada
  id_venta: {
    type: Schema.Types.ObjectId,
    ref: 'Venta',
    required: true,
    index: true,
    unique: true
  },
  
  // Cliente que realizó la compra
  id_cliente: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  // Tienda seleccionada para recogida
  id_tienda: {
    type: Schema.Types.ObjectId,
    ref: 'Tienda_Fisica',
    required: true,
    index: true
  },
  
  // Estado de la recogida
  estado: {
    type: String,
    enum: [
      'VERIFICANDO_DISPONIBILIDAD',
      'PREPARANDO_PEDIDO',
      'LISTO_PARA_RECOGER',
      'RECOGIDO',
      'CANCELADO',
      'EXPIRADO'
    ],
    default: 'VERIFICANDO_DISPONIBILIDAD',
    index: true
  },
  
  // Items de la recogida
  items: [{
    id_item_venta: {
      type: Schema.Types.ObjectId,
      required: true
    },
    id_libro: {
      type: Schema.Types.ObjectId,
      ref: 'Libro',
      required: true
    },
    titulo: String,
    autor: String,
    isbn: String,
    cantidad: {
      type: Number,
      required: true,
      min: 1
    },
    precio_unitario: Number,
    subtotal: Number,
    estado_item: {
      type: String,
      enum: ['pendiente', 'disponible', 'recogido', 'faltante', 'transferido'],
      default: 'pendiente'
    },
    id_tienda_origen: {
      type: Schema.Types.ObjectId,
      ref: 'Tienda_Fisica'
    },
    notas: String
  }],
  
  // Código único para la recogida
  codigo_recogida: {
    type: String,
    sparse: true,
  },
  
  // QR code para facilitar la recogida
  qr_code: {
    codigo: String,
    imagen_base64: String,
    url_verificacion: String,
    fecha_generacion: {
      type: Date,
      default: Date.now
    }
  },
  
  // Información de fechas importantes
  fechas: {
    creacion: {
      type: Date,
      default: Date.now
    },
    verificacion_completada: Date,
    preparacion_iniciada: Date,
    listo_para_recoger: Date,
    fecha_recogida: Date,
    fecha_limite: Date,
    fecha_expiracion: {
      type: Date,
      default: function() {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + 7); // 7 días para recoger
        return fecha;
      }
    }
  },
  
  // Información del personal de la tienda
  empleado_preparacion: {
    id_usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    nombre: String,
    fecha: Date,
    tiempo_preparacion_minutos: Number
  },
  
  empleado_entrega: {
    id_usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    nombre: String,
    fecha: Date,
    documento_presentado: String, // DNI, cédula, etc.
    firma_digital: String
  },
  
  // Notificaciones enviadas al cliente
  notificaciones: [{
    tipo: {
      type: String,
      enum: ['listo_para_recoger', 'recordatorio', 'proximo_vencimiento', 'vencido', 'transferencia']
    },
    fecha_envio: {
      type: Date,
      default: Date.now
    },
    canal: {
      type: String,
      enum: ['email', 'sms', 'push']
    },
    enviado: {
      type: Boolean,
      default: false
    },
    mensaje: String,
    error: String
  }],
  
  // Transferencias entre tiendas
  transferencias: [{
    id_libro: {
      type: Schema.Types.ObjectId,
      ref: 'Libro'
    },
    cantidad: Number,
    tienda_origen: {
      type: Schema.Types.ObjectId,
      ref: 'Tienda_Fisica'
    },
    tienda_destino: {
      type: Schema.Types.ObjectId,
      ref: 'Tienda_Fisica'
    },
    estado_transferencia: {
      type: String,
      enum: ['solicitada', 'en_transito', 'completada', 'cancelada'],
      default: 'solicitada'
    },
    fecha_solicitud: {
      type: Date,
      default: Date.now
    },
    fecha_envio: Date,
    fecha_recepcion: Date,
    empleado_envio: String,
    empleado_recepcion: String,
    notas: String
  }],
  
  // Observaciones y notas
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
      enum: ['operativa', 'incidencia', 'transferencia', 'cliente', 'otra'],
      default: 'otra'
    }
  }],
  
  observaciones_cliente: String,
  instrucciones_especiales: String,
  
  // Historial de cambios de estado
  historial_estados: [{
    estado_anterior: String,
    estado_nuevo: String,
    fecha: {
      type: Date,
      default: Date.now
    },
    motivo: String,
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    metadata: Schema.Types.Mixed
  }],
  
  // Métricas de tiempo
  metricas_tiempo: {
    tiempo_verificacion_minutos: Number,
    tiempo_preparacion_minutos: Number,
    tiempo_espera_recogida_horas: Number,
    tiempo_total_proceso_horas: Number
  },
  
  // Valoración del servicio
  valoracion: {
    puntuacion: {
      type: Number,
      min: 1,
      max: 5
    },
    comentario: String,
    fecha_valoracion: Date,
    aspectos: {
      rapidez: { type: Number, min: 1, max: 5 },
      atencion: { type: Number, min: 1, max: 5 },
      organizacion: { type: Number, min: 1, max: 5 }
    }
  },
  
  // Metadatos
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

// ÍNDICES
recogidaTiendaSchema.index({ id_cliente: 1, estado: 1 });
recogidaTiendaSchema.index({ id_tienda: 1, estado: 1 });
recogidaTiendaSchema.index({ 'fechas.fecha_limite': 1 });
recogidaTiendaSchema.index({ 'fechas.fecha_expiracion': 1 });
recogidaTiendaSchema.index({ fecha_creacion: -1 });

// MIDDLEWARE
recogidaTiendaSchema.pre('save', function(next) {
  this.ultima_actualizacion = new Date();
  next();
});

// Generar QR automáticamente cuando se crea el código
recogidaTiendaSchema.pre('save', async function(next) {
  if (this.isNew && this.codigo_recogida && !this.qr_code.imagen_base64) {
    try {
      const baseUrl = process.env.BASE_URL || 'https://librosfera.onrender.com/';
      this.qr_code.url_verificacion = `${baseUrl}/api/v1/recogidas/verificar/${this.codigo_recogida}`;
      
      const qrOptions = {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      };
      
      this.qr_code.imagen_base64 = await QRCode.toDataURL(this.qr_code.url_verificacion, qrOptions);
      this.qr_code.fecha_generacion = new Date();
    } catch (error) {
      console.error('Error generando QR:', error);
    }
  }
  next();
});

// MÉTODOS DE INSTANCIA

// Cambiar estado con logging automático
recogidaTiendaSchema.methods.cambiarEstado = function(nuevoEstado, motivo, idUsuario, metadata = {}) {
  const estadoAnterior = this.estado;
  this.estado = nuevoEstado;
  
  const ahora = new Date();
  
  // Actualizar fechas según el estado
  switch (nuevoEstado) {
    case 'VERIFICANDO_DISPONIBILIDAD':
      this.fechas.verificacion_completada = null;
      break;
    case 'PREPARANDO_PEDIDO':
      this.fechas.verificacion_completada = ahora;
      this.fechas.preparacion_iniciada = ahora;
      break;
    case 'LISTO_PARA_RECOGER':
      this.fechas.listo_para_recoger = ahora;
      if (!this.codigo_recogida) {
        this.generarCodigoRecogida();
      }
      if (!this.fechas.fecha_limite) {
        const fechaLimite = new Date(ahora);
        fechaLimite.setDate(fechaLimite.getDate() + 7);
        this.fechas.fecha_limite = fechaLimite;
      }
      break;
    case 'RECOGIDO':
      this.fechas.fecha_recogida = ahora;
      this._calcularMetricasTiempo();
      break;
    case 'EXPIRADO':
      // No cambiar fechas existentes
      break;
  }
  
  // Registrar en historial
  this.historial_estados.push({
    estado_anterior: estadoAnterior,
    estado_nuevo: nuevoEstado,
    fecha: ahora,
    motivo: motivo || `Cambio a ${nuevoEstado}`,
    usuario: idUsuario,
    metadata
  });
  
  return this;
};

// Generar código único para recogida
recogidaTiendaSchema.methods.generarCodigoRecogida = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  this.codigo_recogida = `REC-${timestamp}-${random}`;
  
  // Preparar información del QR
  this.qr_code.codigo = this.codigo_recogida;
  
  return this.codigo_recogida;
};

// Verificar disponibilidad de items en la tienda
recogidaTiendaSchema.methods.verificarDisponibilidad = async function() {
  const Inventario = mongoose.model('Inventario');
  
  let todoDisponible = true;
  const itemsActualizados = [];
  const itemsFaltantes = [];
  
  for (const item of this.items) {
    const inventario = await Inventario.findOne({
      id_libro: item.id_libro,
      id_tienda: this.id_tienda,
      estado: 'disponible'
    });
    
    const stockDisponible = inventario ? inventario.stock_disponible : 0;
    
    if (stockDisponible >= item.cantidad) {
      item.estado_item = 'disponible';
      item.id_tienda_origen = this.id_tienda;
    } else {
      item.estado_item = 'faltante';
      item.notas = `Stock insuficiente. Disponible: ${stockDisponible}, Requerido: ${item.cantidad}`;
      todoDisponible = false;
      itemsFaltantes.push({
        id_libro: item.id_libro,
        titulo: item.titulo,
        cantidad_faltante: item.cantidad - stockDisponible,
        cantidad_disponible: stockDisponible
      });
    }
    
    itemsActualizados.push(item);
  }
  
  this.items = itemsActualizados;
  this.markModified('items');
  
  return {
    disponible: todoDisponible,
    items_faltantes: itemsFaltantes
  };
};

// Solicitar transferencias para items faltantes
recogidaTiendaSchema.methods.solicitarTransferencias = async function(tiendaOrigenMap, idUsuario) {
  const transferenciasCreadas = [];
  
  for (const item of this.items) {
    if (item.estado_item === 'faltante') {
      const tiendaOrigen = tiendaOrigenMap[item.id_libro.toString()];
      
      if (tiendaOrigen) {
        const transferencia = {
          id_libro: item.id_libro,
          cantidad: item.cantidad,
          tienda_origen: tiendaOrigen,
          tienda_destino: this.id_tienda,
          estado_transferencia: 'solicitada',
          fecha_solicitud: new Date()
        };
        
        this.transferencias.push(transferencia);
        transferenciasCreadas.push(transferencia);
        
        // Actualizar estado del item
        item.estado_item = 'transferido';
        item.id_tienda_origen = tiendaOrigen;
        item.notas = `Transferencia solicitada desde tienda ${tiendaOrigen}`;
      }
    }
  }
  
  this.markModified('items');
  this.markModified('transferencias');
  
  return transferenciasCreadas;
};

// Marcar items como preparados
recogidaTiendaSchema.methods.marcarItemsPreparados = function(idsItems, idEmpleado, nombreEmpleado) {
  const ahora = new Date();
  
  for (const item of this.items) {
    if (idsItems.includes(item._id.toString()) || idsItems.includes(item.id_libro.toString())) {
      item.estado_item = 'disponible';
    }
  }
  
  // Calcular tiempo de preparación
  let tiempoPreparacion = 0;
  if (this.fechas.preparacion_iniciada) {
    const diffTime = ahora - this.fechas.preparacion_iniciada;
    tiempoPreparacion = Math.ceil(diffTime / (1000 * 60)); // minutos
  }
  
  this.empleado_preparacion = {
    id_usuario: idEmpleado,
    nombre: nombreEmpleado,
    fecha: ahora,
    tiempo_preparacion_minutos: tiempoPreparacion
  };
  
  this.markModified('items');
  this.markModified('empleado_preparacion');
  
  return this;
};

// Completar recogida
recogidaTiendaSchema.methods.completarRecogida = function(datosEntrega) {
  const { idEmpleado, nombreEmpleado, documentoPresentado, observaciones } = datosEntrega;
  
  // Marcar todos los items disponibles como recogidos
  for (const item of this.items) {
    if (item.estado_item === 'disponible') {
      item.estado_item = 'recogido';
    }
  }
  
  this.empleado_entrega = {
    id_usuario: idEmpleado,
    nombre: nombreEmpleado,
    fecha: new Date(),
    documento_presentado: documentoPresentado
  };
  
  if (observaciones) {
    this.observaciones_cliente = observaciones;
  }
  
  this.markModified('items');
  this.markModified('empleado_entrega');
  
  return this.cambiarEstado('RECOGIDO', 'Recogida completada por el cliente', idEmpleado);
};

// Calcular métricas de tiempo
recogidaTiendaSchema.methods._calcularMetricasTiempo = function() {
  const fechas = this.fechas;
  
  if (fechas.verificacion_completada && fechas.creacion) {
    const diffTime = fechas.verificacion_completada - fechas.creacion;
    this.metricas_tiempo.tiempo_verificacion_minutos = Math.ceil(diffTime / (1000 * 60));
  }
  
  if (fechas.listo_para_recoger && fechas.preparacion_iniciada) {
    const diffTime = fechas.listo_para_recoger - fechas.preparacion_iniciada;
    this.metricas_tiempo.tiempo_preparacion_minutos = Math.ceil(diffTime / (1000 * 60));
  }
  
  if (fechas.fecha_recogida && fechas.listo_para_recoger) {
    const diffTime = fechas.fecha_recogida - fechas.listo_para_recoger;
    this.metricas_tiempo.tiempo_espera_recogida_horas = Math.ceil(diffTime / (1000 * 60 * 60));
  }
  
  if (fechas.fecha_recogida && fechas.creacion) {
    const diffTime = fechas.fecha_recogida - fechas.creacion;
    this.metricas_tiempo.tiempo_total_proceso_horas = Math.ceil(diffTime / (1000 * 60 * 60));
  }
  
  this.markModified('metricas_tiempo');
};

// Verificar si está próximo a vencer
recogidaTiendaSchema.methods.estaProximoAVencer = function(horasAntes = 24) {
  if (!this.fechas.fecha_limite) return false;
  
  const ahora = new Date();
  const diffTime = this.fechas.fecha_limite - ahora;
  const horasRestantes = Math.ceil(diffTime / (1000 * 60 * 60));
  
  return horasRestantes <= horasAntes && horasRestantes > 0;
};

// Verificar si ya venció
recogidaTiendaSchema.methods.haVencido = function() {
  if (!this.fechas.fecha_limite) return false;
  return new Date() > this.fechas.fecha_limite;
};

// Agregar nota interna
recogidaTiendaSchema.methods.agregarNotaInterna = function(nota, idUsuario, categoria = 'otra') {
  this.notas_internas.push({
    nota,
    usuario: idUsuario,
    categoria,
    fecha: new Date()
  });
  return this;
};

// Registrar notificación
recogidaTiendaSchema.methods.registrarNotificacion = function(tipo, canal, enviado = true, mensaje = '', error = null) {
  this.notificaciones.push({
    tipo,
    canal,
    enviado,
    mensaje,
    error,
    fecha_envio: new Date()
  });
  this.markModified('notificaciones');
  return this;
};

// Agregar valoración
recogidaTiendaSchema.methods.agregarValoracion = function(datosValoracion) {
  this.valoracion = {
    ...datosValoracion,
    fecha_valoracion: new Date()
  };
  this.markModified('valoracion');
  return this;
};

// MÉTODOS ESTÁTICOS

// Crear recogida desde una venta
recogidaTiendaSchema.statics.crearDesdeVenta = async function(venta, idTienda) {
  if (venta.envio.tipo !== 'recogida_tienda') {
    throw new Error('La venta no es para recogida en tienda');
  }
  const recogidaExistente = await this.findOne({ id_venta: venta._id });
  if (recogidaExistente) {
    return recogidaExistente;
  }
  
  // Crear items de recogida
  const items = venta.items.map(item => ({
    id_item_venta: item._id,
    id_libro: item.id_libro,
    titulo: item.snapshot.titulo,
    autor: item.snapshot.autor,
    isbn: item.snapshot.isbn,
    cantidad: item.cantidad,
    precio_unitario: item.precios.precio_unitario_final,
    subtotal: item.precios.subtotal,
    estado_item: 'pendiente'
  }));
  
  const nuevaRecogida = new this({
    id_venta: venta._id,
    id_cliente: venta.id_cliente,
    id_tienda: venta.envio.id_tienda_recogida || idTienda,
    items: items,
    instrucciones_especiales: venta.envio.notas_envio
  });
  // Registrar estado inicial
  nuevaRecogida.historial_estados.push({
    estado_nuevo: 'VERIFICANDO_DISPONIBILIDAD',
    fecha: new Date(),
    motivo: 'Recogida creada desde venta'
  });
  
  return nuevaRecogida.save();
};

// Buscar por código de recogida
recogidaTiendaSchema.statics.buscarPorCodigo = function(codigoRecogida) {
  return this.findOne({ codigo_recogida: codigoRecogida })
    .populate('id_cliente', 'nombres apellidos telefono email')
    .populate('id_tienda', 'nombre direccion telefono horarios')
    .populate('id_venta', 'numero_venta totales');
};

// Obtener recogidas próximas a vencer
recogidaTiendaSchema.statics.obtenerProximasAVencer = function(horasAntes = 24) {
  const fechaLimite = new Date();
  fechaLimite.setHours(fechaLimite.getHours() + horasAntes);
  
  return this.find({
    estado: 'LISTO_PARA_RECOGER',
    'fechas.fecha_limite': { $lte: fechaLimite, $gt: new Date() }
  })
  .populate('id_cliente', 'nombres apellidos email telefono')
  .populate('id_tienda', 'nombre telefono_principal');
};

// Obtener recogidas vencidas
recogidaTiendaSchema.statics.obtenerVencidas = function() {
  return this.find({
    estado: 'LISTO_PARA_RECOGER',
    'fechas.fecha_limite': { $lt: new Date() }
  })
  .populate('id_cliente', 'nombres apellidos email')
  .populate('id_tienda', 'nombre');
};

// Marcar recogidas vencidas automáticamente
recogidaTiendaSchema.statics.marcarVencidas = async function() {
  const recogidas = await this.find({
    estado: 'LISTO_PARA_RECOGER',
    'fechas.fecha_limite': { $lt: new Date() }
  });
  
  const actualizadas = [];
  
  for (const recogida of recogidas) {
    recogida.cambiarEstado('EXPIRADO', 'Tiempo límite para recogida expirado', null);
    await recogida.save();
    actualizadas.push(recogida);
  }
  
  return actualizadas;
};

// Obtener estadísticas
recogidaTiendaSchema.statics.obtenerEstadisticas = async function(idTienda = null, fechaInicio = null, fechaFin = null) {
  const match = {};
  
  if (idTienda) match.id_tienda = new mongoose.Types.ObjectId(idTienda);
  if (fechaInicio) match.fecha_creacion = { $gte: fechaInicio };
  if (fechaFin) {
    match.fecha_creacion = match.fecha_creacion || {};
    match.fecha_creacion.$lte = fechaFin;
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$estado',
        cantidad: { $sum: 1 },
        tiempo_promedio_preparacion: { $avg: '$metricas_tiempo.tiempo_preparacion_minutos' },
        tiempo_promedio_espera: { $avg: '$metricas_tiempo.tiempo_espera_recogida_horas' },
        valoracion_promedio: { $avg: '$valoracion.puntuacion' }
      }
    }
  ]);
  
  const total = await this.countDocuments(match);
  
  return {
    total_recogidas: total,
    por_estado: stats,
    fecha_consulta: new Date()
  };
};

const RecogidaTienda = mongoose.model('RecogidaTienda', recogidaTiendaSchema);

module.exports = RecogidaTienda;