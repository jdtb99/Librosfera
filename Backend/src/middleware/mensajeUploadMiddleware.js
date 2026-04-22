//src/middleware/mensajeUploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    const mensajesDir = path.join(uploadDir, 'mensajes');
    
    // Crear directorio si no existe
    if (!fs.existsSync(mensajesDir)) {
      fs.mkdirSync(mensajesDir, { recursive: true });
    }
    
    cb(null, mensajesDir);
  },
  filename: function(req, file, cb) {
    // Generar nombre único para el archivo
    const extension = path.extname(file.originalname);
    const nombreUnico = `${uuidv4()}${extension}`;
    cb(null, nombreUnico);
  }
});

// Filtro de archivos permitidos
const fileFilter = (req, file, cb) => {
  // Tipos MIME permitidos
  const tiposPermitidos = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (tiposPermitidos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

// Configuración de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
    files: 5 // Máximo 5 archivos por mensaje
  }
});

// Middleware para subir archivos de mensajes
const uploadMensajeArchivos = upload.array('archivos', 5);

// Middleware para manejar errores de upload
const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'El archivo es demasiado grande. Tamaño máximo: 10MB'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        status: 'error',
        message: 'Demasiados archivos. Máximo permitido: 5 archivos'
      });
    }
    
    return res.status(400).json({
      status: 'error',
      message: `Error al subir archivo: ${error.message}`
    });
  }
  
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
  
  next();
};

// Middleware para verificar directorios
const checkUploadDirs = (req, res, next) => {
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
  const mensajesDir = path.join(uploadDir, 'mensajes');
  
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('Directorio de uploads creado:', uploadDir);
    }
    
    if (!fs.existsSync(mensajesDir)) {
      fs.mkdirSync(mensajesDir, { recursive: true });
      console.log('Directorio de mensajes creado:', mensajesDir);
    }
    
    next();
  } catch (error) {
    console.error('Error creando directorios:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error configurando directorios de archivos'
    });
  }
};

// Middleware para procesar archivos subidos
const procesarArchivos = (req, res, next) => {
  if (req.files && req.files.length > 0) {
    const baseUrl = process.env.BASE_URL || 'https://librosfera.onrender.com/';
    
    req.archivosData = req.files.map(file => ({
      nombre_original: file.originalname,
      nombre_archivo: file.filename,
      url: `${baseUrl}/uploads/mensajes/${file.filename}`,
      tipo_mime: file.mimetype,
      tamaño: file.size
    }));
  } else {
    req.archivosData = [];
  }
  
  next();
};

module.exports = {
  uploadMensajeArchivos,
  handleUploadErrors,
  checkUploadDirs,
  procesarArchivos
};