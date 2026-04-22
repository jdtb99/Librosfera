const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ejemplarSchema = new Schema({
  // Identificador único del ejemplar
  id_ejemplar: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true,
    index: true
  },
  
  // Referencia al libro al que pertenece este ejemplar
  id_libro: {
    type: Schema.Types.ObjectId,
    ref: 'Libro',
    required: true,
    index: true
  },
  
  // Estado físico del ejemplar
  estado: {
    type: String,
    enum: ['nuevo', 'excelente', 'bueno', 'aceptable', 'deteriorado'],
    default: 'nuevo',
    required: true
  },
  
  // Descripción o notas sobre este ejemplar específico
  descripcion: {
    type: String,
    trim: true
  },
  
  // Tienda donde se encuentra el ejemplar
  id_tienda: {
    type: Schema.Types.ObjectId,
    ref: 'Tienda_Fisica',
    required: true,
    index: true
  },
  
  // Para saber si el ejemplar está disponible para venta
  disponible: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Código único para identificación en estante/inventario físico
  codigo_ejemplar: {
    type: String,
    required: true,
    unique: true
  },
  
  // Fecha de adquisición
  fecha_adquisicion: {
    type: Date,
    default: Date.now
  },
  
  // Precio de compra del ejemplar (puede ser diferente al precio de venta)
  precio_adquisicion: {
    type: Number,
    min: 0
  },
  
  // Precio de venta específico (si difiere del precio general del libro)
  precio_venta_especifico: {
    type: Number,
    min: 0
  },
  
  // Historial de este ejemplar
  historial: [{
    tipo: {
      type: String,
      enum: ['ingreso', 'traslado', 'reserva', 'venta', 'devolucion', 'perdida', 'baja'],
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    id_tienda_origen: Schema.Types.ObjectId,
    id_tienda_destino: Schema.Types.ObjectId,
    id_transaccion: Schema.Types.ObjectId,
    id_usuario: Schema.Types.ObjectId,
    detalle: String
  }]
});

// ÍNDICES
ejemplarSchema.index({ id_libro: 1, disponible: 1 });
ejemplarSchema.index({ id_tienda: 1, disponible: 1 });
ejemplarSchema.index({ estado: 1, disponible: 1 });

// MÉTODOS DE INSTANCIA

// Marcar como no disponible (vendido, reservado, etc.)
ejemplarSchema.methods.marcarNoDisponible = function(tipo, idUsuario, idTransaccion = null, detalle = '') {
  if (!this.disponible) {
    throw new Error('Este ejemplar ya no está disponible');
  }
  
  this.disponible = false;
  
  this.historial.push({
    tipo: tipo,
    fecha: new Date(),
    id_usuario: idUsuario,
    id_transaccion: idTransaccion,
    detalle: detalle || `Ejemplar marcado como ${tipo}`
  });
  
  return this.save();
};

// Trasladar a otra tienda
ejemplarSchema.methods.trasladar = function(idTiendaDestino, idUsuario, detalle = '') {
  const tiendaOrigen = this.id_tienda;
  this.id_tienda = idTiendaDestino;
  
  this.historial.push({
    tipo: 'traslado',
    fecha: new Date(),
    id_tienda_origen: tiendaOrigen,
    id_tienda_destino: idTiendaDestino,
    id_usuario: idUsuario,
    detalle: detalle || 'Traslado entre tiendas'
  });
  
  return this.save();
};

// Actualizar estado
ejemplarSchema.methods.actualizarEstado = function(nuevoEstado, idUsuario, detalle = '') {
  this.estado = nuevoEstado;
  
  this.historial.push({
    tipo: 'actualizacion',
    fecha: new Date(),
    id_usuario: idUsuario,
    detalle: detalle || `Estado actualizado a ${nuevoEstado}`
  });
  
  return this.save();
};

// MÉTODOS ESTÁTICOS

// Crear ejemplares para un libro
ejemplarSchema.statics.crearEjemplares = async function(idLibro, cantidad, idTienda, estado = 'nuevo', detalles = {}) {
  const ejemplaresCreados = [];
  
  // Obtener el título del libro para generar códigos
  const Libro = mongoose.model('Libro');
  const libro = await Libro.findById(idLibro).select('titulo');
  
  if (!libro) {
    throw new Error('Libro no encontrado');
  }
  
  // Generar prefijo para el código basado en el título
  const prefijo = libro.titulo
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  
  // Obtener el último número usado para este libro
  const ultimoEjemplar = await this.findOne({ id_libro: idLibro })
    .sort({ codigo_ejemplar: -1 });
  
  let ultimoNumero = 0;
  if (ultimoEjemplar && ultimoEjemplar.codigo_ejemplar) {
    const match = ultimoEjemplar.codigo_ejemplar.match(/(\d+)$/);
    if (match) {
      ultimoNumero = parseInt(match[1], 10);
    }
  }
  
  // Crear ejemplares
  for (let i = 0; i < cantidad; i++) {
    ultimoNumero++;
    
    // Generar código único (formato: PREFIJO-IDLIBRO-NÚMERO)
    const codigo = `${prefijo}-${idLibro.toString().substr(-5)}-${ultimoNumero.toString().padStart(3, '0')}`;
    
    const ejemplar = new this({
      id_libro: idLibro,
      estado: estado,
      id_tienda: idTienda,
      codigo_ejemplar: codigo,
      disponible: true,
      ...detalles
    });
    
    // Añadir evento inicial al historial
    ejemplar.historial.push({
      tipo: 'ingreso',
      fecha: new Date(),
      id_tienda_destino: idTienda,
      detalle: 'Ingreso inicial al inventario'
    });
    
    await ejemplar.save();
    ejemplaresCreados.push(ejemplar);
  }
  
  return ejemplaresCreados;
};

// Obtener ejemplares disponibles de un libro
ejemplarSchema.statics.obtenerDisponibles = function(idLibro, idTienda = null) {
  const query = {
    id_libro: idLibro,
    disponible: true
  };
  
  if (idTienda) {
    query.id_tienda = idTienda;
  }
  
  return this.find(query)
    .sort({ fecha_adquisicion: 1 });
};

// Contar ejemplares disponibles por tienda
ejemplarSchema.statics.contarPorTienda = async function(idLibro) {
  return this.aggregate([
    { $match: { id_libro: mongoose.Types.ObjectId(idLibro), disponible: true } },
    { $group: { _id: '$id_tienda', cantidad: { $sum: 1 } } },
    { $lookup: { from: 'tienda_fisicas', localField: '_id', foreignField: '_id', as: 'recogida_tienda' } },
    { $unwind: '$tienda' },
    { $project: { 
      _id: 0, 
      id_tienda: '$_id', 
      nombre_tienda: '$tienda.nombre', 
      cantidad: 1 
    } }
  ]);
};

const Ejemplar = mongoose.model('Ejemplar', ejemplarSchema);

module.exports = Ejemplar;