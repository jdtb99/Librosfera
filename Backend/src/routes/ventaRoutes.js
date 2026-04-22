// src/routes/ventaRoutes.js
const express = require('express');
const router = express.Router();

const {
  crearVenta,
  calcularPreviewVenta,
  obtenerMisVentas,
  obtenerDetalleVenta,
  cancelarVentaCliente,
  crearDevolucion,
  obtenerVentas,
  actualizarEstadoEnvio,
  cancelarVentaAdmin,
  obtenerEstadisticas,
  agregarNotaInterna
} = require('../controllers/ventaController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

/**
 * @swagger
 * /api/v1/ventas/preview:
 *   post:
 *     summary: Calcular vista previa de venta (costos estimados)
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo_envio
 *             properties:
 *               tipo_envio:
 *                 type: string
 *                 enum: [domicilio, recogida_tienda]
 *                 description: Tipo de envío
 *               cliente_pagara_impuesto:
 *                 type: boolean
 *                 default: false
 *                 description: Si el cliente pagará el impuesto por separado
 *     responses:
 *       200:
 *         description: Vista previa calculada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     subtotal_productos:
 *                       type: number
 *                       description: Subtotal sin descuentos
 *                     total_descuentos:
 *                       type: number
 *                       description: Total de descuentos aplicados
 *                     subtotal_con_descuentos:
 *                       type: number
 *                       description: Subtotal después de descuentos
 *                     envio:
 *                       type: object
 *                       properties:
 *                         tipo:
 *                           type: string
 *                         costo:
 *                           type: number
 *                         descripcion:
 *                           type: string
 *                     impuestos:
 *                       type: object
 *                       properties:
 *                         monto_total:
 *                           type: number
 *                         incluido_en_total:
 *                           type: number
 *                         a_pagar_separado:
 *                           type: number
 *                         pagado_por_cliente:
 *                           type: boolean
 *                         mensaje:
 *                           type: string
 *                     total_final:
 *                       type: number
 *                       description: Total que debe pagar el cliente
 *       400:
 *         description: Datos inválidos o carrito vacío
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /api/v1/ventas:
 *   post:
 *     summary: Crear nueva venta desde carrito
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_tarjeta
 *               - tipo_envio
 *             properties:
 *               id_tarjeta:
 *                 type: string
 *                 description: ID de la tarjeta para el pago
 *               tipo_envio:
 *                 type: string
 *                 enum: [domicilio, recogida_tienda]
 *                 description: Tipo de envío
 *               direccion_envio:
 *                 type: object
 *                 description: Dirección de envío (requerida para domicilio)
 *               id_tienda_recogida:
 *                 type: string
 *                 description: ID de tienda (requerido para recogida)
 *               notas_envio:
 *                 type: string
 *                 description: Notas adicionales para el envío
 *               cliente_pagara_impuesto:
 *                 type: boolean
 *                 default: false
 *                 description: Si el cliente pagará el impuesto por separado
 *     responses:
 *       201:
 *         description: Venta creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     numero_venta:
 *                       type: string
 *                     total_a_pagar:
 *                       type: number
 *                     estado:
 *                       type: string
 *                     envio:
 *                       type: object
 *                     impuesto:
 *                       type: object
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       402:
 *         description: Saldo insuficiente
 *       409:
 *         description: Stock insuficiente
 */

// RUTAS DE CLIENTE
router.post('/preview', authorize('cliente'), calcularPreviewVenta);
router.post('/', authorize('cliente'), crearVenta);
router.get('/mis-ventas', authorize('cliente'), obtenerMisVentas);
router.patch('/:numeroVenta/cancelar', authorize('cliente'), cancelarVentaCliente);
router.post('/:numeroVenta/devolucion', authorize('cliente'), crearDevolucion);

// RUTAS ADMINISTRATIVAS

// Obtener estadísticas de ventas (CON MÉTRICAS DE DEVOLUCIONES)
router.get('/estadisticas', authorize('administrador', 'root'), obtenerEstadisticas);

// Obtener todas las ventas (admin) - CON FILTROS DE DEVOLUCIÓN
router.get('/admin/todas', authorize('administrador', 'root'), obtenerVentas);

// Actualizar estado de envío
router.patch('/:numeroVenta/envio', authorize('administrador', 'root'), actualizarEstadoEnvio);

// Cancelar venta (admin)
router.delete('/:numeroVenta', authorize('administrador', 'root'), cancelarVentaAdmin);

// Agregar nota interna
router.post('/:numeroVenta/notas', authorize('administrador', 'root'), agregarNotaInterna);

// RUTAS MIXTAS (Cliente para sus ventas, Admin para cualquiera)

// Obtener detalle de venta específica (CON INFORMACIÓN COMPLETA DE DEVOLUCIONES)
router.get('/:numeroVenta', obtenerDetalleVenta);

module.exports = router;