// src/routes/libroRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getLibros,
  getLibroPorId,
  crearLibro,
  actualizarLibro,
  eliminarLibro,
  eliminarLibroPermanente,
  buscarLibros,
  registrarInteraccion,
  getRecomendaciones,
  getLibrosConDescuento,
  getLibrosDestacados,
  calificarLibro,
  marcarComoHistorico,
  agregarEjemplar,
  actualizarEjemplar,
  eliminarEjemplar,
  agregarDescuento,
  desactivarDescuentos,
  subirImagenLibro,
  actualizarOrdenImagenes,
  eliminarImagenLibro,
  reservarStockLibro,
  liberarStockLibro,
  confirmarCompraLibro,
  autocompletarTerminos, 
  busquedaDifusa 
} = require('../controllers/libroController');

const { protect, authorize } = require('../middleware/authMiddleware');
const { 
  uploadSingleImage, 
  handleMulterError, 
  checkUploadDirs 
} = require('../middleware/uploadMiddleware');

/**
 * @swagger
 * tags:
 *   name: Libros
 *   description: Gestión del catálogo de libros
 */

// Rutas públicas para búsqueda y listado
/**
 * @swagger
 * /api/v1/libros:
 *   get:
 *     summary: Obtener lista de libros con filtros y paginación
 *     tags: [Libros]
 *     parameters:
 *       - in: query
 *         name: titulo
 *         schema:
 *           type: string
 *         description: Título del libro (búsqueda parcial)
 *       - in: query
 *         name: autor
 *         schema:
 *           type: string
 *         description: Nombre del autor (búsqueda parcial)
 *       - in: query
 *         name: genero
 *         schema:
 *           type: string
 *         description: Género del libro
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
 *         description: Número de resultados por página
 *     responses:
 *       200:
 *         description: Lista de libros obtenida exitosamente
 */

/**
 * @swagger
 * /api/v1/libros/buscar:
 *   get:
 *     summary: Buscar libros por texto y aplicar filtros con Atlas Search
 *     description: Realiza una búsqueda avanzada de libros utilizando Atlas Search, que resuelve problemas de tildes y coincidencias parciales. Los resultados se ordenan por relevancia.
 *     tags: [Libros]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Término de búsqueda (insensible a tildes, permite coincidencias parciales)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Cantidad máxima de resultados a devolver
 *       - in: query
 *         name: genero
 *         schema:
 *           type: string
 *         description: Filtrar por género
 *       - in: query
 *         name: editorial
 *         schema:
 *           type: string
 *         description: Filtrar por editorial
 *       - in: query
 *         name: idioma
 *         schema:
 *           type: string
 *         description: Filtrar por idioma
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [nuevo, usado]
 *         description: Filtrar por estado del libro
 *       - in: query
 *         name: precio_min
 *         schema:
 *           type: number
 *         description: Precio mínimo
 *       - in: query
 *         name: precio_max
 *         schema:
 *           type: number
 *         description: Precio máximo
 *       - in: query
 *         name: solo_disponibles
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Solo mostrar libros con stock disponible
 *     responses:
 *       200:
 *         description: Resultados de búsqueda ordenados por relevancia
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
 *                   description: Cantidad de resultados encontrados
 *                   example: 5
 *                 id_busqueda:
 *                   type: string
 *                   description: Identificador único de la búsqueda
 *                   example: 64a2e5c9f15d71f5019d498
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 60a12e5c9f15d71f5019d495
 *                       titulo:
 *                         type: string
 *                         example: Cien años de soledad
 *                       autor_nombre_completo:
 *                         type: string
 *                         example: Gabriel García Márquez
 *                       editorial:
 *                         type: string
 *                         example: Sudamericana
 *                       genero:
 *                         type: string
 *                         example: Novela
 *                       precio:
 *                         type: number
 *                         example: 45000
 *                       stock:
 *                         type: integer
 *                         example: 15
 *                       activo:
 *                         type: boolean
 *                         example: true
 *       400:
 *         description: Se requiere al menos un término de búsqueda o filtro
 *       500:
 *         description: Error del servidor
 */

/**
 * @swagger
 * /api/v1/libros/autocompletar:
 *   get:
 *     summary: Obtener sugerencias de autocompletado mientras el usuario escribe
 *     description: Proporciona resultados de autocompletado en tiempo real basados en un prefijo parcial. Ideal para implementar campos de búsqueda predictivos.
 *     tags: [Libros]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Prefijo o texto parcial para autocompletar
 *       - in: query
 *         name: campo
 *         schema:
 *           type: string
 *           enum: [titulo, autor_nombre_completo, genero, editorial]
 *           default: titulo
 *         description: Campo en el que buscar el autocompletado
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad máxima de sugerencias a devolver
 *     responses:
 *       200:
 *         description: Sugerencias de autocompletado
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
 *                   description: Cantidad de sugerencias encontradas
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 60a12e5c9f15d71f5019d495
 *                       titulo:
 *                         type: string
 *                         example: Cien años de soledad
 *                       score:
 *                         type: number
 *                         description: Puntuación de relevancia
 *                         example: 9.87
 *       400:
 *         description: Parámetros de búsqueda inválidos
 *       500:
 *         description: Error del servidor
 */

/**
 * @swagger
 * /api/v1/libros/busqueda-difusa:
 *   get:
 *     summary: Realizar búsqueda difusa tolerante a errores tipográficos
 *     description: Ejecuta una búsqueda "fuzzy" que encuentra resultados relevantes incluso cuando hay errores tipográficos, variaciones ortográficas o términos escritos incorrectamente.
 *     tags: [Libros]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Término de búsqueda (puede contener errores o variaciones)
 *       - in: query
 *         name: campos
 *         schema:
 *           type: string
 *           default: titulo,autor_nombre_completo
 *         description: Campos donde buscar (separados por comas)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Cantidad máxima de resultados a devolver
 *     responses:
 *       200:
 *         description: Resultados de búsqueda difusa ordenados por relevancia
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
 *                   description: Cantidad de resultados encontrados
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 60a12e5c9f15d71f5019d495
 *                       titulo:
 *                         type: string
 *                         example: Cien años de soledad
 *                       autor_nombre_completo:
 *                         type: string
 *                         example: Gabriel García Márquez
 *                       editorial:
 *                         type: string
 *                         example: Sudamericana
 *                       genero:
 *                         type: string
 *                         example: Novela
 *                       precio:
 *                         type: number
 *                         example: 45000
 *                       stock:
 *                         type: integer
 *                         example: 15
 *                       activo:
 *                         type: boolean
 *                         example: true
 *       400:
 *         description: Se requiere un término de búsqueda
 *       500:
 *         description: Error del servidor
 */

/**
 * @swagger
 * /api/v1/libros/buscar/{idBusqueda}/interaccion/{idLibro}:
 *   post:
 *     summary: Registrar interacción con un libro desde una búsqueda
 *     tags: [Libros]
 *     parameters:
 *       - in: path
 *         name: idBusqueda
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la búsqueda
 *       - in: path
 *         name: idLibro
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del libro
 *     responses:
 *       200:
 *         description: Interacción registrada correctamente
 */

/**
 * @swagger
 * /api/v1/libros/descuentos:
 *   get:
 *     summary: Obtener libros con descuentos activos
 *     tags: [Libros]
 *     responses:
 *       200:
 *         description: Lista de libros con descuento
 */

/**
 * @swagger
 * /api/v1/libros/destacados:
 *   get:
 *     summary: Obtener libros destacados (mejor calificados)
 *     tags: [Libros]
 *     responses:
 *       200:
 *         description: Lista de libros destacados
 */

/**
 * @swagger
 * /api/v1/libros/recomendaciones:
 *   get:
 *     summary: Obtener recomendaciones para el usuario
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recomendaciones personalizadas
 *       401:
 *         description: Requiere autenticación
 */

/**
 * @swagger
 * /api/v1/libros/{id}:
 *   get:
 *     summary: Obtener detalles de un libro específico
 *     tags: [Libros]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del libro
 *     responses:
 *       200:
 *         description: Detalles del libro
 *       404:
 *         description: Libro no encontrado
 */

// Rutas protegidas para administración de libros

/**
 * @swagger
 * /api/v1/libros:
 *   post:
 *     summary: Crear un nuevo libro
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - autor
 *               - editorial
 *               - genero
 *               - idioma
 *               - fecha_publicacion
 *               - numero_paginas
 *               - precio
 *               - estado
 *     responses:
 *       201:
 *         description: Libro creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No tiene permisos para crear libros
 */

/**
 * @swagger
 * /api/v1/libros/{id}:
 *   put:
 *     summary: Actualizar un libro existente
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Libro actualizado exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No tiene permisos para actualizar libros
 */

/**
 * @swagger
 * /api/v1/libros/{id}:
 *   delete:
 *     summary: Eliminar un libro (desactivación lógica)
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Libro desactivado correctamente
 *       403:
 *         description: No tiene permisos para eliminar libros
 */

/**
 * @swagger
 * /api/v1/libros/{id}/permanente:
 *   delete:
 *     summary: Eliminar un libro permanentemente
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Libro eliminado permanentemente
 *       403:
 *         description: No tiene permisos para eliminar libros permanentemente
 */

/**
 * @swagger
 * /api/v1/libros/{id}/historico:
 *   patch:
 *     summary: Marcar un libro como histórico agotado
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Libro marcado como histórico agotado
 *       403:
 *         description: No tiene permisos para esta acción
 */

// Rutas para calificaciones
/**
 * @swagger
 * /api/v1/libros/{id}/calificacion:
 *   post:
 *     summary: Calificar un libro
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - calificacion
 *             properties:
 *               calificacion:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Calificación registrada exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Requiere autenticación
 */

// Rutas para gestión de ejemplares
/**
 * @swagger
 * /api/v1/libros/{id}/ejemplares:
 *   post:
 *     summary: Agregar un ejemplar a un libro
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - codigo
 *     responses:
 *       201:
 *         description: Ejemplar agregado exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No tiene permisos para agregar ejemplares
 */

/**
 * @swagger
 * /api/v1/libros/{id}/ejemplares/{codigo}:
 *   put:
 *     summary: Actualizar un ejemplar específico
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ejemplar actualizado exitosamente
 *       403:
 *         description: No tiene permisos para actualizar ejemplares
 */

/**
 * @swagger
 * /api/v1/libros/{id}/ejemplares/{codigo}:
 *   delete:
 *     summary: Eliminar un ejemplar específico
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ejemplar eliminado exitosamente
 *       403:
 *         description: No tiene permisos para eliminar ejemplares
 */

// Rutas para gestión de descuentos
/**
 * @swagger
 * /api/v1/libros/{id}/descuentos:
 *   post:
 *     summary: Agregar un descuento a un libro
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo
 *               - valor
 *     responses:
 *       201:
 *         description: Descuento agregado exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No tiene permisos para agregar descuentos
 */

/**
 * @swagger
 * /api/v1/libros/{id}/descuentos:
 *   delete:
 *     summary: Desactivar todos los descuentos de un libro
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Descuentos desactivados exitosamente
 *       403:
 *         description: No tiene permisos para desactivar descuentos
 */

// Rutas para gestión de imágenes
/**
 * @swagger
 * /api/v1/libros/{id}/imagenes:
 *   post:
 *     summary: Subir una imagen para un libro
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - imagen
 *             properties:
 *               imagen:
 *                 type: string
 *                 format: binary
 *               tipo:
 *                 type: string
 *                 enum: [portada, contraportada, contenido, detalle]
 *               orden:
 *                 type: integer
 *               alt_text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Imagen subida exitosamente
 *       400:
 *         description: Error al subir imagen
 *       403:
 *         description: No tiene permisos para subir imágenes
 */

/**
 * @swagger
 * /api/v1/libros/{id}/imagenes/orden:
 *   patch:
 *     summary: Actualizar orden de imágenes
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ordenesNuevos
 *             properties:
 *               ordenesNuevos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_imagen
 *                     - orden_nuevo
 *                   properties:
 *                     id_imagen:
 *                       type: string
 *                     orden_nuevo:
 *                       type: integer
 *                     tipo_nuevo:
 *                       type: string
 *                       enum: [portada, contraportada, contenido, detalle]
 *     responses:
 *       200:
 *         description: Orden actualizado correctamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No tiene permisos para ordenar imágenes
 */


/**
 * @swagger
 * /api/v1/libros/{id}/imagenes/{idImagen}:
 *   delete:
 *     summary: Eliminar una imagen
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: idImagen
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Imagen eliminada correctamente
 *       400:
 *         description: Error al eliminar imagen
 *       403:
 *         description: No tiene permisos para eliminar imágenes
 */

// Rutas para gestión de stock
/**
 * @swagger
 * /api/v1/libros/{id}/reservar:
 *   post:
 *     summary: Reservar stock para compra
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cantidad
 *               - id_reserva
 *     responses:
 *       200:
 *         description: Stock reservado correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Requiere autenticación
 *       409:
 *         description: Stock insuficiente
 */

/**
 * @swagger
 * /api/v1/libros/{id}/liberar:
 *   post:
 *     summary: Liberar stock reservado
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cantidad
 *               - id_reserva
 *     responses:
 *       200:
 *         description: Stock liberado correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Requiere autenticación
 */

/**
 * @swagger
 * /api/v1/libros/{id}/comprar:
 *   post:
 *     summary: Confirmar compra de libro
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cantidad
 *               - id_transaccion
 *               - id_reserva
 *     responses:
 *       200:
 *         description: Compra confirmada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Requiere autenticación
 */

router.get('/', getLibros);
router.get('/buscar', buscarLibros);
router.get('/autocompletar', autocompletarTerminos);
router.get('/busqueda-difusa', busquedaDifusa);
router.post('/buscar/:idBusqueda/interaccion/:idLibro', registrarInteraccion);
router.get('/descuentos', getLibrosConDescuento);
router.get('/destacados', getLibrosDestacados);
router.get('/recomendaciones', protect, getRecomendaciones);
router.get('/:id', getLibroPorId);
router.post('/', protect, authorize('administrador', 'root'), crearLibro);
router.put('/:id', protect, authorize('administrador', 'root'), actualizarLibro);
router.delete('/:id', protect, authorize('administrador', 'root'), eliminarLibro);
router.delete('/:id/permanente', protect, authorize('root'), eliminarLibroPermanente);
router.patch('/:id/historico', protect, authorize('administrador', 'root'), marcarComoHistorico);
router.post('/:id/calificacion', protect, calificarLibro);
router.post('/:id/ejemplares', protect, authorize('administrador', 'root'), agregarEjemplar);
router.put('/:id/ejemplares/:codigo', protect, authorize('administrador', 'root'), actualizarEjemplar);
router.delete('/:id/ejemplares/:codigo', protect, authorize('administrador', 'root'), eliminarEjemplar);
router.post('/:id/descuentos', protect, authorize('administrador', 'root'), agregarDescuento);
router.delete('/:id/descuentos', protect, authorize('administrador', 'root'), desactivarDescuentos);
router.post(
  '/:id/imagenes', 
  protect, 
  authorize('administrador', 'root'), 
  checkUploadDirs,
  uploadSingleImage,
  handleMulterError,
  subirImagenLibro
);
router.patch(
  '/:id/imagenes/orden', 
  protect, 
  authorize('administrador', 'root'), 
  actualizarOrdenImagenes
);
router.delete('/:id/imagenes/:idImagen', protect, authorize('administrador', 'root'), eliminarImagenLibro);
router.post('/:id/reservar', protect, reservarStockLibro);
router.post('/:id/liberar', protect, liberarStockLibro);
router.post('/:id/comprar', protect, confirmarCompraLibro);

module.exports = router;