// Database/models/inventarioModel.js (CORREGIDO)
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const inventarioSchema = new Schema({
  // Identificador único del registro de inventario
  id_inventario: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true,
    index: true
  },
  
  // Referencia al libro asociado
  id_libro: {
    type: Schema.Types.ObjectId,
    ref: 'Libro',
    required: true,
    index: true
  },
  
  // Referencia a la tienda física donde está el inventario
  id_tienda: {
    type: Schema.Types.ObjectId,
    ref: 'Tienda_Fisica',
    required: true,
    index: true
  },
  
  // Estado actual del inventario
  estado: {
    type: String,
    enum: ['disponible', 'agotado', 'baja_existencia', 'historico_agotado'],
    default: 'disponible',
    index: true
  },
  
  // Contadores de stock
  stock_total: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  stock_disponible: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(v) {
        return v <= this.stock_total;
      },
      message: 'Stock disponible no puede ser mayor que stock total'
    }
  },
  
  stock_reservado: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(v) {
        return v <= this.stock_total;
      },
      message: 'Stock reservado no puede ser mayor que stock total'
    }
  },
  
  // Umbral para alertas de bajo stock
  umbral_alerta: {
    type: Number,
    default: 5,
    min: 1
  },
  
  // Registro de movimientos de inventario
  movimientos: [{
    tipo: {
      type: String,
      enum: ['entrada', 'salida', 'reserva', 'liberacion_reserva', 'ajuste', 'baja', 'transferencia'],
      required: true
    },
    cantidad: {
      type: Number,
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    id_usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    motivo: {
      type: String,
      enum: ['compra', 'venta', 'devolucion', 'perdida', 'daño', 'inventario_inicial', 'ajuste_auditoria', 'reserva', 'expiracion_reserva', 'baja', 'transferencia']
    },
    id_transaccion: {
      type: Schema.Types.ObjectId,
      ref: 'Transaccion'
    },
    id_reserva: {
      type: Schema.Types.ObjectId, // ID del carrito para reservas
      ref: 'Carrito'
    },
    notas: String,
    // Nuevos campos para mejor tracking
    stock_anterior: {
      total: Number,
      disponible: Number,
      reservado: Number
    },
    stock_posterior: {
      total: Number,
      disponible: Number,
      reservado: Number
    }
  }],
  
  // Historial de cambios de estado
  historial_estados: [{
    estado_anterior: {
      type: String,
      enum: ['disponible', 'agotado', 'baja_existencia', 'historico_agotado']
    },
    estado_nuevo: {
      type: String,
      enum: ['disponible', 'agotado', 'baja_existencia', 'historico_agotado'],
      required: true
    },
    fecha_cambio: {
      type: Date,
      default: Date.now
    },
    razon: String,
    id_usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    }
  }],
  
  // Última fecha de auditoría física
  ultima_auditoria: {
    fecha: Date,
    id_usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    resultados: {
      stock_sistema: Number,
      stock_fisico: Number,
      diferencia: Number,
      ajustado: Boolean
    }
  },
  
  // Metadatos
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  ultima_actualizacion: {
    type: Date,
    default: Date.now
  }
});

// ÍNDICES
inventarioSchema.index({ id_libro: 1, id_tienda: 1 }, { unique: true });
inventarioSchema.index({ id_libro: 1, estado: 1 });
inventarioSchema.index({ id_tienda: 1, estado: 1 });
inventarioSchema.index({ stock_disponible: 1 });
inventarioSchema.index({ 'movimientos.fecha': 1 });
inventarioSchema.index({ 'movimientos.id_reserva': 1 });

// PRE-SAVE MIDDLEWARE
inventarioSchema.pre('save', function(next) {
  this.ultima_actualizacion = new Date();
  
  // VALIDAR CONSISTENCIA DE STOCK
  if (this.stock_disponible + this.stock_reservado > this.stock_total) {
    return next(new Error('La suma de stock disponible y reservado no puede exceder el stock total'));
  }
  
  // Actualizar estado basado en niveles de stock
  const estadoAnterior = this.estado;
  
  if (this.stock_total === 0) {
    this.estado = 'agotado';
  } else if (this.stock_disponible === 0 && this.stock_reservado > 0) {
    // Si solo hay stock reservado, considerarlo como disponible pero con alerta
    this.estado = 'baja_existencia';
  } else if (this.stock_disponible <= this.umbral_alerta && this.stock_disponible > 0) {
    this.estado = 'baja_existencia';
  } else if (this.stock_disponible > this.umbral_alerta) {
    this.estado = 'disponible';
  } else {
    this.estado = 'agotado';
  }
  
  // Registrar cambio de estado si es diferente
  if (estadoAnterior && this.estado !== estadoAnterior) {
    this.historial_estados.push({
      estado_anterior: estadoAnterior,
      estado_nuevo: this.estado,
      fecha_cambio: new Date(),
      razon: 'Cambio automático por movimiento de stock'
    });
  }
  
  next();
});

// MÉTODOS DE INSTANCIA

// Registrar entrada de nuevos ejemplares
inventarioSchema.methods.registrarEntrada = async function(cantidad, motivo, idUsuario, notas = '') {
  if (cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero');
  }
  
  const estadoAnterior = this.estado;
  const stockAnterior = {
    total: this.stock_total,
    disponible: this.stock_disponible,
    reservado: this.stock_reservado
  };
  
  // Actualizar contadores
  this.stock_total += cantidad;
  this.stock_disponible += cantidad; // Las entradas van siempre a disponible
  
  const stockPosterior = {
    total: this.stock_total,
    disponible: this.stock_disponible,
    reservado: this.stock_reservado
  };
  
  // Registrar el movimiento
  this.movimientos.push({
    tipo: 'entrada',
    cantidad: cantidad,
    fecha: new Date(),
    id_usuario: idUsuario,
    motivo: motivo,
    notas: notas,
    stock_anterior: stockAnterior,
    stock_posterior: stockPosterior
  });
  
  console.log(`Entrada registrada: +${cantidad} | Stock total: ${this.stock_total}, Disponible: ${this.stock_disponible}, Reservado: ${this.stock_reservado}`);
  
  return this.save();
};

// Registrar salida de ejemplares (ventas, pérdidas, etc.)
inventarioSchema.methods.registrarSalida = async function(cantidad, motivo, idUsuario, idTransaccion = null, notas = '', options = {}) {
  if (cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero');
  }
  
  const stockAnterior = {
    total: this.stock_total,
    disponible: this.stock_disponible,
    reservado: this.stock_reservado
  };
  
  // LÓGICA CORREGIDA: Las ventas salen del stock reservado, no del disponible
  if (motivo === 'venta') {
    if (cantidad > this.stock_reservado) {
      throw new Error(`No hay suficiente stock reservado para la venta. Reservado: ${this.stock_reservado}, Solicitado: ${cantidad}`);
    }
    
    // Reducir del stock reservado (las ventas ya estaban reservadas)
    this.stock_reservado -= cantidad;
    this.stock_total -= cantidad;
  } else {
    // Para otros motivos (pérdidas, daños, etc.), reducir del disponible
    if (cantidad > this.stock_disponible) {
      throw new Error(`No hay suficiente stock disponible. Disponible: ${this.stock_disponible}, Solicitado: ${cantidad}`);
    }
    
    this.stock_disponible -= cantidad;
    this.stock_total -= cantidad;
  }
  
  const stockPosterior = {
    total: this.stock_total,
    disponible: this.stock_disponible,
    reservado: this.stock_reservado
  };
  
  // Registrar el movimiento
  this.movimientos.push({
    tipo: 'salida',
    cantidad: cantidad,
    fecha: new Date(),
    id_usuario: idUsuario,
    motivo: motivo,
    id_transaccion: idTransaccion,
    notas: notas,
    stock_anterior: stockAnterior,
    stock_posterior: stockPosterior
  });
  
  console.log(`Salida registrada: -${cantidad} (${motivo}) | Stock total: ${this.stock_total}, Disponible: ${this.stock_disponible}, Reservado: ${this.stock_reservado}`);

  return this.save(options);
};

// Reservar ejemplares (del disponible al reservado)
inventarioSchema.methods.reservarEjemplares = async function(cantidad, idUsuario, idReserva, notas = '') {
  if (cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero');
  }
  
  if (cantidad > this.stock_disponible) {
    throw new Error(`No hay suficiente stock disponible para reservar. Disponible: ${this.stock_disponible}, Solicitado: ${cantidad}`);
  }
  
  const stockAnterior = {
    total: this.stock_total,
    disponible: this.stock_disponible,
    reservado: this.stock_reservado
  };
  
  // Mover del disponible al reservado
  this.stock_disponible -= cantidad;
  this.stock_reservado += cantidad;
  // El stock_total NO cambia en las reservas
  
  const stockPosterior = {
    total: this.stock_total,
    disponible: this.stock_disponible,
    reservado: this.stock_reservado
  };
  
  // Registrar el movimiento
  this.movimientos.push({
    tipo: 'reserva',
    cantidad: cantidad,
    fecha: new Date(),
    id_usuario: idUsuario,
    motivo: 'reserva',
    id_reserva: idReserva,
    notas: notas,
    stock_anterior: stockAnterior,
    stock_posterior: stockPosterior
  });
  
  console.log(`Reserva registrada: ${cantidad} | Stock total: ${this.stock_total}, Disponible: ${this.stock_disponible}, Reservado: ${this.stock_reservado}`);
  
  return this.save();
};

// Liberar reserva de ejemplares (del reservado al disponible)
inventarioSchema.methods.liberarReserva = async function(cantidad, idUsuario, idReserva, notas = '') {
  if (cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero');
  }
  
  if (cantidad > this.stock_reservado) {
    throw new Error(`La cantidad a liberar excede el stock reservado. Reservado: ${this.stock_reservado}, Solicitado: ${cantidad}`);
  }
  
  const stockAnterior = {
    total: this.stock_total,
    disponible: this.stock_disponible,
    reservado: this.stock_reservado
  };
  
  // Mover del reservado al disponible
  this.stock_disponible += cantidad;
  this.stock_reservado -= cantidad;
  // El stock_total NO cambia en las liberaciones
  
  const stockPosterior = {
    total: this.stock_total,
    disponible: this.stock_disponible,
    reservado: this.stock_reservado
  };
  
  // Registrar el movimiento
  this.movimientos.push({
    tipo: 'liberacion_reserva',
    cantidad: cantidad,
    fecha: new Date(),
    id_usuario: idUsuario,
    motivo: 'expiracion_reserva',
    id_reserva: idReserva,
    notas: notas,
    stock_anterior: stockAnterior,
    stock_posterior: stockPosterior
  });
  
  console.log(`Reserva liberada: ${cantidad} | Stock total: ${this.stock_total}, Disponible: ${this.stock_disponible}, Reservado: ${this.stock_reservado}`);
  
  return this.save();
};

// Obtener cantidad reservada para una reserva específica (carrito)
inventarioSchema.methods.obtenerCantidadReservada = function(idReserva) {
  let cantidadReservada = 0;
  
  for (const movimiento of this.movimientos) {
    if (movimiento.id_reserva && movimiento.id_reserva.equals(idReserva)) {
      if (movimiento.tipo === 'reserva') {
        cantidadReservada += movimiento.cantidad;
      } else if (movimiento.tipo === 'liberacion_reserva') {
        cantidadReservada -= movimiento.cantidad;
      }
    }
  }
  
  return Math.max(0, cantidadReservada);
};

// Validar consistencia del stock
inventarioSchema.methods.validarConsistencia = function() {
  const errores = [];
  
  if (this.stock_total < 0) {
    errores.push('Stock total no puede ser negativo');
  }
  
  if (this.stock_disponible < 0) {
    errores.push('Stock disponible no puede ser negativo');
  }
  
  if (this.stock_reservado < 0) {
    errores.push('Stock reservado no puede ser negativo');
  }
  
  if (this.stock_disponible + this.stock_reservado !== this.stock_total) {
    errores.push(`Inconsistencia: Disponible (${this.stock_disponible}) + Reservado (${this.stock_reservado}) ≠ Total (${this.stock_total})`);
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
};

// Marcar como histórico agotado
inventarioSchema.methods.marcarComoHistoricoAgotado = async function(idUsuario, razon = '') {
  if (this.estado !== 'agotado') {
    throw new Error('Solo se pueden marcar como histórico los libros agotados');
  }
  
  const estadoAnterior = this.estado;
  this.estado = 'historico_agotado';
  
  // Registrar el cambio de estado
  this.historial_estados.push({
    estado_anterior: estadoAnterior,
    estado_nuevo: 'historico_agotado',
    fecha_cambio: new Date(),
    razon: razon || 'Marcado como histórico agotado',
    id_usuario: idUsuario
  });
  
  // Actualizar también el estado en el modelo de Libro
  await mongoose.model('Libro').findByIdAndUpdate(
    this.id_libro,
    { categoria_historico: true }
  );
  
  return this.save();
};

// Realizar auditoría de inventario
inventarioSchema.methods.registrarAuditoria = async function(stockFisico, idUsuario, ajustarAutomaticamente = false) {
  const diferencia = stockFisico - this.stock_total;
  
  this.ultima_auditoria = {
    fecha: new Date(),
    id_usuario: idUsuario,
    resultados: {
      stock_sistema: this.stock_total,
      stock_fisico: stockFisico,
      diferencia: diferencia,
      ajustado: ajustarAutomaticamente
    }
  };
  
  // Si se debe ajustar automáticamente
  if (ajustarAutomaticamente && diferencia !== 0) {
    const stockAnterior = {
      total: this.stock_total,
      disponible: this.stock_disponible,
      reservado: this.stock_reservado
    };
    
    // Ajustar stock (la diferencia va al disponible)
    this.stock_total = stockFisico;
    this.stock_disponible = Math.max(0, this.stock_disponible + diferencia);
    
    const stockPosterior = {
      total: this.stock_total,
      disponible: this.stock_disponible,
      reservado: this.stock_reservado
    };
    
    // Registrar el movimiento
    this.movimientos.push({
      tipo: 'ajuste',
      cantidad: Math.abs(diferencia),
      fecha: new Date(),
      id_usuario: idUsuario,
      motivo: 'ajuste_auditoria',
      notas: `Ajuste por auditoría. Diferencia: ${diferencia}`,
      stock_anterior: stockAnterior,
      stock_posterior: stockPosterior
    });
  }
  
  return this.save();
};

// MÉTODOS ESTÁTICOS
//Validar y procesar devolución de stock
inventarioSchema.statics.procesarDevolucionStock = async function(datosDevolucion, session = null) {
  try {
    const {
      id_libro,
      cantidad,
      id_usuario_admin,
      codigo_devolucion,
      preferencia_tienda = null
    } = datosDevolucion;
    
    console.log(`Procesando devolución de stock: ${cantidad} unidades del libro ${id_libro}`);
    
    // 1. Buscar el mejor inventario para recibir la devolución
    let inventario = null;
    
    // Prioridad 1: Tienda preferida (si se especifica)
    if (preferencia_tienda) {
      inventario = await this.findOne({
        id_libro: id_libro,
        id_tienda: preferencia_tienda,
        estado: { $in: ['disponible', 'baja_existencia'] }
      }).session(session);
    }
    
    // Prioridad 2: Tienda principal
    if (!inventario) {
      const TiendaFisica = require('./tiendaFisicaModel');
      const tiendaPrincipal = await TiendaFisica.findOne({ 
        estado: 'activa',
        es_principal: true 
      }).session(session);
      
      if (tiendaPrincipal) {
        inventario = await this.findOne({
          id_libro: id_libro,
          id_tienda: tiendaPrincipal._id
        }).session(session);
        
        // Si no existe inventario en tienda principal, crearlo
        if (!inventario) {
          inventario = new this({
            id_libro: id_libro,
            id_tienda: tiendaPrincipal._id,
            stock_total: 0,
            stock_disponible: 0,
            stock_reservado: 0
          });
        }
      }
    }
    
    // Prioridad 3: Cualquier tienda activa con mayor capacidad
    if (!inventario) {
      const inventarios = await this.find({
        id_libro: id_libro,
        estado: { $in: ['disponible', 'baja_existencia'] }
      })
      .populate('id_tienda', 'estado capacidad_maxima')
      .session(session);
      
      // Filtrar solo tiendas activas y ordenar por capacidad disponible
      const inventariosActivos = inventarios
        .filter(inv => inv.id_tienda.estado === 'activa')
        .sort((a, b) => a.stock_total - b.stock_total); // Menor stock = más capacidad disponible
      
      inventario = inventariosActivos[0];
    }
    
    // Prioridad 4: Crear inventario en primera tienda activa disponible
    if (!inventario) {
      const TiendaFisica = require('./tiendaFisicaModel');
      const tiendaActiva = await TiendaFisica.findOne({ 
        estado: 'activa' 
      }).session(session);
      
      if (!tiendaActiva) {
        throw new Error('No hay tiendas activas disponibles para procesar la devolución');
      }
      
      inventario = new this({
        id_libro: id_libro,
        id_tienda: tiendaActiva._id,
        stock_total: 0,
        stock_disponible: 0,
        stock_reservado: 0
      });
    }
    
    // 2. Procesar la entrada de stock
    await inventario.registrarEntrada(
      cantidad,
      'devolucion',
      id_usuario_admin,
      `Devolución procesada - Código: ${codigo_devolucion}`
    );
    
    console.log(`✅ Stock devuelto exitosamente a tienda ${inventario.id_tienda}: ${cantidad} unidades`);
    
    return {
      exito: true,
      inventario_actualizado: inventario,
      tienda_destino: inventario.id_tienda,
      stock_anterior: inventario.stock_total - cantidad,
      stock_nuevo: inventario.stock_total
    };
    
  } catch (error) {
    console.error('Error procesando devolución de stock:', error);
    throw new Error(`Error en devolución de stock: ${error.message}`);
  }
};

//Obtener reporte de devoluciones por tienda
inventarioSchema.statics.obtenerReporteDevolucionesPorTienda = async function(fechaInicio, fechaFin, idTienda = null) {
  try {
    const match = {
      'movimientos.tipo': 'entrada',
      'movimientos.motivo': 'devolucion',
      'movimientos.fecha': {
        $gte: fechaInicio,
        $lte: fechaFin
      }
    };
    
    if (idTienda) {
      match.id_tienda = new mongoose.Types.ObjectId(idTienda);
    }
    
    const reporte = await this.aggregate([
      { $match: match },
      { $unwind: '$movimientos' },
      {
        $match: {
          'movimientos.tipo': 'entrada',
          'movimientos.motivo': 'devolucion',
          'movimientos.fecha': {
            $gte: fechaInicio,
            $lte: fechaFin
          }
        }
      },
      {
        $lookup: {
          from: 'libros',
          localField: 'id_libro',
          foreignField: '_id',
          as: 'libro_info'
        }
      },
      {
        $lookup: {
          from: 'tienda_fisicas',
          localField: 'id_tienda',
          foreignField: '_id',
          as: 'tienda_info'
        }
      },
      {
        $group: {
          _id: {
            tienda: '$id_tienda',
            libro: '$id_libro'
          },
          tienda_nombre: { $first: { $arrayElemAt: ['$tienda_info.nombre', 0] } },
          libro_titulo: { $first: { $arrayElemAt: ['$libro_info.titulo', 0] } },
          total_unidades_devueltas: { $sum: '$movimientos.cantidad' },
          cantidad_devoluciones: { $sum: 1 },
          fechas_devoluciones: { $push: '$movimientos.fecha' }
        }
      },
      {
        $group: {
          _id: '$_id.tienda',
          tienda_nombre: { $first: '$tienda_nombre' },
          total_unidades: { $sum: '$total_unidades_devueltas' },
          total_devoluciones: { $sum: '$cantidad_devoluciones' },
          libros_devueltos: {
            $push: {
              libro_titulo: '$libro_titulo',
              unidades: '$total_unidades_devueltas',
              devoluciones: '$cantidad_devoluciones'
            }
          }
        }
      },
      { $sort: { total_unidades: -1 } }
    ]);
    
    return reporte;
    
  } catch (error) {
    console.error('Error generando reporte de devoluciones por tienda:', error);
    throw error;
  }
};

// Obtener libros con bajo stock
inventarioSchema.statics.obtenerBajoStock = function(idTienda = null, limite = 20) {
  const query = { 
    estado: 'baja_existencia',
    stock_total: { $gt: 0 } 
  };
  
  if (idTienda) {
    query.id_tienda = idTienda;
  }
  
  return this.find(query)
    .sort({ stock_disponible: 1 })
    .limit(limite)
    .populate('id_libro', 'titulo autor editorial ISBN')
    .populate('id_tienda', 'nombre codigo ciudad');
};

// Obtener libros agotados
inventarioSchema.statics.obtenerAgotados = function(idTienda = null, limite = 20) {
  const query = { 
    estado: 'agotado'
  };
  
  if (idTienda) {
    query.id_tienda = idTienda;
  }
  
  return this.find(query)
    .sort({ ultima_actualizacion: -1 })
    .limit(limite)
    .populate('id_libro', 'titulo autor editorial ISBN')
    .populate('id_tienda', 'nombre codigo ciudad');
};

// Obtener historial de movimientos para un libro
inventarioSchema.statics.obtenerHistorialLibro = function(idLibro, desde, hasta, tipoMovimiento = null, idTienda = null) {
  const query = { id_libro: idLibro };
  
  if (idTienda) {
    query.id_tienda = idTienda;
  }
  
  const pipeline = [
    { $match: query },
    { $unwind: '$movimientos' }
  ];
  
  // Filtrar por fechas
  if (desde || hasta) {
    const dateMatch = {};
    if (desde) dateMatch.$gte = desde;
    if (hasta) dateMatch.$lte = hasta;
    pipeline.push({ $match: { 'movimientos.fecha': dateMatch } });
  }
  
  // Filtrar por tipo de movimiento
  if (tipoMovimiento) {
    pipeline.push({ $match: { 'movimientos.tipo': tipoMovimiento } });
  }
  
  pipeline.push({ $sort: { 'movimientos.fecha': -1 } });
  
  return this.aggregate(pipeline);
};

// Obtener inventario consolidado por libro (suma de todas las tiendas)
inventarioSchema.statics.obtenerInventarioConsolidado = function(idLibro = null) {
  const pipeline = [];
  
  if (idLibro) {
    pipeline.push({ $match: { id_libro: new mongoose.Types.ObjectId(idLibro) } });
  }
  
  pipeline.push(
    {
      $group: {
        _id: '$id_libro',
        stock_total_consolidado: { $sum: '$stock_total' },
        stock_disponible_consolidado: { $sum: '$stock_disponible' },
        stock_reservado_consolidado: { $sum: '$stock_reservado' },
        tiendas_con_stock: { $sum: { $cond: [{ $gt: ['$stock_total', 0] }, 1, 0] } },
        tiendas_disponibles: { $sum: { $cond: [{ $gt: ['$stock_disponible', 0] }, 1, 0] } }
      }
    },
    {
      $lookup: {
        from: 'libros',
        localField: '_id',
        foreignField: '_id',
        as: 'libro'
      }
    },
    { $unwind: '$libro' }
  );
  
  return this.aggregate(pipeline);
};

// Verificar consistencia de todos los inventarios
inventarioSchema.statics.verificarConsistenciaGeneral = async function() {
  const inventarios = await this.find({});
  const inconsistencias = [];
  
  for (const inventario of inventarios) {
    const validacion = inventario.validarConsistencia();
    if (!validacion.valido) {
      inconsistencias.push({
        id_inventario: inventario._id,
        id_libro: inventario.id_libro,
        id_tienda: inventario.id_tienda,
        errores: validacion.errores
      });
    }
  }
  
  return {
    total_inventarios: inventarios.length,
    inconsistencias: inconsistencias.length,
    detalles: inconsistencias
  };
};

// Limpiar reservas expiradas (por ejemplo, carritos abandonados)
inventarioSchema.statics.limpiarReservasExpiradas = async function(tiempoExpiracionMinutos = 30) {
  const fechaLimite = new Date();
  fechaLimite.setMinutes(fechaLimite.getMinutes() - tiempoExpiracionMinutos);
  
  const inventarios = await this.find({
    stock_reservado: { $gt: 0 },
    'movimientos': {
      $elemMatch: {
        tipo: 'reserva',
        fecha: { $lt: fechaLimite }
      }
    }
  });
  
  let reservasLiberadas = 0;
  
  for (const inventario of inventarios) {
    // Buscar reservas expiradas que no hayan sido liberadas
    const reservasExpiradas = inventario.movimientos.filter(mov => 
      mov.tipo === 'reserva' && 
      mov.fecha < fechaLimite &&
      inventario.obtenerCantidadReservada(mov.id_reserva) > 0
    );
    
    for (const reserva of reservasExpiradas) {
      const cantidadReservada = inventario.obtenerCantidadReservada(reserva.id_reserva);
      if (cantidadReservada > 0) {
        await inventario.liberarReserva(
          cantidadReservada,
          null,
          reserva.id_reserva,
          'Liberación automática por expiración de tiempo'
        );
        reservasLiberadas++;
      }
    }
  }
  
  return {
    inventarios_procesados: inventarios.length,
    reservas_liberadas: reservasLiberadas,
    fecha_limite: fechaLimite
  };
};

const Inventario = mongoose.model('Inventario', inventarioSchema);

module.exports = Inventario;