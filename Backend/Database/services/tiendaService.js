// Database/services/tiendaService.js
const mongoose = require('mongoose');
const TiendaFisica = require('../models/tiendaFisicaModel');
const RecogidaTienda = require('../models/recogidaTiendaModel');
const Inventario = require('../models/inventarioModel');
const Libro = require('../models/libroModel');
const Venta = require('../models/ventaModel');

/**
 * Servicio de Tiendas Físicas
 * Maneja toda la lógica de negocio relacionada con tiendas físicas
 */
const tiendaService = {
  /**
   * Crear una nueva tienda física
   * @param {Object} datosTienda - Datos de la tienda
   * @param {String} idUsuarioCreador - ID del usuario que crea la tienda
   * @returns {Promise<Object>} Tienda creada
   */
  async crearTienda(datosTienda, idUsuarioCreador) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log('Creando nueva tienda:', JSON.stringify(datosTienda, null, 2));
      
      // Verificar que el código no esté en uso
      if (datosTienda.codigo) {
        const tiendaExistente = await TiendaFisica.findOne({ 
          codigo: datosTienda.codigo.toUpperCase() 
        }).session(session);
        
        if (tiendaExistente) {
          throw new Error('El código de tienda ya está en uso');
        }
      }
      
      // Validar y normalizar coordenadas
      if (datosTienda.coordenadas) {
        const { latitud, longitud } = datosTienda.coordenadas;
        
        if (typeof latitud !== 'number' || typeof longitud !== 'number') {
          throw new Error('Las coordenadas deben ser números');
        }
        
        if (latitud < -90 || latitud > 90) {
          throw new Error('La latitud debe estar entre -90 y 90');
        }
        
        if (longitud < -180 || longitud > 180) {
          throw new Error('La longitud debe estar entre -180 y 180');
        }
      }
      
      // Validar dirección
      if (!datosTienda.direccion) {
        throw new Error('La dirección es obligatoria');
      }
      
      if (!datosTienda.direccion.direccion_completa || 
          !datosTienda.direccion.ciudad || 
          !datosTienda.direccion.departamento) {
        throw new Error('La dirección debe incluir dirección completa, ciudad y departamento');
      }
      
      // Normalizar código de tienda
      if (datosTienda.codigo) {
        datosTienda.codigo = datosTienda.codigo.toUpperCase();
      }
      
      // Asegurar que la dirección esté marcada como activa
      datosTienda.direccion.activa = true;
      datosTienda.direccion.predeterminada = true;
      
      // Establecer fecha de apertura si no se proporciona
      if (!datosTienda.fecha_apertura) {
        datosTienda.fecha_apertura = new Date();
      }
      
      // Crear tienda
      const nuevaTienda = new TiendaFisica(datosTienda);
      await nuevaTienda.save({ session });
      
      // Agregar nota inicial
      await nuevaTienda.agregarNota(
        `Tienda creada por usuario ${idUsuarioCreador}`,
        idUsuarioCreador,
        'operativa'
      );
      
      await session.commitTransaction();
      
      console.log('Tienda creada con ID:', nuevaTienda._id);
      return nuevaTienda.toObject();
    } catch (error) {
      await session.abortTransaction();
      console.error('Error creando tienda:', error);
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Obtener todas las tiendas con filtros y paginación
   * @param {Object} filtros - Filtros para la búsqueda
   * @param {Number} pagina - Página actual
   * @param {Number} limite - Cantidad de resultados por página
   * @param {String} ordenar - Campo de ordenamiento
   * @returns {Promise<Object>} Resultados paginados
   */
  async listarTiendas(filtros = {}, pagina = 1, limite = 10, ordenar = 'nombre') {
    try {
      console.log('Listando tiendas con filtros:', JSON.stringify(filtros, null, 2));
      
      const skip = (pagina - 1) * limite;
      const query = {};
      
      // Aplicar filtros
      if (filtros.estado) {
        if (Array.isArray(filtros.estado)) {
          query.estado = { $in: filtros.estado };
        } else {
          query.estado = filtros.estado;
        }
      }
      
      if (filtros.ciudad) {
        query['direccion.ciudad'] = { $regex: filtros.ciudad, $options: 'i' };
      }
      
      if (filtros.departamento) {
        query['direccion.departamento'] = { $regex: filtros.departamento, $options: 'i' };
      }
      
      if (filtros.nombre) {
        query.nombre = { $regex: filtros.nombre, $options: 'i' };
      }
      
      if (filtros.codigo) {
        query.codigo = { $regex: filtros.codigo, $options: 'i' };
      }
      
      if (filtros.recogida_productos !== undefined) {
        query['servicios.recogida_productos'] = filtros.recogida_productos === 'true' || filtros.recogida_productos === true;
      }
      
      if (filtros.devoluciones !== undefined) {
        query['servicios.devoluciones'] = filtros.devoluciones === 'true' || filtros.devoluciones === true;
      }
      
      if (filtros.tiene_inventario) {
        query['estadisticas.inventario_actual'] = { $gt: 0 };
      }
      
      // Búsqueda por texto
      if (filtros.busqueda) {
        query.$text = { $search: filtros.busqueda };
      }
      
      // Contar total
      const total = await TiendaFisica.countDocuments(query);
      
      // Configurar ordenamiento
      let sortQuery = {};
      if (ordenar.startsWith('-')) {
        sortQuery[ordenar.substring(1)] = -1;
      } else {
        sortQuery[ordenar] = 1;
      }
      
      // Obtener tiendas
      const tiendas = await TiendaFisica.find(query)
        .skip(skip)
        .limit(limite)
        .sort(sortQuery)
        .lean();
      
      // Agregar información adicional
      const tiendasEnriquecidas = tiendas.map(tienda => ({
        ...tienda,
        esta_abierta: this._evaluarHorario(tienda.horarios),
        direccion_formateada: this._formatearDireccion(tienda.direccion),
        tiene_inventario: tienda.estadisticas?.inventario_actual > 0
      }));
      
      const totalPaginas = Math.ceil(total / limite) || 1;
      
      return {
        datos: tiendasEnriquecidas,
        paginacion: {
          total,
          pagina,
          limite,
          totalPaginas,
          haySiguiente: pagina < totalPaginas,
          hayAnterior: pagina > 1
        }
      };
    } catch (error) {
      console.error('Error listando tiendas:', error);
      throw error;
    }
  },

  /**
   * Obtener tienda por ID
   * @param {String} idTienda - ID de la tienda
   * @param {Boolean} incluirEstadisticas - Si incluir estadísticas detalladas
   * @returns {Promise<Object>} Tienda encontrada
   */
  async obtenerTiendaPorId(idTienda, incluirEstadisticas = false) {
    try {
      let tienda;
      
      if (mongoose.Types.ObjectId.isValid(idTienda)) {
        tienda = await TiendaFisica.findById(idTienda).lean();
      } else {
        tienda = await TiendaFisica.findOne({ 
          $or: [
            { id_tienda: idTienda },
            { codigo: idTienda.toUpperCase() }
          ]
        }).lean();
      }
      
      if (!tienda) {
        throw new Error('Tienda no encontrada');
      }
      
      // Enriquecer con información adicional
      const tiendaEnriquecida = {
        ...tienda,
        esta_abierta: this._evaluarHorario(tienda.horarios),
        direccion_formateada: this._formatearDireccion(tienda.direccion)
      };
      
      // Incluir estadísticas detalladas si se solicita
      if (incluirEstadisticas) {
        tiendaEnriquecida.estadisticas_detalladas = await this._obtenerEstadisticasDetalladas(tienda._id);
      }
      
      return tiendaEnriquecida;
    } catch (error) {
      console.error('Error obteniendo tienda:', error);
      throw error;
    }
  },

  /**
   * Actualizar tienda
   * @param {String} idTienda - ID de la tienda
   * @param {Object} datosActualizados - Datos a actualizar
   * @param {String} idUsuario - ID del usuario que actualiza
   * @returns {Promise<Object>} Tienda actualizada
   */
  async actualizarTienda(idTienda, datosActualizados, idUsuario) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log('Actualizando tienda:', idTienda);
      
      // Buscar tienda
      let tienda;
      if (mongoose.Types.ObjectId.isValid(idTienda)) {
        tienda = await TiendaFisica.findById(idTienda).session(session);
      } else {
        tienda = await TiendaFisica.findOne({ 
          $or: [
            { id_tienda: idTienda },
            { codigo: idTienda.toUpperCase() }
          ]
        }).session(session);
      }
      
      if (!tienda) {
        throw new Error('Tienda no encontrada');
      }
      
      // Verificar código único si se está cambiando
      if (datosActualizados.codigo && datosActualizados.codigo.toUpperCase() !== tienda.codigo) {
        const tiendaExistente = await TiendaFisica.findOne({ 
          codigo: datosActualizados.codigo.toUpperCase(),
          _id: { $ne: tienda._id }
        }).session(session);
        
        if (tiendaExistente) {
          throw new Error('El código de tienda ya está en uso');
        }
        
        datosActualizados.codigo = datosActualizados.codigo.toUpperCase();
      }
      
      // Validar coordenadas si se actualizan
      if (datosActualizados.coordenadas) {
        const { latitud, longitud } = datosActualizados.coordenadas;
        
        if (typeof latitud === 'number' && (latitud < -90 || latitud > 90)) {
          throw new Error('La latitud debe estar entre -90 y 90');
        }
        
        if (typeof longitud === 'number' && (longitud < -180 || longitud > 180)) {
          throw new Error('La longitud debe estar entre -180 y 180');
        }
      }
      
      // Guardar campos modificados para el log
      const camposModificados = Object.keys(datosActualizados);
      
      // Actualizar tienda
      Object.assign(tienda, datosActualizados);
      await tienda.save({ session });
      
      // Agregar nota de actualización
      await tienda.agregarNota(
        `Tienda actualizada. Campos modificados: ${camposModificados.join(', ')}`,
        idUsuario,
        'operativa'
      );
      
      await session.commitTransaction();
      
      console.log('Tienda actualizada exitosamente');
      return tienda.toObject();
    } catch (error) {
      await session.abortTransaction();
      console.error('Error actualizando tienda:', error);
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Cambiar estado de tienda
   * @param {String} idTienda - ID de la tienda
   * @param {String} nuevoEstado - Nuevo estado
   * @param {String} motivo - Motivo del cambio
   * @param {String} idUsuario - ID del usuario que hace el cambio
   * @returns {Promise<Object>} Tienda actualizada
   */
  async cambiarEstadoTienda(idTienda, nuevoEstado, motivo, idUsuario) {
    try {
      const tienda = await TiendaFisica.findById(idTienda);
      if (!tienda) {
        throw new Error('Tienda no encontrada');
      }
      
      const estadoAnterior = tienda.estado;
      tienda.estado = nuevoEstado;
      
      // Agregar fecha de cierre si se cierra permanentemente
      if (nuevoEstado === 'cerrada_permanente' && !tienda.fecha_cierre) {
        tienda.fecha_cierre = new Date();
      }
      
      await tienda.save();
      
      // Agregar nota del cambio
      await tienda.agregarNota(
        `Estado cambiado de ${estadoAnterior} a ${nuevoEstado}. Motivo: ${motivo}`,
        idUsuario,
        'operativa'
      );
      
      console.log(`Estado de tienda ${tienda.nombre} cambiado a ${nuevoEstado}`);
      return tienda.toObject();
    } catch (error) {
      console.error('Error cambiando estado de tienda:', error);
      throw error;
    }
  },

  /**
   * Buscar tiendas cercanas por coordenadas
   * @param {Number} latitud - Latitud del punto de búsqueda
   * @param {Number} longitud - Longitud del punto de búsqueda
   * @param {Number} radioKm - Radio de búsqueda en kilómetros
   * @param {Number} limite - Límite de resultados
   * @param {Object} filtrosAdicionales - Filtros adicionales
   * @returns {Promise<Array>} Tiendas cercanas con distancia
   */
  async buscarTiendasCercanas(latitud, longitud, radioKm = 10, limite = 10, filtrosAdicionales = {}) {
    try {
      console.log(`Buscando tiendas cercanas a [${latitud}, ${longitud}] en radio de ${radioKm}km`);
      
      // Construir query de filtros adicionales
      const matchQuery = { estado: 'activa', ...filtrosAdicionales };
      
      // Usar agregación para búsqueda geoespacial
      const pipeline = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [longitud, latitud] // MongoDB usa [lng, lat]
            },
            distanceField: 'distancia',
            maxDistance: radioKm * 1000, // Convertir a metros
            spherical: true,
            distanceMultiplier: 0.001 // Convertir a km
          }
        },
        { $match: matchQuery },
        { $limit: limite }
      ];
      
      const tiendas = await TiendaFisica.aggregate(pipeline);
      
      // Enriquecer con información adicional
      const tiendasEnriquecidas = tiendas.map(tienda => ({
        ...tienda,
        distancia: Math.round(tienda.distancia * 100) / 100, // Redondear a 2 decimales
        esta_abierta: this._evaluarHorario(tienda.horarios),
        direccion_formateada: this._formatearDireccion(tienda.direccion)
      }));
      
      console.log(`Encontradas ${tiendasEnriquecidas.length} tiendas cercanas`);
      return tiendasEnriquecidas;
    } catch (error) {
      console.error('Error buscando tiendas cercanas:', error);
      throw error;
    }
  },

  /**
   * Buscar tiendas por ciudad
   * @param {String} ciudad - Nombre de la ciudad
   * @param {Object} filtrosAdicionales - Filtros adicionales
   * @returns {Promise<Array>} Tiendas en la ciudad
   */
  async buscarTiendasPorCiudad(ciudad, filtrosAdicionales = {}) {
    try {
      const query = {
        'direccion.ciudad': { $regex: ciudad, $options: 'i' },
        estado: 'activa',
        ...filtrosAdicionales
      };
      
      const tiendas = await TiendaFisica.find(query)
        .sort({ nombre: 1 })
        .lean();
      
      return tiendas.map(tienda => ({
        ...tienda,
        esta_abierta: this._evaluarHorario(tienda.horarios),
        direccion_formateada: this._formatearDireccion(tienda.direccion)
      }));
    } catch (error) {
      console.error('Error buscando tiendas por ciudad:', error);
      throw error;
    }
  },

  /**
   * Verificar disponibilidad de libro en tiendas
   * @param {String} idLibro - ID del libro
   * @param {Number} cantidad - Cantidad requerida
   * @param {Number} latitud - Latitud para ordenar por cercanía (opcional)
   * @param {Number} longitud - Longitud para ordenar por cercanía (opcional)
   * @param {Number} radioMaximo - Radio máximo de búsqueda en km
   * @returns {Promise<Array>} Tiendas con disponibilidad
   */
  async verificarDisponibilidadEnTiendas(idLibro, cantidad = 1, latitud = null, longitud = null, radioMaximo = 50) {
    try {
      console.log(`Verificando disponibilidad de libro ${idLibro} (cantidad: ${cantidad})`);
      
      // Pipeline de agregación para buscar disponibilidad
      const pipeline = [
        {
          $match: {
            id_libro: new mongoose.Types.ObjectId(idLibro),
            stock_disponible: { $gte: cantidad },
            estado: 'disponible'
          }
        },
        {
          $lookup: {
            from: 'tienda_fisicas',
            localField: 'id_tienda',
            foreignField: '_id',
            as: 'tienda'
          }
        },
        {
          $unwind: '$tienda'
        },
        {
          $match: {
            'tienda.estado': 'activa',
            'tienda.servicios.recogida_productos': true
          }
        },
        {
          $lookup: {
            from: 'libros',
            localField: 'id_libro',
            foreignField: '_id',
            as: 'libro'
          }
        },
        {
          $unwind: '$libro'
        }
      ];
      
      const inventarios = await Inventario.aggregate(pipeline);
      
      let tiendasConStock = inventarios.map(inv => ({
        tienda: inv.tienda,
        stock_disponible: inv.stock_disponible,
        libro: inv.libro,
        puede_recoger: inv.tienda.servicios?.recogida_productos || false,
        esta_abierta: this._evaluarHorario(inv.tienda.horarios),
        direccion_formateada: this._formatearDireccion(inv.tienda.direccion)
      }));
      
      // Si se proporcionan coordenadas, calcular distancia y filtrar por radio
      if (latitud && longitud) {
        tiendasConStock = tiendasConStock.map(item => {
          const distancia = this._calcularDistancia(
            latitud, 
            longitud, 
            item.tienda.coordenadas.latitud, 
            item.tienda.coordenadas.longitud
          );
          
          return {
            ...item,
            distancia
          };
        }).filter(item => !radioMaximo || item.distancia <= radioMaximo);
        
        // Ordenar por distancia
        tiendasConStock.sort((a, b) => a.distancia - b.distancia);
      }
      
      console.log(`Encontradas ${tiendasConStock.length} tiendas con stock disponible`);
      return tiendasConStock;
    } catch (error) {
      console.error('Error verificando disponibilidad en tiendas:', error);
      throw error;
    }
  },

  /**
   * Obtener inventario de una tienda
   * @param {String} idTienda - ID de la tienda
   * @param {Object} filtros - Filtros adicionales
   * @param {Number} pagina - Página actual
   * @param {Number} limite - Límite de resultados
   * @returns {Promise<Object>} Inventario paginado
   */
  async obtenerInventarioTienda(idTienda, filtros = {}, pagina = 1, limite = 20) {
    try {
      console.log(`Obteniendo inventario de tienda ${idTienda}`);
      
      const skip = (pagina - 1) * limite;
      const query = { id_tienda: idTienda };
      
      // Aplicar filtros
      if (filtros.estado) query.estado = filtros.estado;
      if (filtros.stock_min) query.stock_disponible = { $gte: parseInt(filtros.stock_min) };
      if (filtros.stock_max) {
        query.stock_disponible = query.stock_disponible || {};
        query.stock_disponible.$lte = parseInt(filtros.stock_max);
      }
      if (filtros.solo_disponibles) query.stock_disponible = { $gt: 0 };
      if (filtros.solo_reservados) query.stock_reservado = { $gt: 0 };
      if (filtros.bajo_stock) {
        query.$expr = { $lte: ['$stock_disponible', '$umbral_alerta'] };
      }
      
      // Contar total
      const total = await Inventario.countDocuments(query);
      
      // Obtener inventarios
      const inventarios = await Inventario.find(query)
        .populate('id_libro', 'titulo autor_nombre_completo precio imagen_portada ISBN activo')
        .skip(skip)
        .limit(limite)
        .sort({ ultima_actualizacion: -1 });
      
      // Enriquecer con información adicional
      const inventariosEnriquecidos = inventarios.map(inv => {
        const obj = inv.toObject();
        return {
          ...obj,
          porcentaje_stock: obj.stock_total > 0 ? Math.round((obj.stock_disponible / obj.stock_total) * 100) : 0,
          necesita_restock: obj.stock_disponible <= obj.umbral_alerta,
          valor_stock: obj.stock_total * (obj.id_libro?.precio || 0)
        };
      });
      
      const totalPaginas = Math.ceil(total / limite) || 1;
      
      return {
        datos: inventariosEnriquecidos,
        paginacion: {
          total,
          pagina,
          limite,
          totalPaginas
        },
        resumen: {
          total_items: total,
          items_sin_stock: inventarios.filter(inv => inv.stock_disponible === 0).length,
          items_bajo_stock: inventarios.filter(inv => inv.stock_disponible <= inv.umbral_alerta && inv.stock_disponible > 0).length
        }
      };
    } catch (error) {
      console.error('Error obteniendo inventario de tienda:', error);
      throw error;
    }
  },

  /**
   * Obtener estadísticas de tiendas
   * @param {String} idTienda - ID de tienda específica (opcional)
   * @param {Date} fechaInicio - Fecha de inicio (opcional)
   * @param {Date} fechaFin - Fecha de fin (opcional)
   * @returns {Promise<Object>} Estadísticas
   */
  async obtenerEstadisticas(idTienda = null, fechaInicio = null, fechaFin = null) {
    try {
      console.log('Obteniendo estadísticas de tiendas');
      
      // Estadísticas generales de tiendas
      const estadisticasTiendas = await TiendaFisica.obtenerEstadisticasGenerales();
      
      // Estadísticas de recogidas
      const estadisticasRecogidas = await RecogidaTienda.obtenerEstadisticas(idTienda, fechaInicio, fechaFin);
      
      // Top tiendas por rendimiento
      const topTiendas = await this._obtenerTopTiendas(fechaInicio, fechaFin);
      
      // Estadísticas de inventario por tienda
      const estadisticasInventario = await this._obtenerEstadisticasInventario(idTienda);
      
      return {
        tiendas: estadisticasTiendas,
        recogidas: estadisticasRecogidas,
        inventario: estadisticasInventario,
        top_tiendas: topTiendas,
        fecha_consulta: new Date()
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  },

  // MÉTODOS DE RECOGIDAS

  /**
   * Crear recogida desde venta
   * @param {Object} venta - Objeto de venta
   * @param {String} idTienda - ID de la tienda (opcional, si no se toma de la venta)
   * @returns {Promise<Object>} Recogida creada
   */
  async crearRecogidaDesdeVenta(venta, idTienda = null) {
    try {
      const recogida = await RecogidaTienda.crearDesdeVenta(venta, idTienda);
      
      // Verificar disponibilidad inmediatamente
      const resultadoVerificacion = await recogida.verificarDisponibilidad();
      
      if (resultadoVerificacion.disponible) {
        recogida.cambiarEstado('PREPARANDO_PEDIDO', 'Todos los items están disponibles', null);
      } else {
        // Buscar transferencias si hay items faltantes
        await this._buscarYSolicitarTransferencias(recogida, resultadoVerificacion.items_faltantes);
      }
      
      await recogida.save();
      return recogida.toObject();
    } catch (error) {
      console.error('Error creando recogida desde venta:', error);
      throw error;
    }
  },

  /**
   * Procesar recogida (cambiar estado, verificar items, etc.)
   * @param {String} idRecogida - ID de la recogida
   * @param {String} accion - Acción a realizar
   * @param {Object} datos - Datos adicionales
   * @param {String} idUsuario - ID del usuario
   * @returns {Promise<Object>} Recogida actualizada
   */
  async procesarRecogida(idRecogida, accion, datos, idUsuario) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log(`Procesando recogida ${idRecogida}: ${accion}`);
      
      const recogida = await RecogidaTienda.findById(idRecogida)
        .populate('id_cliente', 'nombres apellidos telefono email')
        .populate('id_tienda', 'nombre telefono_principal')
        .session(session);
      
      if (!recogida) {
        throw new Error('Recogida no encontrada');
      }
      
      switch (accion) {
        case 'verificar_disponibilidad':
          const disponible = await recogida.verificarDisponibilidad();
          if (disponible.disponible) {
            recogida.cambiarEstado('PREPARANDO_PEDIDO', 'Todos los items están disponibles', idUsuario);
          } else {
            // Manejar items faltantes
            await this._buscarYSolicitarTransferencias(recogida, disponible.items_faltantes);
          }
          break;
          
        case 'marcar_preparado':
          // Reservar stock para los items
          await this._reservarStockRecogida(recogida, idUsuario, session);
          recogida.cambiarEstado('LISTO_PARA_RECOGER', 'Pedido preparado para recogida', idUsuario);
          break;
          
        case 'completar_recogida':
          // Reducir stock definitivamente
          await this._completarVentaStock(recogida, idUsuario, session);
          recogida.completarRecogida({
            idEmpleado: idUsuario,
            nombreEmpleado: datos.nombre_empleado || 'Empleado',
            documentoPresentado: datos.documento_presentado,
            observaciones: datos.observaciones
          });
          break;
          
        case 'cancelar':
          // Liberar stock reservado si existe
          await this._liberarStockRecogida(recogida, idUsuario, session);
          recogida.cambiarEstado('CANCELADO', datos.motivo || 'Recogida cancelada', idUsuario);
          break;
          
        default:
          throw new Error('Acción no válida');
      }
      
      await recogida.save({ session });
      await session.commitTransaction();
      
      console.log(`Recogida ${accion} procesada exitosamente`);
      return recogida.toObject();
    } catch (error) {
      await session.abortTransaction();
      console.error('Error procesando recogida:', error);
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Buscar recogida por código
   * @param {String} codigoRecogida - Código de recogida
   * @returns {Promise<Object>} Recogida encontrada
   */
  async buscarRecogidaPorCodigo(codigoRecogida) {
    try {
      const recogida = await RecogidaTienda.buscarPorCodigo(codigoRecogida);
      if (!recogida) {
        throw new Error('Código de recogida no válido');
      }
      
      return {
        ...recogida.toObject(),
        puede_recoger: recogida.estado === 'LISTO_PARA_RECOGER' && !recogida.haVencido(),
        ha_vencido: recogida.haVencido(),
        proximo_a_vencer: recogida.estaProximoAVencer()
      };
    } catch (error) {
      console.error('Error buscando recogida por código:', error);
      throw error;
    }
  },

  // MÉTODOS AUXILIARES PRIVADOS

  /**
   * Evaluar si una tienda está abierta según sus horarios
   * @private
   */
  _evaluarHorario(horarios) {
    if (!horarios) return false;
    
    const ahora = new Date();
    const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const diaNombre = diasSemana[ahora.getDay()];
    const horario = horarios[diaNombre];
    
    if (!horario || !horario.activo) {
      return false;
    }
    
    try {
      const hora = ahora.getHours();
      const minutos = ahora.getMinutes();
      const horaActual = hora + (minutos / 60);
      
      const [aperturaH, aperturaM] = horario.apertura.split(':').map(Number);
      const [cierreH, cierreM] = horario.cierre.split(':').map(Number);
      
      const horaApertura = aperturaH + (aperturaM / 60);
      const horaCierre = cierreH + (cierreM / 60);
      
      return horaActual >= horaApertura && horaActual < horaCierre;
    } catch (error) {
      console.error('Error evaluando horario:', error);
      return false;
    }
  },

  /**
   * Formatear dirección para mostrar
   * @private
   */
  _formatearDireccion(direccion) {
    if (!direccion) return '';
    
    let direccionCompleta = direccion.direccion_completa || '';
    
    if (direccion.ciudad) {
      direccionCompleta += `, ${direccion.ciudad}`;
    }
    
    if (direccion.departamento) {
      direccionCompleta += `, ${direccion.departamento}`;
    }
    
    return direccionCompleta;
  },

  /**
   * Calcular distancia entre dos puntos
   * @private
   */
  _calcularDistancia(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distancia = R * c;
    
    return Math.round(distancia * 100) / 100;
  },

  /**
   * Obtener estadísticas detalladas de una tienda
   * @private
   */
  async _obtenerEstadisticasDetalladas(idTienda) {
    try {
      const [recogidas, inventario, ventas] = await Promise.all([
        RecogidaTienda.obtenerEstadisticas(idTienda),
        this._obtenerEstadisticasInventario(idTienda),
        this._obtenerEstadisticasVentas(idTienda)
      ]);
      
      return {
        recogidas,
        inventario,
        ventas
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas detalladas:', error);
      return null;
    }
  },

  /**
   * Obtener top tiendas por rendimiento
   * @private
   */
  async _obtenerTopTiendas(fechaInicio, fechaFin) {
    try {
      const matchConditions = {};
      if (fechaInicio) matchConditions.fecha_creacion = { $gte: fechaInicio };
      if (fechaFin) {
        matchConditions.fecha_creacion = matchConditions.fecha_creacion || {};
        matchConditions.fecha_creacion.$lte = fechaFin;
      }
      
      return await RecogidaTienda.aggregate([
        { $match: { estado: 'RECOGIDO', ...matchConditions } },
        {
          $group: {
            _id: '$id_tienda',
            total_recogidas: { $sum: 1 },
            tiempo_promedio_preparacion: { $avg: '$metricas_tiempo.tiempo_preparacion_minutos' },
            valoracion_promedio: { $avg: '$valoracion.puntuacion' }
          }
        },
        {
          $lookup: {
            from: 'tienda_fisicas',
            localField: '_id',
            foreignField: '_id',
            as: 'tienda'
          }
        },
        { $unwind: '$tienda' },
        { $sort: { total_recogidas: -1 } },
        { $limit: 5 },
        {
          $project: {
            tienda: '$tienda.nombre',
            codigo: '$tienda.codigo',
            ciudad: '$tienda.direccion.ciudad',
            total_recogidas: 1,
            tiempo_promedio_preparacion: { $round: ['$tiempo_promedio_preparacion', 2] },
            valoracion_promedio: { $round: ['$valoracion_promedio', 2] }
          }
        }
      ]);
    } catch (error) {
      console.error('Error obteniendo top tiendas:', error);
      return [];
    }
  },

  /**
   * Obtener estadísticas de inventario
   * @private
   */
  async _obtenerEstadisticasInventario(idTienda = null) {
    try {
      const match = idTienda ? { id_tienda: new mongoose.Types.ObjectId(idTienda) } : {};
      
      return await Inventario.aggregate([
        { $match: match },
        {
          $group: {
            _id: idTienda ? null : '$id_tienda',
            total_items: { $sum: 1 },
            stock_total: { $sum: '$stock_total' },
            stock_disponible: { $sum: '$stock_disponible' },
            stock_reservado: { $sum: '$stock_reservado' },
            items_sin_stock: { $sum: { $cond: [{ $eq: ['$stock_disponible', 0] }, 1, 0] } },
            items_bajo_stock: { $sum: { $cond: [{ $lte: ['$stock_disponible', '$umbral_alerta'] }, 1, 0] } }
          }
        }
      ]);
    } catch (error) {
      console.error('Error obteniendo estadísticas de inventario:', error);
      return [];
    }
  },

  /**
   * Obtener estadísticas de ventas
   * @private
   */
  async _obtenerEstadisticasVentas(idTienda) {
    try {
      return await Venta.aggregate([
        {
          $match: {
            'envio.tipo': 'recogida_tienda',
            'envio.id_tienda_recogida': new mongoose.Types.ObjectId(idTienda),
            estado: 'entregado'
          }
        },
        {
          $group: {
            _id: null,
            total_ventas: { $sum: 1 },
            monto_total: { $sum: '$totales.total_final' },
            ticket_promedio: { $avg: '$totales.total_final' }
          }
        }
      ]);
    } catch (error) {
      console.error('Error obteniendo estadísticas de ventas:', error);
      return [];
    }
  },

  /**
   * Buscar y solicitar transferencias para items faltantes
   * @private
   */
  async _buscarYSolicitarTransferencias(recogida, itemsFaltantes) {
    try {
      const tiendaOrigenMap = {};
      
      for (const itemFaltante of itemsFaltantes) {
        // Buscar tiendas con stock del libro
        const tiendasConStock = await TiendaFisica.buscarConLibroDisponible(
          itemFaltante.id_libro,
          itemFaltante.cantidad_faltante
        );
        
        if (tiendasConStock.length > 0) {
          // Tomar la primera tienda disponible
          tiendaOrigenMap[itemFaltante.id_libro.toString()] = tiendasConStock[0]._id;
        }
      }
      
      if (Object.keys(tiendaOrigenMap).length > 0) {
        await recogida.solicitarTransferencias(tiendaOrigenMap, null);
        recogida.cambiarEstado('PREPARANDO_PEDIDO', 'Transferencias solicitadas para items faltantes', null);
      }
    } catch (error) {
      console.error('Error buscando transferencias:', error);
    }
  },

  /**
   * Reservar stock para recogida
   * @private
   */
  async _reservarStockRecogida(recogida, idUsuario, session) {
    for (const item of recogida.items) {
      if (item.estado_item === 'disponible') {
        const inventario = await Inventario.findOne({
          id_libro: item.id_libro,
          id_tienda: recogida.id_tienda
        }).session(session);
        
        if (inventario && inventario.stock_disponible >= item.cantidad) {
          await inventario.reservarEjemplares(
            item.cantidad,
            idUsuario,
            recogida._id,
            `Reserva para recogida ${recogida.codigo_recogida}`
          );
        }
      }
    }
  },

  /**
   * Completar venta - reducir stock definitivamente
   * @private
   */
  async _completarVentaStock(recogida, idUsuario, session) {
    for (const item of recogida.items) {
      if (item.estado_item === 'disponible') {
        const inventario = await Inventario.findOne({
          id_libro: item.id_libro,
          id_tienda: recogida.id_tienda
        }).session(session);
        
        if (inventario) {
          // Reducir del stock reservado y total
          await inventario.registrarSalida(
            item.cantidad,
            'venta',
            idUsuario,
            recogida.id_venta,
            `Venta completada - recogida ${recogida.codigo_recogida}`
          );
        }
      }
    }
  },

  /**
   * Liberar stock reservado de recogida cancelada
   * @private
   */
  async _liberarStockRecogida(recogida, idUsuario, session) {
    for (const item of recogida.items) {
      const inventario = await Inventario.findOne({
        id_libro: item.id_libro,
        id_tienda: recogida.id_tienda
      }).session(session);
      
      if (inventario && inventario.stock_reservado >= item.cantidad) {
        await inventario.liberarReserva(
          item.cantidad,
          idUsuario,
          recogida._id,
          `Liberación por cancelación de recogida ${recogida.codigo_recogida}`
        );
      }
    }
  }
};

module.exports = tiendaService;