// src/utils/cronJobs.js 

const cron = require('node-cron');
const devolucionService = require('../../Database/services/devolucionService');

class DevolucionCronJobs {
  /**
   * Inicializar todos los jobs de devoluciones
   */
  static inicializarJobs() {
    console.log('🔄 Inicializando jobs automáticos de devoluciones...');
    
    // Job diario para procesar devoluciones expiradas (a las 2:00 AM)
    this.jobDevolucionesExpiradas();
    
    // Job semanal para limpiar archivos temporales (domingos a las 3:00 AM)
    this.jobLimpiezaArchivos();
    
    console.log('✅ Jobs de devoluciones inicializados correctamente');
  }
  
  /**
   * Job para procesar devoluciones expiradas diariamente
   */
  static jobDevolucionesExpiradas() {
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🔄 Ejecutando job: Procesamiento de devoluciones expiradas');
        
        const resultado = await devolucionService.procesarDevolucionesExpiradas();
        
        console.log(`✅ Job completado: ${resultado.procesadas} devoluciones procesadas`);
        
        // Log en base de datos si hay un sistema de logs
        if (resultado.procesadas > 0) {
          // Opcional: enviar notificación a administradores
          console.log(`📧 Se procesaron ${resultado.procesadas} devoluciones expiradas automáticamente`);
        }
        
      } catch (error) {
        console.error('❌ Error en job de devoluciones expiradas:', error);
        
        // Opcional: enviar alerta crítica a administradores
        // await enviarAlertaCritica('Job de devoluciones expiradas falló', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'America/Bogota'
    });
    
    console.log('📅 Job programado: Devoluciones expiradas (diario a las 2:00 AM)');
  }
  
  /**
   * Job para limpiar archivos temporales de devoluciones
   */
  static jobLimpiezaArchivos() {
    cron.schedule('0 3 * * 0', async () => {
      try {
        console.log('🧹 Ejecutando job: Limpieza de archivos temporales de devoluciones');
        
        const fs = require('fs').promises;
        const path = require('path');
        
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
        const tempDir = path.join(uploadDir, 'devoluciones', 'temp');
        
        // Limpiar archivos temporales más antiguos que 7 días
        try {
          const archivos = await fs.readdir(tempDir);
          let archivosEliminados = 0;
          
          const fechaLimite = new Date();
          fechaLimite.setDate(fechaLimite.getDate() - 7);
          
          for (const archivo of archivos) {
            const rutaArchivo = path.join(tempDir, archivo);
            const stats = await fs.stat(rutaArchivo);
            
            if (stats.mtime < fechaLimite) {
              await fs.unlink(rutaArchivo);
              archivosEliminados++;
            }
          }
          
          console.log(`🗑️ Limpieza completada: ${archivosEliminados} archivos temporales eliminados`);
          
        } catch (dirError) {
          console.log('📁 Directorio temporal no existe o está vacío');
        }
        
      } catch (error) {
        console.error('❌ Error en job de limpieza de archivos:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'America/Bogota'
    });
    
    console.log('📅 Job programado: Limpieza de archivos (semanal domingos a las 3:00 AM)');
  }
  
  /**
   * Ejecutar manualmente el job de devoluciones expiradas
   */
  static async ejecutarManualDevolucionesExpiradas() {
    try {
      console.log('🔄 Ejecutando manualmente: Procesamiento de devoluciones expiradas');
      
      const resultado = await devolucionService.procesarDevolucionesExpiradas();
      
      console.log(`✅ Ejecución manual completada: ${resultado.procesadas} devoluciones procesadas`);
      
      return resultado;
      
    } catch (error) {
      console.error('❌ Error en ejecución manual:', error);
      throw error;
    }
  }
}

module.exports = DevolucionCronJobs;