// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Gestión de autenticación y tokens
 */

/**
 * @swagger
 * /api/v1/auth/verify-token:
 *   get:
 *     summary: Verificar si un token es válido y obtener información del usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token válido con información del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60d0fe4f5311236168a109ca
 *                     usuario:
 *                       type: string
 *                       example: juanperez
 *                     email:
 *                       type: string
 *                       example: juan@ejemplo.com
 *                     tipo_usuario:
 *                       type: string
 *                       enum: [cliente, administrador, root]
 *                       example: cliente
 *                 tokenInfo:
 *                   type: object
 *                   properties:
 *                     expiresIn:
 *                       type: number
 *                       description: Segundos restantes de validez del token
 *                       example: 1209600
 *                     expirationDate:
 *                       type: string
 *                       format: date-time
 *                       example: 2023-07-15T12:00:00.000Z
 *       401:
 *         description: Token inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: fail
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: El token ha expirado. Por favor inicie sesión nuevamente
 */
router.get('/verify-token', verifyToken);

module.exports = router;