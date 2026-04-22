// src/routes/activityLogRoutes.js
const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Actividades
 *   description: Gestión de registros de actividad
 */

/**
 * @swagger
 * /api/v1/activities/recent:
 *   get:
 *     summary: Obtener actividades recientes
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Cantidad de actividades a devolver
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filtrar por tipo de actividad
 *     responses:
 *       200:
 *         description: Lista de actividades recientes
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 */
router.get('/recent', protect, authorize('administrador', 'root'), activityLogController.getRecentActivities);

/**
 * @swagger
 * /api/v1/activities/search:
 *   post:
 *     summary: Búsqueda avanzada de actividades
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fechaInicio:
 *                 type: string
 *                 format: date
 *               fechaFin:
 *                 type: string
 *                 format: date
 *               tipo_actividad:
 *                 type: string
 *               accion:
 *                 type: string
 *               nivel_importancia:
 *                 type: string
 *               texto_busqueda:
 *                 type: string
 *               pagina:
 *                 type: integer
 *                 default: 1
 *               limite:
 *                 type: integer
 *                 default: 50
 *     responses:
 *       200:
 *         description: Resultados de la búsqueda
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 */
router.post('/search', protect, authorize('administrador', 'root'), activityLogController.searchActivities);

/**
 * @swagger
 * /api/v1/activities/dashboard:
 *   get:
 *     summary: Obtener actividades destacadas para el dashboard
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Actividades destacadas
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 */
router.get('/dashboard', protect, authorize('administrador', 'root'), activityLogController.getDashboardActivities);

/**
 * @swagger
 * /api/v1/activities/user/{id}:
 *   get:
 *     summary: Obtener actividades de un usuario específico
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Actividades del usuario
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 */
router.get('/user/:id', protect, authorize('administrador', 'root'), activityLogController.getUserActivities);

/**
 * @swagger
 * /api/v1/activities/entity/{tipo}/{id}:
 *   get:
 *     summary: Obtener actividades relacionadas con una entidad
 *     tags: [Actividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tipo
 *         schema:
 *           type: string
 *         required: true
 *         description: Tipo de entidad (libro, usuario, etc.)
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID de la entidad
 *     responses:
 *       200:
 *         description: Actividades relacionadas con la entidad
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 */
router.get('/entity/:tipo/:id', protect, authorize('administrador', 'root'), activityLogController.getEntityActivities);

module.exports = router;