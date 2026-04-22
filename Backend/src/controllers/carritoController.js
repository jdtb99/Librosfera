// src/controllers/carritoController.js
const { carritoService } = require('../../Database/services');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Obtener carrito del usuario actual
 * @route   GET /api/v1/carrito
 * @access  Private/Cliente
 */
const obtenerCarrito = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para ver su carrito', 401));
    }

    const resultado = await carritoService.obtenerCarritoUsuario(req.user._id);

    return res.status(200).json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    console.error('Error obteniendo carrito:', error);
    return next(new AppError(`Error al obtener carrito: ${error.message}`, 500));
  }
});

/**
 * @desc    Agregar libro al carrito
 * @route   POST /api/v1/carrito/agregar
 * @access  Private/Cliente
 */
const agregarLibro = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para agregar productos al carrito', 401));
    }

    const { id_libro, cantidad = 1 } = req.body;

    if (!id_libro) {
      return next(new AppError('El ID del libro es obligatorio', 400));
    }

    if (cantidad < 1 || cantidad > 3) {
      return next(new AppError('La cantidad debe estar entre 1 y 3', 400));
    }

    console.log(`Usuario ${req.user._id} agregando ${cantidad} del libro ${id_libro}`);

    const resultado = await carritoService.agregarLibroAlCarrito(
      req.user._id,
      id_libro,
      parseInt(cantidad)
    );

    await req.logActivity('carrito', 'agregar_producto', {
      detalles: {
        id_libro: id_libro,
        cantidad: cantidad
      }
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error agregando libro al carrito:', error);
    return next(new AppError(`Error al agregar libro: ${error.message}`, 400));
  }
});

/**
 * @desc    Actualizar cantidad de un item en el carrito
 * @route   PUT /api/v1/carrito/item/:idLibro
 * @access  Private/Cliente
 */
const actualizarCantidad = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para modificar su carrito', 401));
    }

    const { idLibro } = req.params;
    const { cantidad } = req.body;

    if (cantidad === undefined || cantidad < 0 || cantidad > 3) {
      return next(new AppError('La cantidad debe estar entre 0 y 3', 400));
    }

    console.log(`Usuario ${req.user._id} actualizando cantidad del libro ${idLibro} a ${cantidad}`);

    const resultado = await carritoService.actualizarCantidadItem(
      req.user._id,
      idLibro,
      parseInt(cantidad)
    );

    await req.logActivity('carrito', 'actualizar_cantidad', {
      detalles: {
        id_libro: idLibro,
        nueva_cantidad: cantidad
      }
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error actualizando cantidad:', error);
    return next(new AppError(`Error al actualizar cantidad: ${error.message}`, 400));
  }
});

/**
 * @desc    Quitar libro del carrito
 * @route   DELETE /api/v1/carrito/item/:idLibro
 * @access  Private/Cliente
 */
const quitarLibro = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para modificar su carrito', 401));
    }

    const { idLibro } = req.params;

    console.log(`Usuario ${req.user._id} quitando libro ${idLibro} del carrito`);

    const resultado = await carritoService.quitarLibroDelCarrito(req.user._id, idLibro);

    await req.logActivity('carrito', 'quitar_producto', {
      detalles: {
        id_libro: idLibro
      }
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error quitando libro del carrito:', error);
    return next(new AppError(`Error al quitar libro: ${error.message}`, 400));
  }
});

/**
 * @desc    Vaciar carrito
 * @route   DELETE /api/v1/carrito
 * @access  Private/Cliente
 */
const vaciarCarrito = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para vaciar su carrito', 401));
    }

    console.log(`Usuario ${req.user._id} vaciando su carrito`);

    const resultado = await carritoService.vaciarCarrito(req.user._id);

    await req.logActivity('carrito', 'vaciar_carrito', {
      nivel_importancia: 'medio'
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error vaciando carrito:', error);
    return next(new AppError(`Error al vaciar carrito: ${error.message}`, 500));
  }
});

/**
 * @desc    Aplicar código de descuento
 * @route   POST /api/v1/carrito/codigo-descuento
 * @access  Private/Cliente
 */
const aplicarCodigoDescuento = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para aplicar códigos de descuento', 401));
    }

    const { codigo_descuento } = req.body;

    if (!codigo_descuento) {
      return next(new AppError('El código de descuento es obligatorio', 400));
    }

    console.log(`Usuario ${req.user._id} aplicando código ${codigo_descuento}`);

    const resultado = await carritoService.aplicarCodigoDescuento(
      req.user._id, 
      codigo_descuento.toUpperCase().trim()
    );

    await req.logActivity('carrito', 'aplicar_codigo_descuento', {
      detalles: {
        codigo_descuento: codigo_descuento,
        items_afectados: resultado.items_afectados,
        descuento_aplicado: resultado.descuento_aplicado
      }
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error aplicando código de descuento:', error);
    return next(new AppError(`Error al aplicar código: ${error.message}`, 400));
  }
});

/**
 * @desc    Quitar código de descuento
 * @route   DELETE /api/v1/carrito/codigo-descuento/:codigo
 * @access  Private/Cliente
 */
const quitarCodigoDescuento = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para quitar códigos de descuento', 401));
    }

    const { codigo } = req.params;

    console.log(`Usuario ${req.user._id} quitando código ${codigo}`);

    const resultado = await carritoService.quitarCodigoDescuento(req.user._id, codigo);

    await req.logActivity('carrito', 'quitar_codigo_descuento', {
      detalles: {
        codigo_descuento: codigo,
        items_afectados: resultado.items_afectados
      }
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error quitando código de descuento:', error);
    return next(new AppError(`Error al quitar código: ${error.message}`, 400));
  }
});

/**
 * @desc    Confirmar cambios de precio
 * @route   POST /api/v1/carrito/confirmar-precios
 * @access  Private/Cliente
 */
const confirmarCambiosPrecios = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para confirmar cambios', 401));
    }

    const { id_libro } = req.body; // Opcional: confirmar solo un libro específico

    console.log(`Usuario ${req.user._id} confirmando cambios de precio`);

    const resultado = await carritoService.confirmarCambiosPrecio(req.user._id, id_libro);

    await req.logActivity('carrito', 'confirmar_cambios_precio', {
      detalles: {
        items_confirmados: resultado.items_confirmados,
        id_libro: id_libro
      }
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error confirmando cambios de precio:', error);
    return next(new AppError(`Error al confirmar cambios: ${error.message}`, 400));
  }
});

/**
 * @desc    Calcular total del carrito
 * @route   GET /api/v1/carrito/total
 * @access  Private/Cliente
 */
const calcularTotal = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para ver el total', 401));
    }

    const totales = await carritoService.calcularTotalCarrito(req.user._id);

    return res.status(200).json({
      status: 'success',
      data: totales
    });
  } catch (error) {
    console.error('Error calculando total:', error);
    return next(new AppError(`Error al calcular total: ${error.message}`, 500));
  }
});

// CONTROLADORES ADMINISTRATIVOS (mantienen la misma lógica, solo cambiando nombres)

const listarCarritos = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para ver todos los carritos', 403));
    }

    const {
      estado, usuario, fecha_desde, fecha_hasta,
      page = 1, limit = 10
    } = req.query;

    const filtros = { estado, usuario, fecha_desde, fecha_hasta };

    console.log('Admin listando carritos con filtros:', JSON.stringify(filtros, null, 2));

    const resultado = await carritoService.listarCarritos(
      filtros,
      parseInt(page),
      parseInt(limit)
    );

    return res.status(200).json({
      status: 'success',
      resultados: resultado.datos.length,
      paginacion: resultado.paginacion,
      data: resultado.datos
    });
  } catch (error) {
    console.error('Error listando carritos:', error);
    return next(new AppError(`Error al listar carritos: ${error.message}`, 500));
  }
});

const obtenerEstadisticas = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para ver estadísticas', 403));
    }

    console.log('Admin obteniendo estadísticas de carritos');

    const estadisticas = await carritoService.obtenerEstadisticasAdmin();

    return res.status(200).json({
      status: 'success',
      data: estadisticas
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return next(new AppError(`Error al obtener estadísticas: ${error.message}`, 500));
  }
});

const quitarProductoDeCarritos = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para quitar productos de carritos', 403));
    }

    const { idLibro } = req.params;
    const { razon } = req.body;

    console.log(`Admin quitando libro ${idLibro} de todos los carritos`);

    const resultado = await carritoService.quitarProductoDeCarritos(
      idLibro,
      razon || 'Removido por administrador'
    );

    await req.logActivity('administracion', 'quitar_producto_carritos', {
      entidad_afectada: {
        tipo: 'libro',
        id: idLibro
      },
      detalles: {
        carritos_afectados: resultado.carritos_afectados,
        razon: razon
      },
      nivel_importancia: 'alto'
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error quitando producto de carritos:', error);
    return next(new AppError(`Error al quitar producto: ${error.message}`, 500));
  }
});

const vaciarCarritoCliente = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para vaciar carritos de clientes', 403));
    }

    const { idUsuario } = req.params;

    console.log(`Admin vaciando carrito del usuario ${idUsuario}`);

    const resultado = await carritoService.vaciarCarritoCliente(idUsuario);

    await req.logActivity('administracion', 'vaciar_carrito_cliente', {
      entidad_afectada: {
        tipo: 'usuario',
        id: idUsuario
      },
      nivel_importancia: 'medio'
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error vaciando carrito de cliente:', error);
    return next(new AppError(`Error al vaciar carrito: ${error.message}`, 500));
  }
});

const vaciarTodosLosCarritos = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || req.user.tipo_usuario !== 'root') {
      return next(new AppError('No tiene permisos para vaciar todos los carritos', 403));
    }

    console.log('Root vaciando todos los carritos');

    const resultado = await carritoService.vaciarTodosLosCarritos();

    await req.logActivity('administracion', 'vaciar_todos_carritos', {
      detalles: {
        carritos_afectados: resultado.carritos_afectados
      },
      nivel_importancia: 'critico'
    });

    return res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    console.error('Error vaciando todos los carritos:', error);
    return next(new AppError(`Error al vaciar carritos: ${error.message}`, 500));
  }
});

const obtenerProductoMasPopular = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para ver estadísticas detalladas', 403));
    }

    console.log('Admin obteniendo producto más popular en carritos');

    const resultado = await carritoService.obtenerProductoMasPopular();

    return res.status(200).json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    console.error('Error obteniendo producto más popular:', error);
    return next(new AppError(`Error al obtener producto popular: ${error.message}`, 500));
  }
});

module.exports = {
  // Controladores de cliente
  obtenerCarrito,
  agregarLibro,
  actualizarCantidad,
  quitarLibro,
  vaciarCarrito,
  aplicarCodigoDescuento,
  quitarCodigoDescuento,
  confirmarCambiosPrecios,
  calcularTotal,
  
  // Controladores administrativos
  listarCarritos,
  obtenerEstadisticas,
  quitarProductoDeCarritos,
  vaciarCarritoCliente,
  vaciarTodosLosCarritos,
  obtenerProductoMasPopular
};