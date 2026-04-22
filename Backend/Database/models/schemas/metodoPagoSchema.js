// // Database/models/schemas/metodoPagoSchema.js
// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// // Esquema para tarjetas (crédito/débito)
// const tarjetaSchema = new Schema({
//   // Identificador único
//   id_tarjeta: {
//     type: String,
//     default: function() {
//       return new mongoose.Types.ObjectId().toString();
//     },
//     unique: true
//   },
  
//   // Usuario propietario de la tarjeta
//   id_usuario: {
//     type: Schema.Types.ObjectId,
//     ref: 'Usuario',
//     required: true,
//     index: true
//   },
  
//   // Tipo de tarjeta
//   tipo: {
//     type: String,
//     enum: ['credito', 'debito'],
//     required: true
//   },
  
//   // Nombre como aparece en la tarjeta
//   nombre_titular: {
//     type: String,
//     required: true,
//     trim: true
//   },
  
//   // Últimos 4 dígitos (por seguridad solo almacenamos estos)
//   ultimos_digitos: {
//     type: String,
//     required: true,
//     match: /^\d{4}$/
//   },
  
//   // Marca de la tarjeta
//   marca: {
//     type: String,
//     enum: ['visa', 'mastercard', 'american_express', 'diners', 'otra'],
//     required: true
//   },
  
//   // Fecha de expiración
//   fecha_expiracion: {
//     mes: {
//       type: Number,
//       required: true,
//       min: 1,
//       max: 12
//     },
//     anio: {
//       type: Number,
//       required: true,
//       validate: {
//         validator: function(v) {
//           return v >= new Date().getFullYear();
//         },
//         message: 'La tarjeta ha expirado'
//       }
//     }
//   },
  
//   // Token seguro para operaciones (simulado - en producción usarías un servicio de pago)
//   token_seguro: {
//     type: String,
//     required: true
//   },
  
//   // Si es la tarjeta predeterminada del usuario
//   predeterminada: {
//     type: Boolean,
//     default: false
//   },
  
//   // Metadatos
//   fecha_registro: {
//     type: Date,
//     default: Date.now
//   },
  
//   ultima_actualizacion: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Esquema para saldo en cuenta
// const saldoSchema = new Schema({
//   // Usuario propietario del saldo
//   id_usuario: {
//     type: Schema.Types.ObjectId,
//     ref: 'Usuario',
//     required: true,
//     unique: true,
//     index: true
//   },
  
//   // Monto actual del saldo
//   monto: {
//     type: Number,
//     required: true,
//     default: 0,
//     min: 0
//   },
  
//   // Historial de transacciones
//   historial_transacciones: [{
//     tipo: {
//       type: String,
//       enum: ['deposito', 'retiro', 'compra', 'reembolso', 'ajuste_manual', 'bono'],
//       required: true
//     },
//     monto: {
//       type: Number,
//       required: true
//     },
//     fecha: {
//       type: Date,
//       default: Date.now
//     },
//     saldo_anterior: Number,
//     saldo_nuevo: Number,
//     id_transaccion: Schema.Types.ObjectId, // Referencia a una transacción (si aplica)
//     id_orden: Schema.Types.ObjectId, // Referencia a una orden (si aplica)
//     descripcion: String,
//     realizado_por: {
//       type: Schema.Types.ObjectId,
//       ref: 'Usuario'
//     }
//   }],
  
//   // Metadatos
//   fecha_creacion: {
//     type: Date,
//     default: Date.now
//   },
  
//   ultima_actualizacion: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Middleware para actualizar fecha
// tarjetaSchema.pre('save', function(next) {
//   this.ultima_actualizacion = new Date();
//   next();
// });

// saldoSchema.pre('save', function(next) {
//   this.ultima_actualizacion = new Date();
//   next();
// });

// // MÉTODOS DE INSTANCIA PARA TARJETAS

// // Verificar si la tarjeta es válida (no expirada)
// tarjetaSchema.methods.esValida = function() {
//   const ahora = new Date();
//   const anioActual = ahora.getFullYear();
//   const mesActual = ahora.getMonth() + 1; // getMonth() es 0-indexed
  
//   return (this.fecha_expiracion.anio > anioActual) || 
//          (this.fecha_expiracion.anio === anioActual && this.fecha_expiracion.mes >= mesActual);
// };

// // MÉTODOS DE INSTANCIA PARA SALDO

// // Añadir fondos al saldo
// saldoSchema.methods.agregarFondos = async function(monto, tipo, descripcion, idTransaccion = null, realizadoPor = null) {
//   if (monto <= 0) {
//     throw new Error('El monto debe ser positivo');
//   }
  
//   const saldoAnterior = this.monto;
//   this.monto += monto;
  
//   this.historial_transacciones.push({
//     tipo: tipo,
//     monto: monto,
//     fecha: new Date(),
//     saldo_anterior: saldoAnterior,
//     saldo_nuevo: this.monto,
//     id_transaccion: idTransaccion,
//     descripcion: descripcion,
//     realizado_por: realizadoPor
//   });
  
//   return this.save();
// };

// // Retirar fondos del saldo
// saldoSchema.methods.retirarFondos = async function(monto, tipo, descripcion, idOrden = null, idTransaccion = null, realizadoPor = null) {
//   if (monto <= 0) {
//     throw new Error('El monto debe ser positivo');
//   }
  
//   if (monto > this.monto) {
//     throw new Error('Saldo insuficiente');
//   }
  
//   const saldoAnterior = this.monto;
//   this.monto -= monto;
  
//   this.historial_transacciones.push({
//     tipo: tipo,
//     monto: -monto, // Negativo para indicar retiro
//     fecha: new Date(),
//     saldo_anterior: saldoAnterior,
//     saldo_nuevo: this.monto,
//     id_transaccion: idTransaccion,
//     id_orden: idOrden,
//     descripcion: descripcion,
//     realizado_por: realizadoPor
//   });
  
//   return this.save();
// };

// // MÉTODOS ESTÁTICOS PARA TARJETAS

// // Obtener tarjetas de un usuario
// tarjetaSchema.statics.obtenerTarjetasUsuario = function(idUsuario) {
//   return this.find({ id_usuario: idUsuario })
//     .sort({ predeterminada: -1, fecha_registro: -1 });
// };

// // Establecer una tarjeta como predeterminada
// tarjetaSchema.statics.establecerPredeterminada = async function(idTarjeta, idUsuario) {
//   // Primero, quitar predeterminada de todas las tarjetas del usuario
//   await this.updateMany(
//     { id_usuario: idUsuario },
//     { $set: { predeterminada: false } }
//   );
  
//   // Establecer la tarjeta seleccionada como predeterminada
//   return this.findByIdAndUpdate(
//     idTarjeta,
//     { $set: { predeterminada: true } },
//     { new: true }
//   );
// };

// // MÉTODOS ESTÁTICOS PARA SALDO

// // Obtener o crear saldo para un usuario
// saldoSchema.statics.obtenerOCrearSaldo = async function(idUsuario) {
//   let saldo = await this.findOne({ id_usuario: idUsuario });
  
//   if (!saldo) {
//     saldo = new this({
//       id_usuario: idUsuario,
//       monto: 0
//     });
//     await saldo.save();
//   }
  
//   return saldo;
// };

// // Crear esquema reutilizable de método de pago
// const metodoPagoSchema = new Schema({
//   tipo: {
//     type: String,
//     enum: ['tarjeta_credito', 'tarjeta_debito', 'saldo_cuenta'],
//     required: true
//   },
  
//   // Referencia a la tarjeta (si aplica)
//   id_tarjeta: {
//     type: Schema.Types.ObjectId,
//     ref: 'Tarjeta'
//   },
  
//   // Indicador de si se usa saldo (si aplica)
//   usar_saldo: {
//     type: Boolean,
//     default: false
//   },
  
//   // Datos adicionales (por ej. para mostrar resumen)
//   detalles: {
//     ultimos_digitos: String,
//     marca: String,
//     nombre_titular: String
//   }
// });

// // Exportar modelos y esquemas
// const Tarjeta = mongoose.model('Tarjeta', tarjetaSchema);
// const Saldo = mongoose.model('Saldo', saldoSchema);

// module.exports = {
//   Tarjeta,
//   Saldo,
//   tarjetaSchema,
//   saldoSchema,
//   metodoPagoSchema
// };