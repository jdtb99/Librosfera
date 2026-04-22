// src/controllers/libroController.js
const { libroService } = require('../../Database/services');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Obtener todos los libros con filtros y paginación
 * @route   GET /api/v1/libros
 * @access  Public
 */
const getLibros = catchAsync(async (req, res, next) => {
  try {
    // Extraer parámetros de consulta
    const {
      titulo, autor, editorial, genero, idioma, estado,
      precio_min, precio_max, anio_min, anio_max,
      solo_disponibles, incluir_inactivos,
      page = 1, limit = 10, sort = 'fecha_registro', order = 'desc'
    } = req.query;

    // Construir objeto de filtros
    const filtros = {
      titulo,
      autor,
      editorial,
      genero,
      idioma,
      estado,
      precio_min,
      precio_max,
      anio_min,
      anio_max,
      solo_disponibles: solo_disponibles === 'true'
    };

    // Solo usuarios administradores pueden ver libros inactivos
    const esAdmin = req.user && (req.user.tipo_usuario === 'administrador' || req.user.tipo_usuario === 'root');
    filtros.incluir_inactivos = esAdmin && incluir_inactivos === 'true';

    console.log('Obteniendo libros con filtros:', JSON.stringify(filtros, null, 2));

    // Obtener libros con filtros y paginación
    const resultado = await libroService.listarLibros(
      filtros,
      parseInt(page),
      parseInt(limit),
      sort,
      order
    );

    // Devolver respuesta
    return res.status(200).json({
      status: 'success',
      resultados: resultado.datos.length,
      paginacion: resultado.paginacion,
      data: resultado.datos
    });
  } catch (error) {
    console.error('Error en controlador getLibros:', error);
    return next(new AppError(`Error obteniendo libros: ${error.message}`, 500));
  }
});

/**
 * @desc    Obtener un libro por ID
 * @route   GET /api/v1/libros/:id
 * @access  Public
 */
const getLibroPorId = catchAsync(async (req, res, next) => {
  try {
    console.log('Buscando libro con ID:', req.params.id);
    const libro = await libroService.obtenerLibroPorId(req.params.id);

    if (!libro) {
      return next(new AppError('Libro no encontrado', 404));
    }

    // Verificar si el libro está activo o si el usuario es administrador
    const esAdmin = req.user && (req.user.tipo_usuario === 'administrador' || req.user.tipo_usuario === 'root');
    if (!libro.activo && !esAdmin) {
      return next(new AppError('Libro no disponible', 404));
    }

    return res.status(200).json({
      status: 'success',
      data: libro
    });
  } catch (error) {
    console.error('Error obteniendo libro:', error);
    return next(new AppError(`Error al obtener libro: ${error.message}`, 500));
  }
});

/**
 * @desc    Crear un nuevo libro
 * @route   POST /api/v1/libros
 * @access  Private/Admin
 */
const crearLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para crear libros', 403));
    }

    // Validar campos obligatorios
    const {
      titulo, autor, editorial, genero, idioma,
      fecha_publicacion, anio_publicacion, numero_paginas,
      precio_info, precio, estado
    } = req.body;

    // Verificar campos obligatorios
    if (!titulo) {
      return next(new AppError('El título del libro es obligatorio', 400));
    }
    
    if (!autor) {
      return next(new AppError('El autor es obligatorio', 400));
    }
    
    if (!editorial) {
      return next(new AppError('La editorial es obligatoria', 400));
    }
    
    if (!genero) {
      return next(new AppError('El género del libro es obligatorio', 400));
    }
    
    if (!idioma) {
      return next(new AppError('El idioma del libro es obligatorio', 400));
    }
    
    if (!fecha_publicacion) {
      return next(new AppError('La fecha de publicación es obligatoria', 400));
    }
    
    if (!anio_publicacion) {
      return next(new AppError('El año de publicación es obligatorio', 400));
    }
    
    if (!numero_paginas) {
      return next(new AppError('El número de páginas es obligatorio', 400));
    }
    
    if (!precio && (!precio_info || !precio_info.precio_base)) {
      return next(new AppError('El precio del libro es obligatorio', 400));
    }
    
    if (!estado) {
      return next(new AppError('El estado del libro (nuevo/usado) es obligatorio', 400));
    }

    // Validaciones adicionales
    // Validar fecha de publicación
    try {
      new Date(fecha_publicacion);
    } catch (error) {
      return next(new AppError('Fecha de publicación inválida', 400));
    }

    // Validar año de publicación
    const anioActual = new Date().getFullYear();
    if (anio_publicacion < 1000 || anio_publicacion > anioActual) {
      return next(new AppError(`El año de publicación debe estar entre 1000 y ${anioActual}`, 400));
    }

    // Validar estado del libro
    if (!['nuevo', 'usado'].includes(estado)) {
      return next(new AppError('El estado del libro debe ser "nuevo" o "usado"', 400));
    }
    
    // Validar número de páginas
    if (numero_paginas <= 0) {
      return next(new AppError('El número de páginas debe ser mayor a cero', 400));
    }
    
    // Validar precio
    if (precio && precio <= 0) {
      return next(new AppError('El precio debe ser mayor a cero', 400));
    }
    
    console.log('Creando nuevo libro:', JSON.stringify(req.body, null, 2));
    
    // Crear libro con datos validados
    const nuevoLibro = await libroService.crearLibro(req.body);

    await req.logActivity('libro', 'creacion', {
      id_libro: nuevoLibro._id,
      titulo_libro: nuevoLibro.titulo,
      detalles: {
        titulo: nuevoLibro.titulo,
        autor: nuevoLibro.autor_nombre_completo,
        editorial: nuevoLibro.editorial,
        precio: nuevoLibro.precio
      },
      nivel_importancia: 'alto'
    });

    return res.status(201).json({
      status: 'success',
      message: 'Libro creado exitosamente',
      data: nuevoLibro
    });
  } catch (error) {
    console.error('Error en controlador crearLibro:', error);
    return next(new AppError(`Error al crear libro: ${error.message}`, 400));
  }
});

/**
 * @desc    Actualizar un libro
 * @route   PUT /api/v1/libros/:id
 * @access  Private/Admin
 */
const actualizarLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para actualizar libros', 403));
    }

    // Verificar que el libro existe
    const libroExistente = await libroService.obtenerLibroPorId(req.params.id);
    if (!libroExistente) {
      return next(new AppError('Libro no encontrado', 404));
    }

    // Validar campos que requieren validación específica
    if (req.body.anio_publicacion) {
      const anioActual = new Date().getFullYear();
      if (req.body.anio_publicacion < 1000 || req.body.anio_publicacion > anioActual) {
        return next(new AppError(`El año de publicación debe estar entre 1000 y ${anioActual}`, 400));
      }
    }

    if (req.body.estado && !['nuevo', 'usado'].includes(req.body.estado)) {
      return next(new AppError('El estado del libro debe ser "nuevo" o "usado"', 400));
    }

    if (req.body.fecha_publicacion) {
      try {
        new Date(req.body.fecha_publicacion);
      } catch (error) {
        return next(new AppError('Fecha de publicación inválida', 400));
      }
    }
    
    if (req.body.numero_paginas && req.body.numero_paginas <= 0) {
      return next(new AppError('El número de páginas debe ser mayor a cero', 400));
    }
    
    if (req.body.precio && req.body.precio <= 0) {
      return next(new AppError('El precio debe ser mayor a cero', 400));
    }

    console.log('Actualizando libro:', req.params.id);
    console.log('Datos de actualización:', JSON.stringify(req.body, null, 2));
    
    const estadoAnterior = { ...libroExistente };
    // Actualizar libro con datos validados
    // Obtener versión para control de concurrencia
    const version = req.body.version || libroExistente.version;
    
    const libroActualizado = await libroService.actualizarLibro(
      req.params.id, 
      req.body, 
      version
    );

    await req.logActivity('libro', 'actualizacion', {
      id_libro: libroActualizado._id,
      titulo_libro: libroActualizado.titulo,
      estado_anterior: estadoAnterior,
      estado_nuevo: libroActualizado,
      detalles: {
        campos_actualizados: Object.keys(req.body)
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Libro actualizado exitosamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador actualizarLibro:', error);
    if (error.message.includes('modificado por otro usuario')) {
      return next(new AppError(error.message, 409)); // Conflict
    }
    return next(new AppError(`Error al actualizar libro: ${error.message}`, 400));
  }
});

/**
 * @desc    Eliminar un libro (desactivación lógica)
 * @route   DELETE /api/v1/libros/:id
 * @access  Private/Admin
 */
const eliminarLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para eliminar libros', 403));
    }

    // Verificar que el libro existe
    const libroExistente = await libroService.obtenerLibroPorId(req.params.id);
    if (!libroExistente) {
      return next(new AppError('Libro no encontrado', 404));
    }

    console.log('Desactivando libro:', req.params.id);
    
    // Desactivar libro (eliminación lógica)
    await libroService.desactivarLibro(req.params.id);

    await req.logActivity('libro', 'desactivacion_logica', {
      id_libro: libroExistente._id,
      titulo_libro: libroExistente.titulo,
      detalles: {
        eliminado_por: req.user.usuario
      },
      nivel_importancia: 'medio'
    });

    return res.status(200).json({
      status: 'success',
      message: 'Libro desactivado correctamente'
    });
  } catch (error) {
    console.error('Error en controlador eliminarLibro:', error);
    return next(new AppError(`Error al desactivar libro: ${error.message}`, 500));
  }
});

/**
 * @desc    Eliminar un libro permanentemente
 * @route   DELETE /api/v1/libros/:id/permanente
 * @access  Private/Root
 */
const eliminarLibroPermanente = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de usuario root
    if (!req.user || req.user.tipo_usuario !== 'root') {
      return next(new AppError('No tiene permisos para eliminar libros permanentemente', 403));
    }

    // Verificar que el libro existe
    const libroExistente = await libroService.obtenerLibroPorId(req.params.id);
    if (!libroExistente) {
      return next(new AppError('Libro no encontrado', 404));
    }

    console.log('Eliminando permanentemente libro:', req.params.id);
    
    // Eliminar libro permanentemente
    await libroService.eliminarLibroPermanente(req.params.id);

    await req.logActivity('libro', 'eliminacion_permanente', {
      id_libro: libroExistente._id,
      titulo_libro: libroExistente.titulo,
      estado_anterior: libroExistente,
      detalles: {
        titulo: libroExistente.titulo,
        autor: libroExistente.autor_nombre_completo,
        eliminado_por: req.user.usuario
      },
      nivel_importancia: 'alto'
    });

    return res.status(200).json({
      status: 'success',
      message: 'Libro eliminado permanentemente'
    });
  } catch (error) {
    console.error('Error en controlador eliminarLibroPermanente:', error);
    return next(new AppError(`Error al eliminar libro: ${error.message}`, 500));
  }
});

/**
 * @desc    Buscar libros por texto y registrar búsqueda usando Atlas Search
 * @route   GET /api/v1/libros/buscar
 * @access  Public
 */
const buscarLibros = catchAsync(async (req, res, next) => {
  try {
    let { q, limit, genero, editorial, idioma, estado, precio_min, precio_max, solo_disponibles } = req.query;
    const limite = parseInt(limit) || 20;
    
    // Decodificar explícitamente parámetros que pueden contener caracteres especiales
    if (q) {
      try {
        q = decodeURIComponent(q);
      } catch (e) {
        console.warn('Error decodificando término q:', e.message);
      }
    }
    
    if (genero) {
      try {
        genero = decodeURIComponent(genero);
      } catch (e) {
        console.warn('Error decodificando genero:', e.message);
      }
    }
    
    if (editorial) {
      try {
        editorial = decodeURIComponent(editorial);
      } catch (e) {
        console.warn('Error decodificando editorial:', e.message);
      }
    }
    
    // Construir objeto de filtros
    const filtros = {
      genero,
      editorial,
      idioma,
      estado,
      precio_min,
      precio_max,
      solo_disponibles: solo_disponibles === 'true'
    };
    
    // Si no hay texto de búsqueda ni filtros, solicitar al menos uno
    const hayFiltros = Object.values(filtros).some(v => v);
    if (!q && !hayFiltros) {
      return next(new AppError('Se requiere al menos un término de búsqueda o filtro', 400));
    }

    console.log('Buscando libros con término:', q);
    console.log('Filtros adicionales:', JSON.stringify(filtros, null, 2));
    
    // Realizar búsqueda con Atlas Search y registrar en historial
    const resultado = await libroService.buscarYRegistrar(
      q,
      filtros,
      req.user, // Usuario opcional (si está autenticado)
      limite
    );

    return res.status(200).json({
      status: 'success',
      resultados: resultado.resultados.length,
      id_busqueda: resultado.id_busqueda,
      data: resultado.resultados
    });
  } catch (error) {
    console.error('Error en controlador buscarLibros:', error);
    return next(new AppError(`Error en búsqueda de libros: ${error.message}`, 500));
  }
});

/**
 * @desc    Autocompletado de términos para búsqueda
 * @route   GET /api/v1/libros/autocompletar
 * @access  Public
 */
const autocompletarTerminos = catchAsync(async (req, res, next) => {
  try {
    let { q, campo = 'titulo', limit = 10 } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(200).json({
        status: 'success',
        resultados: 0,
        data: []
      });
    }
    
    // Decodificar parámetro de búsqueda
    try {
      q = decodeURIComponent(q);
    } catch (e) {
      console.warn('Error decodificando término para autocompletar:', e.message);
    }
    
    // Validar campo para búsqueda
    const camposPermitidos = ['titulo', 'autor_nombre_completo', 'genero', 'editorial'];
    if (!camposPermitidos.includes(campo)) {
      campo = 'titulo'; // Valor por defecto si no es válido
    }
    
    // Obtener sugerencias de autocompletado
    const sugerencias = await libroService.buscarAutocomplete(
      q,
      campo,
      parseInt(limit) || 10
    );
    
    return res.status(200).json({
      status: 'success',
      resultados: sugerencias.length,
      data: sugerencias
    });
  } catch (error) {
    console.error('Error en controlador autocompletarTerminos:', error);
    return next(new AppError(`Error en autocompletado: ${error.message}`, 500));
  }
});

/**
 * @desc    Búsqueda difusa (fuzzy) para términos mal escritos o con errores tipográficos
 * @route   GET /api/v1/libros/busqueda-difusa
 * @access  Public
 */
const busquedaDifusa = catchAsync(async (req, res, next) => {
  try {
    let { q, campos, limit = 20 } = req.query;
    
    if (!q || q.trim() === '') {
      return next(new AppError('Se requiere un término de búsqueda', 400));
    }
    
    // Decodificar parámetro de búsqueda
    try {
      q = decodeURIComponent(q);
    } catch (e) {
      console.warn('Error decodificando término para búsqueda difusa:', e.message);
    }
    
    // Procesar campos si se especifican
    let camposBusqueda = ['titulo', 'autor_nombre_completo']; // Valores por defecto
    if (campos) {
      try {
        // Permitir que se pasen como array o como string separada por comas
        if (typeof campos === 'string') {
          camposBusqueda = campos.split(',').map(c => c.trim());
        } else if (Array.isArray(campos)) {
          camposBusqueda = campos;
        }
        
        // Validar que sean campos permitidos
        const camposPermitidos = ['titulo', 'autor_nombre_completo', 'genero', 'editorial', 'descripcion', 'palabras_clave'];
        camposBusqueda = camposBusqueda.filter(c => camposPermitidos.includes(c));
        
        // Si no queda ningún campo válido, usar los predeterminados
        if (camposBusqueda.length === 0) {
          camposBusqueda = ['titulo', 'autor_nombre_completo'];
        }
      } catch (e) {
        console.warn('Error procesando campos para búsqueda difusa:', e.message);
      }
    }
    
    // Realizar búsqueda difusa
    const resultados = await libroService.busquedaDifusa(
      q,
      camposBusqueda,
      parseInt(limit) || 20
    );
    
    return res.status(200).json({
      status: 'success',
      resultados: resultados.length,
      data: resultados
    });
  } catch (error) {
    console.error('Error en controlador busquedaDifusa:', error);
    return next(new AppError(`Error en búsqueda difusa: ${error.message}`, 500));
  }
});

/**
 * @desc    Registrar interacción con libro desde búsqueda
 * @route   POST /api/v1/libros/buscar/:idBusqueda/interaccion/:idLibro
 * @access  Public
 */
const registrarInteraccion = catchAsync(async (req, res, next) => {
  try {
    const { idBusqueda, idLibro } = req.params;
    
    console.log(`Registrando interacción de búsqueda ${idBusqueda} con libro ${idLibro}`);
    
    const resultado = await libroService.registrarInteraccionBusqueda(idBusqueda, idLibro);
    
    return res.status(200).json({
      status: 'success',
      message: 'Interacción registrada correctamente'
    });
  } catch (error) {
    console.error('Error en controlador registrarInteraccion:', error);
    return next(new AppError(`Error al registrar interacción: ${error.message}`, 400));
  }
});

/**
 * @desc    Obtener recomendaciones para un usuario
 * @route   GET /api/v1/libros/recomendaciones
 * @access  Private
 */
const getRecomendaciones = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para obtener recomendaciones', 401));
    }

    const limite = parseInt(req.query.limit) || 5;
    
    console.log(`Obteniendo ${limite} recomendaciones para usuario ${req.user._id}`);
    
    const libros = await libroService.obtenerRecomendaciones(req.user._id, limite);

    return res.status(200).json({
      status: 'success',
      resultados: libros.length,
      data: libros
    });
  } catch (error) {
    console.error('Error en controlador getRecomendaciones:', error);
    return next(new AppError(`Error al obtener recomendaciones: ${error.message}`, 500));
  }
});

/**
 * @desc    Obtener libros con descuentos activos
 * @route   GET /api/v1/libros/descuentos
 * @access  Public
 */
const getLibrosConDescuento = catchAsync(async (req, res, next) => {
  try {
    const limite = parseInt(req.query.limit) || 20;
    
    console.log(`Obteniendo ${limite} libros con descuento`);
    
    const libros = await libroService.obtenerLibrosConDescuento(limite);

    return res.status(200).json({
      status: 'success',
      resultados: libros.length,
      data: libros // Ya incluye stock consolidado
    });
  } catch (error) {
    console.error('Error en controlador getLibrosConDescuento:', error);
    return next(new AppError(`Error al obtener libros con descuento: ${error.message}`, 500));
  }
});

/**
 * @desc    Obtener libros destacados (mejor calificados)
 * @route   GET /api/v1/libros/destacados
 * @access  Public
 */
const getLibrosDestacados = catchAsync(async (req, res, next) => {
  try {
    const limite = parseInt(req.query.limit) || 10;
    
    console.log(`Obteniendo ${limite} libros destacados`);
    
    const libros = await libroService.obtenerLibrosDestacados(limite);

    return res.status(200).json({
      status: 'success',
      resultados: libros.length,
      data: libros
    });
  } catch (error) {
    console.error('Error en controlador getLibrosDestacados:', error);
    return next(new AppError(`Error al obtener libros destacados: ${error.message}`, 500));
  }
});

/**
 * @desc    Añadir calificación a un libro
 * @route   POST /api/v1/libros/:id/calificacion
 * @access  Private
 */
const calificarLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para calificar un libro', 401));
    }

    // Validar calificación
    const calificacion = parseFloat(req.body.calificacion);
    if (isNaN(calificacion) || calificacion < 1 || calificacion > 5) {
      return next(new AppError('La calificación debe ser un número entre 1 y 5', 400));
    }

    console.log(`Calificando libro ${req.params.id} con ${calificacion} estrellas`);
    
    // Actualizar calificación
    const libroActualizado = await libroService.actualizarCalificacion(
      req.params.id,
      calificacion
    );

    return res.status(200).json({
      status: 'success',
      message: 'Calificación registrada exitosamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador calificarLibro:', error);
    return next(new AppError(`Error al calificar libro: ${error.message}`, 400));
  }
});

/**
 * @desc    Marcar un libro como histórico agotado
 * @route   PATCH /api/v1/libros/:id/historico
 * @access  Private/Admin
 */
const marcarComoHistorico = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para marcar libros como históricos', 403));
    }

    // Verificar que el libro existe
    const libroExistente = await libroService.obtenerLibroPorId(req.params.id);
    if (!libroExistente) {
      return next(new AppError('Libro no encontrado', 404));
    }

    console.log('Marcando libro como histórico agotado:', req.params.id);
    
    // Marcar como histórico
    const libroActualizado = await libroService.marcarComoHistoricoAgotado(req.params.id);
    
    await req.logActivity('libro', 'marcar_como_historico', {
      id_libro: libroActualizado._id,
      titulo_libro: libroActualizado.titulo,
      nivel_importancia: 'medio'
    });

    return res.status(200).json({
      status: 'success',
      message: 'Libro marcado como histórico agotado',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador marcarComoHistorico:', error);
    return next(new AppError(`Error al marcar libro como histórico: ${error.message}`, 400));
  }
});

/**
 * @desc    Agregar un ejemplar a un libro
 * @route   POST /api/v1/libros/:id/ejemplares
 * @access  Private/Admin
 */
const agregarEjemplar = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para agregar ejemplares', 403));
    }

    // Verificar que el código de ejemplar es obligatorio
    if (!req.body.codigo) {
      return next(new AppError('El código del ejemplar es obligatorio', 400));
    }
    
    // Sanear el código (no espacios, solo alfanuméricos)
    req.body.codigo = req.body.codigo.trim().replace(/[^a-zA-Z0-9-_]/g, '');
    
    if (req.body.codigo.length < 3) {
      return next(new AppError('El código del ejemplar debe tener al menos 3 caracteres', 400));
    }

    // Verificar que el código no esté en uso
    const codigoExistente = await libroService.verificarCodigoEjemplar(req.body.codigo);
    if (codigoExistente) {
      return next(new AppError('El código del ejemplar ya está en uso', 400));
    }
    
    // Validar estado físico si se proporciona
    if (req.body.estado_fisico && !['excelente', 'bueno', 'aceptable', 'deteriorado'].includes(req.body.estado_fisico)) {
      return next(new AppError('Estado físico no válido', 400));
    }

    console.log('Agregando ejemplar al libro:', req.params.id);
    console.log('Datos del ejemplar:', JSON.stringify(req.body, null, 2));
    
    // Agregar ejemplar
    const libroActualizado = await libroService.agregarEjemplar(
      req.params.id, 
      req.body
    );

    await req.logActivity('inventario', 'agregar_ejemplar', {
      id_libro: libroActualizado._id,
      titulo_libro: libroActualizado.titulo,
      detalles: {
        codigo: req.body.codigo,
        estado_fisico: req.body.estado_fisico || 'excelente'
      }
    });

    return res.status(201).json({
      status: 'success',
      message: 'Ejemplar agregado exitosamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador agregarEjemplar:', error);
    return next(new AppError(`Error al agregar ejemplar: ${error.message}`, 400));
  }
});

/**
 * @desc    Actualizar un ejemplar específico
 * @route   PUT /api/v1/libros/:id/ejemplares/:codigo
 * @access  Private/Admin
 */
const actualizarEjemplar = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para actualizar ejemplares', 403));
    }
    
    // Validar estado físico si se proporciona
    if (req.body.estado_fisico && !['excelente', 'bueno', 'aceptable', 'deteriorado'].includes(req.body.estado_fisico)) {
      return next(new AppError('Estado físico no válido', 400));
    }

    console.log(`Actualizando ejemplar ${req.params.codigo} del libro ${req.params.id}`);
    console.log('Datos de actualización:', JSON.stringify(req.body, null, 2));
    
    // Actualizar ejemplar
    const libroActualizado = await libroService.actualizarEjemplar(
      req.params.id,
      req.params.codigo,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      message: 'Ejemplar actualizado exitosamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador actualizarEjemplar:', error);
    return next(new AppError(`Error al actualizar ejemplar: ${error.message}`, 400));
  }
});

/**
 * @desc    Eliminar un ejemplar específico
 * @route   DELETE /api/v1/libros/:id/ejemplares/:codigo
 * @access  Private/Admin
 */
const eliminarEjemplar = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para eliminar ejemplares', 403));
    }

    console.log(`Eliminando ejemplar ${req.params.codigo} del libro ${req.params.id}`);
    
    // Eliminar ejemplar
    const libroActualizado = await libroService.eliminarEjemplar(
      req.params.id,
      req.params.codigo
    );

    await req.logActivity('inventario', 'eliminar_ejemplar', {
      id_libro: libroActualizado._id,
      titulo_libro: libroActualizado.titulo,
      detalles: {
        codigo: req.params.codigo
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Ejemplar eliminado exitosamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador eliminarEjemplar:', error);
    return next(new AppError(`Error al eliminar ejemplar: ${error.message}`, 400));
  }
});

/**
 * @desc    Agregar un descuento a un libro
 * @route   POST /api/v1/libros/:id/descuentos
 * @access  Private/Admin
 */
const agregarDescuento = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para agregar descuentos', 403));
    }

    // Validar campos obligatorios
    if (!req.body.tipo || req.body.valor === undefined) {
      return next(new AppError('El tipo y valor del descuento son obligatorios', 400));
    }

    // Validar tipo de descuento
    if (!['porcentaje', 'valor_fijo', 'promocion_2x1', 'bundle'].includes(req.body.tipo)) {
      return next(new AppError('Tipo de descuento no válido', 400));
    }

    // Validar valor del descuento
    if (req.body.valor <= 0) {
      return next(new AppError('El valor del descuento debe ser positivo', 400));
    }

    // Si es porcentaje, validar que no sea mayor a 100
    if (req.body.tipo === 'porcentaje' && req.body.valor > 100) {
      return next(new AppError('El porcentaje de descuento no puede ser mayor a 100', 400));
    }

    // Validar fechas
    if (req.body.fecha_fin) {
      const fechaFin = new Date(req.body.fecha_fin);
      const hoy = new Date();
      
      if (fechaFin < hoy) {
        return next(new AppError('La fecha de fin del descuento no puede ser en el pasado', 400));
      }
    }

    console.log(`Agregando descuento al libro ${req.params.id}`);
    console.log('Datos del descuento:', JSON.stringify(req.body, null, 2));
    
    // Agregar descuento
    const libroActualizado = await libroService.agregarDescuento(
      req.params.id, 
      req.body
    );

    return res.status(201).json({
      status: 'success',
      message: 'Descuento agregado exitosamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador agregarDescuento:', error);
    return next(new AppError(`Error al agregar descuento: ${error.message}`, 400));
  }
});

/**
 * @desc    Desactivar todos los descuentos de un libro
 * @route   DELETE /api/v1/libros/:id/descuentos
 * @access  Private/Admin
 */
const desactivarDescuentos = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para desactivar descuentos', 403));
    }

    console.log(`Desactivando descuentos del libro ${req.params.id}`);
    
    // Desactivar descuentos
    const libroActualizado = await libroService.desactivarDescuentos(req.params.id);

    return res.status(200).json({
      status: 'success',
      message: 'Descuentos desactivados exitosamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador desactivarDescuentos:', error);
    return next(new AppError(`Error al desactivar descuentos: ${error.message}`, 400));
  }
});

/**
 * @desc    Subir imagen para un libro
 * @route   POST /api/v1/libros/:id/imagenes
 * @access  Private/Admin
 */
const subirImagenLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para subir imágenes', 403));
    }

    // Verificar que se ha subido un archivo
    if (!req.file) {
      return next(new AppError('No se ha subido ningún archivo', 400));
    }

    console.log('Archivo recibido en controlador:', req.file);

    // Verificar que el archivo es una imagen
    if (!req.file.mimetype.startsWith('image')) {
      return next(new AppError('El archivo debe ser una imagen', 400));
    }

    // Verificar tamaño máximo (5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return next(new AppError('La imagen no puede ser mayor a 5MB', 400));
    }

    // Obtener el libro para verificar las imágenes existentes si no se proporciona orden
    let ordenImagen = req.body.orden !== undefined ? parseInt(req.body.orden) : undefined;
    
    if (ordenImagen === undefined) {
      // Buscar el libro para determinar el orden automáticamente
      const libro = await libroService.obtenerLibroPorId(req.params.id);
      
      if (!libro) {
        return next(new AppError('Libro no encontrado', 404));
      }
      
      // Determinar el orden basado en imágenes existentes
      if (!libro.imagenes || libro.imagenes.length === 0) {
        // Primera imagen, asignar orden 0 (portada)
        ordenImagen = 0;
      } else {
        // Buscar el orden más alto y sumar 1
        const ordenMasAlto = Math.max(...libro.imagenes.map(img => img.orden));
        ordenImagen = ordenMasAlto + 1;
      }
      
      console.log(`Orden determinado automáticamente: ${ordenImagen}`);
    }
    
    // Determinar el tipo de imagen basado en el orden
    let tipoImagen = req.body.tipo;
    
    if (!tipoImagen) {
      if (ordenImagen === 0) {
        tipoImagen = 'portada';
      } else if (ordenImagen === 1) {
        tipoImagen = 'contraportada';
      } else {
        tipoImagen = 'detalle'; // Por defecto
      }
    } else if ((ordenImagen === 0 && tipoImagen !== 'portada') || 
               (ordenImagen === 1 && tipoImagen !== 'contraportada')) {
      // Forzar coherencia entre orden y tipo
      tipoImagen = ordenImagen === 0 ? 'portada' : 'contraportada';
      console.log(`Tipo ajustado para mantener coherencia con orden ${ordenImagen}: ${tipoImagen}`);
    }

    // Preparar metadatos de la imagen
    const metadatos = {
      tipo: tipoImagen,
      orden: ordenImagen,
      alt_text: req.body.alt_text || ''
    };

    console.log(`Subiendo imagen para libro ${req.params.id}`);
    console.log('Metadatos de imagen:', JSON.stringify(metadatos, null, 2));
    
    // Agregar la imagen al libro
    const libroActualizado = await libroService.agregarImagenLibro(
      req.params.id,
      req.file,
      metadatos
    );

    if (!libroActualizado) {
      return next(new AppError('No se pudo actualizar el libro con la imagen', 500));
    }

    await req.logActivity('libro', 'subir_imagen', {
      id_libro: libroActualizado._id,
      titulo_libro: libroActualizado.titulo,
      detalles: {
        tipo_imagen: metadatos.tipo,
        orden: metadatos.orden
      },
      nivel_importancia: 'bajo'
    });

    return res.status(201).json({
      status: 'success',
      message: 'Imagen subida exitosamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador subirImagenLibro:', error);
    return next(new AppError(`Error al subir imagen: ${error.message}`, 400));
  }
});

/**
 * @desc    Actualizar orden de imágenes
 * @route   PATCH /api/v1/libros/:id/imagenes/orden
 * @access  Private/Admin
 */
const actualizarOrdenImagenes = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para ordenar imágenes', 403));
    }

    // Verificar que se proporcionó un array de ordenesNuevos
    if (!req.body.ordenesNuevos || !Array.isArray(req.body.ordenesNuevos)) {
      return next(new AppError('Se requiere un array de ordenesNuevos', 400));
    }

    // Validar estructura de los datos
    for (const item of req.body.ordenesNuevos) {
      if (!item.id_imagen || item.orden_nuevo === undefined) {
        return next(new AppError('Cada item debe tener id_imagen y orden_nuevo', 400));
      }
      
      // Validar tipo si se proporciona
      if (item.tipo_nuevo && !['portada', 'contraportada', 'contenido', 'detalle'].includes(item.tipo_nuevo)) {
        return next(new AppError('Tipo de imagen no válido', 400));
      }
    }

    console.log(`Actualizando orden de imágenes del libro ${req.params.id}`);
    console.log('Nuevos órdenes:', JSON.stringify(req.body.ordenesNuevos, null, 2));
    
    // Actualizar orden de imágenes
    const libroActualizado = await libroService.actualizarOrdenImagenes(
      req.params.id,
      req.body.ordenesNuevos
    );

    return res.status(200).json({
      status: 'success',
      message: 'Orden de imágenes actualizado correctamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador actualizarOrdenImagenes:', error);
    return next(new AppError(`Error al actualizar orden: ${error.message}`, 400));
  }
});

/**
 * @desc    Eliminar una imagen
 * @route   DELETE /api/v1/libros/:id/imagenes/:idImagen
 * @access  Private/Admin
 */
const eliminarImagenLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para eliminar imágenes', 403));
    }

    console.log(`Eliminando imagen ${req.params.idImagen} del libro ${req.params.id}`);
    
    // Eliminar imagen
    const libroActualizado = await libroService.eliminarImagenLibro(
      req.params.id,
      req.params.idImagen
    );

    return res.status(200).json({
      status: 'success',
      message: 'Imagen eliminada correctamente',
      data: libroActualizado
    });
  } catch (error) {
    console.error('Error en controlador eliminarImagenLibro:', error);
    return next(new AppError(`Error al eliminar imagen: ${error.message}`, 400));
  }
});

/**
 * @desc    Reservar stock para compra
 * @route   POST /api/v1/libros/:id/reservar
 * @access  Private
 */
const reservarStockLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para reservar libros', 401));
    }

    // Validar campos obligatorios
    if (!req.body.cantidad || !req.body.id_reserva) {
      return next(new AppError('La cantidad y el ID de reserva son obligatorios', 400));
    }

    // Validar cantidad
    const cantidad = parseInt(req.body.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      return next(new AppError('La cantidad debe ser un número positivo', 400));
    }

    console.log(`Reservando ${cantidad} unidades del libro ${req.params.id}`);
    console.log('ID de reserva:', req.body.id_reserva);
    
    // Reservar stock
    const resultado = await libroService.reservarStock(
      req.params.id,
      cantidad,
      req.user._id,
      req.body.id_reserva
    );

    await req.logActivity('inventario', 'reservar_stock', {
      id_libro: req.params.id,
      titulo_libro: libro.titulo,
      detalles: {
        cantidad: cantidad,
        id_reserva: req.body.id_reserva
      }
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error en controlador reservarStockLibro:', error);
    // Manejar error de stock insuficiente
    if (error.message.includes('Stock insuficiente')) {
      return next(new AppError(error.message, 409)); // Conflict
    }
    return next(new AppError(`Error al reservar stock: ${error.message}`, 400));
  }
});

/**
 * @desc    Liberar stock reservado
 * @route   POST /api/v1/libros/:id/liberar
 * @access  Private
 */
const liberarStockLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para liberar reservas', 401));
    }

    // Validar campos obligatorios
    if (!req.body.cantidad || !req.body.id_reserva) {
      return next(new AppError('La cantidad y el ID de reserva son obligatorios', 400));
    }

    // Validar cantidad
    const cantidad = parseInt(req.body.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      return next(new AppError('La cantidad debe ser un número positivo', 400));
    }

    console.log(`Liberando ${cantidad} unidades reservadas del libro ${req.params.id}`);
    console.log('ID de reserva:', req.body.id_reserva);
    
    // Liberar stock
    const resultado = await libroService.liberarStockReservado(
      req.params.id,
      cantidad,
      req.user._id,
      req.body.id_reserva
    );

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error en controlador liberarStockLibro:', error);
    return next(new AppError(`Error al liberar stock: ${error.message}`, 400));
  }
});

/**
 * @desc    Confirmar compra de libro
 * @route   POST /api/v1/libros/:id/comprar
 * @access  Private
 */
const confirmarCompraLibro = catchAsync(async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para confirmar compras', 401));
    }

    // Validar campos obligatorios
    if (!req.body.cantidad || !req.body.id_transaccion || !req.body.id_reserva) {
      return next(new AppError('La cantidad, ID de transacción y ID de reserva son obligatorios', 400));
    }

    // Validar cantidad
    const cantidad = parseInt(req.body.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      return next(new AppError('La cantidad debe ser un número positivo', 400));
    }

    console.log(`Confirmando compra de ${cantidad} unidades del libro ${req.params.id}`);
    console.log('ID de transacción:', req.body.id_transaccion);
    console.log('ID de reserva:', req.body.id_reserva);
    
    // Confirmar compra
    const resultado = await libroService.confirmarCompraLibro(
      req.params.id,
      cantidad,
      req.user._id,
      req.body.id_transaccion,
      req.body.id_reserva
    );

    await req.logActivity('venta', 'compra_libro', {
      id_libro: req.params.id,
      titulo_libro: libro.titulo,
      detalles: {
        cantidad: cantidad,
        id_transaccion: req.body.id_transaccion
      },
      nivel_importancia: 'alto'
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error en controlador confirmarCompraLibro:', error);
    return next(new AppError(`Error al confirmar compra: ${error.message}`, 400));
  }
});

module.exports = {
  getLibros,
  getLibroPorId,
  crearLibro,
  actualizarLibro,
  eliminarLibro,
  eliminarLibroPermanente,
  buscarLibros,
  registrarInteraccion,
  getRecomendaciones,
  getLibrosConDescuento,
  getLibrosDestacados,
  calificarLibro,
  marcarComoHistorico,
  agregarEjemplar,
  actualizarEjemplar,
  eliminarEjemplar,
  agregarDescuento,
  desactivarDescuentos,
  subirImagenLibro,
  actualizarOrdenImagenes,
  eliminarImagenLibro,
  reservarStockLibro,
  liberarStockLibro,
  confirmarCompraLibro,
  autocompletarTerminos, 
  busquedaDifusa 
};