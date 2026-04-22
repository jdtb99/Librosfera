// Database/models/ventaModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const addressSchema = require('./schemas/addressSchema');

// Esquema para los items de la venta
const ventaItemSchema = new Schema({
  id_libro: {
    type: Schema.Types.ObjectId,
    ref: 'Libro',
    required: true
  },
  
  // Información snapshot del producto al momento de la compra
  snapshot: {
    titulo: {
      type: String,
      required: true
    },
    autor: String,
    isbn: String,
    editorial: String,
    imagen_portada: String
  },
  
  cantidad: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Precios al momento de la compra
  precios: {
    precio_unitario_base: {
      type: Number,
      required: true
    },
    descuento_aplicado: {
      type: Number,
      default: 0
    },
    precio_unitario_final: {
      type: Number,
      required: true
    },
    impuesto: {
      tipo: String,
      porcentaje: Number,
      valor: Number
    },
    subtotal: {
      type: Number,
      required: true
    }
  },
  
  // Estado individual del item
  estado_item: {
    type: String,
    enum: ['procesando', 'preparando', 'enviado', 'entregado', 'devuelto', 'devolucion_parcial'],
    default: 'procesando'
  },
  
  // Para devoluciones - MEJORADO
  devolucion_info: {
    cantidad_devuelta: {
      type: Number,
      default: 0,
      min: 0
    },
    cantidad_disponible_devolucion: {
      type: Number,
      default: function() { return this.cantidad; }
    },
    monto_devuelto: {
      type: Number,
      default: 0
    },
    ultima_devolucion: Date,
    tiene_devolucion_activa: {
      type: Boolean,
      default: false
    }
  }
});

const ventaSchema = new Schema({
  // Número de venta único y legible
  numero_venta: {
    type: String,
    default: function() {
      const fecha = new Date();
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `VTA-${año}${mes}-${random}`;
    },
  },
  
  // Cliente
  id_cliente: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  // Referencia al carrito original
  id_carrito_origen: {
    type: Schema.Types.ObjectId,
    ref: 'Carrito'
  },
  
  // Items de la venta
  items: [ventaItemSchema],
  
  // NUEVO: Sistema de devoluciones integrado
  sistema_devolucion: {
    tiene_devoluciones: {
      type: Boolean,
      default: false,
    },
    estado_devolucion: {
      type: String,
      enum: [
        'sin_devolucion',
        'devolucion_solicitada', 
        'devolucion_en_proceso',
        'devolucion_aprobada',
        'devolucion_rechazada',
        'devolucion_completada',
        'devolucion_parcial'
      ],
      default: 'sin_devolucion',
    },
    cantidad_devoluciones: {
      type: Number,
      default: 0
    },
    monto_total_devuelto: {
      type: Number,
      default: 0
    },
    ultima_solicitud_devolucion: Date,
    permite_devolucion: {
      type: Boolean,
      default: function() {
        return this.estado === 'entregado';
      }
    }
  },
  
  // Totales y costos
  totales: {
    subtotal_sin_descuentos: {
      type: Number,
      required: true
    },
    total_descuentos: {
      type: Number,
      default: 0
    },
    subtotal_con_descuentos: {
      type: Number,
      required: true
    },
    total_impuestos: {
      type: Number,
      default: 0
    },
    costo_envio: {
      type: Number,
      default: 0
    },
    total_final: {
      type: Number,
      required: true
    }
  },
  
  // Información de pago
  pago: {
    metodo: {
      type: String,
      enum: ['tarjeta_debito', 'tarjeta_credito'],
      required: true
    },
    id_tarjeta: {
      type: String,
      required: true
    },
    ultimos_digitos: String,
    marca_tarjeta: String,
    fecha_pago: {
      type: Date,
      default: Date.now
    },
    referencia_pago: {
      type: String,
      default: function() {
        return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
    },
    estado_pago: {
      type: String,
      enum: ['pendiente', 'procesando', 'aprobado', 'rechazado', 'reembolsado', 'reembolso_parcial'],
      default: 'pendiente'
    }
  },
  
  // Información de envío
  envio: {
    tipo: {
      type: String,
      enum: ['domicilio', 'recogida_tienda'],
      required: true
    },
    direccion: addressSchema,
    id_tienda_recogida: {
      type: Schema.Types.ObjectId,
      ref: 'Tienda_Fisica'
    },
    costo: {
      type: Number,
      default: 0
    },
    empresa_envio: String,
    numero_guia: String,
    fecha_envio: Date,
    fecha_entrega_estimada: Date,
    fecha_entrega_real: Date,
    notas_envio: String
  },

  impuesto_info: {
    pagado_por_cliente: {
      type: Boolean,
      default: false,
      description: 'Indica si el cliente pagará el impuesto por separado'
    },
    monto_excluido: {
      type: Number,
      default: 0,
      description: 'Monto del impuesto excluido del total si lo paga el cliente'
    },
    monto_incluido: {
      type: Number,
      default: 0,
      description: 'Monto del impuesto incluido en el total de la venta'
    },
    nota_impuesto: {
      type: String,
      default: '',
      description: 'Nota adicional sobre el manejo del impuesto'
    }
  },
  
  // Estado general de la venta
  estado: {
    type: String,
    enum: [
      'pendiente_pago',
      'pago_aprobado',
      'preparando',
      'listo_para_envio',
      'enviado',
      'en_transito',
      'entregado',
      'cancelado',
      'reembolsado',
      'fallo_pago'
    ],
    default: 'pendiente_pago',
    index: true
  },
  
  // Información de facturación
  facturacion: {
    requiere_factura: {
      type: Boolean,
      default: false
    },
    datos_fiscales: {
      razon_social: String,
      rfc: String,
      direccion_fiscal: addressSchema,
      email_fiscal: String
    },
    numero_factura: String,
    fecha_facturacion: Date,
    url_pdf: String,
    url_xml: String
  },
  
  // Códigos de descuento aplicados
  descuentos_aplicados: [{
    codigo: String,
    tipo: String,
    valor: Number,
    descripcion: String
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
  
  // Cancelación
  cancelacion: {
    fecha: Date,
    motivo: String,
    solicitada_por: {
      type: String,
      enum: ['cliente', 'administrador', 'sistema']
    },
    usuario_responsable: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    }
  },
  
  // Notas internas
  notas_internas: [{
    fecha: {
      type: Date,
      default: Date.now
    },
    nota: String,
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    }
  }],
  
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

// ÍNDICES MEJORADOS
ventaSchema.index({ id_cliente: 1, fecha_creacion: -1 });
ventaSchema.index({ estado: 1, fecha_creacion: -1 });
ventaSchema.index({ 'pago.estado_pago': 1 });
ventaSchema.index({ 'envio.numero_guia': 1 });
ventaSchema.index({ numero_venta: 1 });
ventaSchema.index({ 'sistema_devolucion.tiene_devoluciones': 1 });
ventaSchema.index({ 'sistema_devolucion.estado_devolucion': 1 });

// MIDDLEWARE MEJORADO
ventaSchema.pre('save', function(next) {
  // Actualizar información de devoluciones automáticamente
  this._actualizarInfoDevoluciones();
  next();
});

ventaSchema.methods._actualizarInfoDevoluciones = function() {
  let totalDevuelto = 0;
  let tieneDevolucionActiva = false;
  
  for (const item of this.items) {
    if (item.devolucion_info) {
      totalDevuelto += item.devolucion_info.monto_devuelto || 0;
      if (item.devolucion_info.tiene_devolucion_activa) {
        tieneDevolucionActiva = true;
      }
    }
  }
  
  this.sistema_devolucion.monto_total_devuelto = totalDevuelto;
  
  // Actualizar estado de devolución automáticamente
  if (totalDevuelto > 0) {
    this.sistema_devolucion.tiene_devoluciones = true;
    if (totalDevuelto >= this.totales.total_final) {
      this.sistema_devolucion.estado_devolucion = 'devolucion_completada';
    } else {
      this.sistema_devolucion.estado_devolucion = 'devolucion_parcial';
    }
  }
};

// MÉTODOS DE INSTANCIA EXISTENTES Y NUEVOS

// Registrar evento en el historial (sin guardar automáticamente)
ventaSchema.methods.registrarEvento = function(evento, descripcion, usuarioId = null, metadata = {}) {
  this.historial.push({
    evento,
    descripcion,
    usuario_responsable: usuarioId,
    metadata
  });
  
  return this;
};

// Cambiar estado de la venta (sin guardar automáticamente)
ventaSchema.methods.cambiarEstado = function(nuevoEstado, usuarioId, descripcion = '') {
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

// NUEVOS MÉTODOS PARA DEVOLUCIONES

// Actualizar estado de devolución
ventaSchema.methods.actualizarEstadoDevolucion = function(nuevoEstado, usuarioId, descripcion = '') {
  const estadoAnterior = this.sistema_devolucion.estado_devolucion;
  this.sistema_devolucion.estado_devolucion = nuevoEstado;
  
  // Activar flag si no es 'sin_devolucion'
  if (nuevoEstado !== 'sin_devolucion') {
    this.sistema_devolucion.tiene_devoluciones = true;
  }
  
  this.registrarEvento(
    'cambio_estado_devolucion',
    descripcion || `Estado de devolución cambiado de ${estadoAnterior} a ${nuevoEstado}`,
    usuarioId,
    { 
      estado_devolucion_anterior: estadoAnterior, 
      estado_devolucion_nuevo: nuevoEstado 
    }
  );
  
  return this;
};

// Registrar nueva solicitud de devolución
ventaSchema.methods.registrarSolicitudDevolucion = function(codigoDevolucion, itemsAfectados, usuarioId) {
  this.sistema_devolucion.cantidad_devoluciones += 1;
  this.sistema_devolucion.ultima_solicitud_devolucion = new Date();
  
  // Marcar items afectados
  for (const itemAfectado of itemsAfectados) {
    const item = this.items.id(itemAfectado.id_item_venta);
    if (item) {
      item.devolucion_info.tiene_devolucion_activa = true;
      item.devolucion_info.cantidad_disponible_devolucion -= itemAfectado.cantidad;
    }
  }
  
  this.actualizarEstadoDevolucion('devolucion_solicitada', usuarioId, 
    `Nueva solicitud de devolución: ${codigoDevolucion}`);
  
  return this;
};

// Actualizar cuando se aprueba una devolución
ventaSchema.methods.aprobarDevolucion = function(codigoDevolucion, usuarioId) {
  this.actualizarEstadoDevolucion('devolucion_aprobada', usuarioId,
    `Devolución aprobada: ${codigoDevolucion}`);
  
  return this;
};

// Actualizar cuando se rechaza una devolución
ventaSchema.methods.rechazarDevolucion = function(codigoDevolucion, usuarioId, motivo) {
  // Liberar items que estaban marcados como en devolución
  for (const item of this.items) {
    if (item.devolucion_info.tiene_devolucion_activa) {
      // Solo liberar si no hay otras devoluciones activas para este item
      item.devolucion_info.tiene_devolucion_activa = false;
      item.devolucion_info.cantidad_disponible_devolucion = 
        item.cantidad - item.devolucion_info.cantidad_devuelta;
    }
  }
  
  this.actualizarEstadoDevolucion('devolucion_rechazada', usuarioId,
    `Devolución rechazada: ${codigoDevolucion} - ${motivo}`);
  
  return this;
};

// Completar devolución con reembolso
ventaSchema.methods.completarDevolucion = function(codigoDevolucion, itemsReembolsados, montoReembolsado, usuarioId) {
  // Actualizar items reembolsados
  for (const itemReembolsado of itemsReembolsados) {
    const item = this.items.id(itemReembolsado.id_item);
    if (item) {
      item.devolucion_info.cantidad_devuelta += itemReembolsado.cantidad_devuelta;
      item.devolucion_info.monto_devuelto += itemReembolsado.monto_reembolsado;
      item.devolucion_info.tiene_devolucion_activa = false;
      
      // Actualizar estado del item si se devolvió completamente
      if (item.devolucion_info.cantidad_devuelta >= item.cantidad) {
        item.estado_item = 'devuelto';
      } else if (item.devolucion_info.cantidad_devuelta > 0) {
        item.estado_item = 'devolucion_parcial';
      }
    }
  }
  
  // Actualizar totales de devolución
  this.sistema_devolucion.monto_total_devuelto += montoReembolsado;
  
  // Determinar nuevo estado
  const estadoDevolucion = this.sistema_devolucion.monto_total_devuelto >= this.totales.total_final
    ? 'devolucion_completada'
    : 'devolucion_parcial';
  
  this.actualizarEstadoDevolucion(estadoDevolucion, usuarioId,
    `Devolución completada: ${codigoDevolucion} - Reembolso: $${montoReembolsado.toLocaleString()}`);
  
  return this;
};

// MÉTODOS EXISTENTES ACTUALIZADOS

ventaSchema.methods.obtenerTotalAPagar = function() {
  return this.totales.total_final;
};

ventaSchema.methods.obtenerInfoImpuesto = function() {
  const info = {
    debe_pagar_impuesto_separado: this.impuesto_info.pagado_por_cliente,
    monto_impuesto: this.impuesto_info.pagado_por_cliente 
      ? this.impuesto_info.monto_excluido 
      : this.impuesto_info.monto_incluido,
    incluido_en_total: !this.impuesto_info.pagado_por_cliente,
    total_productos: this.totales.subtotal_con_descuentos,
    total_envio: this.totales.costo_envio,
    total_a_pagar: this.totales.total_final
  };
  
  if (this.impuesto_info.pagado_por_cliente) {
    info.mensaje = `El cliente debe pagar $${this.impuesto_info.monto_excluido.toLocaleString()} de impuesto por separado`;
  } else {
    info.mensaje = `El impuesto de $${this.impuesto_info.monto_incluido.toLocaleString()} está incluido en el total`;
  }
  
  return info;
};

// Aprobar pago (sin guardar automáticamente)
ventaSchema.methods.aprobarPago = function(referenciaPago = null) {
  if (this.pago.estado_pago !== 'pendiente' && this.pago.estado_pago !== 'procesando') {
    throw new Error('El pago ya fue procesado');
  }
  
  this.pago.estado_pago = 'aprobado';
  this.pago.fecha_pago = new Date();
  if (referenciaPago) {
    this.pago.referencia_pago = referenciaPago;
  }
  
  this.cambiarEstado('pago_aprobado', null, 'Pago aprobado exitosamente');
  this.cambiarEstado('preparando', null, 'Orden en preparación');
  
  return this;
};

// Rechazar pago (sin guardar automáticamente)
ventaSchema.methods.rechazarPago = function(motivo = '') {
  this.pago.estado_pago = 'rechazado';
  this.cambiarEstado('fallo_pago', null, `Pago rechazado: ${motivo}`);
  
  return this;
};

// Marcar como listo para envío (sin guardar automáticamente)
ventaSchema.methods.marcarListoParaEnvio = function(usuarioId) {
  if (this.estado !== 'preparando') {
    throw new Error('La orden debe estar en preparación para marcarla como lista para envío');
  }
  
  this.cambiarEstado('listo_para_envio', usuarioId, 'Orden lista para ser enviada');
  
  return this;
};

// Marcar como enviado (sin guardar automáticamente)
ventaSchema.methods.marcarComoEnviado = function(datosEnvio, usuarioId) {
  if (this.estado !== 'listo_para_envio' && this.estado !== 'preparando') {
    throw new Error('La orden debe estar lista para envío');
  }
  
  this.envio.fecha_envio = new Date();
  this.envio.numero_guia = datosEnvio.numero_guia;
  this.envio.empresa_envio = datosEnvio.empresa_envio;
  this.envio.fecha_entrega_estimada = datosEnvio.fecha_entrega_estimada;
  
  // Actualizar estado de todos los items
  this.items.forEach(item => {
    item.estado_item = 'enviado';
  });
  
  this.cambiarEstado('enviado', usuarioId, 'Orden enviada');
  
  return this;
};

// Marcar como entregado (sin guardar automáticamente)
ventaSchema.methods.marcarComoEntregado = function(usuarioId, fechaEntrega = null) {
  if (this.estado !== 'enviado' && this.estado !== 'en_transito') {
    throw new Error('La orden debe estar enviada para marcarla como entregada');
  }
  
  this.envio.fecha_entrega_real = fechaEntrega || new Date();
  
  // Actualizar estado de todos los items (solo si no han sido devueltos)
  this.items.forEach(item => {
    if (!['devuelto', 'devolucion_parcial'].includes(item.estado_item)) {
      item.estado_item = 'entregado';
    }
  });
  
  // Activar la posibilidad de devolución
  this.sistema_devolucion.permite_devolucion = true;
  
  this.cambiarEstado('entregado', usuarioId, 'Orden entregada exitosamente');
  
  return this;
};

// Cancelar venta (sin guardar automáticamente)
ventaSchema.methods.cancelarVenta = function(motivo, solicitadaPor, usuarioId) {
  const estadosNoCancelables = ['enviado', 'en_transito', 'entregado', 'cancelado', 'reembolsado'];
  if (estadosNoCancelables.includes(this.estado)) {
    throw new Error(`No se puede cancelar una orden en estado: ${this.estado}`);
  }
  
  this.cancelacion = {
    fecha: new Date(),
    motivo,
    solicitada_por: solicitadaPor,
    usuario_responsable: usuarioId
  };
  
  if (this.pago.estado_pago === 'aprobado') {
    this.pago.estado_pago = 'reembolsado';
  }
  
  this.cambiarEstado('cancelado', usuarioId, `Venta cancelada: ${motivo}`);
  
  return this;
};

// Agregar nota interna
ventaSchema.methods.agregarNotaInterna = function(nota, usuarioId) {
  this.notas_internas.push({
    nota,
    usuario: usuarioId
  });
  
  return this;
};

// MÉTODO MEJORADO: Validar si se puede solicitar devolución
ventaSchema.methods.puedeSolicitarDevolucion = function() {
  if (this.estado !== 'entregado') {
    return { puede: false, razon: 'La orden debe estar entregada para solicitar devolución' };
  }
  
  if (!this.envio.fecha_entrega_real) {
    return { puede: false, razon: 'No se ha registrado fecha de entrega' };
  }
  
  const diasDesdeEntrega = Math.floor((new Date() - this.envio.fecha_entrega_real) / (1000 * 60 * 60 * 24));
  if (diasDesdeEntrega > 8) {
    return { puede: false, razon: 'Han pasado más de 8 días desde la entrega' };
  }
  
  // Verificar si hay items disponibles para devolución
  const itemsDisponibles = this.items.filter(item => 
    item.devolucion_info.cantidad_disponible_devolucion > 0
  );
  
  if (itemsDisponibles.length === 0) {
    return { puede: false, razon: 'Todos los items ya han sido devueltos' };
  }
  
  return { 
    puede: true, 
    items_disponibles: itemsDisponibles.length,
    dias_restantes: 8 - diasDesdeEntrega
  };
};

// Obtener resumen de devoluciones
ventaSchema.methods.obtenerResumenDevoluciones = function() {
  return {
    tiene_devoluciones: this.sistema_devolucion.tiene_devoluciones,
    estado_devolucion: this.sistema_devolucion.estado_devolucion,
    cantidad_devoluciones: this.sistema_devolucion.cantidad_devoluciones,
    monto_total_devuelto: this.sistema_devolucion.monto_total_devuelto,
    porcentaje_devuelto: this.totales.total_final > 0 
      ? (this.sistema_devolucion.monto_total_devuelto / this.totales.total_final) * 100 
      : 0,
    puede_solicitar_devolucion: this.puedeSolicitarDevolucion()
  };
};

// MÉTODOS ESTÁTICOS EXISTENTES Y NUEVOS

// Obtener ventas de un cliente
ventaSchema.statics.obtenerVentasCliente = function(idCliente, opciones = {}) {
  const {
    page = 1,
    limit = 10,
    estado = null,
    incluir_devoluciones = true,
    ordenar = '-fecha_creacion'
  } = opciones;
  
  const query = { id_cliente: idCliente };
  if (estado) {
    query.estado = estado;
  }
  
  let consulta = this.find(query)
    .sort(ordenar)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select('-notas_internas');
  
  // Incluir información de devoluciones si se solicita
  if (incluir_devoluciones) {
    consulta = consulta.populate({
      path: 'sistema_devolucion',
      select: 'tiene_devoluciones estado_devolucion monto_total_devuelto cantidad_devoluciones'
    });
  }
  
  return consulta;
};

// Obtener ventas para administradores CON INFORMACIÓN DE DEVOLUCIONES
ventaSchema.statics.obtenerVentasAdmin = function(filtros = {}, opciones = {}) {
  const {
    page = 1,
    limit = 20,
    incluir_devoluciones = true,
    ordenar = '-fecha_creacion'
  } = opciones;
  
  const query = {};
  
  if (filtros.estado) query.estado = filtros.estado;
  if (filtros.cliente) query.id_cliente = filtros.cliente;
  if (filtros.numero_venta) query.numero_venta = new RegExp(filtros.numero_venta, 'i');
  if (filtros.fecha_desde) query.fecha_creacion = { $gte: new Date(filtros.fecha_desde) };
  if (filtros.fecha_hasta) {
    query.fecha_creacion = query.fecha_creacion || {};
    query.fecha_creacion.$lte = new Date(filtros.fecha_hasta);
  }
  
  // NUEVO: Filtro por estado de devolución
  if (filtros.estado_devolucion) {
    query['sistema_devolucion.estado_devolucion'] = filtros.estado_devolucion;
  }
  if (filtros.tiene_devoluciones !== undefined) {
    query['sistema_devolucion.tiene_devoluciones'] = filtros.tiene_devoluciones;
  }
  
  let consulta = this.find(query)
    .populate('id_cliente', 'nombres apellidos email')
    .sort(ordenar)
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  return consulta;
};

// NUEVO: Obtener ventas con devoluciones pendientes
ventaSchema.statics.obtenerVentasConDevolucionesPendientes = function() {
  return this.find({
    'sistema_devolucion.tiene_devoluciones': true,
    'sistema_devolucion.estado_devolucion': {
      $in: ['devolucion_solicitada', 'devolucion_en_proceso', 'devolucion_aprobada']
    }
  })
  .populate('id_cliente', 'nombres apellidos email')
  .sort('-sistema_devolucion.ultima_solicitud_devolucion');
};

// Obtener estadísticas de ventas INCLUYENDO DEVOLUCIONES
ventaSchema.statics.obtenerEstadisticas = async function(fechaInicio, fechaFin) {
  const stats = await this.aggregate([
    {
      $match: {
        fecha_creacion: {
          $gte: fechaInicio,
          $lte: fechaFin
        },
        estado: { $nin: ['cancelado', 'fallo_pago'] }
      }
    },
    {
      $group: {
        _id: null,
        total_ventas: { $sum: '$totales.total_final' },
        cantidad_ordenes: { $sum: 1 },
        ticket_promedio: { $avg: '$totales.total_final' },
        total_descuentos: { $sum: '$totales.total_descuentos' },
        total_envios: { $sum: '$totales.costo_envio' },
        // NUEVAS MÉTRICAS DE DEVOLUCIONES
        ordenes_con_devolucion: { 
          $sum: { $cond: ['$sistema_devolucion.tiene_devoluciones', 1, 0] } 
        },
        total_monto_devuelto: { $sum: '$sistema_devolucion.monto_total_devuelto' },
        cantidad_devoluciones: { $sum: '$sistema_devolucion.cantidad_devoluciones' }
      }
    }
  ]);
  
  const ventasPorEstado = await this.aggregate([
    {
      $match: {
        fecha_creacion: {
          $gte: fechaInicio,
          $lte: fechaFin
        }
      }
    },
    {
      $group: {
        _id: '$estado',
        cantidad: { $sum: 1 },
        total: { $sum: '$totales.total_final' }
      }
    }
  ]);
  
  // NUEVAS ESTADÍSTICAS DE DEVOLUCIONES
  const devolucionesPorEstado = await this.aggregate([
    {
      $match: {
        fecha_creacion: {
          $gte: fechaInicio,
          $lte: fechaFin
        },
        'sistema_devolucion.tiene_devoluciones': true
      }
    },
    {
      $group: {
        _id: '$sistema_devolucion.estado_devolucion',
        cantidad: { $sum: 1 },
        monto_total: { $sum: '$sistema_devolucion.monto_total_devuelto' }
      }
    }
  ]);
  
  return {
    resumen: stats[0] || {
      total_ventas: 0,
      cantidad_ordenes: 0,
      ticket_promedio: 0,
      total_descuentos: 0,
      total_envios: 0,
      ordenes_con_devolucion: 0,
      total_monto_devuelto: 0,
      cantidad_devoluciones: 0
    },
    por_estado: ventasPorEstado,
    devoluciones_por_estado: devolucionesPorEstado
  };
};

const Venta = mongoose.model('Venta', ventaSchema);

module.exports = Venta;