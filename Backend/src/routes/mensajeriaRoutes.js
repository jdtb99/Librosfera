//src/routes/mensajeriaRoutes.js
const express = require('express');
const router = express.Router();

const {
  crearConversacion,
  obtenerConversaciones,
  obtenerConversacion,
  enviarMensaje,
  marcarComoLeida,
  cambiarEstado,
  asignarAdministrador,
  buscar,
  obtenerEstadisticas,
  obtenerContadores
} = require('../controllers/mensajeriaController');

const {
  uploadMensajeArchivos,
  handleUploadErrors,
  checkUploadDirs,
  procesarArchivos
} = require('../middleware/mensajeUploadMiddleware');

const { protect, authorize } = require('../middleware/authMiddleware');

// Aplicar protección a todas las rutas
router.use(protect);

// Rutas generales
router.get('/buscar', buscar);
router.get('/contadores', obtenerContadores);

// Rutas de conversaciones
router.route('/conversaciones')
  .get(obtenerConversaciones)
  .post(
    authorize('cliente'), // Solo clientes pueden crear conversaciones
    checkUploadDirs,
    uploadMensajeArchivos,
    handleUploadErrors,
    procesarArchivos,
    crearConversacion
  );

router.get('/conversaciones/:id', obtenerConversacion);

// Rutas de mensajes
router.post(
  '/conversaciones/:id/mensajes',
  checkUploadDirs,
  uploadMensajeArchivos,
  handleUploadErrors,
  procesarArchivos,
  enviarMensaje
);

// Rutas de administración
router.patch('/conversaciones/:id/leer', marcarComoLeida);
router.patch(
  '/conversaciones/:id/estado',
  authorize('administrador', 'root'),
  cambiarEstado
);
router.patch(
  '/conversaciones/:id/asignar',
  authorize('administrador', 'root'),
  asignarAdministrador
);

// Rutas de estadísticas (solo admins)
router.get(
  '/estadisticas',
  authorize('administrador', 'root'),
  obtenerEstadisticas
);

module.exports = router;