// src/app.js (ACTUALIZADO)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importar configuraciones
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const debugMiddleware = require('./middleware/debugMiddleware');
const activityLogger = require('./middleware/activityLogMiddleware');

// Importar rutas
const userRoutes = require('./routes/userRoutes');
const passwordResetRoutes = require('./routes/passwordResetRoutes');
const authRoutes = require('./routes/authRoutes');
const libroRoutes = require('./routes/libroRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const tarjetaRoutes = require('./routes/tarjetaRoutes');
const carritoRoutes = require('./routes/carritoRoutes');
const ventaRoutes = require('./routes/ventaRoutes');
const devolucionRoutes = require('./routes/devolucionRoutes');
const direccionRoutes = require('./routes/direccionRoutes');
const tiendaRoutes = require('./routes/tiendaRoutes');
const mensajeriaRoutes = require('./routes/mensajeriaRoutes');

const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

// Inicializar app
const app = express();

// Middlewares de seguridad y utilidad
app.use(helmet()); // Seguridad con headers HTTP
app.use(cors()); // Habilitar CORS
app.use(express.json()); // Parsear JSON
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev')); // Logging

// middleware de activity logger a nivel global
app.use(activityLogger);

// Añadir middleware de depuración en ambiente de desarrollo
if (process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true') {
  app.use(debugMiddleware);
  console.log('Middleware de depuración activado');
}

// Directorio estático para archivos subidos
const uploadsPath = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
console.log('Directorio de uploads configurado en:', uploadsPath);
app.use('/uploads', express.static(uploadsPath));

// Crear directorios necesarios si no existen
const fs = require('fs');
const librosPath = path.join(uploadsPath, 'libros');
const profilesPath = path.join(uploadsPath, 'profiles');
const devolucionesPath = path.join(uploadsPath, 'devoluciones');
const mensajesPath = path.join(uploadsPath, 'mensajes');
try {
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log('Directorio de uploads creado:', uploadsPath);
  }
  if (!fs.existsSync(librosPath)) {
    fs.mkdirSync(librosPath, { recursive: true });
    console.log('Directorio de imágenes de libros creado:', librosPath);
  }
  if (!fs.existsSync(profilesPath)) {
    fs.mkdirSync(profilesPath, { recursive: true });
    console.log('Directorio de imágenes de perfiles creado:', profilesPath);
  }
  if (!fs.existsSync(devolucionesPath)) {
    fs.mkdirSync(devolucionesPath, { recursive: true });
    console.log('Directorio de documentos de devoluciones creado:', devolucionesPath);
  }
  if (!fs.existsSync(mensajesPath)) {
    fs.mkdirSync(mensajesPath, { recursive: true });
    console.log('Directorio de archivos de mensajes creado:', mensajesPath);
  }
} catch (error) {
  console.error('Error creando directorios:', error);
}

// Rutas de la API
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/users', passwordResetRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/libros', libroRoutes);
app.use('/api/v1/activities', activityLogRoutes);
app.use('/api/v1/tarjetas', tarjetaRoutes);
app.use('/api/v1/carrito', carritoRoutes);
app.use('/api/v1/ventas', ventaRoutes);
app.use('/api/v1/devoluciones', devolucionRoutes);
app.use('/api/v1/direcciones', direccionRoutes);
app.use('/api/v1/tiendas', tiendaRoutes);
app.use('/api/v1/mensajeria', mensajeriaRoutes);

// Ruta de estado
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'API funcionando correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      tiendas_fisicas: true,
      sistema_reservas: true,
      inventario_distribuido: true,
      carrito_con_reservas: true
    }
  });
});

// Ruta específica para verificar tiendas
app.get('/api/tiendas/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Sistema de tiendas físicas operativo',
    timestamp: new Date().toISOString()
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }'
}));

// Middleware de manejo de errores
app.use(notFound);
app.use(errorHandler);

if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON_JOBS === 'true') {
  const DevolucionCronJobs = require('./utils/cronJobs');
  DevolucionCronJobs.inicializarJobs();
}

module.exports = app;