// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile, 
  deleteUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUserById,
  createAdmin,
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadUserPhoto,
  deleteUserPhoto
} = require('../controllers/userController');
const { 
  uploadProfileImage, 
  checkUploadDirs 
} = require('../middleware/profileUploadMiddleware');

const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: Gestión de usuarios
 */

/**
 * @swagger
 * /api/v1/users/register:
 *   post:
 *     summary: Registrar un nuevo usuario cliente
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usuario
 *               - email
 *               - password
 *               - tipo_usuario
 *               - DNI
 *               - nombres
 *               - apellidos
 *             properties:
 *               usuario:
 *                 type: string
 *                 example: cliente1
 *               email:
 *                 type: string
 *                 format: email
 *                 example: cliente@ejemplo.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Contraseña123
 *               tipo_usuario:
 *                 type: string
 *                 enum: [cliente]
 *                 example: cliente
 *               DNI:
 *                 type: string
 *                 example: 12345678A
 *               nombres:
 *                 type: string
 *                 example: Juan
 *               apellidos:
 *                 type: string
 *                 example: García López
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *                 example: 1990-05-15
 *               lugar_nacimiento:
 *                 type: string
 *                 example: Madrid
 *               genero:
 *                 type: string
 *                 enum: [Masculino, Femenino, Otro, Prefiero no decir]
 *                 example: Masculino
 *               direcciones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     calle:
 *                       type: string
 *                       example: Calle Principal 123
 *                     ciudad:
 *                       type: string
 *                       example: Madrid
 *                     codigo_postal:
 *                       type: string
 *                       example: 28001
 *                     pais:
 *                       type: string
 *                       example: España
 *               telefono:
 *                 type: string
 *                 example: 612345678
 *               suscrito_noticias:
 *                 type: boolean
 *                 example: true
 *               preferencias:
 *                 type: object
 *                 properties:
 *                   temas:
 *                     type: array
 *                     items:
 *                       type: string
 *                       example: Ficcion
 *                   autores:
 *                     type: array
 *                     items:
 *                       type: string
 *                       example: Gabriel García Márquez
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/users/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: cliente@ejemplo.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Contraseña123
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso
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
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Obtener perfil de usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil de usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Actualizar perfil de usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombres:
 *                 type: string
 *               apellidos:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direcciones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     calle:
 *                       type: string
 *                     ciudad:
 *                       type: string
 *                     codigo_postal:
 *                       type: string
 *                     pais:
 *                       type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Desactivar cuenta de usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cuenta desactivada
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
 *                   example: Usuario desactivado correctamente
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Obtener lista de usuarios (solo admin y root)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad de resultados por página
 *       - in: query
 *         name: tipo_usuario
 *         schema:
 *           type: string
 *           enum: [cliente, administrador, root]
 *         description: Filtrar por tipo de usuario
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
 *     responses:
 *       200:
 *         description: Lista de usuarios
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
 *                   example: 10
 *                 paginacion:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 50
 *                     pagina:
 *                       type: integer
 *                       example: 1
 *                     limite:
 *                       type: integer
 *                       example: 10
 *                     totalPaginas:
 *                       type: integer
 *                       example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Prohibido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Obtener usuario por ID (solo admin y root)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del usuario, ID_CLIENTE, o email
 *     responses:
 *       200:
 *         description: Datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Usuario'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Actualizar usuario por ID (solo admin y root)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               nombres:
 *                 type: string
 *               apellidos:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Usuario'
 *       403:
 *         description: Prohibido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Desactivar usuario por ID (solo admin y root)
 *     tags: [Usuarios]
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
 *         description: Usuario desactivado
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
 *                   example: Usuario desactivado correctamente
 *       403:
 *         description: Prohibido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /users/admin:
 *   post:
 *     summary: Crear usuario administrador con datos mínimos (solo root)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@ejemplo.com
 *                 description: Correo electrónico (obligatorio)
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin123
 *                 description: Contraseña (obligatorio)
 *               usuario:
 *                 type: string
 *                 example: admin1
 *                 description: Nombre de usuario (opcional, generado automáticamente si no se proporciona)
 *               DNI:
 *                 type: string
 *                 example: 87654321B
 *                 description: Documento de identidad (opcional)
 *               nombres:
 *                 type: string
 *                 example: Ana
 *                 description: Nombres (opcional)
 *               apellidos:
 *                 type: string
 *                 example: Martínez Ruiz
 *                 description: Apellidos (opcional)
 *               cargo:
 *                 type: string
 *                 example: Gerente de Ventas
 *                 description: Cargo en la empresa (opcional)
 *               departamento:
 *                 type: string
 *                 example: Ventas
 *                 description: Departamento (opcional)
 *     responses:
 *       201:
 *         description: Administrador creado exitosamente
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
 *                   example: Administrador creado con datos mínimos. Se requiere completar el perfil
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 60d0fe4f5311236168a109cb
 *                     usuario:
 *                       type: string
 *                       example: admin@ejemplo.com_admin
 *                     email:
 *                       type: string
 *                       example: admin@ejemplo.com
 *                     tipo_usuario:
 *                       type: string
 *                       example: administrador
 *                     perfil_completo:
 *                       type: boolean
 *                       example: false
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Prohibido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @swagger
 * /api/v1/users/profile/foto:
 *   post:
 *     summary: Subir foto de perfil
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - foto_perfil
 *             properties:
 *               foto_perfil:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Foto de perfil actualizada correctamente
 *       400:
 *         description: Error al subir imagen
 *       401:
 *         description: No autorizado
 *   delete:
 *     summary: Eliminar foto de perfil (restaurar a default)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Foto de perfil eliminada correctamente
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /api/v1/users/{id}/foto:
 *   post:
 *     summary: Subir foto de perfil para otro usuario (admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - foto_perfil
 *             properties:
 *               foto_perfil:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Foto de perfil actualizada correctamente
 *       400:
 *         description: Error al subir imagen
 *       403:
 *         description: No tiene permisos
 *   delete:
 *     summary: Eliminar foto de perfil de otro usuario (admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Foto de perfil eliminada correctamente
 *       403:
 *         description: No tiene permisos
 *       404:
 *         description: Usuario no encontrado
 */

// Rutas públicas
router.post('/login', loginUser);

// Registro de usuarios (clientes sin autenticación, otros roles con autenticación)
router.post('/register', registerUser);

// Rutas protegidas para cualquier usuario autenticado
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.delete('/profile', protect, deleteUser);
router.post(
  '/profile/foto', 
  protect, 
  checkUploadDirs,
  uploadProfileImage,
  uploadProfilePhoto
);

router.delete(
  '/profile/foto', 
  protect, 
  deleteProfilePhoto
);

// Rutas protegidas para administradores y root
router.get('/', protect, authorize('administrador', 'root'), getUsers);
router.get('/:id', protect, authorize('administrador', 'root'), getUserById);
router.put('/:id', protect, authorize('administrador', 'root'), updateUser);
router.delete('/:id', protect, authorize('administrador', 'root'), deleteUserById);

// Rutas específicas para administradores y root
// router.post('/admin', protect, authorize('root'), registerUser); // Ruta específica para crear administradores
router.post('/admin', protect, authorize('root'), createAdmin);
router.post(
  '/:id/foto', 
  protect, 
  authorize('administrador', 'root'), 
  checkUploadDirs,
  uploadProfileImage,
  uploadUserPhoto
);

router.delete(
  '/:id/foto', 
  protect, 
  authorize('administrador', 'root'), 
  deleteUserPhoto
);

module.exports = router;