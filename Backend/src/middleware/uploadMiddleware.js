// src/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const AppError = require('../utils/appError');
const { uploadBuffer, buildKey } = require('../utils/s3Client');

const PREFIX_LIBROS = 'libros';

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('El archivo no es una imagen. Por favor, suba solo imágenes.', 400), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const buildFilename = (idLibro, extension, suffix = '') => {
  const timestamp = Date.now();
  const sfx = suffix !== '' ? `_${suffix}` : '';
  return `${idLibro}_${timestamp}${sfx}${extension}`;
};

const uploadSingleImage = (req, res, next) => {
  upload.single('imagen')(req, res, async (err) => {
    if (err) return handleMulterError(err, req, res, next);

    if (!req.file) {
      console.warn('No se recibió ningún archivo');
      return next();
    }

    try {
      console.log('Archivo recibido:', req.file.originalname, req.file.mimetype, req.file.size);

      const extension = path.extname(req.file.originalname).toLowerCase();
      const nombreArchivo = buildFilename(req.params.id, extension);
      const key = buildKey(PREFIX_LIBROS, nombreArchivo);

      const publicUrl = await uploadBuffer({
        buffer: req.file.buffer,
        key,
        contentType: req.file.mimetype
      });

      req.file.filename = nombreArchivo;
      req.file.key = key;
      req.file.url = publicUrl;

      console.log('Archivo subido a S3:', publicUrl);
      next();
    } catch (error) {
      console.error('Error subiendo a S3:', error);
      next(new AppError(`Error al subir archivo a S3: ${error.message}`, 500));
    }
  });
};

const uploadMultipleImages = (req, res, next) => {
  upload.array('imagenes', 5)(req, res, async (err) => {
    if (err) return handleMulterError(err, req, res, next);

    if (!req.files || req.files.length === 0) {
      return next();
    }

    try {
      await Promise.all(req.files.map(async (file, index) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const nombreArchivo = buildFilename(req.params.id, extension, index);
        const key = buildKey(PREFIX_LIBROS, nombreArchivo);

        const publicUrl = await uploadBuffer({
          buffer: file.buffer,
          key,
          contentType: file.mimetype
        });

        file.filename = nombreArchivo;
        file.key = key;
        file.url = publicUrl;
      }));

      console.log(`${req.files.length} archivos subidos a S3`);
      next();
    } catch (error) {
      console.error('Error subiendo archivos a S3:', error);
      next(new AppError(`Error al subir archivos: ${error.message}`, 500));
    }
  });
};

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('El archivo es demasiado grande. Máximo 5MB permitidos.', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Demasiados archivos o campo de archivo incorrecto.', 400));
    }
    return next(new AppError(`Error al subir archivo: ${err.message}`, 400));
  }
  next(err);
};

// Ya no requiere directorios locales — S3 maneja el almacenamiento.
// Se mantiene como passthrough para no romper las rutas que lo invocan.
const checkUploadDirs = (req, res, next) => next();

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  handleMulterError,
  checkUploadDirs
};
