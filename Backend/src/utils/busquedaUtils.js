// Database/utils/busquedaUtils.js
const Busqueda = require('../models/busquedaModel');
const Libro = require('../models/libroModel');

/**
 * Utilidades para el procesamiento de búsquedas y generación de recomendaciones
 */
const busquedaUtils = {
  /**
   * Analiza el historial de búsquedas de un usuario para extraer términos frecuentes
   * @param {String} idUsuario - ID del usuario
   * @param {Number} limiteDias - Número de días hacia atrás para considerar
   * @param {Number} limiteTerminos - Número máximo de términos a devolver
   * @returns {Promise<Array>} Lista de términos de búsqueda ordenados por frecuencia
   */
  async obtenerTerminosFrecuentes(idUsuario, limiteDias = 30, limiteTerminos = 5) {
    try {
      // Calcular fecha límite
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - limiteDias);
      
      // Obtener todas las búsquedas recientes del usuario
      const busquedas = await Busqueda.find({
        id_usuario: idUsuario,
        fecha_busqueda: { $gte: fechaLimite }
      }).select('termino');
      
      // Contabilizar términos
      const contadorTerminos = {};
      
      busquedas.forEach(busqueda => {
        if (busqueda.termino) {
          const termino = busqueda.termino.toLowerCase();
          contadorTerminos[termino] = (contadorTerminos[termino] || 0) + 1;
        }
      });
      
      // Convertir a array y ordenar
      const terminosOrdenados = Object.entries(contadorTerminos)
        .sort((a, b) => b[1] - a[1]) // Ordenar por frecuencia
        .slice(0, limiteTerminos) // Limitar cantidad
        .map(entry => entry[0]); // Extraer solo los términos
      
      return terminosOrdenados;
    } catch (error) {
      console.error('Error obteniendo términos frecuentes:', error);
      return [];
    }
  },
  
  /**
   * Obtiene IDs de libros con los que el usuario ha interactuado
   * @param {String} idUsuario - ID del usuario
   * @param {Number} limiteDias - Número de días hacia atrás para considerar
   * @returns {Promise<Array>} Lista de IDs de libros vistos
   */
  async obtenerLibrosVistos(idUsuario, limiteDias = 30) {
    try {
      // Calcular fecha límite
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - limiteDias);
      
      // Obtener búsquedas con interacciones
      const busquedas = await Busqueda.find({
        id_usuario: idUsuario,
        fecha_busqueda: { $gte: fechaLimite },
        'interaccion.hubo_interaccion': true
      }).select('interaccion.libros_vistos');
      
      // Extraer IDs únicos de libros vistos
      const librosVistos = new Set();
      
      busquedas.forEach(busqueda => {
        if (busqueda.interaccion && busqueda.interaccion.libros_vistos) {
          busqueda.interaccion.libros_vistos.forEach(id => {
            librosVistos.add(id.toString());
          });
        }
      });
      
      return Array.from(librosVistos);
    } catch (error) {
      console.error('Error obteniendo libros vistos:', error);
      return [];
    }
  },
  
  /**
   * Genera recomendaciones basadas en el historial de búsquedas
   * @param {String} idUsuario - ID del usuario
   * @param {Number} limite - Número máximo de recomendaciones
   * @returns {Promise<Array>} Lista de libros recomendados
   */
  async generarRecomendaciones(idUsuario, limite = 5) {
    try {
      // Obtener términos de búsqueda frecuentes
      const terminosFrecuentes = await this.obtenerTerminosFrecuentes(idUsuario);
      
      // Obtener libros ya vistos para excluirlos
      const librosVistos = await this.obtenerLibrosVistos(idUsuario);
      
      // Si no hay suficientes datos para recomendar
      if (terminosFrecuentes.length === 0) {
        // Devolver libros destacados como alternativa
        return await Libro.obtenerLibrosDestacados(limite);
      }
      
      // Construir query para buscar libros relacionados con los términos
      const query = {
        activo: true,
        stock: { $gt: 0 }
      };
      
      // Búsqueda por texto usando los términos frecuentes
      if (terminosFrecuentes.length > 0) {
        query.$text = { $search: terminosFrecuentes.join(' ') };
      }
      
      // Excluir libros ya vistos
      if (librosVistos.length > 0) {
        query._id = { $nin: librosVistos };
      }
      
      // Obtener recomendaciones basadas en los términos frecuentes
      const recomendaciones = await Libro.find(
        query,
        { score: { $meta: "textScore" } }
      )
      .sort({ score: { $meta: "textScore" }, 'calificaciones.promedio': -1 })
      .limit(limite);
      
      // Si no hay suficientes recomendaciones, completar con libros populares
      if (recomendaciones.length < limite) {
        const librosAdicionales = await Libro.obtenerLibrosDestacados(
          limite - recomendaciones.length
        );
        
        // Filtrar libros adicionales para evitar duplicados
        const idsExistentes = new Set(recomendaciones.map(l => l._id.toString()));
        const idsVistos = new Set(librosVistos);
        
        const librosComplementarios = librosAdicionales.filter(libro => 
          !idsExistentes.has(libro._id.toString()) && 
          !idsVistos.has(libro._id.toString())
        );
        
        recomendaciones.push(...librosComplementarios);
      }
      
      return recomendaciones;
    } catch (error) {
      console.error('Error generando recomendaciones:', error);
      return [];
    }
  }
};

module.exports = busquedaUtils;