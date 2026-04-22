// Database/models/schemas/bookPriceSchema.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Esquema para gestionar los precios y descuentos de los libros
const bookPriceSchema = new Schema({
  // Precio base del libro
  precio_base: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Moneda (por defecto en pesos colombianos, según la ubicación de la librería)
  moneda: {
    type: String,
    default: 'COP',
    enum: ['COP', 'USD', 'EUR']
  },
  
  // Impuestos aplicables
  impuesto: {
    tipo: {
      type: String,
      default: 'IVA',
      enum: ['IVA', 'ninguno', 'otro']
    },
    porcentaje: {
      type: Number,
      default: 19, // IVA Colombia
      min: 0,
      max: 100
    }
  },
  
  // Descuentos activos
  descuentos: [{
    tipo: {
      type: String,
      enum: ['porcentaje', 'valor_fijo', 'promocion_2x1', 'bundle'],
      required: true
    },
    valor: {
      type: Number,
      required: true,
      min: 0
    },
    fecha_inicio: {
      type: Date,
      default: Date.now
    },
    fecha_fin: Date,
    codigo_promocion: String,
    descripcion: String,
    activo: {
      type: Boolean,
      default: true
    }
  }],
  
  // Si el precio incluye envío gratuito
  envio_gratis: {
    type: Boolean,
    default: false
  }
});

// Método para calcular precio con impuestos (desde precio con descuentos)
bookPriceSchema.methods.calcularPrecioConImpuestos = function(precioConDescuentos) {
  const impuestoDecimal = this.impuesto.porcentaje / 100;
  return precioConDescuentos * (1 + impuestoDecimal);
};

// Método para obtener descuentos activos actualmente
bookPriceSchema.methods.obtenerDescuentosActivos = function() {
  const hoy = new Date();
  
  return this.descuentos.filter(descuento => {
    return descuento.activo && 
           (!descuento.fecha_fin || descuento.fecha_fin >= hoy) &&
           descuento.fecha_inicio <= hoy;
  });
};

// Método para calcular precio con descuentos automáticos (sin código)
bookPriceSchema.methods.calcularPrecioConDescuentosAutomaticos = function() {
  let precioConDescuentos = this.precio_base;
  const descuentosActivos = this.obtenerDescuentosActivos();
  
  // Solo aplicar descuentos que NO tienen código (automáticos)
  const descuentosAutomaticos = descuentosActivos.filter(desc => 
    !desc.codigo_promocion || desc.codigo_promocion.trim() === ''
  );
  
  descuentosAutomaticos.forEach(descuento => {
    if (descuento.tipo === 'porcentaje') {
      const descuentoDecimal = descuento.valor / 100;
      precioConDescuentos = precioConDescuentos * (1 - descuentoDecimal);
    } else if (descuento.tipo === 'valor_fijo') {
      precioConDescuentos = Math.max(0, precioConDescuentos - descuento.valor);
    }
  });
  
  return Math.round(precioConDescuentos * 100) / 100;
};

// Método para calcular precio con descuentos específicos (incluyendo códigos)
bookPriceSchema.methods.calcularPrecioConDescuentos = function(codigosAplicados = []) {
  let precioConDescuentos = this.precio_base;
  const descuentosActivos = this.obtenerDescuentosActivos();
  
  descuentosActivos.forEach(descuento => {
    let aplicarDescuento = false;
    
    // Descuento automático (sin código)
    if (!descuento.codigo_promocion || descuento.codigo_promocion.trim() === '') {
      aplicarDescuento = true;
    }
    // Descuento con código (solo si está en la lista)
    else if (codigosAplicados.includes(descuento.codigo_promocion)) {
      aplicarDescuento = true;
    }
    
    if (aplicarDescuento) {
      if (descuento.tipo === 'porcentaje') {
        const descuentoDecimal = descuento.valor / 100;
        precioConDescuentos = precioConDescuentos * (1 - descuentoDecimal);
      } else if (descuento.tipo === 'valor_fijo') {
        precioConDescuentos = Math.max(0, precioConDescuentos - descuento.valor);
      }
    }
  });
  
  return Math.round(precioConDescuentos * 100) / 100;
};

// Método para calcular precio final con impuestos
bookPriceSchema.methods.calcularPrecioFinalConImpuestos = function(codigosAplicados = []) {
  const precioConDescuentos = this.calcularPrecioConDescuentos(codigosAplicados);
  return Math.round(this.calcularPrecioConImpuestos(precioConDescuentos) * 100) / 100;
};

// Método para agregar un nuevo descuento
bookPriceSchema.methods.agregarDescuento = function(tipo, valor, fechaInicio, fechaFin, codigoPromocion = '', descripcion = '') {
  this.descuentos.push({
    tipo: tipo,
    valor: valor,
    fecha_inicio: fechaInicio || new Date(),
    fecha_fin: fechaFin,
    codigo_promocion: codigoPromocion,
    descripcion: descripcion,
    activo: true
  });
};

// Método para desactivar todos los descuentos
bookPriceSchema.methods.desactivarDescuentos = function() {
  this.descuentos.forEach(descuento => {
    descuento.activo = false;
  });
};

module.exports = bookPriceSchema;