// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;
// const { metodoPagoSchema } = require('./schemas/metodoPagoSchema'); 
// const addressSchema = require('./schemas/addressSchema');

// const transaccionSchema = new Schema({
//   // Identificador único de la transacción
//   id_transaccion: {
//     type: String,
//     default: function() {
//       return new mongoose.Types.ObjectId().toString();
//     },
//     unique: true,
//     index: true
//   },
  
//   // Usuario que realiza la compra
//   id_usuario: {
//     type: Schema.Types.ObjectId,
//     ref: 'Usuario',
//     required: true,
//     index: true
//   },
  
//   // Referencia al carrito convertido en compra
//   id_carrito: {
//     type: Schema.Types.ObjectId,
//     ref: 'Carrito',
//     required: true
//   },
  
//   // Monto total de la transacción
//   total_pago: {
//     type: Number,
//     required: true,
//     min: 0
//   },
  
//   // Método de pago utilizando el esquema reutilizable
//   metodo_pago: {
//     type: metodoPagoSchema,
//     required: true
//   },
  
//   // Fecha en que se realizó el pago
//   fecha_pago: {
//     type: Date,
//     default: Date.now,
//     index: true
//   },
  
//   // Estado de la transacción
//   estado: {
//     type: String,
//     enum: ['pendiente', 'procesando', 'completada', 'fallida', 'cancelada', 'reembolsada', 'reembolso_parcial'],
//     default: 'pendiente',
//     index: true
//   },
  
//   // Información detallada del envío
//   envio: {
//     direccion: {
//       type: [addressSchema]
//     },
//     metodo: {
//       type: String,
//       enum: ['domicilio', 'recogida_tienda'],
//       required: true
//     },
//     costo: {
//       type: Number,
//       default: 0,
//       min: 0
//     },
//     id_tienda_recogida:{
//         type:Schema.ObjectId,
//         ref: 'Tienda_Fisica'
//     }
    
//   },
  
//   // Listado de productos comprados
//   items: [{
//     id_libro: {
//       type: Schema.Types.ObjectId,
//       ref: 'Libro',
//       required: true
//     },
//     titulo: String, // Para mantener el título incluso si el libro cambia
//     cantidad: {
//       type: Number,
//       required: true,
//       min: 1
//     },
//     precio_unitario: {
//       type: Number,
//       required: true,
//       min: 0
//     },
//     subtotal: {
//       type: Number,
//       required: true,
//       min: 0
//     },
//     estado_item: {
//       type: String,
//       enum: ['procesado', 'enviado', 'entregado', 'devuelto', 'en_proceso_devolucion'],
//       default: 'procesado'
//     }
//   }],
  
//   // Historial de eventos de la transacción
//   historial: [{
//     tipo_evento: {
//       type: String,
//       enum: ['creacion', 'pago', 'procesamiento', 'envio', 'entrega', 'cancelacion', 'devolucion', 'reembolso', 'cambio_estado'],
//       required: true
//     },
//     fecha: {
//       type: Date,
//       default: Date.now
//     },
//     detalles: String,
//     estado_anterior: String,
//     estado_nuevo: String,
//     id_usuario_operacion: Schema.Types.ObjectId // Usuario que realizó la operación
//   }],
  
//   // Información de devoluciones (si aplica)
//   devoluciones: [{
//     id_devolucion: {
//       type: String,
//       default: function() {
//         return new mongoose.Types.ObjectId().toString();
//       }
//     },
//     fecha_solicitud: {
//       type: Date,
//       default: Date.now
//     },
//     items: [{
//       id_libro: Schema.Types.ObjectId,
//       cantidad: Number,
//       motivo: {
//         type: String,
//         enum: ['mal_estado', 'no_satisfactorio', 'retraso_entrega', 'otro'],
//         required: true
//       },
//       descripcion: String
//     }],
//     estado: {
//       type: String,
//       enum: ['solicitada', 'aprobada', 'rechazada', 'en_proceso', 'completada'],
//       default: 'solicitada'
//     },
//     codigo_qr: String, // Código QR para iniciar el proceso de devolución
//     monto_reembolso: Number,
//     fecha_reembolso: Date,
//     notas_internas: String
//   }],
  
//   // Facturación
//   facturacion: {
//     numero_factura: String,
//     fecha_emision: {
//       type: Date,
//       default: Date.now
//     },
//     datos_fiscales: {
//       nombre: String,
//       identificacion_fiscal: String,
//       direccion: String
//     },
//     url_factura_pdf: String
//   },
  
//   // Metadatos
//   fecha_creacion: {
//     type: Date,
//     default: Date.now
//   },
//   ultima_actualizacion: {
//     type: Date,
//     default: Date.now
//   },
  
//   // Campo para notas y observaciones internas
//   notas: String
// });

// // ÍNDICES
// transaccionSchema.index({ id_usuario: 1, fecha_pago: -1 });
// transaccionSchema.index({ estado: 1, fecha_pago: -1 });
// transaccionSchema.index({ 'envio.estado_envio': 1 });
// transaccionSchema.index({ 'devoluciones.estado': 1 });

// // MIDDLEWARE
// transaccionSchema.pre('save', function(next) {
//   this.ultima_actualizacion = new Date();
//   next();
// });

// // MÉTODOS DE INSTANCIA

// // Registrar evento en el historial
// transaccionSchema.methods.registrarEvento = function(tipoEvento, detalles = '', idUsuarioOperacion = null) {
//   const estadoAnterior = this.estado;
  
//   this.historial.push({
//     tipo_evento: tipoEvento,
//     fecha: new Date(),
//     detalles: detalles,
//     estado_anterior: estadoAnterior,
//     estado_nuevo: this.estado,
//     id_usuario_operacion: idUsuarioOperacion
//   });
  
//   return this.save();
// };

// // Actualizar estado del envío
// transaccionSchema.methods.actualizarEstadoEnvio = async function(nuevoEstado, numeroSeguimiento = null, detalle = '') {
//   const estadoAnterior = this.envio.estado_envio;
//   this.envio.estado_envio = nuevoEstado;
  
//   if (numeroSeguimiento) {
//     this.envio.numero_seguimiento = numeroSeguimiento;
//   }
  
//   // Registrar el evento
//   this.historial.push({
//     tipo_evento: 'envio',
//     fecha: new Date(),
//     detalles: detalle || `Estado de envío cambiado de ${estadoAnterior} a ${nuevoEstado}`,
//     estado_anterior: estadoAnterior,
//     estado_nuevo: nuevoEstado
//   });
  
//   return this.save();
// };

// // Crear solicitud de devolución
// transaccionSchema.methods.solicitarDevolucion = async function(items, motivo, descripcion) {
//   // Verificar que no hayan pasado más de 8 días (requisito del proyecto)
//   const diasTranscurridos = Math.floor((new Date() - this.fecha_pago) / (1000 * 60 * 60 * 24));
  
//   if (diasTranscurridos > 8) {
//     throw new Error('No se pueden hacer devoluciones pasados 8 días después de haber recibido el producto');
//   }
  
//   // Verificar que los items existan en la compra
//   for (const item of items) {
//     const encontrado = this.items.find(i => i.id_libro.toString() === item.id_libro.toString());
    
//     if (!encontrado) {
//       throw new Error(`El libro con ID ${item.id_libro} no está en esta transacción`);
//     }
    
//     if (item.cantidad > encontrado.cantidad) {
//       throw new Error(`No se puede devolver más unidades (${item.cantidad}) que las compradas (${encontrado.cantidad})`);
//     }
//   }
  
//   // Generar código QR para la devolución (simulado)
//   const codigoQR = `DEV-${this.id_transaccion}-${Date.now()}`;
  
//   // Crear la solicitud de devolución
//   this.devoluciones.push({
//     fecha_solicitud: new Date(),
//     items: items.map(item => ({
//       id_libro: item.id_libro,
//       cantidad: item.cantidad,
//       motivo: motivo,
//       descripcion: descripcion
//     })),
//     estado: 'solicitada',
//     codigo_qr: codigoQR
//   });
  
//   // Registrar el evento
//   this.historial.push({
//     tipo_evento: 'devolucion',
//     fecha: new Date(),
//     detalles: `Solicitud de devolución creada. Motivo: ${motivo}`
//   });
  
//   return this.save();
// };

// // Procesar devolución
// transaccionSchema.methods.procesarDevolucion = async function(idDevolucion, estado, montoReembolso = null, notas = '') {
//   const devolucion = this.devoluciones.id(idDevolucion);
  
//   if (!devolucion) {
//     throw new Error('Devolución no encontrada');
//   }
  
//   devolucion.estado = estado;
  
//   if (montoReembolso !== null) {
//     devolucion.monto_reembolso = montoReembolso;
//   }
  
//   if (estado === 'completada') {
//     devolucion.fecha_reembolso = new Date();
    
//     // Actualizar estado de la transacción
//     if (montoReembolso === this.total_pago) {
//       this.estado = 'reembolsada';
//     } else if (montoReembolso > 0) {
//       this.estado = 'reembolso_parcial';
//     }
//   }
  
//   if (notas) {
//     devolucion.notas_internas = notas;
//   }
  
//   // Registrar el evento
//   this.historial.push({
//     tipo_evento: 'reembolso',
//     fecha: new Date(),
//     detalles: `Devolución ${estado}. ${notas}`
//   });
  
//   return this.save();
// };

// // MÉTODOS ESTÁTICOS

// // Crear transacción a partir de un carrito
// transaccionSchema.statics.crearDesdeCarrito = async function(carrito, metodoPago) {
//   if (!carrito || !carrito.id_usuario || !carrito.items || carrito.items.length === 0) {
//     throw new Error('Carrito inválido o vacío');
//   }
  
//   // Obtener detalles de los items
//   const CarritoItem = mongoose.model('Carrito_Items');
//   const itemsCarrito = await CarritoItem.obtenerItemsCarrito(carrito._id)
//     .populate('id_libro', 'titulo precio');
  
//   // Validar si hay suficiente stock para todos los items
//   const Inventario = mongoose.model('Inventario');
//   for (const item of itemsCarrito) {
//     const inventario = await Inventario.findOne({ id_libro: item.id_libro._id });
//     if (!inventario || inventario.stock_disponible < item.cantidad) {
//       throw new Error(`Stock insuficiente para ${item.id_libro.titulo}`);
//     }
//   }
  
//   // Crear la transacción
//   const transaccion = new this({
//     id_usuario: carrito.id_usuario,
//     id_carrito: carrito._id,
//     total_pago: carrito.total,
//     metodo_pago: metodoPago,
//     envio: carrito.info_envio,
//     items: itemsCarrito.map(item => ({
//       id_libro: item.id_libro._id,
//       titulo: item.id_libro.titulo,
//       cantidad: item.cantidad,
//       precio_unitario: item.precio_unitario,
//       subtotal: item.subtotal
//     }))
//   });
  
//   // Registrar el evento inicial
//   transaccion.historial.push({
//     tipo_evento: 'creacion',
//     fecha: new Date(),
//     detalles: 'Transacción creada',
//     estado_nuevo: 'pendiente'
//   });
  
//   await transaccion.save();
  
//   // Actualizar el inventario y reservar los items
//   for (const item of itemsCarrito) {
//     const inventario = await Inventario.findOne({ id_libro: item.id_libro._id });
//     await inventario.registrarSalida(
//       item.cantidad, 
//       'venta', 
//       carrito.id_usuario,
//       transaccion._id,
//       `Venta en transacción ${transaccion.id_transaccion}`
//     );
//   }
  
//   // Actualizar estado del carrito
//   await mongoose.model('Carrito').findByIdAndUpdate(
//     carrito._id,
//     { estado: 'convertido_a_compra' }
//   );
  
//   return transaccion;
// };

// // Obtener todas las transacciones de un usuario
// transaccionSchema.statics.obtenerTransaccionesUsuario = function(idUsuario) {
//   return this.find({ id_usuario: idUsuario })
//     .sort({ fecha_pago: -1 })
//     .select('id_transaccion total_pago fecha_pago estado envio.estado_envio items');
// };

// // Obtener transacciones en un rango de fechas
// transaccionSchema.statics.obtenerPorRangoFechas = function(fechaInicio, fechaFin, estado = null) {
//   const query = {
//     fecha_pago: {
//       $gte: fechaInicio,
//       $lte: fechaFin
//     }
//   };
  
//   if (estado) {
//     query.estado = estado;
//   }
  
//   return this.find(query).sort({ fecha_pago: -1 });
// };

// // Obtener transacciones con entregas pendientes
// transaccionSchema.statics.obtenerEntregasPendientes = function() {
//   return this.find({
//     estado: { $in: ['completada', 'procesando'] },
//     'envio.estado_envio': { $ne: 'ENTREGADO' }
//   })
//   .sort({ fecha_pago: 1 });
// };

// // Obtener estadísticas de ventas por período
// transaccionSchema.statics.obtenerEstadisticasVentas = async function(periodo, fechaInicio, fechaFin) {
//   let groupBy;
  
//   if (periodo === 'dia') {
//     groupBy = {
//       $dateToString: { format: '%Y-%m-%d', date: '$fecha_pago' }
//     };
//   } else if (periodo === 'mes') {
//     groupBy = {
//       $dateToString: { format: '%Y-%m', date: '$fecha_pago' }
//     };
//   } else if (periodo === 'anio') {
//     groupBy = {
//       $dateToString: { format: '%Y', date: '$fecha_pago' }
//     };
//   } else {
//     throw new Error('Período inválido. Debe ser "dia", "mes" o "anio"');
//   }
  
//   return this.aggregate([
//     {
//       $match: {
//         fecha_pago: {
//           $gte: fechaInicio,
//           $lte: fechaFin
//         },
//         estado: { $in: ['completada', 'procesando'] }
//       }
//     },
//     {
//       $group: {
//         _id: groupBy,
//         total_ventas: { $sum: '$total_pago' },
//         cantidad_transacciones: { $sum: 1 },
//         promedio_venta: { $avg: '$total_pago' }
//       }
//     },
//     {
//       $sort: { _id: 1 }
//     }
//   ]);
// };

// const Transaccion = mongoose.model('Transaccion', transaccionSchema);

// module.exports = Transaccion;