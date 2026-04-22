// src/middleware/profileUploadMiddleware.js
const multer = require('multer');
const AppError = require('../utils/appError');
const path = require('path');
const fs = require('fs');

// Función para asegurar que existe un directorio
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Directorio creado: ${dirPath}`);
    } catch (err) {
      console.error(`Error al crear directorio ${dirPath}:`, err);
      throw new Error(`No se pudo crear el directorio: ${dirPath}`);
    }
  }
};

// Configurar almacenamiento para multer
const storage = multer.memoryStorage(); // Usar almacenamiento en memoria para mayor control

// Filtro de archivos para permitir solo imágenes
const fileFilter = (req, file, cb) => {
  // Aceptar solo imágenes
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('El archivo no es una imagen. Por favor, suba solo imágenes.', 400), false);
  }
};

// Configuración básica de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limitar a 2MB
  }
});

// Middleware para subir una foto de perfil
const uploadProfileImage = (req, res, next) => {
  // Verificar y crear directorios
  try {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    const profilesDir = path.join(uploadDir, 'profiles');
    
    ensureDirectoryExists(uploadDir);
    ensureDirectoryExists(profilesDir);
    
    console.log('Directorios de upload verificados:', { uploadDir, profilesDir });
    
    // Continuar con el upload
    upload.single('foto_perfil')(req, res, (err) => {
      if (err) {
        console.error('Error en upload:', err);
        return handleMulterError(err, req, res, next);
      }
      
      // Si llegamos aquí, el archivo está en req.file (en memoria)
      if (req.file) {
        console.log('Archivo recibido:', req.file.originalname, req.file.mimetype, req.file.size);
        
        // Obtener ID del usuario
        const userId = req.params.id || req.user._id;
        
        // Guardar el archivo en el sistema de archivos
        const extension = path.extname(req.file.originalname).toLowerCase();
        const nombreArchivo = `user_${userId}_${Date.now()}${extension}`;
        const rutaArchivo = path.join(profilesDir, nombreArchivo);
        
        fs.writeFile(rutaArchivo, req.file.buffer, (err) => {
          if (err) {
            console.error('Error guardando archivo:', err);
            return next(new AppError('Error al guardar el archivo en el sistema', 500));
          }
          
          console.log('Archivo guardado exitosamente en:', rutaArchivo);
          
          // Agregar información del archivo guardado a req.file
          req.file.path = rutaArchivo;
          req.file.filename = nombreArchivo;
          
          // Crear URL para acceder a la imagen
          const baseUrl = process.env.BASE_URL || 'https://librosfera.onrender.com/';
          req.file.url = `${baseUrl}/uploads/profiles/${nombreArchivo}`;
          
          next();
        });
      } else {
        console.warn('No se recibió ningún archivo');
        next();
      }
    });
  } catch (error) {
    console.error('Error preparando upload:', error);
    next(new AppError(`Error preparando upload: ${error.message}`, 500));
  }
};

// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('El archivo es demasiado grande. Máximo 2MB permitidos.', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Campo de archivo incorrecto, use "foto_perfil".', 400));
    }
    return next(new AppError(`Error al subir archivo: ${err.message}`, 400));
  }
  next(err);
};

// Verificar que los directorios de upload existan
const checkUploadDirs = (req, res, next) => {
  try {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    const profilesDir = path.join(uploadDir, 'profiles');
    
    // Crear directorios si no existen
    ensureDirectoryExists(uploadDir);
    ensureDirectoryExists(profilesDir);
    
    console.log('Directorios verificados antes de upload');
    next();
  } catch (error) {
    return next(new AppError(`Error preparando directorios: ${error.message}`, 500));
  }
};

module.exports = {
  uploadProfileImage,
  handleMulterError,
  checkUploadDirs
};