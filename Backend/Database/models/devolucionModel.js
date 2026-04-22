const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const QRCode = require('qrcode');
const addressSchema = require('./schemas/addressSchema');
const crypto = require('crypto');

// Esquema para los items a devolver
const devolucionItemSchema = new Schema({
  id_item_venta: {
    type: Schema.Types.ObjectId,
    required: true
  },
  
  id_libro: {
    type: Schema.Types.ObjectId,
    ref: 'Libro',
    required: true
  },
  
  // Información snapshot del libro
  info_libro: {
    titulo: String,
    autor: String,
    isbn: String,
    precio_pagado: Number
  },
  
  cantidad_comprada: {
    type: Number,
    required: true
  },
  
  cantidad_a_devolver: {
    type: Number,
    required: true,
    min: 1
  },
  
  motivo: {
    type: String,
    enum: [
      'producto_dañado',
      'producto_incorrecto',
      'no_coincide_descripcion',
      'no_satisfecho',
      'error_compra',
      'producto_no_llego',
      'otro'
    ],
    required: true
  },
  
  descripcion_problema: {
    type: String,
    required: true
  },
  
  // Estado individual del item
  estado_item: {
    type: String,
    enum: ['solicitado', 'aprobado', 'rechazado', 'recibido', 'inspeccionado', 'reembolsado'],
    default: 'solicitado'
  },
  
  // Resultado de la inspección
  inspeccion: {
    fecha: Date,
    resultado: {
      type: String,
      enum: ['aprobado', 'rechazado', 'aprobado_parcial']
    },
    notas: String,
    porcentaje_reembolso: {
      type: Number,
      min: 0,
      max: 100
    },
    inspector: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    }
  },
  
  monto_reembolso: {
    type: Number,
    default: 0
  }
});

const devolucionSchema = new Schema({
  // Código único de devolución
  codigo_devolucion: {
    type: String,
    unique: true,
    index: true,
    default: function() {
      const fecha = new Date();
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      const random = Math.random().toString(36).substr(2, 6).toUpperCase();
      return `DEV-${año}${mes}${dia}-${random}`;
    }
  },
  id_devolucion: {
    type: String,
    default: function() {
      return crypto.randomUUID();
    },
    unique: true,
    index: true
  },
  
  // Referencia a la venta original
  id_venta: {
    type: Schema.Types.ObjectId,
    ref: 'Venta',
    required: true,
    index: true
  },
  
  numero_venta: {
    type: String,
    required: true
  },
  
  // Cliente
  id_cliente: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  // Items a devolver
  items: [devolucionItemSchema],
  
  // Totales
  totales: {
    monto_total_compra: {
      type: Number,
      required: true
    },
    monto_items_devolucion: {
      type: Number,
      required: true
    },
    monto_aprobado_reembolso: {
      type: Number,
      default: 0
    },
    monto_reembolsado: {
      type: Number,
      default: 0
    }
  },
  
  // Estado general de la devolución
  estado: {
    type: String,
    enum: [
      'solicitada',
      'aprobada',
      'rechazada',
      'esperando_envio',
      'en_transito',
      'recibida',
      'en_inspeccion',
      'reembolso_aprobado',
      'reembolso_procesando',
      'reembolso_completado',
      'cerrada',
      'cancelada'
    ],
    default: 'solicitada',
    index: true
  },
  
  // Información de envío de devolución
  envio_devolucion: {
    metodo: {
      type: String,
      enum: ['correo', 'entrega_tienda', 'recoleccion_domicilio']
    },
    direccion_recoleccion: addressSchema,
    fecha_recoleccion_programada: Date,
    guia_envio: String,
    empresa_envio: String,
    fecha_envio: Date,
    fecha_recepcion: Date,
    costo_envio_cliente: {
      type: Number,
      default: 0
    },
    notas_envio: String
  },
  
  // QR Code
  qr_code: {
    codigo: {
      type: String,
      unique: true,
      required: true
    },
    url_rastreo: {
      type: String,
      required: true
    },
    imagen_base64: String,
    fecha_generacion: {
      type: Date,
      default: Date.now
    }
  },
  
  // Proceso de reembolso
  reembolso: {
    metodo: {
      type: String,
      enum: ['tarjeta_original', 'credito_tienda', 'transferencia']
    },
    id_tarjeta_original: String,
    fecha_aprobacion: Date,
    fecha_procesamiento: Date,
    fecha_completado: Date,
    referencia_reembolso: String,
    notas: String
  },
  
  // Comunicación con el cliente
  comunicaciones: [{
    tipo: {
      type: String,
      enum: ['email', 'sms', 'llamada', 'nota_interna']
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    asunto: String,
    mensaje: String,
    enviado_por: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    }
  }],
  
  // Documentos adjuntos (fotos del producto dañado, etc.)
  documentos: [{
    tipo: {
      type: String,
      enum: ['foto_producto', 'video', 'comprobante', 'otro']
    },
    url: String,
    nombre_archivo: String,
    fecha_subida: {
      type: Date,
      default: Date.now
    },
    subido_por: {
      type: String,
      enum: ['cliente', 'administrador']
    }
  }],
  
  // Historial de eventos
  historial: [{
    evento: {
      type: String,
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    descripcion: String,
    usuario_responsable: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    metadata: Schema.Types.Mixed
  }],
  
  // Fechas importantes
  fecha_solicitud: {
    type: Date,
    default: Date.now
  },
  
  fecha_limite_envio: {
    type: Date,
    default: function() {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 15); // 15 días para enviar el producto
      return fecha;
    }
  },
  
  fecha_resolucion: Date,
  
  // Timestamps
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  fecha_actualizacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'fecha_creacion',
    updatedAt: 'fecha_actualizacion'
  }
});

// ÍNDICES
devolucionSchema.index({ id_cliente: 1, fecha_solicitud: -1 });
devolucionSchema.index({ estado: 1, fecha_solicitud: -1 });

// MIDDLEWARE

// Generar QR antes de guardar
// devolucionSchema.pre('save', async function(next) {
//   if (this.isNew) {
//     try {
//       console.log("Generando código QR para la devolución:", this.codigo_devolucion);
//       // Generar URL de rastreo
//       const baseUrl = process.env.FRONT_URL || 'https://librosfera-awmi.onrender.com';
//       this.qr_code.url_rastreo = `${baseUrl}/devolucion/rastreo/${this.codigo_devolucion}`;
      
//       // Generar código QR único
//       this.qr_code.codigo = `QR-${this.codigo_devolucion}`;
      
//       // Generar imagen QR en base64
//       const qrOptions = {
//         type: 'png',
//         width: 300,
//         margin: 2,
//         color: {
//           dark: '#000000',
//           light: '#FFFFFF'
//         }
//       };
      
//       this.qr_code.imagen_base64 = await QRCode.toDataURL(this.qr_code.url_rastreo, qrOptions);
      
//     } catch (error) {
//       console.error('Error generando QR:', error);
//       return next(error);
//     }
//   }
  
//   next();
// });

// MÉTODOS DE INSTANCIA

// Registrar evento en el historial (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.registrarEvento = function(evento, descripcion, usuarioId = null, metadata = {}) {
  this.historial.push({
    evento,
    descripcion,
    usuario_responsable: usuarioId,
    metadata
  });
  
  return this; // Retornamos el objeto sin guardarlo
};

// Cambiar estado (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.cambiarEstado = function(nuevoEstado, usuarioId, descripcion = '') {
  const estadoAnterior = this.estado;
  this.estado = nuevoEstado;
  
  this.registrarEvento(
    'cambio_estado',
    descripcion || `Estado cambiado de ${estadoAnterior} a ${nuevoEstado}`,
    usuarioId,
    { estado_anterior: estadoAnterior, estado_nuevo: nuevoEstado }
  );
  
  return this;
};

// Aprobar devolución (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.aprobar = function(usuarioId, notas = '') {
  if (this.estado !== 'solicitada') {
    throw new Error('Solo se pueden aprobar devoluciones en estado solicitada');
  }
  
  // Aprobar todos los items
  this.items.forEach(item => {
    item.estado_item = 'aprobado';
  });
  
  this.cambiarEstado('aprobada', usuarioId, `Devolución aprobada. ${notas}`);
  this.cambiarEstado('esperando_envio', usuarioId, 'Esperando que el cliente envíe los productos');
  
  return this;
};

// Rechazar devolución (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.rechazar = function(usuarioId, motivo) {
  if (this.estado !== 'solicitada') {
    throw new Error('Solo se pueden rechazar devoluciones en estado solicitada');
  }
  
  // Rechazar todos los items
  this.items.forEach(item => {
    item.estado_item = 'rechazado';
  });
  
  this.cambiarEstado('rechazada', usuarioId, `Devolución rechazada: ${motivo}`);
  
  return this;
};

// Marcar como recibida (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.marcarComoRecibida = function(usuarioId, datosRecepcion = {}) {
  if (!['esperando_envio', 'en_transito'].includes(this.estado)) {
    throw new Error('Estado inválido para marcar como recibida');
  }
  
  this.envio_devolucion.fecha_recepcion = datosRecepcion.fecha || new Date();
  if (datosRecepcion.notas) {
    this.envio_devolucion.notas_envio = datosRecepcion.notas;
  }
  
  // Actualizar items
  this.items.forEach(item => {
    if (item.estado_item === 'aprobado') {
      item.estado_item = 'recibido';
    }
  });
  
  this.cambiarEstado('recibida', usuarioId, 'Productos recibidos en almacén');
  this.cambiarEstado('en_inspeccion', usuarioId, 'Iniciando proceso de inspección');
  
  return this;
};

// Completar inspección de un item (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.inspeccionarItem = function(idItem, resultado, usuarioId, notas = '', porcentajeReembolso = 100) {
  const item = this.items.id(idItem);
  if (!item) {
    throw new Error('Item no encontrado');
  }
  
  if (item.estado_item !== 'recibido') {
    throw new Error('El item debe estar en estado recibido para ser inspeccionado');
  }
  
  item.inspeccion = {
    fecha: new Date(),
    resultado,
    notas,
    porcentaje_reembolso: porcentajeReembolso,
    inspector: usuarioId
  };
  
  item.estado_item = 'inspeccionado';
  
  // Calcular monto de reembolso para este item
  if (resultado === 'aprobado') {
    item.monto_reembolso = item.info_libro.precio_pagado * (porcentajeReembolso / 100);
  } else if (resultado === 'aprobado_parcial') {
    item.monto_reembolso = item.info_libro.precio_pagado * (porcentajeReembolso / 100);
  } else {
    item.monto_reembolso = 0;
  }
  
  // Verificar si todos los items han sido inspeccionados
  const todosInspeccionados = this.items.every(i => i.estado_item === 'inspeccionado');
  
  if (todosInspeccionados) {
    // Calcular total de reembolso
    this.totales.monto_aprobado_reembolso = this.items.reduce((total, i) => total + i.monto_reembolso, 0);
    
    this.cambiarEstado('reembolso_aprobado', usuarioId, 'Inspección completada, reembolso aprobado');
  }
  
  return this;
};

// Procesar reembolso (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.procesarReembolso = function(datosReembolso, usuarioId) {
  if (this.estado !== 'reembolso_aprobado') {
    throw new Error('El reembolso debe estar aprobado para procesarlo');
  }
  
  this.reembolso = {
    metodo: datosReembolso.metodo,
    id_tarjeta_original: datosReembolso.id_tarjeta_original,
    fecha_procesamiento: new Date(),
    referencia_reembolso: datosReembolso.referencia,
    notas: datosReembolso.notas
  };
  
  this.cambiarEstado('reembolso_procesando', usuarioId, 'Procesando reembolso');
  
  return this;
};

// Completar reembolso (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.completarReembolso = function(usuarioId, referencia = null) {
  if (this.estado !== 'reembolso_procesando') {
    throw new Error('El reembolso debe estar en procesamiento para completarlo');
  }
  
  this.reembolso.fecha_completado = new Date();
  if (referencia) {
    this.reembolso.referencia_reembolso = referencia;
  }
  
  this.totales.monto_reembolsado = this.totales.monto_aprobado_reembolso;
  this.fecha_resolucion = new Date();
  
  // Actualizar items
  this.items.forEach(item => {
    if (item.monto_reembolso > 0) {
      item.estado_item = 'reembolsado';
    }
  });
  
  this.cambiarEstado('reembolso_completado', usuarioId, 'Reembolso completado exitosamente');
  this.cambiarEstado('cerrada', usuarioId, 'Devolución cerrada');
  
  return this;
};

// Cancelar devolución (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.cancelar = function(usuarioId, motivo) {
  const estadosNoCancelables = ['reembolso_procesando', 'reembolso_completado', 'cerrada', 'cancelada'];
  
  if (estadosNoCancelables.includes(this.estado)) {
    throw new Error('No se puede cancelar la devolución en este estado');
  }
  
  this.cambiarEstado('cancelada', usuarioId, `Devolución cancelada: ${motivo}`);
  
  return this;
};

// Agregar comunicación (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.agregarComunicacion = function(tipo, asunto, mensaje, usuarioId) {
  this.comunicaciones.push({
    tipo,
    asunto,
    mensaje,
    enviado_por: usuarioId
  });
  
  return this;
};

// Agregar documento (CORREGIDO: no guarda automáticamente)
devolucionSchema.methods.agregarDocumento = function(datosDocumento) {
  this.documentos.push(datosDocumento);
  return this;
};

// MÉTODOS ESTÁTICOS

// Crear devolución desde una venta
devolucionSchema.statics.crearDesdeVenta = async function(venta, itemsDevolucion, idCliente) {
  // Validar que la venta puede tener devolución
  const validacion = venta.puedeSolicitarDevolucion();
  if (!validacion.puede) {
    throw new Error(validacion.razon);
  }
  
  // Preparar items de devolución
  const itemsPreparados = itemsDevolucion.map(itemDev => {
    const itemVenta = venta.items.find(i => i._id.toString() === itemDev.id_item_venta);
    
    if (!itemVenta) {
      throw new Error(`Item de venta no encontrado: ${itemDev.id_item_venta}`);
    }
    
    if (itemDev.cantidad > itemVenta.cantidad - itemVenta.cantidad_devuelta) {
      throw new Error(`Cantidad a devolver excede la cantidad disponible para el item ${itemVenta.snapshot.titulo}`);
    }
    
    return {
      id_item_venta: itemVenta._id,
      id_libro: itemVenta.id_libro,
      info_libro: {
        titulo: itemVenta.snapshot.titulo,
        autor: itemVenta.snapshot.autor,
        isbn: itemVenta.snapshot.isbn,
        precio_pagado: itemVenta.precios.precio_unitario_final
      },
      cantidad_comprada: itemVenta.cantidad,
      cantidad_a_devolver: itemDev.cantidad,
      motivo: itemDev.motivo,
      descripcion_problema: itemDev.descripcion
    };
  });
  
  // Calcular totales
  const montoItemsDevolucion = itemsPreparados.reduce((total, item) => {
    return total + (item.info_libro.precio_pagado * item.cantidad_a_devolver);
  }, 0);
  
  // Crear devolución
  const devolucion = new this({
    id_venta: venta._id,
    numero_venta: venta.numero_venta,
    id_cliente: idCliente,
    items: itemsPreparados,
    totales: {
      monto_total_compra: venta.totales.total_final,
      monto_items_devolucion: montoItemsDevolucion
    }
  });
  
  // Registrar evento inicial (sin guardar)
  devolucion.registrarEvento(
    'solicitud_creada',
    'Solicitud de devolución creada por el cliente',
    idCliente
  );
  
  return devolucion;
};

// Obtener devoluciones de un cliente
devolucionSchema.statics.obtenerDevolucionesCliente = function(idCliente, opciones = {}) {
  const {
    page = 1,
    limit = 10,
    estado = null
  } = opciones;
  
  const query = { id_cliente: idCliente };
  if (estado) {
    query.estado = estado;
  }
  
  return this.find(query)
    .populate('id_venta', 'numero_venta fecha_creacion')
    .sort('-fecha_solicitud')
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Buscar por código QR
devolucionSchema.statics.buscarPorCodigoQR = function(codigoQR) {
  return this.findOne({ 'qr_code.codigo': codigoQR })
    .populate('id_cliente', 'nombres apellidos email')
    .populate('id_venta', 'numero_venta');
};

// Buscar por código de devolución
devolucionSchema.statics.buscarPorCodigo = function(codigoDevolucion) {
  return this.findOne({ codigo_devolucion: codigoDevolucion })
    .populate('id_cliente', 'nombres apellidos email')
    .populate('id_venta', 'numero_venta');
};

const Devolucion = mongoose.model('Devolucion', devolucionSchema);

module.exports = Devolucion;