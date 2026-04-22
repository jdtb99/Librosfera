// Database/models/carritoModel.js (CORREGIDO - MANEJO DE ITEMS ELIMINADOS)
const mongoose = require('mongoose');
const addressSchema = require('./schemas/addressSchema');

const Schema = mongoose.Schema;
const carritoSchema = new Schema({
  // Identificador único del carrito
  id_carrito: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true,
    index: true
  },
  
  // Usuario al que pertenece el carrito
  id_usuario: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  // Estructura de totales detallada
  totales: {
    // Subtotal sin descuentos (precio base × cantidad)
    subtotal_base: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Total de descuentos aplicados
    total_descuentos: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Subtotal con descuentos pero sin impuestos
    subtotal_con_descuentos: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Total de impuestos
    total_impuestos: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Costo de envío
    costo_envio: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Total final (con todo incluido)
    total_final: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Número total de items en el carrito
  n_item: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Número de libros diferentes
  n_libros_diferentes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Estado del carrito
  estado: {
    type: String,
    enum: ['activo', 'en_proceso_compra', 'abandonado', 'convertido_a_compra', 'expirado'],
    default: 'activo',
    index: true
  },
  
  // Códigos de descuento aplicados a nivel de carrito
  codigos_carrito: [{
    codigo: String,
    fecha_aplicado: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Fechas relevantes
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  ultima_actualizacion: {
    type: Date,
    default: Date.now
  },
  
  fecha_expiracion: {
    type: Date,
    default: function() {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 30);
      return fecha;
    }
  },
  
  // Información de envío
  info_envio: {
    direccion: addressSchema,
    metodo_envio: {
      type: String,
      enum: ['domicilio', 'recogida_tienda']
    },
    tienda_recogida: String,
    notas_envio: String
  },
  
  // Información de problemas en el carrito
  problemas: [{
    tipo: {
      type: String,
      enum: ['precio_cambiado', 'sin_stock', 'libro_no_disponible', 'codigo_expirado']
    },
    descripcion: String,
    id_item: Schema.Types.ObjectId,
    fecha: {
      type: Date,
      default: Date.now
    },
    resuelto: {
      type: Boolean,
      default: false
    }
  }],
  
  // Notas del carrito
  notas: String
});

// Índices para operaciones comunes
carritoSchema.index({ id_usuario: 1, estado: 1 });
carritoSchema.index({ fecha_creacion: 1 });
carritoSchema.index({ ultima_actualizacion: 1 });
carritoSchema.index({ fecha_expiracion: 1 });

// Middleware para actualizar fecha
carritoSchema.pre('save', function(next) {
  this.ultima_actualizacion = new Date();
  next();
});

// MÉTODOS DE INSTANCIA

// CORREGIDO: Actualizar totales del carrito con estructura detallada
carritoSchema.methods.actualizarTotales = async function() {
  try {
    const CarritoItem = mongoose.model('Carrito_Items');
    
    // Usar el ID correctamente
    const carritoId = this._id;
    const stats = await CarritoItem.obtenerEstadisticasItems(carritoId);
    
    // Actualizar contadores de items
    this.n_item = stats.total_items;
    
    // Contar libros diferentes
    const librosDiferentes = await CarritoItem.distinct('id_libro', { id_carrito: carritoId });
    this.n_libros_diferentes = librosDiferentes.length;
    
    // Actualizar estructura de totales detallada
    this.totales.subtotal_base = stats.subtotal_sin_descuentos || 0;
    this.totales.total_descuentos = stats.total_descuentos || 0;
    this.totales.subtotal_con_descuentos = stats.subtotal_sin_impuestos || 0;
    this.totales.total_impuestos = stats.total_impuestos || 0;
    // this.totales.costo_envio se mantiene igual (se actualiza aparte)
    
    // Calcular total final
    this.totales.total_final = (this.totales.subtotal_con_descuentos || 0) + 
                               (this.totales.total_impuestos || 0) + 
                               (this.totales.costo_envio || 0);
    
    return this.save();
  } catch (error) {
    console.error('Error en actualizarTotales:', error);
    throw new Error(`Error al actualizar totales: ${error.message}`);
  }
};

// Aplicar código de descuento a items específicos
carritoSchema.methods.aplicarCodigoDescuento = async function(codigoDescuento) {
  try {
    const CarritoItem = mongoose.model('Carrito_Items');
    const items = await CarritoItem.find({ id_carrito: this._id });
    
    let itemsAfectados = 0;
    let totalDescuentoAplicado = 0;
    
    for (const item of items) {
      // Verificar si el código ya está aplicado a este item
      const yaAplicado = item.codigos_aplicados.some(c => c.codigo === codigoDescuento);
      if (yaAplicado) {
        continue;
      }
      
      const precioAnterior = item.precios.precio_con_impuestos;
      const codigosActuales = item.codigos_aplicados.map(c => c.codigo);
      codigosActuales.push(codigoDescuento);
      
      // Recalcular precios con el nuevo código
      await item.calcularPrecios(codigosActuales);
      
      // Verificar si se aplicó algún descuento
      if (item.precios.precio_con_impuestos < precioAnterior) {
        itemsAfectados++;
        totalDescuentoAplicado += (precioAnterior - item.precios.precio_con_impuestos) * item.cantidad;
      } else {
        // Si no se aplicó descuento, quitar el código de la lista
        const index = item.codigos_aplicados.findIndex(c => c.codigo === codigoDescuento);
        if (index > -1) {
          item.codigos_aplicados.splice(index, 1);
          await item.save();
        }
      }
    }
    
    if (itemsAfectados === 0) {
      throw new Error('El código de descuento no es válido para ningún producto en el carrito');
    }
    
    // Registrar código aplicado a nivel de carrito
    const codigoExiste = this.codigos_carrito.find(c => c.codigo === codigoDescuento);
    if (!codigoExiste) {
      this.codigos_carrito.push({
        codigo: codigoDescuento,
        fecha_aplicado: new Date()
      });
    }
    
    // Actualizar totales
    await this.actualizarTotales();
    
    return {
      items_afectados: itemsAfectados,
      descuento_aplicado: totalDescuentoAplicado,
      mensaje: `Código ${codigoDescuento} aplicado a ${itemsAfectados} producto(s)`
    };
  } catch (error) {
    throw new Error(`Error aplicando código: ${error.message}`);
  }
};

// Quitar código de descuento
carritoSchema.methods.quitarCodigoDescuento = async function(codigoDescuento) {
  try {
    const CarritoItem = mongoose.model('Carrito_Items');
    const items = await CarritoItem.find({ id_carrito: this._id });
    
    let itemsAfectados = 0;
    
    for (const item of items) {
      const codigoIndex = item.codigos_aplicados.findIndex(c => c.codigo === codigoDescuento);
      if (codigoIndex > -1) {
        // Quitar el código de la lista
        item.codigos_aplicados.splice(codigoIndex, 1);
        
        // Recalcular precios sin este código
        const codigosRestantes = item.codigos_aplicados.map(c => c.codigo);
        await item.calcularPrecios(codigosRestantes);
        
        itemsAfectados++;
      }
    }
    
    // Quitar código del carrito
    const carritoIndex = this.codigos_carrito.findIndex(c => c.codigo === codigoDescuento);
    if (carritoIndex > -1) {
      this.codigos_carrito.splice(carritoIndex, 1);
    }
    
    // Actualizar totales
    await this.actualizarTotales();
    
    return {
      items_afectados: itemsAfectados,
      mensaje: `Código ${codigoDescuento} removido de ${itemsAfectados} producto(s)`
    };
  } catch (error) {
    throw new Error(`Error quitando código: ${error.message}`);
  }
};

// Vaciar carrito
carritoSchema.methods.vaciar = async function() {
  try {
    const CarritoItem = mongoose.model('Carrito_Items');
    await CarritoItem.deleteMany({ id_carrito: this._id });
    
    // Resetear totales
    this.totales = {
      subtotal_base: 0,
      total_descuentos: 0,
      subtotal_con_descuentos: 0,
      total_impuestos: 0,
      costo_envio: 0,
      total_final: 0
    };
    
    this.n_item = 0;
    this.n_libros_diferentes = 0;
    this.codigos_carrito = [];
    this.problemas = [];
    
    return this.save();
  } catch (error) {
    throw new Error(`Error al vaciar carrito: ${error.message}`);
  }
};

// CORREGIDO: Verificar problemas en el carrito con manejo seguro de items eliminados
carritoSchema.methods.verificarProblemas = async function() {
  try {
    const CarritoItem = mongoose.model('Carrito_Items');
    
    // CORREGIDO: Obtener items actualmente existentes
    const items = await CarritoItem.find({ id_carrito: this._id });
    
    // Limpiar problemas existentes
    this.problemas = [];
    
    // Si no hay items, no hay problemas que verificar
    if (items.length === 0) {
      console.log(`Carrito ${this._id} está vacío, no hay problemas que verificar`);
      return this.save();
    }
    
    console.log(`Verificando problemas en ${items.length} items del carrito ${this._id}`);
    
    for (const item of items) {
      try {
        // CORREGIDO: Verificar que el item aún existe antes de verificar precio
        const itemExisteEnDB = await CarritoItem.findById(item._id);
        
        if (!itemExisteEnDB) {
          console.log(`Item ${item._id} ya no existe en DB, saltando verificación`);
          continue;
        }
        
        await itemExisteEnDB.verificarPrecio();
        
        // Verificar si hay problemas después de la verificación
        if (itemExisteEnDB.precio_cambiado || itemExisteEnDB.estado !== 'activo') {
          this.problemas.push({
            tipo: itemExisteEnDB.estado === 'sin_stock' ? 'sin_stock' : 'precio_cambiado',
            descripcion: itemExisteEnDB.mensaje_precio,
            id_item: itemExisteEnDB._id,
            fecha: new Date(),
            resuelto: false
          });
        }
      } catch (itemError) {
        // CORREGIDO: Manejo mejorado de errores por item
        console.error(`Error verificando item ${item._id}:`, itemError.message);
        
        // Si el error es "documento no encontrado", el item fue eliminado
        if (itemError.message.includes('No document found') || 
            itemError.message.includes('document not found') ||
            itemError.message.includes('Cast to ObjectId failed')) {
          console.log(`Item ${item._id} fue eliminado durante la verificación, saltando`);
          continue;
        }
        
        // Para otros errores, registrar como problema
        this.problemas.push({
          tipo: 'libro_no_disponible',
          descripcion: `Error verificando disponibilidad: ${itemError.message}`,
          id_item: item._id,
          fecha: new Date(),
          resuelto: false
        });
      }
    }
    
    console.log(`Verificación completada. Problemas encontrados: ${this.problemas.length}`);
    
    return this.save();
  } catch (error) {
    console.error(`Error general verificando problemas del carrito ${this._id}:`, error);
    
    // CORREGIDO: No fallar completamente, solo registrar el error
    // Esto permite que el carrito siga funcionando aunque haya problemas de verificación
    try {
      this.problemas = [{
        tipo: 'libro_no_disponible',
        descripcion: `Error general en verificación: ${error.message}`,
        id_item: null,
        fecha: new Date(),
        resuelto: false
      }];
      
      return this.save();
    } catch (saveError) {
      console.error('Error guardando problemas del carrito:', saveError);
      // Como último recurso, no fallar
      return this;
    }
  }
};

// MÉTODOS ESTÁTICOS

carritoSchema.statics.obtenerCarritoActivo = async function(idUsuario) {
  let carrito = await this.findOne({ 
    id_usuario: idUsuario, 
    estado: 'activo' 
  });
  
  if (!carrito) {
    carrito = new this({
      id_usuario: idUsuario,
      estado: 'activo'
    });
    await carrito.save();
  }
  
  return carrito;
};

carritoSchema.statics.obtenerCarritosAbandonados = function(diasInactividad = 3) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasInactividad);
  
  return this.find({
    estado: 'activo',
    ultima_actualizacion: { $lt: fechaLimite },
    n_item: { $gt: 0 }
  }).populate('id_usuario', 'email nombres');
};

carritoSchema.statics.obtenerEstadisticasAdmin = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$estado',
        count: { $sum: 1 },
        total_valor: { $sum: '$totales.total_final' },
        promedio_items: { $avg: '$n_item' }
      }
    }
  ]);
  
  const totalCarritos = await this.countDocuments();
  const valorTotalCarritos = await this.aggregate([
    { $group: { _id: null, total: { $sum: '$totales.total_final' } } }
  ]);
  
  return {
    por_estado: stats,
    total_carritos: totalCarritos,
    valor_total_carritos: valorTotalCarritos.length > 0 ? valorTotalCarritos[0].total : 0
  };
};

carritoSchema.statics.obtenerLibroMasPopular = async function() {
  const CarritoItem = mongoose.model('Carrito_Items');
  
  const resultado = await CarritoItem.aggregate([
    { $match: { estado: 'activo' } },
    {
      $group: {
        _id: '$id_libro',
        total_en_carritos: { $sum: '$cantidad' },
        carritos_diferentes: { $sum: 1 }
      }
    },
    { $sort: { total_en_carritos: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: 'libros',
        localField: '_id',
        foreignField: '_id',
        as: 'libro'
      }
    }
  ]);
  
  return resultado.length > 0 ? resultado[0] : null;
};

const Carrito = mongoose.model('Carrito', carritoSchema);

module.exports = Carrito;