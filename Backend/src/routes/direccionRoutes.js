// src/routes/direccionRoutes.js
const express = require('express');
const router = express.Router();

const {
  obtenerDirecciones,
  agregarDireccion,
  actualizarDireccion,
  eliminarDireccion,
  establecerDireccionPredeterminada,
  obtenerDireccionPredeterminada
} = require('../controllers/direccionController');

const { protect } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Direcciones
 *   description: Gestión de direcciones de envío del usuario
 */

/**
 * @swagger
 * /api/v1/direcciones:
 *   get:
 *     summary: Obtener todas las direcciones del usuario
 *     tags: [Direcciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de direcciones del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 resultados:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       tipo:
 *                         type: string
 *                         enum: [casa, trabajo, otro]
 *                       direccion_completa:
 *                         type: string
 *                       ciudad:
 *                         type: string
 *                       departamento:
 *                         type: string
 *                       codigo_postal:
 *                         type: string
 *                       pais:
 *                         type: string
 *                       telefono_contacto:
 *                         type: string
 *                       referencia:
 *                         type: string
 *                       predeterminada:
 *                         type: boolean
 *       401:
 *         description: No autorizado
 *   post:
 *     summary: Agregar nueva dirección
 *     tags: [Direcciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - direccion_completa
 *               - ciudad
 *               - departamento
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [casa, trabajo, otro]
 *                 default: casa
 *               direccion_completa:
 *                 type: string
 *                 example: "Calle 123 #45-67, Apartamento 8B"
 *               ciudad:
 *                 type: string
 *                 example: "Bogotá"
 *               departamento:
 *                 type: string
 *                 example: "Cundinamarca"
 *               codigo_postal:
 *                 type: string
 *                 example: "110111"
 *               pais:
 *                 type: string
 *                 default: "Colombia"
 *               telefono_contacto:
 *                 type: string
 *                 example: "+57 300 123 4567"
 *               referencia:
 *                 type: string
 *                 example: "Edificio azul, al lado del parque"
 *               predeterminada:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Dirección creada exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 */
router.route('/')
  .get(obtenerDirecciones)
  .post(agregarDireccion);

/**
 * @swagger
 * /api/v1/direcciones/predeterminada:
 *   get:
 *     summary: Obtener dirección predeterminada del usuario
 *     tags: [Direcciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dirección predeterminada del usuario
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
 *                   nullable: true
 *       401:
 *         description: No autorizado
 */
router.get('/predeterminada', obtenerDireccionPredeterminada);

/**
 * @swagger
 * /api/v1/direcciones/{id}:
 *   put:
 *     summary: Actualizar una dirección específica
 *     tags: [Direcciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la dirección
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [casa, trabajo, otro]
 *               direccion_completa:
 *                 type: string
 *               ciudad:
 *                 type: string
 *               departamento:
 *                 type: string
 *               codigo_postal:
 *                 type: string
 *               telefono_contacto:
 *                 type: string
 *               referencia:
 *                 type: string
 *               predeterminada:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Dirección actualizada exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Dirección no encontrada
 *   delete:
 *     summary: Eliminar una dirección
 *     tags: [Direcciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la dirección
 *     responses:
 *       200:
 *         description: Dirección eliminada exitosamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Dirección no encontrada
 */
router.route('/:id')
  .put(actualizarDireccion)
  .delete(eliminarDireccion);

/**
 * @swagger
 * /api/v1/direcciones/{id}/predeterminada:
 *   patch:
 *     summary: Establecer dirección como predeterminada
 *     tags: [Direcciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la dirección
 *     responses:
 *       200:
 *         description: Dirección establecida como predeterminada
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Dirección no encontrada
 */
router.patch('/:id/predeterminada', establecerDireccionPredeterminada);

module.exports = router;