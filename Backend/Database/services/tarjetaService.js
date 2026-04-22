// Database/services/tarjetaService.js
const mongoose = require('mongoose');
const Tarjeta = require('../models/schemas/tarjetaSchema');
const { Usuario } = require('../models');

/**
 * Servicio de tarjetas - Encapsula la lógica de negocio y acceso a datos para tarjetas
 * Proporciona métodos para todas las operaciones relacionadas con tarjetas en la aplicación
 */
const tarjetaService = {
  /**
   * Registra una nueva tarjeta para un usuario
   * @param {String} userId - ID del usuario
   * @param {Object} datosTarjeta - Datos para crear la tarjeta
   * @returns {Promise<Object>} Tarjeta creada
   */
  async registrarTarjeta(userId, datosTarjeta) {
    try {
      // Verificar si el usuario existe
      const usuario = await Usuario.findById(userId);
      if (!usuario) {
        throw new Error(`Usuario no encontrado con ID: ${userId}`);
      }

      // Validar número de tarjeta (solo para validación, no se almacena completo)
      if (datosTarjeta.numero_tarjeta) {
        const esValido = Tarjeta.validarNumeroTarjeta(datosTarjeta.numero_tarjeta);
        if (!esValido) {
          throw new Error('El número de tarjeta no es válido');
        }
        
        // Extraer últimos 4 dígitos
        datosTarjeta.ultimos_digitos = datosTarjeta.numero_tarjeta.slice(-4);
        
        // Determinar marca de tarjeta si no se especificó
        if (!datosTarjeta.marca) {
          datosTarjeta.marca = Tarjeta.determinarMarcaTarjeta(datosTarjeta.numero_tarjeta);
        }
        
        // Eliminar número completo por seguridad
        delete datosTarjeta.numero_tarjeta;
      }
      
      // Generar token seguro para la tarjeta
      datosTarjeta.token_seguro = Tarjeta.generarTokenSeguro();
      
      // Verificar si el usuario ya tiene tarjetas
      const tarjetasExistentes = await Tarjeta.countDocuments({ id_usuario: userId, activa: true });
      
      // Si es la primera tarjeta, establecerla como predeterminada
      if (tarjetasExistentes === 0) {
        datosTarjeta.predeterminada = true;
      }
      
      // Crear la nueva tarjeta
      const nuevaTarjeta = new Tarjeta({
        id_usuario: userId,
        ...datosTarjeta
      });
      
      await nuevaTarjeta.save();
      
      return nuevaTarjeta.toObject();
    } catch (error) {
      console.error('Error registrando tarjeta:', error);
      throw error;
    }
  },

  /**
   * Obtiene todas las tarjetas activas de un usuario
   * @param {String} userId - ID del usuario
   * @returns {Promise<Array>} Lista de tarjetas
   */
  async obtenerTarjetasUsuario(userId) {
    try {
      const tarjetas = await Tarjeta.obtenerTarjetasUsuario(userId);
      return tarjetas.map(t => t.toObject());
    } catch (error) {
      console.error('Error obteniendo tarjetas del usuario:', error);
      throw error;
    }
  },

  /**
   * Obtiene una tarjeta específica por su ID
   * @param {String} tarjetaId - ID de la tarjeta
   * @param {String} userId - ID del usuario (para verificación de propiedad)
   * @returns {Promise<Object>} Tarjeta encontrada
   */
  async obtenerTarjetaPorId(tarjetaId, userId = null) {
    try {
      const query = { id_tarjeta: tarjetaId };
      
      // Si se proporciona userId, verificar propiedad
      if (userId) {
        query.id_usuario = userId;
      }
      
      const tarjeta = await Tarjeta.findOne(query);
      
      if (!tarjeta) {
        return null;
      }
      
      return tarjeta.toObject();
    } catch (error) {
      console.error('Error obteniendo tarjeta por ID:', error);
      throw error;
    }
  },

  /**
   * Establece un saldo absoluto en una tarjeta de débito (reemplaza el saldo actual)
   * @param {String} tarjetaId - ID de la tarjeta
   * @param {String} userId - ID del usuario propietario
   * @param {Number} saldoNuevo - Nuevo saldo a establecer (debe ser positivo)
   * @param {String} descripcion - Descripción de la operación
   * @returns {Promise<Object>} Resultado de la operación
   */
  async establecerSaldoAbsoluto(tarjetaId, userId, saldoNuevo, descripcion = '') {
    try {
      // Validar que el saldo nuevo sea válido
      if (typeof saldoNuevo !== 'number' || isNaN(saldoNuevo)) {
        throw new Error('El saldo debe ser un número válido');
      }
      
      if (saldoNuevo < 0) {
        throw new Error('El saldo no puede ser negativo');
      }
      
      // Buscar la tarjeta
      const tarjeta = await Tarjeta.findOne({ 
        id_tarjeta: tarjetaId, 
        id_usuario: userId,
        activa: true,
        tipo: 'debito'
      });
      
      if (!tarjeta) {
        throw new Error('Tarjeta no encontrada, no está activa o no es de débito');
      }
      
      // Guardar saldo anterior
      const saldoAnterior = tarjeta.saldo;
      
      // Establecer el nuevo saldo (absoluto)
      tarjeta.saldo = saldoNuevo;
      tarjeta.ultima_actualizacion = new Date();
      
      await tarjeta.save();
      
      // Calcular la diferencia para propósitos informativos
      const diferencia = saldoNuevo - saldoAnterior;
      
      return {
        id_tarjeta: tarjeta.id_tarjeta,
        saldo_anterior: saldoAnterior,
        saldo_establecido: saldoNuevo,
        diferencia: diferencia,
        tipo_operacion: 'saldo_absoluto',
        fecha_operacion: new Date(),
        descripcion: descripcion || 'Establecimiento de saldo absoluto'
      };
    } catch (error) {
      console.error('Error estableciendo saldo absoluto:', error);
      throw error;
    }
  },

  /**
   * Actualiza los datos de una tarjeta
   * @param {String} tarjetaId - ID de la tarjeta
   * @param {String} userId - ID del usuario propietario
   * @param {Object} datosTarjeta - Datos a actualizar
   * @returns {Promise<Object>} Tarjeta actualizada
   */
  async actualizarTarjeta(tarjetaId, userId, datosTarjeta) {
    try {
      // Buscar la tarjeta existente
      const tarjeta = await Tarjeta.findOne({ id_tarjeta: tarjetaId, id_usuario: userId });
      
      if (!tarjeta) {
        throw new Error('Tarjeta no encontrada o no pertenece al usuario');
      }
      
      // No permitir cambiar el usuario propietario
      if (datosTarjeta.id_usuario) {
        delete datosTarjeta.id_usuario;
      }
      
      // No permitir cambiar los últimos dígitos directamente
      if (datosTarjeta.ultimos_digitos) {
        delete datosTarjeta.ultimos_digitos;
      }
      
      // Si se proporciona un nuevo número de tarjeta completo
      if (datosTarjeta.numero_tarjeta) {
        const esValido = Tarjeta.validarNumeroTarjeta(datosTarjeta.numero_tarjeta);
        if (!esValido) {
          throw new Error('El número de tarjeta no es válido');
        }
        
        // Extraer últimos 4 dígitos
        tarjeta.ultimos_digitos = datosTarjeta.numero_tarjeta.slice(-4);
        
        // Determinar marca si no se especificó
        if (!datosTarjeta.marca) {
          tarjeta.marca = Tarjeta.determinarMarcaTarjeta(datosTarjeta.numero_tarjeta);
        }
        
        // Generar nuevo token seguro
        tarjeta.token_seguro = Tarjeta.generarTokenSeguro();
        
        // Eliminar número completo por seguridad
        delete datosTarjeta.numero_tarjeta;
      }
      
      // Actualizar los campos permitidos
      const camposPermitidos = [
        'nombre_titular', 'tipo', 'marca', 'fecha_expiracion', 
        'predeterminada', 'activa'
      ];
      
      camposPermitidos.forEach(campo => {
        if (datosTarjeta[campo] !== undefined) {
          tarjeta[campo] = datosTarjeta[campo];
        }
      });
      
      // Si se está estableciendo como predeterminada
      if (datosTarjeta.predeterminada === true) {
        // Desactivar predeterminada en otras tarjetas
        await Tarjeta.updateMany(
          { id_usuario: userId, id_tarjeta: { $ne: tarjetaId } },
          { $set: { predeterminada: false } }
        );
      }
      
      await tarjeta.save();
      return tarjeta.toObject();
    } catch (error) {
      console.error('Error actualizando tarjeta:', error);
      throw error;
    }
  },

  /**
   * Elimina una tarjeta (desactivación lógica)
   * @param {String} tarjetaId - ID de la tarjeta
   * @param {String} userId - ID del usuario propietario
   * @returns {Promise<Boolean>} True si se eliminó correctamente
   */
  async eliminarTarjeta(tarjetaId, userId) {
    try {
      // Buscar la tarjeta
      const tarjeta = await Tarjeta.findOne({ id_tarjeta: tarjetaId, id_usuario: userId });
      
      if (!tarjeta) {
        throw new Error('Tarjeta no encontrada o no pertenece al usuario');
      }
      
      // Verificar si es la única tarjeta del usuario
      const cantidadTarjetas = await Tarjeta.countDocuments({ 
        id_usuario: userId, 
        activa: true 
      });
      
      // Eliminación lógica
      tarjeta.activa = false;
      tarjeta.ultima_actualizacion = new Date();
      
      // Si era la predeterminada y hay más tarjetas, establecer otra como predeterminada
      if (tarjeta.predeterminada && cantidadTarjetas > 1) {
        const otraTarjeta = await Tarjeta.findOne({ 
          id_usuario: userId, 
          id_tarjeta: { $ne: tarjetaId },
          activa: true 
        });
        
        if (otraTarjeta) {
          otraTarjeta.predeterminada = true;
          await otraTarjeta.save();
        }
      }
      
      await tarjeta.save();
      return true;
    } catch (error) {
      console.error('Error eliminando tarjeta:', error);
      throw error;
    }
  },

  /**
   * Establece una tarjeta como predeterminada
   * @param {String} tarjetaId - ID de la tarjeta
   * @param {String} userId - ID del usuario propietario
   * @returns {Promise<Object>} Tarjeta actualizada
   */
  async establecerTarjetaPredeterminada(tarjetaId, userId) {
    try {
      // Actualizar todas las tarjetas del usuario
      await Tarjeta.updateMany(
        { id_usuario: userId, activa: true },
        { $set: { predeterminada: false } }
      );
      
      // Establecer la tarjeta seleccionada como predeterminada
      const tarjeta = await Tarjeta.findOneAndUpdate(
        { id_tarjeta: tarjetaId, id_usuario: userId, activa: true },
        { $set: { predeterminada: true } },
        { new: true }
      );
      
      if (!tarjeta) {
        throw new Error('Tarjeta no encontrada o no está activa');
      }
      
      return tarjeta.toObject();
    } catch (error) {
      console.error('Error estableciendo tarjeta predeterminada:', error);
      throw error;
    }
  },

  /**
   * Verifica si una tarjeta es válida y está activa
   * @param {String} tarjetaId - ID de la tarjeta
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async verificarTarjeta(tarjetaId) {
    try {
      const tarjeta = await Tarjeta.findOne({ id_tarjeta: tarjetaId });
      
      if (!tarjeta) {
        return {
          valida: false,
          mensaje: 'Tarjeta no encontrada'
        };
      }
      
      if (!tarjeta.activa) {
        return {
          valida: false,
          mensaje: 'La tarjeta está desactivada'
        };
      }
      
      const esValida = tarjeta.esValida();
      
      return {
        valida: esValida,
        activa: tarjeta.activa,
        mensaje: esValida ? 'Tarjeta válida' : 'La tarjeta ha expirado',
        datos: {
          tipo: tarjeta.tipo,
          marca: tarjeta.marca,
          ultimos_digitos: tarjeta.ultimos_digitos,
          fecha_expiracion: tarjeta.fecha_expiracion
        }
      };
    } catch (error) {
      console.error('Error verificando tarjeta:', error);
      throw error;
    }
  },

  /**
   * Verifica el saldo disponible de una tarjeta de débito
   * @param {String} tarjetaId - ID de la tarjeta
   * @param {String} userId - ID del usuario propietario
   * @returns {Promise<Object>} Información del saldo
   */
  async verificarSaldo(tarjetaId, userId) {
    try {
      const tarjeta = await Tarjeta.findOne({ 
        id_tarjeta: tarjetaId, 
        id_usuario: userId,
        activa: true 
      });
      
      if (!tarjeta) {
        throw new Error('Tarjeta no encontrada o no está activa');
      }
      
      if (tarjeta.tipo !== 'debito') {
        return {
          tipo: 'credito',
          mensaje: 'Las tarjetas de crédito no tienen saldo verificable'
        };
      }
      
      return {
        tipo: 'debito',
        saldo: tarjeta.saldo,
        moneda: 'USD' // Podrías tener un campo para esto en tu modelo
      };
    } catch (error) {
      console.error('Error verificando saldo:', error);
      throw error;
    }
  },

  /**
   * Modifica el saldo de una tarjeta de débito
   * @param {String} tarjetaId - ID de la tarjeta
   * @param {String} userId - ID del usuario propietario
   * @param {Number} monto - Monto a modificar (positivo para incremento, negativo para decremento)
   * @param {String} descripcion - Descripción de la operación
   * @returns {Promise<Object>} Tarjeta actualizada
   */
  async modificarSaldo(tarjetaId, userId, monto, descripcion = '') {
    try {
      const tarjeta = await Tarjeta.findOne({ 
        id_tarjeta: tarjetaId, 
        id_usuario: userId,
        activa: true,
        tipo: 'debito'
      });
      
      if (!tarjeta) {
        throw new Error('Tarjeta no encontrada, no está activa o no es de débito');
      }
      
      if (monto < 0 && Math.abs(monto) > tarjeta.saldo) {
        throw new Error('Saldo insuficiente para realizar esta operación');
      }
      
      const saldoAnterior = tarjeta.saldo;
      tarjeta.saldo += monto;
      
      // Evitar saldos negativos
      if (tarjeta.saldo < 0) {
        tarjeta.saldo = 0;
      }
      
      tarjeta.ultima_actualizacion = new Date();
      await tarjeta.save();
      
      return {
        id_tarjeta: tarjeta.id_tarjeta,
        saldo_anterior: saldoAnterior,
        saldo_actual: tarjeta.saldo,
        monto_modificado: monto,
        fecha_operacion: new Date()
      };
    } catch (error) {
      console.error('Error modificando saldo:', error);
      throw error;
    }
  },

  /**
   * Obtiene la tarjeta predeterminada de un usuario
   * @param {String} userId - ID del usuario
   * @returns {Promise<Object>} Tarjeta predeterminada
   */
  async obtenerTarjetaPredeterminada(userId) {
    try {
      const tarjeta = await Tarjeta.findOne({ 
        id_usuario: userId,
        predeterminada: true,
        activa: true
      });
      
      if (!tarjeta) {
        // Intentar obtener cualquier tarjeta activa si no hay predeterminada
        const cualquierTarjeta = await Tarjeta.findOne({
          id_usuario: userId,
          activa: true
        });
        
        return cualquierTarjeta ? cualquierTarjeta.toObject() : null;
      }
      
      return tarjeta.toObject();
    } catch (error) {
      console.error('Error obteniendo tarjeta predeterminada:', error);
      throw error;
    }
  },

  /**
   * Obtiene estadísticas de tarjetas por usuario
   * @param {String} userId - ID del usuario (opcional, si no se proporciona devuelve stats globales)
   * @returns {Promise<Object>} Estadísticas
   */
  async obtenerEstadisticasTarjetas(userId = null) {
    try {
      const match = userId ? { id_usuario: new mongoose.Types.ObjectId(userId) } : {};
      
      const stats = await Tarjeta.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            total: { $sum: 1 },
            activas: { $sum: { $cond: ["$activa", 1, 0] } },
            credito: { $sum: { $cond: [{ $eq: ["$tipo", "credito"] }, 1, 0] } },
            debito: { $sum: { $cond: [{ $eq: ["$tipo", "debito"] }, 1, 0] } },
            saldoTotal: { $sum: { $cond: [{ $eq: ["$tipo", "debito"] }, "$saldo", 0] } }
          }
        },
        { $project: {
            _id: 0,
            total: 1,
            activas: 1,
            inactivas: { $subtract: ["$total", "$activas"] },
            credito: 1,
            debito: 1,
            saldoTotal: 1
          }
        }
      ]);
      
      return stats.length > 0 ? stats[0] : {
        total: 0,
        activas: 0,
        inactivas: 0,
        credito: 0,
        debito: 0,
        saldoTotal: 0
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de tarjetas:', error);
      throw error;
    }
  }
};

module.exports = tarjetaService;