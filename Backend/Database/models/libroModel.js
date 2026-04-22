const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const authorSchema = require('./schemas/authorSchema');
const bookPriceSchema = require('./schemas/bookPriceSchema');

// Esquema para manejar las imágenes del libro con orden específico
const libroImageSchema = new Schema({
  url: {
    type: String,
    required: true
  },
  nombre_archivo: {
    type: String,
    required: true
  },
  orden: {
    type: Number,
    default: 0 // 0 es la imagen principal/portada
  },
  tipo: {
    type: String,
    enum: ['portada', 'contraportada', 'contenido', 'detalle'],
    default: 'detalle'
  },
  fecha_subida: {
    type: Date,
    default: Date.now
  },
  alt_text: {
    type: String,
    default: 'Imagen de libro'
  },
  activa: {
    type: Boolean,
    default: true
  }
});

const libroSchema = new Schema({
  // Identificador único autogenerado para el libro
  id_libro: {
    type: String,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true,
    index: true
  },
  
  // Información bibliográfica básica
  titulo: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Implementamos el nuevo esquema de autor como array
  autor: {
    type: [authorSchema],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Debe proporcionar al menos un autor'
    }
  },
  
  // Mantenemos el campo de autor como string para compatibilidad
  // y búsquedas más sencillas
  autor_nombre_completo: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Información editorial y publicación
  editorial: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  genero: {
    type: String,
    required: true,
    index: true
  },
  
  idioma: {
    type: String,
    required: true,
    trim: true
  },
  
  fecha_publicacion: {
    type: Date,
    required: true
  },
  
  anio_publicacion: {
    type: Number,
    required: true,
    min: 1000,
    max: new Date().getFullYear()
  },
  
  numero_paginas: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Implementamos el nuevo esquema de precio
  precio_info: {
    type: bookPriceSchema,
    required: true
  },
  
  // Mantenemos el campo precio simple para compatibilidad y búsquedas
  precio: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Estado del libro (nuevo o usado)
  estado: {
    type: String,
    enum: ['nuevo', 'usado'],
    required: true
  },
  
  // Control de inventario
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  
  categoria_historico: {
    type: Boolean,
    default: false,
    description: "Indica si el libro está en la categoría de histórico agotado"
  },
  
  // Información adicional para marketing y búsqueda
  descripcion: {
    type: String,
    trim: true
  },
  
  tabla_contenido: {
    type: String,
    trim: true
  },
  
  palabras_clave: [{
    type: String,
    trim: true
  }],
  
  // Nuevo esquema mejorado para imágenes con orden
  imagenes: [libroImageSchema],
  
  // Campo para mantener compatibilidad con código existente
  imagenes_legacy: {
    portada: String,
    contraportada: String,
    adicionales: [String]
  },
  
  // Control de versiones
  edicion: {
    numero: Number,
    descripcion: String
  },
  
  // Calificaciones y reseñas
  calificaciones: {
    promedio: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    cantidad: {
      type: Number,
      default: 0
    }
  },
  
  // ISBN para libros (formato internacional)
  ISBN: {
    type: String,
    trim: true,
    sparse: true,
    index: true
  },
  
  // Metadatos de sistema
  fecha_registro: {
    type: Date,
    default: Date.now
  },
  
  ultima_actualizacion: {
    type: Date,
    default: Date.now
  },
  
  // Campo para indicar si el libro está activo en el catálogo
  activo: {
    type: Boolean,
    default: true
  },
  
  // Códigos únicos para ejemplares individuales
  ejemplares: [{
    codigo: {
      type: String,
      required: true,
      index: { unique: true, sparse: true }
    },
    estado_fisico: {
      type: String,
      enum: ['excelente', 'bueno', 'aceptable', 'deteriorado'],
      default: 'excelente'
    },
    ubicacion: String,
    disponible: {
      type: Boolean,
      default: true
    },
    fecha_adquisicion: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Campo para control de versiones optimista (evitar condiciones de carrera)
  version: {
    type: Number,
    default: 0
  }
});

// ÍNDICES COMPUESTOS
// Para búsquedas combinadas frecuentes
libroSchema.index({ 'autor_nombre_completo': 1, titulo: 1 });
libroSchema.index({ genero: 1, 'autor_nombre_completo': 1 });
libroSchema.index({ estado: 1, precio: 1 });
libroSchema.index({ anio_publicacion: 1, genero: 1 });
libroSchema.index({ 'palabras_clave': 1 });
libroSchema.index({ 'imagenes.orden': 1 });

// Índice de texto para búsquedas full-text
libroSchema.index({ 
  titulo: 'text', 
  autor_nombre_completo: 'text',
  descripcion: 'text',
  palabras_clave: 'text'
}, {
  weights: {
    titulo: 10,
    autor_nombre_completo: 5,
    palabras_clave: 3,
    descripcion: 1
  },
  name: 'libro_text_index'
});

// MIDDLEWARES
// Actualizar fecha cada vez que se modifica el documento
libroSchema.pre('save', function(next) {
  this.ultima_actualizacion = new Date();
  this.version += 1;
  
  // Actualizar el campo autor_nombre_completo para búsquedas
  if (this.autor && Array.isArray(this.autor) && this.autor.length > 0) {
    this.autor_nombre_completo = this.autor.map(a => 
      `${a.nombre} ${a.apellidos}`
    ).join(', ');
  }
  
  // CORREGIDO: Sincronizar campo 'precio' con descuentos automáticos
  if (this.precio_info && typeof this.precio_info.calcularPrecioConDescuentosAutomaticos === 'function') {
    try {
      const precioSincronizado = this.precio_info.calcularPrecioConDescuentosAutomaticos();
      
      // Solo actualizar si hay diferencia significativa (evitar bucles por redondeo)
      if (Math.abs(this.precio - precioSincronizado) > 0.01) {
        console.log(`Sincronizando precio del libro ${this.titulo}: ${this.precio} -> ${precioSincronizado}`);
        this.precio = precioSincronizado;
      }
    } catch (error) {
      console.warn('Error sincronizando precio automático:', error.message);
      // No hacer nada, mantener precio actual
    }
  }
  
  next();
});

// También sincronizar en actualizaciones
libroSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  
  // Incrementar versión
  if (!update.$inc) {
    update.$inc = {};
  }
  update.$inc.version = 1;
  
  // Actualizar fecha
  if (!update.$set) {
    update.$set = {};
  }
  update.$set.ultima_actualizacion = new Date();
  
  // Si se está actualizando precio_info, necesitamos recalcular precio
  if (update.precio_info || update['precio_info.precio_base'] || update['precio_info.descuentos']) {
    console.log('Actualización de precio_info detectada en findOneAndUpdate');
    // Se manejará en el post-hook o manualmente
  }
  
  this.setUpdate(update);
  next();
});

libroSchema.post('findOneAndUpdate', async function(doc) {
  if (doc && doc.precio_info && typeof doc.precio_info.calcularPrecioConDescuentosAutomaticos === 'function') {
    try {
      const precioSincronizado = doc.precio_info.calcularPrecioConDescuentosAutomaticos();
      
      if (Math.abs(doc.precio - precioSincronizado) > 0.01) {
        console.log(`Post-update: Sincronizando precio del libro ${doc.titulo}: ${doc.precio} -> ${precioSincronizado}`);
        doc.precio = precioSincronizado;
        await doc.save();
      }
    } catch (error) {
      console.warn('Error en post-update sincronizando precio:', error.message);
    }
  }
});

// MÉTODOS VIRTUALES
// Calcular disponibilidad de ejemplares
libroSchema.virtual('ejemplares_disponibles').get(function() {
  return this.ejemplares.filter(ejemplar => ejemplar.disponible).length;
});

// Obtener imagen de portada principal
libroSchema.virtual('imagen_portada').get(function() {
  // Primero buscar en el nuevo sistema
  if (this.imagenes && this.imagenes.length > 0) {
    // Buscar imagen tipo portada con orden 0 o la primera portada
    const portada = this.imagenes.find(img => img.tipo === 'portada' && img.orden === 0) ||
                    this.imagenes.find(img => img.tipo === 'portada') ||
                    // Si no encuentra, retornar la primera imagen
                    this.imagenes.sort((a, b) => a.orden - b.orden)[0];
    
    if (portada) return portada.url;
  }
  
  // Fallback al sistema anterior
  return this.imagenes_legacy && this.imagenes_legacy.portada || '';
});

// MÉTODOS DE INSTANCIA
// Agregar un nuevo ejemplar al libro
libroSchema.methods.agregarEjemplar = function(codigo, estadoFisico = 'excelente', ubicacion = '') {
  // Verificar que el código no exista ya
  if (this.ejemplares.some(e => e.codigo === codigo)) {
    throw new Error(`Ya existe un ejemplar con el código ${codigo}`);
  }
  
  this.ejemplares.push({
    codigo: codigo,
    estado_fisico: estadoFisico,
    ubicacion: ubicacion,
    disponible: true,
    fecha_adquisicion: new Date()
  });
  
  this.stock = this.ejemplares.length;
  return this.save();
};

// Marcar un ejemplar como no disponible
libroSchema.methods.marcarEjemplarNoDisponible = function(codigo) {
  const ejemplar = this.ejemplares.find(e => e.codigo === codigo);
  if (ejemplar) {
    ejemplar.disponible = false;
    this.markModified('ejemplares');
    return this.save();
  }
  return Promise.reject(new Error('Ejemplar no encontrado'));
};

// Añadir un descuento al libro
libroSchema.methods.agregarDescuento = function(tipo, valor, fechaInicio, fechaFin, codigoPromocion = '') {
  if (!this.precio_info) {
    this.precio_info = {
      precio_base: this.precio,
      descuentos: []
    };
  }
  
  this.precio_info.descuentos.push({
    tipo: tipo,
    valor: valor,
    fecha_inicio: fechaInicio || new Date(),
    fecha_fin: fechaFin,
    codigo_promocion: codigoPromocion,
    activo: true
  });
  
  return this.save();
};

// Añadir una imagen al libro
libroSchema.methods.agregarImagen = function(imagenData) {
  if (!this.imagenes) {
    this.imagenes = [];
  }
  
  // Si no se especifica un orden, colocarlo al final
  if (imagenData.orden === undefined) {
    // Buscar el mayor orden actual y sumar 1
    const maxOrden = this.imagenes.reduce((max, img) => 
      img.orden > max ? img.orden : max, -1);
    imagenData.orden = maxOrden + 1;
  }
  
  // Si es portada con orden 0, verificar si ya existe y actualizar
  if (imagenData.tipo === 'portada' && imagenData.orden === 0) {
    const portadaIndex = this.imagenes.findIndex(
      img => img.tipo === 'portada' && img.orden === 0
    );
    
    if (portadaIndex >= 0) {
      // Actualizar portada existente
      this.imagenes[portadaIndex] = {
        ...this.imagenes[portadaIndex],
        ...imagenData
      };
    } else {
      // Agregar nueva portada
      this.imagenes.push(imagenData);
    }
  } else {
    // Agregar imagen normal
    this.imagenes.push(imagenData);
  }
  
  // Ordenar imágenes por orden
  this.imagenes.sort((a, b) => a.orden - b.orden);
  
  this.markModified('imagenes');
  return this.save();
};

// Actualizar orden de imágenes
libroSchema.methods.actualizarOrdenImagenes = function(ordenesNuevos) {
  // ordenesNuevos es un array de objetos {id_imagen, orden_nuevo}
  ordenesNuevos.forEach(item => {
    const imagen = this.imagenes.id(item.id_imagen);
    if (imagen) {
      imagen.orden = item.orden_nuevo;
    }
  });
  
  // Ordenar imágenes por orden
  this.imagenes.sort((a, b) => a.orden - b.orden);
  
  this.markModified('imagenes');
  return this.save();
};

// Eliminar una imagen
libroSchema.methods.eliminarImagen = function(imagenId) {
  const imagenIndex = this.imagenes.findIndex(img => img._id.toString() === imagenId);
  
  if (imagenIndex >= 0) {
    this.imagenes.splice(imagenIndex, 1);
    this.markModified('imagenes');
    return this.save();
  }
  
  return Promise.reject(new Error('Imagen no encontrada'));
};

// MÉTODOS ESTÁTICOS
// Buscar libros por criterios múltiples
// Buscar libros por criterios múltiples
// Mejora del método estático buscarPorCriterios en libroModel
libroSchema.statics.buscarPorCriterios = function(criterios) {
  const query = { activo: true }; // Por defecto solo mostrar activos
  
  // Función auxiliar mejorada para normalizar texto (quitar acentos)
  const normalizarTexto = (texto) => {
    if (!texto) return '';
    return texto
      .normalize('NFD') // Normalización Unicode
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .toLowerCase() // Convertir a minúsculas
      .trim(); // Eliminar espacios
  };
  
  // Función para escapar caracteres especiales en expresiones regulares
  const escaparRegex = (texto) => {
    return texto ? texto.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') : '';
  };
  
  // Función mejorada para crear condición de búsqueda insensible a acentos y con coincidencias parciales
  const crearCondicionBusquedaFlexible = (campo, valor) => {
    if (!valor || valor.trim() === '') return null;
    
    const valorLimpio = valor.trim();
    const valorNormalizado = normalizarTexto(valorLimpio);
    const valorRegex = escaparRegex(valorLimpio);
    const valorNormalizadoRegex = escaparRegex(valorNormalizado);
    
    // Array para condiciones OR
    const condicionesOR = [];
    
    // Coincidencia exacta (con/sin acentos)
    condicionesOR.push(
      { [campo]: { $regex: `^${valorRegex}$`, $options: 'i' } },
      { [campo]: { $regex: `^${valorNormalizadoRegex}$`, $options: 'i' } }
    );
    
    // Coincidencia de palabra completa (con/sin acentos)
    condicionesOR.push(
      { [campo]: { $regex: `\\b${valorRegex}\\b`, $options: 'i' } },
      { [campo]: { $regex: `\\b${valorNormalizadoRegex}\\b`, $options: 'i' } }
    );
    
    // Coincidencia al inicio de palabra (con/sin acentos)
    condicionesOR.push(
      { [campo]: { $regex: `\\b${valorRegex}`, $options: 'i' } },
      { [campo]: { $regex: `\\b${valorNormalizadoRegex}`, $options: 'i' } }
    );
    
    // Coincidencia en cualquier parte (con/sin acentos)
    condicionesOR.push(
      { [campo]: { $regex: valorRegex, $options: 'i' } },
      { [campo]: { $regex: valorNormalizadoRegex, $options: 'i' } }
    );
    
    // Coincidencia parcial más flexible
    condicionesOR.push(
      { [campo]: { $regex: `.*${valorRegex}.*`, $options: 'i' } },
      { [campo]: { $regex: `.*${valorNormalizadoRegex}.*`, $options: 'i' } }
    );
    
    // Búsqueda por palabras individuales
    const palabras = valorLimpio.split(/\s+/).filter(p => p.length >= 1);
    palabras.forEach(palabra => {
      const palabraNormalizada = normalizarTexto(palabra);
      const palabraRegex = escaparRegex(palabra);
      const palabraNormalizadaRegex = escaparRegex(palabraNormalizada);
      
      condicionesOR.push(
        { [campo]: { $regex: palabraRegex, $options: 'i' } },
        { [campo]: { $regex: palabraNormalizadaRegex, $options: 'i' } },
        // Coincidencia parcial más flexible para cada palabra
        { [campo]: { $regex: `.*${palabraRegex}.*`, $options: 'i' } },
        { [campo]: { $regex: `.*${palabraNormalizadaRegex}.*`, $options: 'i' } }
      );
    });
    
    // Eliminar duplicados (pueden generarse con las condiciones)
    const condicionesUnicas = Array.from(new Set(condicionesOR.map(JSON.stringify)))
                               .map(JSON.parse);
    
    return { $or: condicionesUnicas };
  };
  
  // Mapeo de criterios de búsqueda desde la UI a la estructura de MongoDB
  let condicionesAND = [];
  
  // Aplicar búsqueda flexible a campos principales
  if (criterios.titulo) {
    const condicionTitulo = crearCondicionBusquedaFlexible('titulo', criterios.titulo);
    if (condicionTitulo) condicionesAND.push(condicionTitulo);
  }
  
  if (criterios.autor) {
    const condicionAutor = crearCondicionBusquedaFlexible('autor_nombre_completo', criterios.autor);
    if (condicionAutor) condicionesAND.push(condicionAutor);
  }
  
  if (criterios.genero) {
    const condicionGenero = crearCondicionBusquedaFlexible('genero', criterios.genero);
    if (condicionGenero) condicionesAND.push(condicionGenero);
  }
  
  if (criterios.editorial) {
    const condicionEditorial = crearCondicionBusquedaFlexible('editorial', criterios.editorial);
    if (condicionEditorial) condicionesAND.push(condicionEditorial);
  }
  
  // Campos que requieren coincidencia exacta
  if (criterios.ISBN) query.ISBN = criterios.ISBN;
  if (criterios.idioma) query.idioma = criterios.idioma;
  if (criterios.estado) query.estado = criterios.estado;
  
  // Rango de precios
  if (criterios.precio_min || criterios.precio_max) {
    query.precio = {};
    if (criterios.precio_min) query.precio.$gte = parseFloat(criterios.precio_min);
    if (criterios.precio_max) query.precio.$lte = parseFloat(criterios.precio_max);
  }
  
  // Rango de fechas
  if (criterios.anio_min || criterios.anio_max) {
    query.anio_publicacion = {};
    if (criterios.anio_min) query.anio_publicacion.$gte = parseInt(criterios.anio_min);
    if (criterios.anio_max) query.anio_publicacion.$lte = parseInt(criterios.anio_max);
  }
  
  if (criterios.solo_disponibles) {
    query.stock = { $gt: 0 };
  }
  
  // Búsqueda general de texto (q)
  if (criterios.q) {
    const campos = ['titulo', 'autor_nombre_completo', 'genero', 'editorial', 'descripcion', 'palabras_clave'];
    const condicionesQ = { $or: [] };
    
    campos.forEach(campo => {
      const condicion = crearCondicionBusquedaFlexible(campo, criterios.q);
      if (condicion && condicion.$or) {
        condicionesQ.$or = [...condicionesQ.$or, ...condicion.$or];
      }
    });
    
    if (condicionesQ.$or.length > 0) {
      condicionesAND.push(condicionesQ);
    }
  }
  
  // Combinar todas las condiciones con el query base
  if (condicionesAND.length > 0) {
    query.$and = condicionesAND;
  }
  
  // Permitir incluir inactivos solo a administradores
  if (criterios.incluir_inactivos === true) {
    delete query.activo;
  }
  
  console.log("Query final de búsqueda por criterios:", JSON.stringify(query));
  return this.find(query);
};

// Buscar por texto (método optimizado para búsqueda de texto)
libroSchema.statics.buscarPorTexto = function(texto, limite = 20) {
  return this.find(
    { 
      $text: { $search: texto },
      activo: true
    },
    { score: { $meta: "textScore" } }
  )
  .sort({ score: { $meta: "textScore" } })
  .limit(limite);
};

libroSchema.statics.marcarComoHistoricoAgotado = function(idLibro) {
  return this.findByIdAndUpdate(
    idLibro, 
    { 
      categoria_historico: true,
      activo: false
    },
    { new: true }
  );
};

libroSchema.statics.obtenerLibrosMasVendidos = function(limite = 10, diasAtras = 30) {
  return this.find({ activo: true, stock: { $gt: 0 } })
    .sort({ 'calificaciones.promedio': -1 })
    .limit(limite);
};

// Buscar por autor
libroSchema.statics.buscarPorAutor = function(nombreAutor) {
  return this.find({
    autor_nombre_completo: { $regex: nombreAutor, $options: 'i' }
  });
};

// Búsqueda de libros con descuentos activos
libroSchema.statics.obtenerLibrosConDescuento = function() {
  const hoy = new Date();
  return this.find({
    activo: true,
    'precio_info.descuentos': {
      $elemMatch: {
        activo: true,
        fecha_inicio: { $lte: hoy },
        fecha_fin: { $gte: hoy }
      }
    }
  });
};

// Obtener libros destacados (mejores calificaciones)
libroSchema.statics.obtenerLibrosDestacados = function(limite = 10, minCalificacion = 4.0) {
  return this.find({ 
    activo: true,
    'calificaciones.cantidad': { $gte: 1 }, // Ahora solo se requiere al menos 1 calificación
    'calificaciones.promedio': { $gte: minCalificacion },
    stock: { $gt: 0 } // Con stock disponible
  })
  .sort({ 'calificaciones.promedio': -1 })
  .limit(limite);
};

// Añadir calificación a un libro
libroSchema.statics.agregarCalificacion = function(idLibro, calificacion) {
  return this.findById(idLibro).then(libro => {
    if (!libro) {
      throw new Error('Libro no encontrado');
    }
    
    // Calcular nuevo promedio
    const numCalificaciones = libro.calificaciones.cantidad;
    const promedioActual = libro.calificaciones.promedio;
    
    const nuevoPromedio = ((promedioActual * numCalificaciones) + calificacion) / (numCalificaciones + 1);
    
    return this.findByIdAndUpdate(
      idLibro,
      {
        $set: {
          'calificaciones.promedio': nuevoPromedio,
          ultima_actualizacion: new Date()
        },
        $inc: { 'calificaciones.cantidad': 1 }
      },
      { new: true }
    );
  });
};

// Verificar si existe un código de ejemplar
libroSchema.statics.verificarCodigoEjemplar = function(codigo) {
  return this.findOne({ 'ejemplares.codigo': codigo })
    .then(libro => !!libro);
};

// Desactivar todos los descuentos de un libro
libroSchema.statics.desactivarDescuentos = function(idLibro) {
  return this.findByIdAndUpdate(
    idLibro,
    { 
      $set: { 
        'precio_info.descuentos.$[].activo': false,
        ultima_actualizacion: new Date()
      }
    },
    { new: true }
  );
};

const Libro = mongoose.model('Libro', libroSchema);

module.exports = Libro;