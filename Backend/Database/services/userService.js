// Database/services/userService.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;
const { Usuario, Root, Administrador, Cliente } = require('../models');

/**
 * Servicio de usuario - Encapsula la lógica de negocio y acceso a datos para usuarios
 * Proporciona métodos para todas las operaciones relacionadas con usuarios en la aplicación
 */
const userService = {
  /**
   * Actualiza la foto de perfil de un usuario
   * @param {String} userId - ID del usuario
   * @param {Object} archivo - Archivo de imagen subido
   * @returns {Promise<Object>} Usuario actualizado
   */
  async actualizarFotoPerfil(userId, archivo) {
    try {
      console.log('Actualizando foto de perfil para usuario:', userId);
      
      // Verificar si el usuario existe
      let usuario;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        usuario = await Usuario.findById(userId);
      } else {
        usuario = await Usuario.findOne({
          $or: [
            { id_cliente: userId },
            { id_root: userId },
            { usuario: userId },
            { email: userId }
          ]
        });
      }

      if (!usuario) {
        throw new Error(`Usuario no encontrado con ID: ${userId}`);
      }

      // Verificar que la imagen existe
      if (!archivo || (!archivo.filename && !archivo.path)) {
        throw new Error('No se recibió un archivo de imagen válido');
      }

      // URL para acceder a la imagen
      const baseUrl = process.env.BASE_URL || 'https://librosfera.onrender.com/';
      const urlImagen = archivo.url || `${baseUrl}/uploads/profiles/${archivo.filename}`;
      
      console.log('URL de la imagen:', urlImagen);
      
      // Si ya existe una foto de perfil anterior y no es la default, eliminar físicamente
      if (usuario.foto_perfil && usuario.foto_perfil !== 'https://librosfera.onrender.com/uploads/profiles/default.jpg' && !usuario.foto_perfil.includes('default')) {
        try {
          // Extraer nombre del archivo de la URL
          const nombreArchivoActual = usuario.foto_perfil.split('/').pop();
          if (nombreArchivoActual) {
            const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
            const profilesDir = path.join(uploadDir, 'profiles');
            const rutaArchivoActual = path.join(profilesDir, nombreArchivoActual);
            
            // Verificar si el archivo existe antes de intentar eliminarlo
            const existeArchivo = await fs.access(rutaArchivoActual)
              .then(() => true)
              .catch(() => false);
              
            if (existeArchivo) {
              await fs.unlink(rutaArchivoActual);
            }
          }
        } catch (err) {
          console.warn('No se pudo eliminar la foto de perfil anterior:', err.message);
          // Continuar incluso si no se puede eliminar el archivo físico
        }
      }
      
      // Actualizar foto de perfil en el usuario
      usuario.foto_perfil = urlImagen;
      await usuario.save();
      
      console.log('Foto de perfil actualizada correctamente');
      return usuario.toObject();
    } catch (error) {
      console.error('Error actualizando foto de perfil:', error);
      throw error;
    }
  },

  /**
   * Elimina la foto de perfil de un usuario (establece a default)
   * @param {String} userId - ID del usuario
   * @returns {Promise<Object>} Usuario actualizado
   */
  async eliminarFotoPerfil(userId) {
    try {
      console.log('Eliminando foto de perfil para usuario:', userId);
      
      // Verificar si el usuario existe
      let usuario;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        usuario = await Usuario.findById(userId);
      } else {
        usuario = await Usuario.findOne({
          $or: [
            { id_cliente: userId },
            { id_root: userId },
            { usuario: userId },
            { email: userId }
          ]
        });
      }

      if (!usuario) {
        throw new Error(`Usuario no encontrado con ID: ${userId}`);
      }

      // Si ya existe una foto de perfil y no es la default, eliminar físicamente
      if (usuario.foto_perfil && usuario.foto_perfil !== 'https://librosfera.onrender.com/uploads/profiles/default.jpg' && !usuario.foto_perfil.includes('default')) {
        try {
          // Extraer nombre del archivo de la URL
          const nombreArchivoActual = usuario.foto_perfil.split('/').pop();
          if (nombreArchivoActual) {
            const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
            const profilesDir = path.join(uploadDir, 'profiles');
            const rutaArchivoActual = path.join(profilesDir, nombreArchivoActual);
            
            // Verificar si el archivo existe antes de intentar eliminarlo
            const existeArchivo = await fs.access(rutaArchivoActual)
              .then(() => true)
              .catch(() => false);
              
            if (existeArchivo) {
              await fs.unlink(rutaArchivoActual);
            }
          }
        } catch (err) {
          console.warn('No se pudo eliminar el archivo físico:', err.message);
          // Continuar incluso si no se puede eliminar el archivo físico
        }
      }
      
      // Restaurar foto de perfil por defecto
      usuario.foto_perfil = 'https://librosfera.onrender.com/uploads/profiles/default.jpg';
      await usuario.save();
      
      console.log('Foto de perfil restaurada a default');
      return usuario.toObject();
    } catch (error) {
      console.error('Error eliminando foto de perfil:', error);
      throw error;
    }
  },

  /**
   * Busca un usuario por su dirección de email
   * @param {String} email - Email del usuario
   * @returns {Promise<Object>} Datos del usuario encontrado
   */
  async buscarUsuarioPorEmail(email) {
    try {
      // Usa el modelo base para encontrar cualquier tipo de usuario
      const usuario = await Usuario.findOne({ email });
      
      if (!usuario) {
        return null;
      }
      
      return usuario.toObject();
    } catch (error) {
      console.error('Error buscando usuario por email:', error);
      throw error;
    }
  },

  /**
   * Busca un usuario por ID y obtiene todos sus datos
   * @param {String} userId - ID del usuario
   * @returns {Promise<Object>} Usuario con todos sus datos
   */
  async obtenerUsuarioCompleto(userId) {
    try {
      let usuario;
      
      // Verificar si es un ObjectId válido
      if (mongoose.Types.ObjectId.isValid(userId)) {
        usuario = await Usuario.findById(userId);
      } 
      // Si no es un ObjectId, intentar buscar por id_cliente o otros campos
      else {
        usuario = await Usuario.findOne({
          $or: [
            { id_cliente: userId },
            { id_root: userId },
            { usuario: userId },
            { email: userId }
          ]
        });
      }
      
      if (!usuario) {
        return null;
      }
      
      return usuario.toObject();
    } catch (error) {
      console.error('Error obteniendo usuario completo:', error);
      throw error;
    }
  },

  /**
   * Crea un nuevo usuario de tipo cliente
   * @param {Object} userData - Datos básicos del usuario
   * @param {Object} profileData - Datos de perfil del cliente
   * @param {Object} clientData - Datos específicos del cliente
   * @returns {Promise<Object>} Datos del nuevo cliente creado
   */
  async crearCliente(userData, profileData, clientData = {}) {
    try {
      // Generar ID de cliente único
      const idCliente = `CLI${Date.now().toString().slice(-8)}`;
      
      const encryptedPassword = userData.password;
      
      const nuevoCliente = new Cliente({
        ...profileData,
        ...clientData,
        id_cliente: idCliente,
        ...userData,
        password: encryptedPassword
      });
      
      // Guardar en la base de datos
      await nuevoCliente.save();
      
      return nuevoCliente.toObject();
    } catch (error) {
      console.error('Error creando cliente:', error);
      throw error;
    }
  },

  /**
 * Crea un nuevo usuario de tipo administrador con datos mínimos
 * @param {Object} userData - Datos básicos del usuario (email, password, usuario)
 * @param {Object} profileData - Datos de perfil del administrador (opcionales)
 * @param {Object} adminData - Datos específicos del administrador (opcionales)
 * @returns {Promise<Object>} Datos del nuevo administrador creado
 */
  async crearAdministrador(userData, profileData = {}, adminData = {}) {
    try {
      // Validar que al menos tengamos los datos básicos
      if (!userData.email || !userData.password) {
        throw new Error('Email y contraseña son obligatorios para crear un administrador');
      }
      
      // Si no se proporciona un nombre de usuario, generarlo a partir del email
      if (!userData.usuario) {
        userData.usuario = userData.email.split('@')[0] + '_admin';
      }
      
      // Crear objeto con datos mínimos
      const datosAdmin = {
        ...userData,
        tipo_usuario: 'administrador',
        perfil_completo: false, // Indicar que el perfil no está completo
        fecha_creacion: new Date()
      };
      
      // Añadir datos de perfil si se proporcionan
      if (Object.keys(profileData).length > 0) {
        Object.assign(datosAdmin, profileData);
        
        // Si se proporcionan suficientes datos personales, marcar el perfil como completo
        if (profileData.nombres && profileData.apellidos && profileData.DNI) {
          datosAdmin.perfil_completo = true;
        }
      }
      
      // Añadir datos específicos de administrador si se proporcionan
      if (Object.keys(adminData).length > 0) {
        Object.assign(datosAdmin, adminData);
      }
      
      // Crear instancia del modelo
      const nuevoAdmin = new Administrador(datosAdmin);
      
      // Guardar en la base de datos
      await nuevoAdmin.save();
      
      return nuevoAdmin.toObject();
    } catch (error) {
      console.error('Error creando administrador:', error);
      throw error;
    }
  },

  /**
   * Crea un nuevo usuario de tipo root (superadmin)
   * @param {Object} userData - Datos básicos del usuario
   * @param {Object} rootData - Datos específicos del root
   * @returns {Promise<Object>} Datos del nuevo root creado
   */
  async crearRoot(userData, rootData = {}) {
    try {
      // Generar ID de root único
      const idRoot = `ROOT${Date.now().toString().slice(-6)}`;
      
      // Combinar todos los datos
      const nuevoRoot = new Root({
        ...userData,
        id_root: idRoot,
        ...rootData
      });
      
      // Guardar en la base de datos
      await nuevoRoot.save();
      
      return nuevoRoot.toObject();
    } catch (error) {
      console.error('Error creando root:', error);
      throw error;
    }
  },

  /**
   * Actualiza los datos de un usuario
   * @param {String} userId - ID del usuario
   * @param {Object} userData - Datos básicos a actualizar
   * @param {Object} profileData - Datos de perfil a actualizar
   * @param {Object} tipoData - Datos específicos del tipo de usuario
   * @returns {Promise<Object>} Usuario actualizado
   */
  async actualizarUsuario(userId, userData, profileData, tipoData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('ID de usuario inválido');
      }
      
      // Buscar primero el usuario para obtener datos existentes
      const usuario = await Usuario.findById(userId);
      
      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }
      
      // Manejar objetos anidados
      if (profileData) {
        // Manejar actualización de direcciones (asegurarse de que sea un array)
        if (profileData.direcciones) {
          // Si se está reemplazando completamente el array
          if (Array.isArray(profileData.direcciones)) {
            usuario.direcciones = profileData.direcciones;
          } 
          // Si se está agregando una sola dirección
          else if (typeof profileData.direcciones === 'object') {
            if (!usuario.direcciones) usuario.direcciones = [];
            usuario.direcciones.push(profileData.direcciones);
          }
          delete profileData.direcciones;
        }
      }
      
      // Manejar preferencias para clientes
      if (tipoData && tipoData.preferencias) {
        if (!usuario.preferencias) usuario.preferencias = {};
        
        // Actualizar temas
        if (tipoData.preferencias.temas) {
          usuario.preferencias.temas = tipoData.preferencias.temas;
        }
        
        // Actualizar autores
        if (tipoData.preferencias.autores) {
          usuario.preferencias.autores = tipoData.preferencias.autores;
        }
        
        delete tipoData.preferencias;
      }
      
      // Actualizar el resto de los datos
      if (userData) Object.assign(usuario, userData);
      if (profileData) Object.assign(usuario, profileData);
      if (tipoData) Object.assign(usuario, tipoData);
      
      // Guardar los cambios
      await usuario.save();
      
      return usuario.toObject();
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  },
  
  /**
   * Desactiva un usuario (eliminación lógica)
   * @param {String} userId - ID del usuario
   * @returns {Promise<Boolean>} True si se desactivó correctamente
   */
  async desactivarUsuario(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('ID de usuario inválido');
      }
      
      // Desactivación lógica cambiando el estado a inactivo
      const resultado = await Usuario.findByIdAndUpdate(
        userId,
        { 
          $set: { 
            activo: false,
            fecha_desactivacion: new Date()
          } 
        }
      );
      
      if (!resultado) {
        throw new Error('Usuario no encontrado');
      }
      
      return true;
    } catch (error) {
      console.error('Error desactivando usuario:', error);
      throw error;
    }
  },
  
  /**
   * Elimina un usuario permanentemente (eliminación física)
   * @param {String} userId - ID del usuario
   * @returns {Promise<Boolean>} True si se eliminó correctamente
   */
  async eliminarUsuarioPermanente(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('ID de usuario inválido');
      }
      
      // Eliminación física del usuario
      const resultado = await Usuario.findByIdAndDelete(userId);
      
      if (!resultado) {
        throw new Error('Usuario no encontrado');
      }
      
      return true;
    } catch (error) {
      console.error('Error eliminando usuario permanentemente:', error);
      throw error;
    }
  },
  
  /**
   * Obtiene una lista paginada de usuarios con filtros
   * @param {Object} filtros - Filtros para la búsqueda
   * @param {Number} pagina - Número de página
   * @param {Number} limite - Cantidad de resultados por página
   * @returns {Promise<Object>} Datos paginados de usuarios
   */
  async listarUsuarios(filtros = {}, pagina = 1, limite = 10) {
    try {
      // Construir el objeto de filtros para la consulta
      const queryFiltros = {};
      
      if (filtros.tipo_usuario) {
        queryFiltros.tipo_usuario = filtros.tipo_usuario;
      }
      
      if (filtros.activo !== undefined) {
        queryFiltros.activo = filtros.activo === true || filtros.activo === 'true';
      }
      
      if (filtros.email) {
        queryFiltros.email = { $regex: filtros.email, $options: 'i' };
      }
      
      if (filtros.usuario) {
        queryFiltros.usuario = { $regex: filtros.usuario, $options: 'i' };
      }
      
      // Calcular índice para paginación
      const skip = (pagina - 1) * limite;
      
      // Contar total de resultados para la paginación
      const total = await Usuario.countDocuments(queryFiltros);
      
      // Obtener usuarios filtrados y paginados
      const usuarios = await Usuario.find(queryFiltros)
        .select('-password')
        .skip(skip)
        .limit(limite)
        .sort({ fecha_registro: -1 });
      
      // Calcular el total de páginas
      const totalPaginas = Math.ceil(total / limite) || 1;
      
      // Devolver resultados con metadatos de paginación
      return {
        datos: usuarios.map(u => u.toObject()),
        paginacion: {
          total,
          pagina,
          limite,
          totalPaginas
        }
      };
    } catch (error) {
      console.error('Error listando usuarios:', error);
      throw error;
    }
  },
  
  /**
   * Verifica si un email o nombre de usuario ya está en uso
   * @param {String} email - Email a verificar
   * @param {String} usuario - Nombre de usuario a verificar
   * @param {String} exceptUsuarioId - ID de usuario a excluir de la verificación
   * @returns {Promise<Boolean>} True si está disponible, False si ya está en uso
   */
  async verificarDisponibilidad(email, usuario, exceptUsuarioId = null) {
    try {
      const filtros = [];
      
      if (email) filtros.push({ email });
      if (usuario) filtros.push({ usuario });
      
      // Si no hay nada que verificar, retorna true
      if (filtros.length === 0) {
        return true;
      }
      
      const consulta = { $or: filtros };
      
      // Excluir el usuario actual si se está actualizando
      if (exceptUsuarioId && mongoose.Types.ObjectId.isValid(exceptUsuarioId)) {
        consulta._id = { $ne: exceptUsuarioId };
      }
      
      const existente = await Usuario.findOne(consulta);
      
      // Retorna true si NO existe un usuario con ese email o nombre
      return !existente;
    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      throw error;
    }
  }
};

module.exports = userService;