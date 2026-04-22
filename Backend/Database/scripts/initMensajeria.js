//Database/scripts/initMensajeria.js
const mongoose = require('mongoose');
const Conversacion = require('../models/conversacionModel');
const Mensaje = require('../models/mensajeModel');

/**
 * Script para inicializar índices y configuración del sistema de mensajería
 */
async function initMensajeria() {
  try {
    console.log('🔧 Inicializando sistema de mensajería...');
    
    // Crear índices si no existen
    await Conversacion.createIndexes();
    await Mensaje.createIndexes();
    
    console.log('✅ Sistema de mensajería inicializado correctamente');
    console.log('📊 Índices creados para búsquedas eficientes');
    
    return true;
  } catch (error) {
    console.error('❌ Error inicializando sistema de mensajería:', error);
    return false;
  }
}

module.exports = initMensajeria;