// src/routes/passwordResetRoutes.js
const express = require('express');
const router = express.Router();
const {
  requestPasswordReset,
  verifyResetToken,
  resetPassword
} = require('../controllers/passwordResetController');

/**
 * @swagger
 * tags:
 *   name: Recuperación
 *   description: Gestión de recuperación de contraseña
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 *           example: Mensaje de error
 *     PasswordResetRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email asociado a la cuenta de usuario
 *           example: usuario@ejemplo.com
 *     TokenVerifyResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *           example: Token válido
 *         data:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               example: us****@ejemplo.com
 *     PasswordResetBody:
 *       type: object
 *       required:
 *         - verificationCode
 *         - password
 *         - passwordConfirm
 *       properties:
 *         verificationCode:
 *           type: string
 *           description: Código de verificación de 6 dígitos
 *           example: 123456
 *         password:
 *           type: string
 *           format: password
 *           description: Nueva contraseña (debe cumplir con los requisitos de complejidad)
 *           example: Abc123$%^
 *         passwordConfirm:
 *           type: string
 *           format: password
 *           description: Confirmación de la nueva contraseña
 *           example: Abc123$%^
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *           example: Operación realizada con éxito
 */

/**
 * @swagger
 * /api/v1/users/forgot-password:
 *   post:
 *     summary: Solicitar recuperación de contraseña
 *     description: Inicia el proceso de recuperación de contraseña enviando un correo electrónico con un enlace y código de verificación.
 *     tags: [Recuperación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetRequest'
 *     responses:
 *       200:
 *         description: Solicitud procesada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *               properties:
 *                 message:
 *                   example: Si existe una cuenta con ese email, recibirás un correo con instrucciones para restablecer tu contraseña
 *       400:
 *         description: Email no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *               properties:
 *                 message:
 *                   example: Por favor proporcione su dirección de email
 *       500:
 *         description: Error al procesar la solicitud o enviar el correo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *               properties:
 *                 message:
 *                   example: No se pudo enviar el email. Por favor intenta de nuevo más tarde
 */

/**
 * @swagger
 * /api/v1/users/reset-password/{token}:
 *   get:
 *     summary: Verificar token de recuperación
 *     description: Verifica si un token de recuperación es válido y no ha expirado.
 *     tags: [Recuperación]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Token de recuperación recibido por email
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenVerifyResponse'
 *       400:
 *         description: Token inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *               properties:
 *                 message:
 *                   example: El enlace de recuperación es inválido o ha expirado
 *       500:
 *         description: Error al procesar la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Restablecer contraseña
 *     description: Restablece la contraseña de un usuario usando el token y el código de verificación. La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.
 *     tags: [Recuperación]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Token de recuperación recibido por email
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetBody'
 *     responses:
 *       200:
 *         description: Contraseña restablecida correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *               properties:
 *                 message:
 *                   example: Contraseña restablecida con éxito
 *       400:
 *         description: Datos inválidos, token expirado o código incorrecto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *               properties:
 *                 message:
 *                   example: El código de verificación es incorrecto
 *       500:
 *         description: Error al procesar la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *               properties:
 *                 message:
 *                   example: Error al restablecer la contraseña. Por favor intenta de nuevo
 */

// Ruta para solicitar reseteo de contraseña
router.post('/forgot-password', requestPasswordReset);

// Rutas para verificar token y resetear contraseña
router.get('/reset-password/:token', verifyResetToken);
router.post('/reset-password/:token', resetPassword);

module.exports = router;