const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reservaSchema = new Schema({
  id_reserva: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true,
    index: true
  },
  
  id_usuario: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  id_libro: {
    type: Schema.Types.ObjectId,
    ref: 'Libro',
    required: true,
    index: true
  },
  
  fecha_reserva: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // La reserva expira después de 24 horas
  fecha_expiracion: {
    type: Date,
    required: true,
    index: true
  },
  
  cantidad: {
    type: Number,
    required: true,
    min: 1,
    max: 3, // Máximo 3 del mismo ejemplar
    default: 1
  },
  
  estado: {
    type: String,
    enum: ['activa', 'confirmada', 'expirada', 'cancelada'],
    default: 'activa',
    index: true
  },
  
  id_carrito: {
    type: Schema.Types.ObjectId,
    ref: 'Carrito'
  },
  
  // Para auditoría
  eventos: [{
    tipo: {
      type: String,
      enum: ['creacion', 'confirmacion', 'expiracion', 'cancelacion'],
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    detalle: String
  }]
});

// ÍNDICES
reservaSchema.index({ id_usuario: 1, estado: 1 });
reservaSchema.index({ fecha_expiracion: 1, estado: 1 });

// PRE-SAVE MIDDLEWARE
reservaSchema.pre('save', function(next) {
  // Establecer fecha de expiración a 24 horas si es nueva reserva
  if (this.isNew && !this.fecha_expiracion) {
    const fechaExp = new Date(this.fecha_reserva);
    fechaExp.setHours(fechaExp.getHours() + 24);
    this.fecha_expiracion = fechaExp;
    
    // Registrar evento de creación
    this.eventos.push({
      tipo: 'creacion',
      fecha: this.fecha_reserva,
      detalle: 'Reserva creada'
    });
  }
  
  next();
});

// MÉTODOS DE INSTANCIA

// Confirmar reserva (convertir a carrito)
reservaSchema.methods.confirmar = async function() {
  if (this.estado !== 'activa') {
    throw new Error('Solo se pueden confirmar reservas activas');
  }
  
  // Verificar que no haya expirado
  if (new Date() > this.fecha_expiracion) {
    await this.expirar();
    throw new Error('La reserva ha expirado');
  }
  
  this.estado = 'confirmada';
  
  // Registrar evento
  this.eventos.push({
    tipo: 'confirmacion',
    fecha: new Date(),
    detalle: 'Reserva confirmada y agregada al carrito'
  });
  
  return this.save();
};

// Cancelar reserva
reservaSchema.methods.cancelar = async function(motivo = '') {
  if (this.estado !== 'activa') {
    throw new Error('Solo se pueden cancelar reservas activas');
  }
  
  this.estado = 'cancelada';
  
  // Registrar evento
  this.eventos.push({
    tipo: 'cancelacion',
    fecha: new Date(),
    detalle: motivo || 'Reserva cancelada por el usuario'
  });
  
  // Liberar inventario
  const Inventario = mongoose.model('Inventario');
  await Inventario.findOne({ id_libro: this.id_libro })
    .then(inv => inv.liberarReserva(
      this.cantidad, 
      this.id_usuario, 
      this._id, 
      'Cancelación de reserva'
    ));
  
  return this.save();
};

// Expirar reserva
reservaSchema.methods.expirar = async function() {
  if (this.estado !== 'activa') {
    return this; // Si no está activa, no hacemos nada
  }
  
  this.estado = 'expirada';
  
  // Registrar evento
  this.eventos.push({
    tipo: 'expiracion',
    fecha: new Date(),
    detalle: 'Reserva expirada automáticamente'
  });
  
  // Liberar inventario
  const Inventario = mongoose.model('Inventario');
  await Inventario.findOne({ id_libro: this.id_libro })
    .then(inv => inv.liberarReserva(
      this.cantidad, 
      this.id_usuario, 
      this._id, 
      'Expiración de reserva'
    ));
  
  return this.save();
};

// MÉTODOS ESTÁTICOS

// Crear nueva reserva
reservaSchema.statics.crearReserva = async function(idUsuario, idLibro, cantidad = 1) {
  // Validar cantidad máxima por libro
  if (cantidad > 3) {
    throw new Error('No se pueden reservar más de 3 ejemplares del mismo libro');
  }
  
  // Verificar límite de 5 libros diferentes
  const reservasActivas = await this.countDocuments({
    id_usuario: idUsuario,
    estado: 'activa'
  });
  
  const reservaMismoLibro = await this.findOne({
    id_usuario: idUsuario,
    id_libro: idLibro,
    estado: 'activa'
  });
  
  if (reservaMismoLibro) {
    throw new Error('Ya tienes una reserva activa para este libro');
  }
  
  if (reservasActivas >= 5 && !reservaMismoLibro) {
    throw new Error('No puedes reservar más de 5 libros diferentes');
  }
  
  // Verificar disponibilidad en inventario
  const Inventario = mongoose.model('Inventario');
  const inventario = await Inventario.findOne({ id_libro: idLibro });
  
  if (!inventario || inventario.stock_disponible < cantidad) {
    throw new Error('No hay suficiente stock disponible para reservar');
  }
  
  // Crear la reserva
  const reserva = new this({
    id_usuario: idUsuario,
    id_libro: idLibro,
    cantidad: cantidad
  });
  
  await reserva.save();
  
  // Actualizar inventario
  await inventario.reservarEjemplares(
    cantidad, 
    idUsuario, 
    reserva._id, 
    'Nueva reserva'
  );
  
  return reserva;
};

// Procesar reservas expiradas
reservaSchema.statics.procesarReservasExpiradas = async function() {
  const ahora = new Date();
  
  const reservasExpiradas = await this.find({
    estado: 'activa',
    fecha_expiracion: { $lt: ahora }
  });
  
  let procesadas = 0;
  
  for (const reserva of reservasExpiradas) {
    await reserva.expirar();
    procesadas++;
  }
  
  return procesadas;
};

// Obtener reservas activas de un usuario
reservaSchema.statics.obtenerReservasActivas = function(idUsuario) {
  return this.find({
    id_usuario: idUsuario,
    estado: 'activa'
  })
  .sort({ fecha_reserva: -1 })
  .populate('id_libro', 'titulo autor precio imagenes');
};

const Reserva = mongoose.model('Reserva', reservaSchema);

module.exports = Reserva;