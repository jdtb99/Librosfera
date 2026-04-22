// Database/scripts/initRootUser.js
const bcrypt = require('bcryptjs');
const { Usuario, Root } = require('../models');
const userService = require('../services/userService');

/**
 * Crea un usuario root inicial si no existe ninguno
 * Esta función se ejecuta al iniciar el servidor en desarrollo o primera instalación
 * 
 * @returns {Promise<Object|null>} El usuario root creado o null si ya existe uno
 */
const initRootUser = async () => {
  try {
    console.log('Verificando si existe usuario root...');
    
    // Buscar si existe algún usuario root
    const rootCount = await Usuario.countDocuments({ tipo_usuario: 'root' });
    
    if (rootCount > 0) {
      console.log('Ya existe al menos un usuario root. No se creará uno nuevo.');
      return null;
    }
    
    console.log('No se encontró ningún usuario root. Creando usuario root inicial...');
    
    // Credenciales predefinidas para el usuario root inicial
    // En producción deberían obtenerse de variables de entorno o configuración
    const defaultRootData = {
      usuario: 'root_admin',
      email: 'root@librosfera.com',
      password: 'Root12345!', // En producción, usar una contraseña más segura
      tipo_usuario: 'root'
    };
    
    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    defaultRootData.password = await bcrypt.hash(defaultRootData.password, salt);
    
    // Crear usuario root
    const rootUser = new Root({
      ...defaultRootData,
      id_root: `ROOT${Date.now().toString().slice(-6)}`,
      permisos_especiales: ['todos']
    });
    
    // Guardar en la base de datos
    await rootUser.save();
    
    console.log(`
========================================================
🔐 USUARIO ROOT INICIAL CREADO CON ÉXITO
========================================================
Usuario: ${defaultRootData.usuario}
Email: ${defaultRootData.email}
Contraseña: Root12345!  (Cámbiala inmediatamente)
========================================================
⚠️ POR SEGURIDAD, CAMBIA ESTAS CREDENCIALES INMEDIATAMENTE
   DESPUÉS DEL PRIMER INICIO DE SESIÓN
========================================================
    `);
    
    return rootUser;
  } catch (error) {
    console.error('Error al crear usuario root inicial:', error);
    return null;
  }
};

module.exports = initRootUser;