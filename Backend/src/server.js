// src/server.js
const dotenv = require('dotenv');
const { connectDB } = require('../Database/config/dbConfig');
const initRootUser = require('../Database/scripts/initRootUser');
// const initMensajeria = require('../Database/scripts/initMensajeria');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno antes de importar otros módulos
dotenv.config();

// Importar aplicación Express
const app = require('./app');

// Configurar manejo de excepciones no capturadas
process.on('uncaughtException', (err) => {
  console.error('ERROR NO CAPTURADO! 💥 Cerrando aplicación...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Crear directorios necesarios para uploads
const createRequiredDirectories = () => {
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
  const librosDir = path.join(uploadDir, 'libros');
  
  try {
    if (!fs.existsSync(uploadDir)) {
      console.log(`Creando directorio de uploads: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    if (!fs.existsSync(librosDir)) {
      console.log(`Creando directorio para imágenes de libros: ${librosDir}`);
      fs.mkdirSync(librosDir, { recursive: true });
    }
    
    console.log('✅ Directorios para uploads creados correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al crear directorios de uploads:', error);
    return false;
  }
};

// Función principal para iniciar el servidor
async function iniciarServidor() {
  try {
    // Conectar a MongoDB
    await connectDB();
    
    // Inicializar usuario root
    await initRootUser();
    // await initMensajeria();
    
    // Crear directorios necesarios
    createRequiredDirectories();
    
    // Definir puerto
    const PORT = process.env.PORT || 5000;
    
    // Iniciar servidor HTTP
    const server = app.listen(PORT, () => {
      console.log(`
🚀 Servidor iniciado:
- Modo: ${process.env.NODE_ENV}
- Puerto: ${PORT}
- Tiempo: ${new Date().toISOString()}
      `);
    });
    
    // Manejar rechazos de promesas no capturados
    process.on('unhandledRejection', (err) => {
      console.error('ERROR DE PROMESA NO MANEJADA! 💥');
      console.error(err.name, err.message);
      console.error(err.stack);
      
      // Cerrar servidor y salir
      server.close(() => {
        console.log('Servidor cerrado debido a un error no manejado.');
        process.exit(1);
      });
    });
    
    // Manejar señales de terminación
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM recibido. Cerrando servidor graciosamente...');
      server.close(() => {
        console.log('Proceso terminado.');
      });
    });
    
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor
iniciarServidor();