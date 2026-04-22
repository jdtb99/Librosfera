// src/routes/carritoRoutes.js
const express = require('express');
const router = express.Router();

const {
  obtenerCarrito,
  agregarLibro,
  actualizarCantidad,
  quitarLibro,
  vaciarCarrito,
  aplicarCodigoDescuento,
  quitarCodigoDescuento,
  confirmarCambiosPrecios,
  calcularTotal,
  listarCarritos,
  obtenerEstadisticas,
  quitarProductoDeCarritos,
  vaciarCarritoCliente,
  vaciarTodosLosCarritos,
  obtenerProductoMasPopular
} = require('../controllers/carritoController');

const { protect, authorize } = require('../middleware/authMiddleware');



// RUTAS DE CLIENTE (requieren autenticación)

// Obtener carrito del usuario
router.get('/', protect, obtenerCarrito);

// Agregar libro al carrito
router.post('/agregar', protect, agregarLibro);

// Actualizar cantidad de un item
router.put('/item/:idLibro', protect, actualizarCantidad);

// Quitar libro del carrito
router.delete('/item/:idLibro', protect, quitarLibro);

// Vaciar carrito
router.delete('/', protect, vaciarCarrito);

// Aplicar código de descuento
router.post('/codigo-descuento', protect, aplicarCodigoDescuento);

// Quitar código de descuento
router.delete('/codigo-descuento/:codigo', protect, quitarCodigoDescuento);

// Confirmar cambios de precio
router.post('/confirmar-precios', protect, confirmarCambiosPrecios);

// Calcular total del carrito
router.get('/total', protect, calcularTotal);

// RUTAS ADMINISTRATIVAS

// Listar todos los carritos
router.get('/admin/todos', protect, authorize('administrador', 'root'), listarCarritos);

// Obtener estadísticas de carritos
router.get('/admin/estadisticas', protect, authorize('administrador', 'root'), obtenerEstadisticas);

// Obtener producto más popular
router.get('/admin/producto-popular', protect, authorize('administrador', 'root'), obtenerProductoMasPopular);

// Quitar producto de todos los carritos
router.delete('/admin/producto/:idLibro', protect, authorize('administrador', 'root'), quitarProductoDeCarritos);

// Vaciar carrito de un cliente específico
router.delete('/admin/cliente/:idUsuario', protect, authorize('administrador', 'root'), vaciarCarritoCliente);

// Vaciar todos los carritos (solo root)
router.delete('/admin/todos', protect, authorize('root'), vaciarTodosLosCarritos);

module.exports = router;