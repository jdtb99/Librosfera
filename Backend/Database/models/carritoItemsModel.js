// Database/models/carritoItemsModel.js (CORREGIDO)
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const carritoItemSchema = new Schema({
  // Identificador único del item
  id_item: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true,
    index: true
  },
  
  // Referencia al carrito al que pertenece este item
  id_carrito: {
    type: Schema.Types.ObjectId,
    ref: 'Carrito',
    required: true,
    index: true
  },
  
  // Referencia al libro que se está añadiendo
  id_libro: {
    type: Schema.Types.ObjectId,
    ref: 'Libro',
    required: true,
    index: true
  },
  
  // Cantidad de ejemplares de este libro
  cantidad: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
    validate: {
      validator: function(v) {
        return v <= 3; // Máximo 3 ejemplares del mismo libro
      },
      message: 'No se pueden agregar más de 3 ejemplares del mismo libro'
    }
  },
  
  // Estructura de precios detallada
  precios: {
    // Precio base del libro (sin descuentos ni impuestos)
    precio_base: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Precio con descuentos aplicados (sin impuestos)
    precio_con_descuentos: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Precio final con impuestos
    precio_con_impuestos: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Información de impuesto aplicado
    impuesto: {
      tipo: String,
      porcentaje: Number,
      valor_impuesto: Number // Valor monetario del impuesto
    },
    
    // Total de descuentos aplicados
    total_descuentos: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Códigos de descuento aplicados manualmente por el cliente
  codigos_aplicados: [{
    codigo: String,
    descuento_aplicado: Number,
    tipo_descuento: String
  }],
  
  // Subtotal calculado (precio_con_impuestos × cantidad)
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  // NUEVO: Información de reserva de stock
  reserva_info: {
    id_tienda_reservado: {
      type: Schema.Types.ObjectId,
      ref: 'Tienda_Fisica',
    },
    fecha_reserva: {
      type: Date,
      default: Date.now
    },
    cantidad_reservada: {
      type: Number,
      default: 0
    },
    estado_reserva: {
      type: String,
      enum: ['PENDIENTE', 'RESERVADO', 'LIBERADO', 'CONVERTIDO_VENTA'],
      default: 'PENDIENTE',
    },
    observaciones_reserva: String
  },
  
  // Indicar si el precio ha cambiado desde que se agregó
  precio_cambiado: {
    type: Boolean,
    default: false
  },
  
  // Mensaje sobre cambio de precio
  mensaje_precio: {
    type: String,
    default: ''
  },
  
  // Estado del item
  estado: {
    type: String,
    enum: ['activo', 'precio_cambiado', 'sin_stock', 'reserva_expirada', 'removido'],
    default: 'activo'
  },
  
  // Fecha en que se agregó el item al carrito
  fecha_agregado: {
    type: Date,
    default: Date.now
  },
  
  // Fecha de última actualización
  fecha_actualizado: {
    type: Date,
    default: Date.now
  },
  
  // Metadatos adicionales (ACTUALIZADO)
  metadatos: {
    titulo_libro: String,
    autor_libro: String,
    imagen_portada: String,
    isbn: String,
    disponible: {
      type: Boolean,
      default: true
    },
    // NUEVO: Información de tienda donde está disponible
    tiendas_disponibles: [{
      id_tienda: {
        type: Schema.Types.ObjectId,
        ref: 'Tienda_Fisica'
      },
      nombre_tienda: String,
      stock_disponible: Number,
      distancia_km: Number // Si se calculó
    }],
    mejor_tienda_disponible: {
      type: Schema.Types.ObjectId,
      ref: 'Tienda_Fisica'
    }
  }
});

// ÍNDICES
carritoItemSchema.index({ id_carrito: 1, id_libro: 1 }, { unique: true });
carritoItemSchema.index({ estado: 1 });
carritoItemSchema.index({ fecha_agregado: -1 });
carritoItemSchema.index({ 'reserva_info.estado_reserva': 1 });
carritoItemSchema.index({ 'reserva_info.id_tienda_reservado': 1 });

// PRE SAVE MIDDLEWARE
carritoItemSchema.pre('save', function(next) {
  // Actualizar el subtotal automáticamente (con impuestos incluidos)
  this.subtotal = this.precios.precio_con_impuestos * this.cantidad;
  this.fecha_actualizado = new Date();
  
  // Actualizar información de reserva en metadatos para compatibilidad
  if (this.reserva_info.id_tienda_reservado) {
    this.metadatos.id_tienda_reservado = this.reserva_info.id_tienda_reservado;
  }
  
  next();
});

// MÉTODOS DE INSTANCIA

// Actualizar cantidad CON MANEJO DE RESERVA
carritoItemSchema.methods.actualizarCantidad = async function(nuevaCantidad) {
  if (nuevaCantidad < 1) {
    throw new Error('La cantidad debe ser al menos 1');
  }
  
  if (nuevaCantidad > 3) {
    throw new Error('No se pueden agregar más de 3 ejemplares del mismo libro');
  }
  
  const cantidadAnterior = this.cantidad;
  this.cantidad = nuevaCantidad;
  this.subtotal = this.precios.precio_con_impuestos * nuevaCantidad;
  
  // Actualizar información de reserva
  if (this.reserva_info.estado_reserva === 'RESERVADO') {
    this.reserva_info.cantidad_reservada = nuevaCantidad;
    this.reserva_info.observaciones_reserva = `Cantidad actualizada de ${cantidadAnterior} a ${nuevaCantidad}`;
  }
  
  return this.save();
};

// NUEVO: Marcar como reservado
carritoItemSchema.methods.marcarComoReservado = function(idTienda, cantidadReservada = null) {
  this.reserva_info.id_tienda_reservado = idTienda;
  this.reserva_info.fecha_reserva = new Date();
  this.reserva_info.cantidad_reservada = cantidadReservada || this.cantidad;
  this.reserva_info.estado_reserva = 'RESERVADO';
  this.reserva_info.observaciones_reserva = `Reservado en tienda ${idTienda}`;
  
  // Actualizar metadatos para compatibilidad
  this.metadatos.id_tienda_reservado = idTienda;
  
  return this.save();
};

// NUEVO: Liberar reserva
carritoItemSchema.methods.liberarReserva = function(motivo = 'Reserva liberada') {
  this.reserva_info.estado_reserva = 'LIBERADO';
  this.reserva_info.observaciones_reserva = motivo;
  
  return this.save();
};

// NUEVO: Convertir reserva en venta
carritoItemSchema.methods.convertirReservaEnVenta = function(idVenta) {
  this.reserva_info.estado_reserva = 'CONVERTIDO_VENTA';
  this.reserva_info.observaciones_reserva = `Convertido en venta ${idVenta}`;
  
  return this.save();
};

// NUEVO: Verificar si tiene reserva activa
carritoItemSchema.methods.tieneReservaActiva = function() {
  return this.reserva_info.estado_reserva === 'RESERVADO' && 
         this.reserva_info.id_tienda_reservado;
};

// NUEVO: Obtener información de tienda reservada
carritoItemSchema.methods.obtenerInfoTiendaReservada = async function() {
  if (!this.reserva_info.id_tienda_reservado) {
    return null;
  }
  
  const TiendaFisica = mongoose.model('Tienda_Fisica');
  const tienda = await TiendaFisica.findById(this.reserva_info.id_tienda_reservado)
    .select('nombre codigo direccion.ciudad estado');
  
  return tienda;
};

// Calcular precios con descuentos e impuestos (MEJORADO)
carritoItemSchema.methods.calcularPrecios = async function(codigosDescuento = []) {
  try {
    const Libro = mongoose.model('Libro');
    const libro = await Libro.findById(this.id_libro);
    
    if (!libro) {
      throw new Error('Libro no encontrado');
    }
    
    // 1. Precio base
    this.precios.precio_base = libro.precio_info?.precio_base || libro.precio;
    
    // 2. Calcular precio con descuentos (automáticos + códigos)
    let precioConDescuentos;
    if (libro.precio_info && libro.precio_info.calcularPrecioConDescuentos) {
      precioConDescuentos = libro.precio_info.calcularPrecioConDescuentos(codigosDescuento);
    } else {
      // Fallback si no tiene precio_info
      precioConDescuentos = this.precios.precio_base;
    }
    
    this.precios.precio_con_descuentos = precioConDescuentos;
    this.precios.total_descuentos = this.precios.precio_base - precioConDescuentos;
    
    // 3. Calcular precio con impuestos
    let precioConImpuestos = precioConDescuentos;
    let valorImpuesto = 0;
    
    if (libro.precio_info && libro.precio_info.impuesto) {
      const impuesto = libro.precio_info.impuesto;
      const porcentajeImpuesto = impuesto.porcentaje || 0;
      
      valorImpuesto = (precioConDescuentos * porcentajeImpuesto) / 100;
      precioConImpuestos = precioConDescuentos + valorImpuesto;
      
      // Guardar información del impuesto
      this.precios.impuesto = {
        tipo: impuesto.tipo || 'IVA',
        porcentaje: porcentajeImpuesto,
        valor_impuesto: Math.round(valorImpuesto * 100) / 100
      };
    } else {
      // Sin impuestos
      this.precios.impuesto = {
        tipo: 'ninguno',
        porcentaje: 0,
        valor_impuesto: 0
      };
    }
    
    this.precios.precio_con_impuestos = Math.round(precioConImpuestos * 100) / 100;
    
    // 4. Registrar códigos aplicados
    this.codigos_aplicados = [];
    if (libro.precio_info && libro.precio_info.descuentos) {
      const descuentosActivos = libro.precio_info.obtenerDescuentosActivos();
      
      for (const descuento of descuentosActivos) {
        if (descuento.codigo_promocion && codigosDescuento.includes(descuento.codigo_promocion)) {
          let valorDescuento = 0;
          
          if (descuento.tipo === 'porcentaje') {
            valorDescuento = (this.precios.precio_base * descuento.valor) / 100;
          } else if (descuento.tipo === 'valor_fijo') {
            valorDescuento = Math.min(descuento.valor, this.precios.precio_base);
          }
          
          this.codigos_aplicados.push({
            codigo: descuento.codigo_promocion,
            descuento_aplicado: Math.round(valorDescuento * 100) / 100,
            tipo_descuento: descuento.tipo
          });
        }
      }
    }
    
    // 5. Actualizar subtotal
    this.subtotal = this.precios.precio_con_impuestos * this.cantidad;
    
    return this.save();
  } catch (error) {
    throw new Error(`Error calculando precios: ${error.message}`);
  }
};

// NUEVO: Actualizar información de tiendas disponibles
carritoItemSchema.methods.actualizarTiendasDisponibles = async function(latitud = null, longitud = null) {
  try {
    const TiendaFisica = mongoose.model('Tienda_Fisica');
    const Inventario = mongoose.model('Inventario');
    
    // Buscar inventarios que tengan este libro disponible
    const inventarios = await Inventario.find({
      id_libro: this.id_libro,
      stock_disponible: { $gte: this.cantidad },
      estado: 'disponible'
    }).populate('id_tienda', 'nombre estado direccion coordenadas');
    
    const tiendasDisponibles = [];
    
    for (const inventario of inventarios) {
      if (inventario.id_tienda && inventario.id_tienda.estado === 'activa') {
        const tiendaInfo = {
          id_tienda: inventario.id_tienda._id,
          nombre_tienda: inventario.id_tienda.nombre,
          stock_disponible: inventario.stock_disponible
        };
        
        // Calcular distancia si se proporcionan coordenadas
        if (latitud && longitud && inventario.id_tienda.coordenadas) {
          const distancia = this._calcularDistancia(
            latitud, 
            longitud,
            inventario.id_tienda.coordenadas.latitud,
            inventario.id_tienda.coordenadas.longitud
          );
          tiendaInfo.distancia_km = Math.round(distancia * 100) / 100;
        }
        
        tiendasDisponibles.push(tiendaInfo);
      }
    }
    
    // Ordenar por distancia si está disponible, sino por stock
    if (tiendasDisponibles.some(t => t.distancia_km !== undefined)) {
      tiendasDisponibles.sort((a, b) => (a.distancia_km || 999) - (b.distancia_km || 999));
    } else {
      tiendasDisponibles.sort((a, b) => b.stock_disponible - a.stock_disponible);
    }
    
    // Actualizar metadatos
    this.metadatos.tiendas_disponibles = tiendasDisponibles;
    if (tiendasDisponibles.length > 0) {
      this.metadatos.mejor_tienda_disponible = tiendasDisponibles[0].id_tienda;
    }
    
    return this.save();
  } catch (error) {
    console.error('Error actualizando tiendas disponibles:', error);
  }
};

// Método auxiliar para calcular distancia
carritoItemSchema.methods._calcularDistancia = function(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distancia = R * c;
  
  return distancia;
};

// Verificar y actualizar precio (MEJORADO)
carritoItemSchema.methods.verificarPrecio = async function() {
  try {
    const Libro = mongoose.model('Libro');
    const libro = await Libro.findById(this.id_libro);
    
    if (!libro) {
      this.estado = 'removido';
      this.mensaje_precio = 'El libro ya no está disponible';
      return this.save();
    }
    
    // Actualizar metadatos
    this.metadatos.titulo_libro = libro.titulo;
    this.metadatos.autor_libro = libro.autor_nombre_completo;
    this.metadatos.disponible = libro.stock > 0;
    
    const precioBaseActual = libro.precio_info?.precio_base || libro.precio;
    
    // Verificar si el precio base cambió
    if (precioBaseActual !== this.precios.precio_base) {
      this.precio_cambiado = true;
      this.estado = 'precio_cambiado';
      
      if (precioBaseActual > this.precios.precio_base) {
        this.mensaje_precio = `El precio subió de $${this.precios.precio_base.toLocaleString()} a $${precioBaseActual.toLocaleString()}`;
      } else {
        this.mensaje_precio = `El precio bajó de $${this.precios.precio_base.toLocaleString()} a $${precioBaseActual.toLocaleString()}`;
      }
    }
    
    // Verificar stock disponible en tiendas
    const Inventario = mongoose.model('Inventario');
    const stockTotal = await Inventario.aggregate([
      { $match: { id_libro: this.id_libro, estado: 'disponible' } },
      { $group: { _id: null, total_disponible: { $sum: '$stock_disponible' } } }
    ]);
    
    const stockDisponible = stockTotal.length > 0 ? stockTotal[0].total_disponible : 0;
    
    if (stockDisponible < this.cantidad) {
      this.estado = 'sin_stock';
      this.mensaje_precio = `Stock insuficiente. Disponible: ${stockDisponible}`;
    }
    
    return this.save();
  } catch (error) {
    throw new Error(`Error verificando precio: ${error.message}`);
  }
};

// Confirmar cambio de precio
carritoItemSchema.methods.confirmarCambioPrecio = async function() {
  // Recalcular con el nuevo precio
  const codigosActuales = this.codigos_aplicados.map(c => c.codigo);
  await this.calcularPrecios(codigosActuales);
  
  this.precio_cambiado = false;
  this.estado = 'activo';
  this.mensaje_precio = '';
  
  return this.save();
};

// MÉTODOS ESTÁTICOS

// Obtener todos los items de un carrito (MEJORADO)
carritoItemSchema.statics.obtenerItemsCarrito = function(idCarrito) {
  return this.find({ id_carrito: idCarrito })
    .populate('id_libro', 'titulo autor_nombre_completo ISBN precio stock imagenes estado precio_info')
    .populate('reserva_info.id_tienda_reservado', 'nombre codigo direccion.ciudad')
    .sort({ fecha_agregado: -1 });
};

// Verificar si un libro ya está en el carrito
carritoItemSchema.statics.libroEnCarrito = async function(idCarrito, idLibro) {
  const item = await this.findOne({ id_carrito: idCarrito, id_libro: idLibro });
  return item;
};

// NUEVO: Obtener items con reservas expiradas
carritoItemSchema.statics.obtenerReservasExpiradas = function(tiempoExpiracionMinutos = 30) {
  const fechaLimite = new Date();
  fechaLimite.setMinutes(fechaLimite.getMinutes() - tiempoExpiracionMinutos);
  
  return this.find({
    'reserva_info.estado_reserva': 'RESERVADO',
    'reserva_info.fecha_reserva': { $lt: fechaLimite }
  }).populate('id_carrito', 'id_usuario ultima_actualizacion');
};

// NUEVO: Limpiar reservas expiradas
carritoItemSchema.statics.limpiarReservasExpiradas = async function(tiempoExpiracionMinutos = 30) {
  const itemsExpirados = await this.obtenerReservasExpiradas(tiempoExpiracionMinutos);
  let reservasLiberadas = 0;
  
  for (const item of itemsExpirados) {
    await item.liberarReserva('Reserva expirada por tiempo');
    item.estado = 'reserva_expirada';
    await item.save();
    reservasLiberadas++;
  }
  
  return {
    reservas_liberadas: reservasLiberadas,
    items_procesados: itemsExpirados.length
  };
};

// Obtener estadísticas de items con estructura de precios detallada (MEJORADO)
carritoItemSchema.statics.obtenerEstadisticasItems = async function(idCarrito) {
  try {
    // Asegurar que idCarrito es un ObjectId válido
    let carritoObjectId;
    if (mongoose.Types.ObjectId.isValid(idCarrito)) {
      carritoObjectId = new mongoose.Types.ObjectId(idCarrito);
    } else {
      throw new Error('ID de carrito inválido');
    }
    
    const stats = await this.aggregate([
      { $match: { id_carrito: carritoObjectId } },
      {
        $group: {
          _id: null,
          total_items: { $sum: '$cantidad' },
          subtotal_sin_descuentos: { $sum: { $multiply: ['$precios.precio_base', '$cantidad'] } },
          total_descuentos: { $sum: { $multiply: ['$precios.total_descuentos', '$cantidad'] } },
          subtotal_sin_impuestos: { $sum: { $multiply: ['$precios.precio_con_descuentos', '$cantidad'] } },
          total_impuestos: { $sum: { $multiply: ['$precios.impuesto.valor_impuesto', '$cantidad'] } },
          total_final: { $sum: '$subtotal' },
          items_con_precio_cambiado: {
            $sum: { $cond: ['$precio_cambiado', 1, 0] }
          },
          items_sin_stock: {
            $sum: { $cond: [{ $eq: ['$estado', 'sin_stock'] }, 1, 0] }
          },
          items_reservados: {
            $sum: { $cond: [{ $eq: ['$reserva_info.estado_reserva', 'RESERVADO'] }, 1, 0] }
          },
          items_con_reserva_expirada: {
            $sum: { $cond: [{ $eq: ['$estado', 'reserva_expirada'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const resultado = stats.length > 0 ? stats[0] : {
      total_items: 0,
      subtotal_sin_descuentos: 0,
      total_descuentos: 0,
      subtotal_sin_impuestos: 0,
      total_impuestos: 0,
      total_final: 0,
      items_con_precio_cambiado: 0,
      items_sin_stock: 0,
      items_reservados: 0,
      items_con_reserva_expirada: 0
    };
    
    return resultado;
  } catch (error) {
    console.error('Error en obtenerEstadisticasItems:', error);
    throw error;
  }
};

const CarritoItem = mongoose.model('Carrito_Items', carritoItemSchema);

module.exports = CarritoItem;