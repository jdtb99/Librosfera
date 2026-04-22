// src/controllers/tiendaController.js
const tiendaService = require('../../Database/services/tiendaService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// ==========================================
// CONTROLADORES PÚBLICOS (PARA CLIENTES)
// ==========================================

/**
 * @desc    Obtener todas las tiendas activas (para clientes)
 * @route   GET /api/v1/tiendas
 * @access  Public
 */
const obtenerTiendasPublicas = catchAsync(async (req, res, next) => {
  try {
    const {
      ciudad,
      departamento,
      recogida_productos = true,
      devoluciones,
      busqueda,
      page = 1,
      limit = 20
    } = req.query;

    // Filtros para clientes (solo tiendas activas y con servicios)
    const filtros = {
      estado: 'activa'
    };

    if (ciudad) filtros.ciudad = ciudad;
    if (departamento) filtros.departamento = departamento;
    if (busqueda) filtros.busqueda = busqueda;
    
    // Solo mostrar tiendas que ofrecen el servicio solicitado
    if (recogida_productos !== undefined) {
      filtros.recogida_productos = recogida_productos;
    }
    if (devoluciones !== undefined) {
      filtros.devoluciones = devoluciones;
    }

    const resultado = await tiendaService.listarTiendas(
      filtros, 
      parseInt(page), 
      parseInt(limit), 
      'nombre'
    );

    return res.status(200).json({
      status: 'success',
      resultados: resultado.datos.length,
      paginacion: resultado.paginacion,
      data: resultado.datos
    });
  } catch (error) {
    console.error('Error obteniendo tiendas públicas:', error);
    return next(new AppError('Error al obtener tiendas', 500));
  }
});

/**
 * @desc    Buscar tiendas cercanas por coordenadas
 * @route   GET /api/v1/tiendas/cercanas
 * @access  Public
 */
const buscarTiendasCercanas = catchAsync(async (req, res, next) => {
  try {
    const { lat, lng, radio = 10, limit = 10, servicios } = req.query;

    if (!lat || !lng) {
      return next(new AppError('Se requieren coordenadas (lat, lng)', 400));
    }

    const latitud = parseFloat(lat);
    const longitud = parseFloat(lng);
    const radioKm = parseFloat(radio);
    const limite = parseInt(limit);

    // Validar coordenadas
    if (isNaN(latitud) || isNaN(longitud)) {
      return next(new AppError('Coordenadas inválidas', 400));
    }

    if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
      return next(new AppError('Coordenadas fuera de rango', 400));
    }

    if (radioKm < 0 || radioKm > 100) {
      return next(new AppError('Radio debe estar entre 0 y 100 km', 400));
    }

    // Filtros adicionales por servicios
    const filtrosAdicionales = {};
    if (servicios) {
      const serviciosArray = servicios.split(',');
      serviciosArray.forEach(servicio => {
        if (['recogida_productos', 'devoluciones', 'eventos'].includes(servicio)) {
          filtrosAdicionales[`servicios.${servicio}`] = true;
        }
      });
    }

    const tiendasCercanas = await tiendaService.buscarTiendasCercanas(
      latitud, 
      longitud, 
      radioKm, 
      limite,
      filtrosAdicionales
    );

    return res.status(200).json({
      status: 'success',
      resultados: tiendasCercanas.length,
      coordenadas_busqueda: { latitud, longitud, radio: radioKm },
      data: tiendasCercanas
    });
  } catch (error) {
    console.error('Error buscando tiendas cercanas:', error);
    return next(new AppError('Error al buscar tiendas cercanas', 500));
  }
});

/**
 * @desc    Buscar tiendas por ciudad
 * @route   GET /api/v1/tiendas/ciudad/:ciudad
 * @access  Public
 */
const buscarTiendasPorCiudad = catchAsync(async (req, res, next) => {
  try {
    const { ciudad } = req.params;
    const { servicios } = req.query;

    if (!ciudad || ciudad.trim().length < 2) {
      return next(new AppError('Ciudad debe tener al menos 2 caracteres', 400));
    }

    // Filtros adicionales por servicios
    const filtrosAdicionales = {};
    if (servicios) {
      const serviciosArray = servicios.split(',');
      serviciosArray.forEach(servicio => {
        if (['recogida_productos', 'devoluciones', 'eventos'].includes(servicio)) {
          filtrosAdicionales[`servicios.${servicio}`] = true;
        }
      });
    }

    const tiendas = await tiendaService.buscarTiendasPorCiudad(ciudad, filtrosAdicionales);

    return res.status(200).json({
      status: 'success',
      resultados: tiendas.length,
      ciudad: ciudad,
      data: tiendas
    });
  } catch (error) {
    console.error('Error buscando tiendas por ciudad:', error);
    return next(new AppError('Error al buscar tiendas por ciudad', 500));
  }
});

/**
 * @desc    Verificar disponibilidad de libro en tiendas
 * @route   GET /api/v1/tiendas/disponibilidad/:idLibro
 * @access  Public
 */
const verificarDisponibilidadLibro = catchAsync(async (req, res, next) => {
  try {
    const { idLibro } = req.params;
    const { cantidad = 1, lat, lng, radio = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(idLibro)) {
      return next(new AppError('ID de libro inválido', 400));
    }

    const cantidadNum = parseInt(cantidad);
    if (isNaN(cantidadNum) || cantidadNum < 1 || cantidadNum > 10) {
      return next(new AppError('Cantidad debe estar entre 1 y 10', 400));
    }

    let latitud = null;
    let longitud = null;
    let radioKm = parseFloat(radio);

    // Si se proporcionan coordenadas, validarlas
    if (lat && lng) {
      latitud = parseFloat(lat);
      longitud = parseFloat(lng);
      
      if (isNaN(latitud) || isNaN(longitud)) {
        return next(new AppError('Coordenadas inválidas', 400));
      }

      if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
        return next(new AppError('Coordenadas fuera de rango', 400));
      }
    }

    const disponibilidad = await tiendaService.verificarDisponibilidadEnTiendas(
      idLibro,
      cantidadNum,
      latitud,
      longitud,
      radioKm
    );

    return res.status(200).json({
      status: 'success',
      libro_id: idLibro,
      cantidad_solicitada: cantidadNum,
      tiendas_disponibles: disponibilidad.length,
      radio_busqueda_km: latitud && longitud ? radioKm : null,
      data: disponibilidad
    });
  } catch (error) {
    console.error('Error verificando disponibilidad:', error);
    return next(new AppError('Error al verificar disponibilidad', 500));
  }
});

/**
 * @desc    Obtener detalles de una tienda específica
 * @route   GET /api/v1/tiendas/:id
 * @access  Public
 */
const obtenerDetalleTienda = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { incluir_estadisticas } = req.query;

    const tienda = await tiendaService.obtenerTiendaPorId(
      id, 
      incluir_estadisticas === 'true'
    );

    // Solo mostrar tiendas activas a clientes públicos
    if (tienda.estado !== 'activa') {
      return next(new AppError('Tienda no disponible', 404));
    }

    // Limpiar información sensible para clientes
    const tiendaPublica = {
      ...tienda,
      // Remover información administrativa
      notas_internas: undefined,
      configuracion_notificaciones: undefined,
      fecha_ultima_auditoria: undefined
    };

    return res.status(200).json({
      status: 'success',
      data: tiendaPublica
    });
  } catch (error) {
    console.error('Error obteniendo detalle de tienda:', error);
    if (error.message === 'Tienda no encontrada') {
      return next(new AppError('Tienda no encontrada', 404));
    }
    return next(new AppError('Error al obtener tienda', 500));
  }
});

/**
 * @desc    Verificar código de recogida
 * @route   GET /api/v1/tiendas/recogida/:codigo
 * @access  Public
 */
const verificarCodigoRecogida = catchAsync(async (req, res, next) => {
  try {
    const { codigo } = req.params;

    if (!codigo || codigo.length < 5) {
      return next(new AppError('Código de recogida inválido', 400));
    }

    const recogida = await tiendaService.buscarRecogidaPorCodigo(codigo);

    return res.status(200).json({
      status: 'success',
      data: recogida
    });
  } catch (error) {
    console.error('Error verificando código de recogida:', error);
    if (error.message === 'Código de recogida no válido') {
      return next(new AppError('Código de recogida no válido', 404));
    }
    return next(new AppError('Error al verificar código', 500));
  }
});

// ==========================================
// CONTROLADORES ADMINISTRATIVOS
// ==========================================

/**
 * @desc    Crear nueva tienda
 * @route   POST /api/v1/tiendas/admin
 * @access  Private/Admin
 */
const crearTienda = catchAsync(async (req, res, next) => {
  try {
    // Validar datos obligatorios
    const {
      nombre,
      codigo,
      direccion,
      coordenadas,
      telefono_principal,
      email,
      responsable
    } = req.body;

    // Validaciones básicas
    if (!nombre || nombre.trim().length < 3) {
      return next(new AppError('El nombre debe tener al menos 3 caracteres', 400));
    }

    if (!codigo || codigo.trim().length < 2) {
      return next(new AppError('El código debe tener al menos 2 caracteres', 400));
    }

    if (!direccion || !direccion.direccion_completa || !direccion.ciudad || !direccion.departamento) {
      return next(new AppError('La dirección debe incluir dirección completa, ciudad y departamento', 400));
    }

    if (!coordenadas || typeof coordenadas.latitud !== 'number' || typeof coordenadas.longitud !== 'number') {
      return next(new AppError('Las coordenadas (latitud y longitud) son obligatorias', 400));
    }

    if (!telefono_principal) {
      return next(new AppError('El teléfono principal es obligatorio', 400));
    }

    if (!email) {
      return next(new AppError('El email es obligatorio', 400));
    }

    if (!responsable || !responsable.nombre || !responsable.telefono) {
      return next(new AppError('Los datos del responsable (nombre y teléfono) son obligatorios', 400));
    }

    // Establecer valores por defecto
    if (!req.body.fecha_apertura) {
      req.body.fecha_apertura = new Date();
    }

    if (!req.body.estado) {
      req.body.estado = 'activa';
    }

    const nuevaTienda = await tiendaService.crearTienda(req.body, req.user._id);

    await req.logActivity('tienda', 'crear_tienda', {
      entidad_afectada: {
        tipo: 'tienda',
        id: nuevaTienda._id,
        nombre: nuevaTienda.nombre
      },
      detalles: {
        codigo: nuevaTienda.codigo,
        ciudad: nuevaTienda.direccion?.ciudad,
        responsable: nuevaTienda.responsable?.nombre
      },
      nivel_importancia: 'alto'
    });

    return res.status(201).json({
      status: 'success',
      message: 'Tienda creada exitosamente',
      data: nuevaTienda
    });
  } catch (error) {
    console.error('Error creando tienda:', error);
    return next(new AppError(`Error al crear tienda: ${error.message}`, 400));
  }
});

/**
 * @desc    Listar todas las tiendas (admin)
 * @route   GET /api/v1/tiendas/admin
 * @access  Private/Admin
 */
const listarTiendasAdmin = catchAsync(async (req, res, next) => {
  try {
    const {
      estado,
      ciudad,
      departamento,
      nombre,
      codigo,
      recogida_productos,
      devoluciones,
      busqueda,
      page = 1,
      limit = 20,
      ordenar = 'nombre'
    } = req.query;

    const filtros = {
      estado,
      ciudad,
      departamento,
      nombre,
      codigo,
      recogida_productos,
      devoluciones,
      busqueda
    };

    // Limpiar filtros undefined
    Object.keys(filtros).forEach(key => 
      filtros[key] === undefined && delete filtros[key]
    );

    const resultado = await tiendaService.listarTiendas(
      filtros, 
      parseInt(page), 
      parseInt(limit),
      ordenar
    );

    return res.status(200).json({
      status: 'success',
      resultados: resultado.datos.length,
      paginacion: resultado.paginacion,
      filtros_aplicados: filtros,
      data: resultado.datos
    });
  } catch (error) {
    console.error('Error listando tiendas (admin):', error);
    return next(new AppError('Error al listar tiendas', 500));
  }
});

/**
 * @desc    Obtener tienda por ID (admin)
 * @route   GET /api/v1/tiendas/admin/:id
 * @access  Private/Admin
 */
const obtenerTiendaAdmin = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { incluir_estadisticas = 'true' } = req.query;

    const tienda = await tiendaService.obtenerTiendaPorId(
      id, 
      incluir_estadisticas === 'true'
    );

    return res.status(200).json({
      status: 'success',
      data: tienda
    });
  } catch (error) {
    console.error('Error obteniendo tienda (admin):', error);
    if (error.message === 'Tienda no encontrada') {
      return next(new AppError('Tienda no encontrada', 404));
    }
    return next(new AppError('Error al obtener tienda', 500));
  }
});

/**
 * @desc    Actualizar tienda
 * @route   PUT /api/v1/tiendas/admin/:id
 * @access  Private/Admin
 */
const actualizarTienda = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que la tienda existe
    const tiendaExistente = await tiendaService.obtenerTiendaPorId(id);
    if (!tiendaExistente) {
      return next(new AppError('Tienda no encontrada', 404));
    }

    // Validaciones de datos si se proporcionan
    if (req.body.coordenadas) {
      const { latitud, longitud } = req.body.coordenadas;
      if (typeof latitud === 'number' && (latitud < -90 || latitud > 90)) {
        return next(new AppError('La latitud debe estar entre -90 y 90', 400));
      }
      if (typeof longitud === 'number' && (longitud < -180 || longitud > 180)) {
        return next(new AppError('La longitud debe estar entre -180 y 180', 400));
      }
    }

    if (req.body.email && !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(req.body.email)) {
      return next(new AppError('Formato de email inválido', 400));
    }

    const tiendaActualizada = await tiendaService.actualizarTienda(
      id, 
      req.body, 
      req.user._id
    );

    await req.logActivity('tienda', 'actualizar_tienda', {
      entidad_afectada: {
        tipo: 'tienda',
        id: tiendaActualizada._id,
        nombre: tiendaActualizada.nombre
      },
      detalles: {
        campos_actualizados: Object.keys(req.body),
        codigo: tiendaActualizada.codigo
      },
      nivel_importancia: 'medio'
    });

    return res.status(200).json({
      status: 'success',
      message: 'Tienda actualizada exitosamente',
      data: tiendaActualizada
    });
  } catch (error) {
    console.error('Error actualizando tienda:', error);
    return next(new AppError(`Error al actualizar tienda: ${error.message}`, 400));
  }
});

/**
 * @desc    Cambiar estado de tienda
 * @route   PATCH /api/v1/tiendas/admin/:id/estado
 * @access  Private/Admin
 */
const cambiarEstadoTienda = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado, motivo } = req.body;

    if (!estado) {
      return next(new AppError('El nuevo estado es obligatorio', 400));
    }

    const estadosValidos = ['activa', 'mantenimiento', 'cerrada_temporal', 'cerrada_permanente'];
    if (!estadosValidos.includes(estado)) {
      return next(new AppError(`Estado no válido. Debe ser uno de: ${estadosValidos.join(', ')}`, 400));
    }

    if (!motivo || motivo.trim().length < 5) {
      return next(new AppError('El motivo debe tener al menos 5 caracteres', 400));
    }

    const tiendaActualizada = await tiendaService.cambiarEstadoTienda(
      id,
      estado,
      motivo,
      req.user._id
    );

    await req.logActivity('tienda', 'cambiar_estado_tienda', {
      entidad_afectada: {
        tipo: 'tienda',
        id: tiendaActualizada._id,
        nombre: tiendaActualizada.nombre
      },
      detalles: {
        estado_anterior: tiendaActualizada.estado,
        estado_nuevo: estado,
        motivo: motivo
      },
      nivel_importancia: estado === 'cerrada_permanente' ? 'critico' : 'alto'
    });

    return res.status(200).json({
      status: 'success',
      message: `Estado de tienda cambiado a ${estado}`,
      data: {
        id: tiendaActualizada._id,
        nombre: tiendaActualizada.nombre,
        estado: tiendaActualizada.estado,
        motivo_cambio: motivo
      }
    });
  } catch (error) {
    console.error('Error cambiando estado de tienda:', error);
    return next(new AppError(`Error al cambiar estado: ${error.message}`, 400));
  }
});

/**
 * @desc    Obtener inventario de tienda
 * @route   GET /api/v1/tiendas/admin/:id/inventario
 * @access  Private/Admin
 */
const obtenerInventarioTienda = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      estado,
      stock_min,
      stock_max,
      solo_disponibles,
      solo_reservados,
      bajo_stock,
      page = 1,
      limit = 20
    } = req.query;

    const filtros = {
      estado,
      stock_min,
      stock_max,
      solo_disponibles: solo_disponibles === 'true',
      solo_reservados: solo_reservados === 'true',
      bajo_stock: bajo_stock === 'true'
    };

    // Limpiar filtros undefined
    Object.keys(filtros).forEach(key => 
      filtros[key] === undefined && delete filtros[key]
    );

    const inventario = await tiendaService.obtenerInventarioTienda(
      id,
      filtros,
      parseInt(page),
      parseInt(limit)
    );

    return res.status(200).json({
      status: 'success',
      tienda_id: id,
      resultados: inventario.datos.length,
      paginacion: inventario.paginacion,
      resumen: inventario.resumen,
      filtros_aplicados: filtros,
      data: inventario.datos
    });
  } catch (error) {
    console.error('Error obteniendo inventario de tienda:', error);
    return next(new AppError('Error al obtener inventario', 500));
  }
});

/**
 * @desc    Obtener recogidas de tienda
 * @route   GET /api/v1/tiendas/admin/:id/recogidas
 * @access  Private/Admin
 */
const obtenerRecogidasTienda = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      estado,
      fecha_desde,
      fecha_hasta,
      page = 1,
      limit = 20
    } = req.query;

    const filtros = {};
    
    if (estado) {
      if (Array.isArray(estado)) {
        filtros.estado = { $in: estado };
      } else {
        filtros.estado = estado;
      }
    }
    
    if (fecha_desde) {
      try {
        filtros.fecha_desde = new Date(fecha_desde);
      } catch (error) {
        return next(new AppError('Fecha desde inválida', 400));
      }
    }
    
    if (fecha_hasta) {
      try {
        filtros.fecha_hasta = new Date(fecha_hasta);
      } catch (error) {
        return next(new AppError('Fecha hasta inválida', 400));
      }
    }

    const recogidas = await tiendaService.obtenerRecogidasTienda(
      id,
      filtros,
      parseInt(page),
      parseInt(limit)
    );

    return res.status(200).json({
      status: 'success',
      tienda_id: id,
      resultados: recogidas.datos.length,
      paginacion: recogidas.paginacion,
      filtros_aplicados: filtros,
      data: recogidas.datos
    });
  } catch (error) {
    console.error('Error obteniendo recogidas de tienda:', error);
    return next(new AppError('Error al obtener recogidas', 500));
  }
});

/**
 * @desc    Procesar recogida
 * @route   PATCH /api/v1/tiendas/admin/recogidas/:idRecogida
 * @access  Private/Admin
 */
const procesarRecogida = catchAsync(async (req, res, next) => {
  try {
    const { idRecogida } = req.params;
    const { accion, datos = {} } = req.body;

    if (!mongoose.Types.ObjectId.isValid(idRecogida)) {
      return next(new AppError('ID de recogida inválido', 400));
    }

    const accionesValidas = ['verificar_disponibilidad', 'marcar_preparado', 'completar_recogida', 'cancelar'];
    if (!accion || !accionesValidas.includes(accion)) {
      return next(new AppError(`Acción no válida. Debe ser una de: ${accionesValidas.join(', ')}`, 400));
    }

    // Validaciones específicas por acción
    if (accion === 'completar_recogida') {
      if (!datos.documento_presentado) {
        return next(new AppError('El documento presentado es obligatorio para completar la recogida', 400));
      }
    }

    if (accion === 'cancelar') {
      if (!datos.motivo || datos.motivo.trim().length < 5) {
        return next(new AppError('El motivo de cancelación debe tener al menos 5 caracteres', 400));
      }
    }

    const recogidaActualizada = await tiendaService.procesarRecogida(
      idRecogida,
      accion,
      datos,
      req.user._id
    );

    await req.logActivity('tienda', 'procesar_recogida', {
      entidad_afectada: {
        tipo: 'recogida',
        id: recogidaActualizada._id,
        codigo: recogidaActualizada.codigo_recogida
      },
      detalles: {
        accion: accion,
        estado_nuevo: recogidaActualizada.estado,
        tienda: recogidaActualizada.id_tienda
      },
      nivel_importancia: accion === 'completar_recogida' ? 'alto' : 'medio'
    });

    return res.status(200).json({
      status: 'success',
      message: `Recogida ${accion} procesada exitosamente`,
      data: recogidaActualizada
    });
  } catch (error) {
    console.error('Error procesando recogida:', error);
    return next(new AppError(`Error al procesar recogida: ${error.message}`, 400));
  }
});

/**
 * @desc    Obtener estadísticas de tiendas
 * @route   GET /api/v1/tiendas/admin/estadisticas
 * @access  Private/Admin
 */
const obtenerEstadisticasTiendas = catchAsync(async (req, res, next) => {
  try {
    const {
      tienda_id,
      fecha_inicio,
      fecha_fin
    } = req.query;

    let fechaInicio = null;
    let fechaFin = null;

    if (fecha_inicio) {
      fechaInicio = new Date(fecha_inicio);
      if (isNaN(fechaInicio.getTime())) {
        return next(new AppError('Fecha de inicio inválida', 400));
      }
    }

    if (fecha_fin) {
      fechaFin = new Date(fecha_fin);
      if (isNaN(fechaFin.getTime())) {
        return next(new AppError('Fecha de fin inválida', 400));
      }
    }

    // Validar que fecha_fin sea posterior a fecha_inicio
    if (fechaInicio && fechaFin && fechaFin <= fechaInicio) {
      return next(new AppError('La fecha de fin debe ser posterior a la fecha de inicio', 400));
    }

    const estadisticas = await tiendaService.obtenerEstadisticas(
      tienda_id,
      fechaInicio,
      fechaFin
    );

    return res.status(200).json({
      status: 'success',
      periodo: {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tienda_id: tienda_id || 'todas'
      },
      data: estadisticas
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return next(new AppError('Error al obtener estadísticas', 500));
  }
});

/**
 * @desc    Agregar nota interna a tienda
 * @route   POST /api/v1/tiendas/admin/:id/notas
 * @access  Private/Admin
 */
const agregarNotaTienda = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nota, categoria = 'otra' } = req.body;

    if (!nota || nota.trim().length < 5) {
      return next(new AppError('La nota debe tener al menos 5 caracteres', 400));
    }

    const categoriasValidas = ['operativa', 'mantenimiento', 'incidencia', 'mejora', 'otra'];
    if (!categoriasValidas.includes(categoria)) {
      return next(new AppError(`Categoría no válida. Debe ser una de: ${categoriasValidas.join(', ')}`, 400));
    }

    const tienda = await tiendaService.obtenerTiendaPorId(id);
    if (!tienda) {
      return next(new AppError('Tienda no encontrada', 404));
    }

    // La lógica de agregar nota está en el modelo
    const TiendaFisica = require('../../Database/models/tiendaFisicaModel');
    const tiendaDoc = await TiendaFisica.findById(tienda._id);
    await tiendaDoc.agregarNota(nota, req.user._id, categoria);

    await req.logActivity('tienda', 'agregar_nota_tienda', {
      entidad_afectada: {
        tipo: 'tienda',
        id: tienda._id,
        nombre: tienda.nombre
      },
      detalles: {
        categoria: categoria,
        longitud_nota: nota.length
      },
      nivel_importancia: categoria === 'incidencia' ? 'alto' : 'bajo'
    });

    return res.status(200).json({
      status: 'success',
      message: 'Nota agregada exitosamente',
      data: {
        tienda_id: tienda._id,
        nota_agregada: {
          nota,
          categoria,
          fecha: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Error agregando nota a tienda:', error);
    return next(new AppError(`Error al agregar nota: ${error.message}`, 400));
  }
});

module.exports = {
  // Controladores públicos
  obtenerTiendasPublicas,
  buscarTiendasCercanas,
  buscarTiendasPorCiudad,
  verificarDisponibilidadLibro,
  obtenerDetalleTienda,
  verificarCodigoRecogida,
  
  // Controladores administrativos
  crearTienda,
  listarTiendasAdmin,
  obtenerTiendaAdmin,
  actualizarTienda,
  cambiarEstadoTienda,
  obtenerInventarioTienda,
  obtenerRecogidasTienda,
  procesarRecogida,
  obtenerEstadisticasTiendas,
  agregarNotaTienda
};