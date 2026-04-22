// Database/config/dbConfig.js
const mongoose = require('mongoose');

/**
 * Configuración para la conexión a MongoDB
 * Incluye opciones para optimizar el rendimiento y la estabilidad
 */
const connectOptions = {
  serverApi: { 
    version: '1', 
    strict: false, 
    deprecationErrors: true 
  },
  autoIndex: process.env.NODE_ENV !== 'production', // Desactivar autoIndex en producción
  maxPoolSize: 10, // Ajustar según la carga esperada
  minPoolSize: 2,
  socketTimeoutMS: 45000, // Tiempo de espera largo para operaciones
  connectTimeoutMS: 10000, // Timeout de conexión inicial
  retryWrites: true,
  retryReads: true,
};

/**
 * Función para conectar a MongoDB con manejo de errores robusto
 * @returns {Promise} Promesa que resuelve cuando la conexión es exitosa
 */
const connectDB = async () => {
  try {
    console.log('Intentando conectar a MongoDB...');
    
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI no está definida en las variables de entorno');
    }
    
    // Conectar a MongoDB
    await mongoose.connect(uri, connectOptions);
    
    // Eventos de conexión para monitoreo
    mongoose.connection.on('connected', () => {
      console.log('🎉 MongoDB conectado correctamente');
      console.log(`Estado de conexión: ${mongoose.connection.readyState}`);
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('Error en la conexión MongoDB:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB desconectado');
    });
    
    // Manejo de cierre del proceso
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('Conexión MongoDB cerrada debido a la terminación de la aplicación');
      process.exit(0);
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('Error fatal al conectar a MongoDB:', error);
    process.exit(1);
  }
};

module.exports = { connectDB };