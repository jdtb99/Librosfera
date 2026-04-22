// src/routes/devolucionRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const {
  obtenerMisDevoluciones,
  obtenerDetalleDevolucion,
  cancelarDevolucionCliente,
  subirDocumento,
  obtenerDevoluciones,
  aprobarDevolucion,
  rechazarDevolucion,
  marcarComoRecibida,
  inspeccionarItem,
  procesarReembolso,
  obtenerEstadisticas,
  cancelarDevolucionAdmin,
  agregarComunicacion,
  obtenerResumenDevolucionesPorVenta,
  procesarDevolucionesExpiradas
} = require('../controllers/devolucionController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Configuración de multer para documentos de devoluciones
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    const devolucionesDir = path.join(uploadDir, 'devoluciones', 'temp');
    
    const fs = require('fs');
    if (!fs.existsSync(devolucionesDir)) {
      fs.mkdirSync(devolucionesDir, { recursive: true });
    }
    
    cb(null, devolucionesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes, videos y PDFs.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: fileFilter
});

// Todas las rutas requieren autenticación
router.use(protect);

// RUTAS DE CLIENTE

// Obtener mis devoluciones (CON INFORMACIÓN DE VENTA)
router.get('/mis-devoluciones', authorize('cliente'), obtenerMisDevoluciones);

// Cancelar mi devolución (cliente)
router.patch('/:codigoDevolucion/cancelar', authorize('cliente'), cancelarDevolucionCliente);

// Subir documento para devolución
router.post('/:codigoDevolucion/documentos', 
  authorize('cliente', 'administrador', 'root'),
  upload.single('documento'),
  subirDocumento
);

// RUTAS ADMINISTRATIVAS

// Obtener estadísticas de devoluciones (CON MÉTRICAS MEJORADAS)
router.get('/estadisticas', authorize('administrador', 'root'), obtenerEstadisticas);

// NUEVO: Obtener resumen de devoluciones por venta específica
router.get('/venta/:numeroVenta/resumen', 
  authorize('administrador', 'root'), 
  obtenerResumenDevolucionesPorVenta
);

// NUEVO: Procesar devoluciones expiradas automáticamente
router.post('/procesar-expiradas', 
  authorize('administrador', 'root'), 
  procesarDevolucionesExpiradas
);

// Obtener todas las devoluciones (admin) - CON INFORMACIÓN DE VENTA
router.get('/admin/todas', authorize('administrador', 'root'), obtenerDevoluciones);

// Aprobar devolución
router.patch('/:codigoDevolucion/aprobar', authorize('administrador', 'root'), aprobarDevolucion);

// Rechazar devolución
router.patch('/:codigoDevolucion/rechazar', authorize('administrador', 'root'), rechazarDevolucion);

// Marcar como recibida
router.patch('/:codigoDevolucion/recibir', authorize('administrador', 'root'), marcarComoRecibida);

// Inspeccionar item específico
router.patch('/:codigoDevolucion/items/:idItem/inspeccionar', 
  authorize('administrador', 'root'), 
  inspeccionarItem
);

// Procesar reembolso (CON SINCRONIZACIÓN COMPLETA)
router.patch('/:codigoDevolucion/reembolsar', authorize('administrador', 'root'), procesarReembolso);

// Cancelar devolución (admin)
router.delete('/:codigoDevolucion', authorize('administrador', 'root'), cancelarDevolucionAdmin);

// Agregar comunicación
router.post('/:codigoDevolucion/comunicaciones', 
  authorize('administrador', 'root'), 
  agregarComunicacion
);

// RUTAS MIXTAS (Cliente para sus devoluciones, Admin para cualquiera)

// Obtener detalle de devolución específica (CON INFORMACIÓN COMPLETA DE VENTA)
router.get('/:codigoDevolucion', obtenerDetalleDevolucion);

// Middleware de manejo de errores de multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'El archivo es demasiado grande. Máximo 10MB.'
      });
    }
  }
  
  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;