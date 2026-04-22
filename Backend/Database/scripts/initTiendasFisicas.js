// Database/scripts/initTiendasFisicas.js
const mongoose = require('mongoose');
const TiendaFisica = require('../models/tiendaFisicaModel');
const Inventario = require('../models/inventarioModel');
const Libro = require('../models/libroModel');

/**
 * Script de inicialización del sistema de tiendas físicas
 * Crea tiendas de ejemplo y configura inventario inicial
 */

const tiendasIniciales = [
  {
    nombre: 'Librería Central Bogotá',
    codigo: 'BOG001',
    direccion: {
      tipo: 'tienda',
      direccion_completa: 'Carrera 7 # 32-16',
      ciudad: 'Bogotá',
      departamento: 'Cundinamarca',
      codigo_postal: '110311',
      pais: 'Colombia',
      telefono_contacto: '+57 1 2345678',
      referencia: 'Frente al parque Nacional, edificio azul',
      es_direccion_comercial: true,
      horario_atencion: 'Lunes a Sábado 8:00 - 19:00, Domingos 10:00 - 17:00',
      instrucciones_acceso: 'Entrada principal por la Carrera 7',
      activa: true,
      predeterminada: true
    },
    coordenadas: {
      latitud: 4.6351,
      longitud: -74.0703
    },
    telefono_principal: '+57 1 2345678',
    email: 'bogota@libreria.com',
    responsable: {
      nombre: 'María González',
      telefono: '+57 300 1234567',
      email: 'maria.gonzalez@libreria.com'
    },
    fecha_apertura: new Date('2020-01-15'),
    descripcion: 'Nuestra tienda principal en el centro de Bogotá, con la mayor variedad de libros y eventos culturales regulares.',
    caracteristicas_especiales: ['parking', 'wifi_gratuito', 'zona_lectura', 'eventos', 'acceso_discapacitados'],
    servicios: {
      venta_presencial: true,
      recogida_productos: true,
      devoluciones: true,
      eventos: true,
      consulta_libreria: true,
      transferencias_tiendas: true
    },
    capacidad: {
      max_recogidas_dia: 100,
      max_transferencias_dia: 30,
      espacio_almacen_m2: 200,
      capacidad_maxima_libros: 8000
    },
    zona_cobertura: {
      radio_km: 25,
      ciudades_cobertura: ['Bogotá'],
      departamentos_cobertura: ['Cundinamarca']
    }
  },
  {
    nombre: 'Librería Norte Medellín',
    codigo: 'MED001',
    direccion: {
      tipo: 'tienda',
      direccion_completa: 'Carrera 65 # 45-23',
      ciudad: 'Medellín',
      departamento: 'Antioquia',
      codigo_postal: '050010',
      pais: 'Colombia',
      telefono_contacto: '+57 4 3456789',
      referencia: 'Centro Comercial Oviedo, local 201',
      es_direccion_comercial: true,
      horario_atencion: 'Lunes a Sábado 9:00 - 20:00, Domingos 11:00 - 18:00',
      instrucciones_acceso: 'Segundo piso del centro comercial',
      activa: true
    },
    coordenadas: {
      latitud: 6.2476,
      longitud: -75.5658
    },
    telefono_principal: '+57 4 3456789',
    email: 'medellin@libreria.com',
    responsable: {
      nombre: 'Carlos Ramírez',
      telefono: '+57 301 2345678',
      email: 'carlos.ramirez@libreria.com'
    },
    fecha_apertura: new Date('2021-03-10'),
    descripcion: 'Nuestra sucursal en Medellín, ubicada estratégicamente en el centro comercial más visitado de la zona norte.',
    caracteristicas_especiales: ['parking', 'wifi_gratuito', 'zona_lectura', 'cafe'],
    servicios: {
      venta_presencial: true,
      recogida_productos: true,
      devoluciones: true,
      eventos: false,
      consulta_libreria: true,
      transferencias_tiendas: true
    },
    capacidad: {
      max_recogidas_dia: 60,
      max_transferencias_dia: 20,
      espacio_almacen_m2: 120,
      capacidad_maxima_libros: 5000
    },
    zona_cobertura: {
      radio_km: 20,
      ciudades_cobertura: ['Medellín'],
      departamentos_cobertura: ['Antioquia']
    }
  },
  {
    nombre: 'Librería Caribe Cartagena',
    codigo: 'CTG001',
    direccion: {
      tipo: 'tienda',
      direccion_completa: 'Calle del Arsenal # 8B-65',
      ciudad: 'Cartagena',
      departamento: 'Bolívar',
      codigo_postal: '130001',
      pais: 'Colombia',
      telefono_contacto: '+57 5 4567890',
      referencia: 'Centro Histórico, cerca de la Torre del Reloj',
      es_direccion_comercial: true,
      horario_atencion: 'Lunes a Domingo 8:30 - 19:30',
      instrucciones_acceso: 'Casa colonial amarilla con balcón',
      activa: true
    },
    coordenadas: {
      latitud: 10.3932,
      longitud: -75.4832
    },
    telefono_principal: '+57 5 4567890',
    email: 'cartagena@libreria.com',
    responsable: {
      nombre: 'Ana Patricia Herrera',
      telefono: '+57 302 3456789',
      email: 'ana.herrera@libreria.com'
    },
    fecha_apertura: new Date('2022-01-20'),
    descripcion: 'Nuestra hermosa tienda en el centro histórico de Cartagena, combinando la magia colonial con la literatura moderna.',
    caracteristicas_especiales: ['wifi_gratuito', 'zona_lectura', 'eventos'],
    servicios: {
      venta_presencial: true,
      recogida_productos: true,
      devoluciones: true,
      eventos: true,
      consulta_libreria: true,
      transferencias_tiendas: true
    },
    capacidad: {
      max_recogidas_dia: 40,
      max_transferencias_dia: 15,
      espacio_almacen_m2: 80,
      capacidad_maxima_libros: 3500
    },
    zona_cobertura: {
      radio_km: 30,
      ciudades_cobertura: ['Cartagena'],
      departamentos_cobertura: ['Bolívar']
    }
  }
];

/**
 * Inicializar tiendas físicas en la base de datos
 */
async function inicializarTiendas() {
  try {
    console.log('🏪 Iniciando configuración de tiendas físicas...');
    
    // Verificar si ya existen tiendas
    const tiendasExistentes = await TiendaFisica.countDocuments();
    
    if (tiendasExistentes > 0) {
      console.log(`✅ Ya existen ${tiendasExistentes} tiendas en el sistema`);
      return {
        success: true,
        message: `Sistema ya inicializado con ${tiendasExistentes} tiendas`,
        tiendas_existentes: tiendasExistentes
      };
    }
    
    // Crear tiendas iniciales
    const tiendasCreadas = [];
    
    for (const datostienda of tiendasIniciales) {
      try {
        const nuevaTienda = new TiendaFisica(datostienda);
        await nuevaTienda.save();
        tiendasCreadas.push(nuevaTienda);
        
        console.log(`✅ Tienda creada: ${nuevaTienda.nombre} (${nuevaTienda.codigo})`);
        
        // Agregar nota inicial
        await nuevaTienda.agregarNota(
          'Tienda inicializada automáticamente por script de configuración',
          null,
          'operativa'
        );
        
      } catch (error) {
        console.error(`❌ Error creando tienda ${datostienda.nombre}:`, error.message);
      }
    }
    
    console.log(`🎉 ${tiendasCreadas.length} tiendas físicas creadas exitosamente`);
    
    return {
      success: true,
      message: `${tiendasCreadas.length} tiendas físicas inicializadas`,
      tiendas_creadas: tiendasCreadas.map(t => ({
        id: t._id,
        nombre: t.nombre,
        codigo: t.codigo,
        ciudad: t.direccion.ciudad
      }))
    };
    
  } catch (error) {
    console.error('❌ Error en inicialización de tiendas:', error);
    throw error;
  }
}

/**
 * Crear inventario inicial para las tiendas con libros existentes
 */
async function inicializarInventarioTiendas() {
  try {
    console.log('📦 Iniciando configuración de inventario por tiendas...');
    
    // Obtener todas las tiendas activas
    const tiendas = await TiendaFisica.find({ estado: 'activa' });
    
    if (tiendas.length === 0) {
      throw new Error('No hay tiendas activas para inicializar inventario');
    }
    
    // Obtener libros existentes
    const libros = await Libro.find({ activo: true }).limit(50); // Limitar para prueba
    
    if (libros.length === 0) {
      console.log('⚠️  No hay libros activos para crear inventario');
      return {
        success: true,
        message: 'No hay libros para crear inventario',
        inventarios_creados: 0
      };
    }
    
    let inventariosCreados = 0;
    
    for (const tienda of tiendas) {
      console.log(`📚 Creando inventario para tienda: ${tienda.nombre}`);
      
      // Crear inventario para una muestra de libros
      const librosParaTienda = libros.slice(0, Math.min(20, libros.length));
      
      for (const libro of librosParaTienda) {
        try {
          // Verificar si ya existe inventario para este libro en esta tienda
          const inventarioExistente = await Inventario.findOne({
            id_libro: libro._id,
            id_tienda: tienda._id
          });
          
          if (inventarioExistente) {
            continue; // Ya existe, saltar
          }
          
          // Generar stock aleatorio según el tipo de tienda
          let stockInicial;
          if (tienda.codigo.includes('BOG')) {
            stockInicial = Math.floor(Math.random() * 20) + 10; // 10-30 para Bogotá
          } else if (tienda.codigo.includes('MED')) {
            stockInicial = Math.floor(Math.random() * 15) + 8;  // 8-23 para Medellín
          } else {
            stockInicial = Math.floor(Math.random() * 10) + 5;  // 5-15 para otras
          }
          
          // Crear inventario
          const nuevoInventario = new Inventario({
            id_libro: libro._id,
            id_tienda: tienda._id,
            stock_total: stockInicial,
            stock_disponible: stockInicial,
            stock_reservado: 0,
            umbral_alerta: Math.max(3, Math.floor(stockInicial * 0.2))
          });
          
          // Registrar entrada inicial
          await nuevoInventario.registrarEntrada(
            stockInicial,
            'inventario_inicial',
            null,
            `Inventario inicial para tienda ${tienda.codigo}`
          );
          
          inventariosCreados++;
          
        } catch (error) {
          console.error(`❌ Error creando inventario para libro ${libro.titulo} en tienda ${tienda.nombre}:`, error.message);
        }
      }
      
      // Actualizar estadísticas de la tienda
      await tienda.actualizarEstadisticas();
    }
    
    console.log(`🎉 ${inventariosCreados} registros de inventario creados`);
    
    return {
      success: true,
      message: `${inventariosCreados} inventarios inicializados`,
      tiendas_procesadas: tiendas.length,
      inventarios_creados: inventariosCreados
    };
    
  } catch (error) {
    console.error('❌ Error en inicialización de inventario:', error);
    throw error;
  }
}

/**
 * Verificar la integridad del sistema de tiendas
 */
async function verificarSistemaTiendas() {
  try {
    console.log('🔍 Verificando integridad del sistema de tiendas...');
    
    const resultados = {
      tiendas: {},
      inventario: {},
      modelos: {},
      configuracion: {}
    };
    
    // Verificar tiendas
    const totalTiendas = await TiendaFisica.countDocuments();
    const tiendasActivas = await TiendaFisica.countDocuments({ estado: 'activa' });
    const tiendasConServicios = await TiendaFisica.countDocuments({ 
      'servicios.recogida_productos': true 
    });
    
    resultados.tiendas = {
      total: totalTiendas,
      activas: tiendasActivas,
      con_recogida: tiendasConServicios,
      estado: totalTiendas > 0 ? 'OK' : 'ERROR'
    };
    
    // Verificar inventario
    const totalInventarios = await Inventario.countDocuments();
    const inventariosActivos = await Inventario.countDocuments({ estado: 'disponible' });
    const inventariosConStock = await Inventario.countDocuments({ stock_total: { $gt: 0 } });
    
    resultados.inventario = {
      total_registros: totalInventarios,
      registros_activos: inventariosActivos,
      con_stock: inventariosConStock,
      estado: totalInventarios > 0 ? 'OK' : 'WARNING'
    };
    
    // Verificar modelos
    const modelosRequeridos = ['TiendaFisica', 'Inventario', 'RecogidaTienda', 'Carrito', 'CarritoItem'];
    const modelosDisponibles = {};
    
    for (const nombreModelo of modelosRequeridos) {
      try {
        const modelo = mongoose.model(nombreModelo);
        modelosDisponibles[nombreModelo] = !!modelo;
      } catch (error) {
        modelosDisponibles[nombreModelo] = false;
      }
    }
    
    resultados.modelos = {
      disponibles: modelosDisponibles,
      todos_disponibles: Object.values(modelosDisponibles).every(Boolean),
      estado: Object.values(modelosDisponibles).every(Boolean) ? 'OK' : 'ERROR'
    };
    
    // Verificar configuración
    const addressSchema = require('../models/schemas/addressSchema');
    const tiendaService = require('../services/tiendaService');
    
    resultados.configuracion = {
      address_schema: !!addressSchema,
      tienda_service: !!tiendaService,
      estado: (addressSchema && tiendaService) ? 'OK' : 'ERROR'
    };
    
    // Estado general
    const estadosComponentes = [
      resultados.tiendas.estado,
      resultados.inventario.estado,
      resultados.modelos.estado,
      resultados.configuracion.estado
    ];
    
    const estadoGeneral = estadosComponentes.every(e => e === 'OK') ? 'OK' : 
                         estadosComponentes.some(e => e === 'ERROR') ? 'ERROR' : 'WARNING';
    
    console.log('📊 Verificación completada');
    console.log(`Estado general: ${estadoGeneral}`);
    console.log(`Tiendas: ${resultados.tiendas.activas}/${resultados.tiendas.total} activas`);
    console.log(`Inventario: ${resultados.inventario.con_stock} registros con stock`);
    
    return {
      estado_general: estadoGeneral,
      ...resultados,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('❌ Error en verificación del sistema:', error);
    throw error;
  }
}

/**
 * Función principal de inicialización
 */
async function inicializarSistemaTiendas() {
  try {
    console.log('🚀 Iniciando configuración completa del sistema de tiendas físicas...\n');
    
    const resultados = {
      tiendas: null,
      inventario: null,
      verificacion: null
    };
    
    // 1. Inicializar tiendas
    resultados.tiendas = await inicializarTiendas();
    console.log('');
    
    // 2. Inicializar inventario
    resultados.inventario = await inicializarInventarioTiendas();
    console.log('');
    
    // 3. Verificar sistema
    resultados.verificacion = await verificarSistemaTiendas();
    console.log('');
    
    console.log('🎉 ¡Sistema de tiendas físicas inicializado completamente!');
    console.log('===============================================');
    console.log(`Estado final: ${resultados.verificacion.estado_general}`);
    console.log(`Tiendas creadas/existentes: ${resultados.tiendas.tiendas_creadas?.length || resultados.tiendas.tiendas_existentes || 0}`);
    console.log(`Inventarios creados: ${resultados.inventario.inventarios_creados}`);
    console.log('===============================================\n');
    
    return resultados;
    
  } catch (error) {
    console.error('❌ Error en inicialización del sistema de tiendas:', error);
    throw error;
  }
}

// Exportar funciones
module.exports = {
  inicializarTiendas,
  inicializarInventarioTiendas,
  verificarSistemaTiendas,
  inicializarSistemaTiendas,
  tiendasIniciales
};

// Si se ejecuta directamente
if (require.main === module) {
  const { connectDB } = require('../config/dbConfig');
  
  (async () => {
    try {
      await connectDB();
      await inicializarSistemaTiendas();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}