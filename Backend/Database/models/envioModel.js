const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const addressSchema = require('./schemas/addressSchema');

const envioSchema = new Schema({
  // Identificador único
  id_envio: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true,
    index: true
  },
  
  // Transacción asociada
  id_transaccion: {
    type: Schema.Types.ObjectId,
    ref: 'Transaccion',
    required: true,
    index: true
  },
  
  // Dirección de entrega
  direccion_envio: {
    type: addressSchema,
    required: true
  },
  
  // Estado del envío
  estado_envio: {
    type: String,
    enum: ['EN PREPARACION', 'ENVIADO', 'ENTREGADO'],
    default: 'EN PREPARACION',
    index: true
  },
  
  // Información de seguimiento
  codigo_seguimiento: String,
  empresa_transporte: String,
  url_seguimiento: String,
  
  // Tienda(s) de origen de los libros
  origenes: [{
    id_libro: {
      type: Schema.Types.ObjectId,
      ref: 'Libro'
    },
    titulo: String,
    cantidad: Number,
    id_tienda_origen: {
      type: Schema.Types.ObjectId,
      ref: 'Tienda_Fisica'
    }
  }],
  
  // Fechas importantes
  fechas: {
    creacion: {
      type: Date,
      default: Date.now
    },
    preparacion_completada: Date,
    salida: Date,
    entrega_estimada: Date,
    entrega_real: Date
  },
  
  // Historial de estados
  historial_estados: [{
    estado_anterior: String,
    estado_nuevo: String,
    fecha: {
      type: Date,
      default: Date.now
    },
    descripcion: String,
    id_usuario_operacion: Schema.Types.ObjectId
  }],
  
  // Información adicional
  costo_envio: {
    type: Number,
    default: 0,
    min: 0
  },
  instrucciones_especiales: String
});

// MÉTODOS DE INSTANCIA

// Actualizar estado
envioSchema.methods.actualizarEstado = function(nuevoEstado, idUsuario, notas = '') {
  const estadoAnterior = this.estado_envio;
  this.estado_envio = nuevoEstado;
  
  // Actualizar fechas según estado
  if (nuevoEstado === 'ENVIADO') {
    this.fechas.salida = new Date();
  } else if (nuevoEstado === 'ENTREGADO') {
    this.fechas.entrega_real = new Date();
  }
  
  // Registrar en historial
  this.historial_estados.push({
    estado_anterior: estadoAnterior,
    estado_nuevo: nuevoEstado,
    fecha: new Date(),
    descripcion: notas || `Cambio de estado a ${nuevoEstado}`,
    id_usuario_operacion: idUsuario
  });
  
  return this.save();
};

// Agregar información de seguimiento
envioSchema.methods.agregarSeguimiento = function(codigo, empresa, idUsuario) {
  this.codigo_seguimiento = codigo;
  this.empresa_transporte = empresa;
  this.url_seguimiento = this._generarUrlSeguimiento(codigo, empresa);
  
  // Si se agrega seguimiento, probablemente se está enviando
  if (this.estado_envio === 'EN PREPARACION') {
    return this.actualizarEstado('ENVIADO', idUsuario, 'Envío despachado con información de seguimiento');
  }
  
  return this.save();
};

// Método auxiliar para generar URL de seguimiento
envioSchema.methods._generarUrlSeguimiento = function(codigo, empresa) {
  const urlBase = {
    'servientrega': 'https://www.servientrega.com/tracking?guia=',
    'coordinadora': 'https://www.coordinadora.com/portafolio-de-servicios/servicios-en-linea/rastrear-guias/?guia=',
    'deprisa': 'https://www.deprisa.com/Tracking/index.html?trackings=',
    'inter_rapidisimo': 'https://www.interrapidisimo.com/sigue-tu-envio/?guia=',
    'default': 'https://www.libreria.com/seguimiento?codigo='
  };
  
  const baseUrl = urlBase[empresa.toLowerCase()] || urlBase.default;
  return `${baseUrl}${codigo}`;
};

// MÉTODOS ESTÁTICOS

// Crear envío desde transacción
envioSchema.statics.crearDesdeTransaccion = async function(transaccion, origenesLibros) {
  // Solo crear para transacciones con envío a domicilio
  if (transaccion.envio.metodo !== 'domicilio') {
    throw new Error('Solo se pueden crear envíos para transacciones con método de entrega a domicilio');
  }
  
  // Verificar que no exista
  const envioExistente = await this.findOne({ id_transaccion: transaccion._id });
  if (envioExistente) {
    return envioExistente;
  }
  
  // Preparar orígenes de los libros
  const origenes = transaccion.items.map(item => {
    const origen = origenesLibros.find(o => o.id_libro.toString() === item.id_libro.toString());
    
    return {
      id_libro: item.id_libro,
      titulo: item.titulo,
      cantidad: item.cantidad,
      id_tienda_origen: origen?.id_tienda_origen
    };
  });
  
  // Crear envío
  const nuevoEnvio = new this({
    id_transaccion: transaccion._id,
    direccion_envio: transaccion.envio.direccion,
    estado_envio: 'EN PREPARACION',
    origenes: origenes,
    costo_envio: transaccion.envio.costo || 0,
    instrucciones_especiales: transaccion.envio.notas
  });
  
  // Registro inicial
  nuevoEnvio.historial_estados.push({
    estado_nuevo: 'EN PREPARACION',
    fecha: new Date(),
    descripcion: 'Envío creado'
  });
  
  return nuevoEnvio.save();
};

// Obtener envíos pendientes
envioSchema.statics.obtenerEnviosPendientes = function() {
  return this.find({
    estado_envio: { $ne: 'ENTREGADO' }
  })
  .sort({ 'fechas.creacion': 1 });
};

// Obtener envíos por cliente
envioSchema.statics.obtenerEnviosPorCliente = async function(idCliente) {
  const Transaccion = mongoose.model('Transaccion');
  
  // Obtener transacciones del cliente
  const transacciones = await Transaccion.find({ 
    id_usuario: idCliente,
    'envio.metodo': 'domicilio'
  });
  
  const idsTransacciones = transacciones.map(t => t._id);
  
  // Buscar envíos correspondientes
  return this.find({
    id_transaccion: { $in: idsTransacciones }
  })
  .sort({ 'fechas.creacion': -1 });
};

const Envio = mongoose.model('Envio', envioSchema);

module.exports = Envio;