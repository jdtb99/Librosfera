// Database/models/index.js (ACTUALIZADO)
/**
 * Archivo índice para exportar todos los modelos
 * Permite importar múltiples modelos desde un solo archivo
 * ACTUALIZADO: Incluye modelos de tiendas físicas y sistema mejorado
 */

const userModels = require('./userModel');
const Libro = require('./libroModel');
const Inventario = require('./inventarioModel');
const TiendaFisica = require('./tiendaFisicaModel');
const RecogidaTienda = require('./recogidaTiendaModel');
const Transaccion = require('./transaccionModel');
const Busqueda = require('./busquedaModel');
const Carrito = require('./carritoModel');
const CarritoItem = require('./carritoItemsModel');
const Devolucion = require('./devolucionModel');
const Recomendacion = require('./recomendacionModel');
const Ejemplar = require('./ejemplarModel');
const Reserva = require('./reservaModel');
const Envio = require('./envioModel');
const Noticia = require('./noticiaModel');
const Mensaje = require('./mensajeModel');

/**
 * Exportación de todos los modelos organizados por categoría
 */
module.exports = {
  // ==========================================
  // MODELOS DE USUARIO
  // ==========================================
  Usuario: userModels.Usuario,
  Root: userModels.Root,
  Administrador: userModels.Administrador,
  Cliente: userModels.Cliente,
  
  // ==========================================
  // MODELOS DE PRODUCTOS Y CATÁLOGO
  // ==========================================
  Libro,
  Ejemplar,
  Busqueda,
  Recomendacion,
  
  // ==========================================
  // MODELOS DE INVENTARIO Y TIENDAS FÍSICAS
  // ==========================================
  Inventario,
  TiendaFisica,
  RecogidaTienda,
  
  // ==========================================
  // MODELOS DE CARRITO Y COMPRAS
  // ==========================================
  Carrito,
  CarritoItem,
  Transaccion,
  Reserva,
  
  // ==========================================
  // MODELOS DE ENVÍO Y LOGÍSTICA
  // ==========================================
  Envio,
  
  // ==========================================
  // MODELOS DE DEVOLUCIONES
  // ==========================================
  Devolucion,
  
  // ==========================================
  // MODELOS DE COMUNICACIÓN
  // ==========================================
  Noticia,
  Mensaje,

  // ==========================================
  // SCHEMAS REUTILIZABLES
  // ==========================================
  addressSchema: require('./schemas/addressSchema'),
  bookPriceSchema: require('./schemas/bookPriceSchema'),

  // ==========================================
  // MÉTODOS DE UTILIDAD
  // ==========================================
  
  /**
   * Verificar que todos los modelos estén disponibles
   * @returns {Object} Estado de los modelos
   */
  verificarModelos() {
    const modelos = [
      'Usuario', 'Root', 'Administrador', 'Cliente',
      'Libro', 'Ejemplar', 'Busqueda', 'Recomendacion',
      'Inventario', 'TiendaFisica', 'RecogidaTienda',
      'Carrito', 'CarritoItem', 'Transaccion', 'Reserva',
      'Envio', 'Devolucion', 'Noticia', 'Mensaje'
    ];

    const estadoModelos = {};
    let todosDisponibles = true;

    modelos.forEach(nombreModelo => {
      const disponible = !!this[nombreModelo];
      estadoModelos[nombreModelo] = disponible;
      if (!disponible) todosDisponibles = false;
    });

    return {
      todos_disponibles: todosDisponibles,
      total_modelos: modelos.length,
      modelos_cargados: Object.values(estadoModelos).filter(Boolean).length,
      detalle: estadoModelos
    };
  },

  /**
   * Obtener información del sistema de tiendas
   * @returns {Object} Información del sistema
   */
  obtenerInfoSistemaTiendas() {
    return {
      tiendas_fisicas_habilitadas: !!this.TiendaFisica,
      recogidas_habilitadas: !!this.RecogidaTienda,
      inventario_distribuido: !!this.Inventario,
      sistema_reservas: true,
      version: '2.0.0',
      caracteristicas: [
        'Gestión de tiendas físicas',
        'Inventario distribuido por tienda',
        'Sistema de reservas automáticas en carrito',
        'Recogidas en tienda con QR',
        'Transferencias entre tiendas',
        'Devoluciones en tienda física',
        'Seguimiento geográfico de tiendas'
      ]
    };
  },

  /**
   * Obtener modelos relacionados con tiendas
   * @returns {Object} Modelos de tiendas
   */
  obtenerModelosTiendas() {
    return {
      TiendaFisica: this.TiendaFisica,
      RecogidaTienda: this.RecogidaTienda,
      Inventario: this.Inventario,
      schemas: {
        addressSchema: this.addressSchema
      }
    };
  },

  /**
   * Obtener modelos relacionados con carrito y ventas
   * @returns {Object} Modelos de carrito y ventas
   */
  obtenerModelosVentas() {
    return {
      Carrito: this.Carrito,
      CarritoItem: this.CarritoItem,
      Transaccion: this.Transaccion,
      Envio: this.Envio,
      Devolucion: this.Devolucion,
      Reserva: this.Reserva
    };
  },

  /**
   * Obtener información de compatibilidad con addressSchema
   * @returns {Object} Información de compatibilidad
   */
  obtenerInfoAddressSchema() {
    const modelosQueUsanAddress = [
      'TiendaFisica',
      'Cliente', 
      'Administrador',
      'Envio',
      'RecogidaTienda'
    ];

    return {
      schema_disponible: !!this.addressSchema,
      modelos_compatibles: modelosQueUsanAddress,
      campos_principales: [
        'direccion_completa',
        'ciudad',
        'departamento',
        'codigo_postal',
        'pais',
        'telefono_contacto',
        'referencia',
        'predeterminada',
        'activa'
      ],
      metodos_virtuales: [
        'direccion_formateada',
        'esta_completa',
        'esValidaParaEnvio'
      ]
    };
  }
};

// ==========================================
// VALIDACIONES DE INICIALIZACIÓN
// ==========================================

// Verificar que los modelos críticos estén disponibles
const modelosCriticos = ['Usuario', 'Cliente', 'Libro', 'Carrito', 'TiendaFisica'];
const modelosFaltantes = modelosCriticos.filter(modelo => !module.exports[modelo]);

if (modelosFaltantes.length > 0) {
  console.error('⚠️  ADVERTENCIA: Modelos críticos faltantes:', modelosFaltantes);
} else {
  console.log('✅ Todos los modelos críticos cargados correctamente');
}

// Verificar integridad del sistema de tiendas
const sistemaCompleto = !!(
  module.exports.TiendaFisica && 
  module.exports.RecogidaTienda && 
  module.exports.Inventario &&
  module.exports.addressSchema
);

if (sistemaCompleto) {
  console.log('✅ Sistema de tiendas físicas completamente cargado');
} else {
  console.warn('⚠️  Sistema de tiendas físicas incompleto');
}