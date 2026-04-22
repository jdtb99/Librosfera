// Database/scripts/crearInventarioLibrosExistentes.js (CORREGIDO)
const mongoose = require('mongoose');
const Libro = require('../models/libroModel');
const Inventario = require('../models/inventarioModel');
const TiendaFisica = require('../models/tiendaFisicaModel');
require('dotenv').config();
/**
 * Script CORREGIDO para crear inventario de libros existentes en todas las tiendas
 * Soluciona el problema de libros sin stock en tiendas
 */

/**
 * Crear inventario para todos los libros existentes
 */
async function crearInventarioLibrosExistentes() {
  try {
    console.log('📚 Iniciando creación de inventario para libros existentes...\n');
    
    // 1. Obtener todas las tiendas activas
    const tiendas = await TiendaFisica.find({ estado: 'activa' });
    
    if (tiendas.length === 0) {
      throw new Error('❌ No hay tiendas activas. Por favor crea al menos una tienda primero.');
    }
    
    console.log(`🏪 Tiendas encontradas: ${tiendas.length}`);
    tiendas.forEach(tienda => {
      console.log(`   - ${tienda.nombre} (${tienda.codigo}) - ${tienda.direccion.ciudad}`);
    });
    console.log('');
    
    // 2. Obtener todos los libros activos
    const libros = await Libro.find({ activo: true });
    
    if (libros.length === 0) {
      throw new Error('❌ No hay libros activos en el sistema.');
    }
    
    console.log(`📖 Libros encontrados: ${libros.length}`);
    console.log('');
    
    // 3. Verificar cuántos ya tienen inventario
    const inventariosExistentes = await Inventario.countDocuments();
    console.log(`📦 Inventarios existentes: ${inventariosExistentes}`);
    
    // 4. Crear inventario para cada libro en cada tienda
    let inventariosCreados = 0;
    let inventariosExistentesContador = 0;
    let errores = 0;
    
    console.log('🔄 Procesando inventarios...\n');
    
    for (const libro of libros) {
      console.log(`📚 Procesando: "${libro.titulo}" por ${libro.autor_nombre_completo}`);
      
      for (const tienda of tiendas) {
        try {
          // Verificar si ya existe inventario para este libro en esta tienda
          const inventarioExistente = await Inventario.findOne({
            id_libro: libro._id,
            id_tienda: tienda._id
          });
          
          if (inventarioExistente) {
            console.log(`   ✓ Ya existe en ${tienda.codigo} (Stock: ${inventarioExistente.stock_total})`);
            inventariosExistentesContador++;
            continue;
          }
          
          // Determinar stock inicial basado en la tienda y características del libro
          let stockInicial = calcularStockInicial(tienda, libro);
          
          // Crear nuevo inventario
          const nuevoInventario = new Inventario({
            id_libro: libro._id,
            id_tienda: tienda._id,
            stock_total: stockInicial,
            stock_disponible: stockInicial,
            stock_reservado: 0,
            umbral_alerta: Math.max(2, Math.floor(stockInicial * 0.25))
          });
          
          // Registrar entrada inicial
          await nuevoInventario.registrarEntrada(
            stockInicial,
            'inventario_inicial',
            null,
            `Inventario inicial creado automáticamente para libro existente en tienda ${tienda.codigo}`
          );
          
          console.log(`   ✅ Creado en ${tienda.codigo} con stock: ${stockInicial}`);
          inventariosCreados++;
          
        } catch (error) {
          console.error(`   ❌ Error en ${tienda.codigo}: ${error.message}`);
          errores++;
        }
      }
      console.log('');
    }
    
    // 5. Actualizar estadísticas de las tiendas
    console.log('📊 Actualizando estadísticas de tiendas...');
    for (const tienda of tiendas) {
      try {
        await tienda.actualizarEstadisticas();
        console.log(`   ✅ ${tienda.nombre} actualizada`);
      } catch (error) {
        console.error(`   ❌ Error actualizando ${tienda.nombre}:`, error.message);
      }
    }
    
    // 6. Mostrar resumen
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN DE OPERACIÓN');
    console.log('='.repeat(60));
    console.log(`📚 Libros procesados: ${libros.length}`);
    console.log(`🏪 Tiendas procesadas: ${tiendas.length}`);
    console.log(`✅ Inventarios creados: ${inventariosCreados}`);
    console.log(`♻️  Inventarios ya existentes: ${inventariosExistentesContador}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📦 Total inventarios en sistema: ${inventariosExistentes + inventariosCreados}`);
    console.log('='.repeat(60));
    
    if (inventariosCreados > 0) {
      console.log('\n🎉 ¡Inventario creado exitosamente!');
      console.log('Ahora los libros deberían estar disponibles para agregar al carrito.');
    } else if (inventariosExistentesContador > 0) {
      console.log('\n✅ Todos los libros ya tenían inventario asignado.');
    }
    
    return {
      success: true,
      libros_procesados: libros.length,
      tiendas_procesadas: tiendas.length,
      inventarios_creados: inventariosCreados,
      inventarios_existentes: inventariosExistentesContador,
      errores: errores,
      total_inventarios: inventariosExistentes + inventariosCreados
    };
    
  } catch (error) {
    console.error('❌ Error en creación de inventario:', error);
    throw error;
  }
}

/**
 * Calcular stock inicial basado en características de la tienda y el libro
 */
function calcularStockInicial(tienda, libro) {
  let stockBase = 5; // Stock mínimo
  
  // Factor por tamaño de tienda (basado en capacidad)
  const capacidadTienda = tienda.capacidad?.capacidad_maxima_libros || 3000;
  if (capacidadTienda > 6000) {
    stockBase = 15; // Tienda grande
  } else if (capacidadTienda > 4000) {
    stockBase = 10; // Tienda mediana
  } else {
    stockBase = 7;  // Tienda pequeña
  }
  
  // Factor por popularidad del libro (basado en calificaciones)
  const calificacion = libro.calificaciones?.promedio || 0;
  const cantidadCalificaciones = libro.calificaciones?.cantidad || 0;
  
  if (calificacion >= 4.5 && cantidadCalificaciones > 0) {
    stockBase += 5; // Libro muy popular
  } else if (calificacion >= 4.0 && cantidadCalificaciones > 0) {
    stockBase += 3; // Libro popular
  }
  
  // Factor por género/categoría
  const genero = libro.genero?.toLowerCase() || '';
  if (['ficción', 'fantasía', 'romance', 'misterio'].includes(genero)) {
    stockBase += 2; // Géneros populares
  }
  
  // Factor por precio (libros más baratos = más stock)
  const precio = libro.precio || libro.precio_info?.precio_base || 0;
  if (precio < 20000) {
    stockBase += 3; // Libros económicos
  } else if (precio > 50000) {
    stockBase -= 2; // Libros costosos
  }
  
  // Agregar variabilidad aleatoria (±30%)
  const variacion = Math.random() * 0.6 - 0.3; // -30% a +30%
  stockBase = Math.round(stockBase * (1 + variacion));
  
  // Asegurar mínimos y máximos
  return Math.max(3, Math.min(25, stockBase));
}

/**
 * Verificar inventarios existentes (CORREGIDO)
 */
async function verificarInventariosExistentes() {
  try {
    console.log('🔍 Verificando estado actual del inventario...\n');
    
    const tiendas = await TiendaFisica.find({ estado: 'activa' });
    const libros = await Libro.find({ activo: true });
    
    // CORREGIDO: Asegurar que se obtienen los campos necesarios
    const inventarios = await Inventario.find()
      .populate('id_tienda', 'nombre codigo')
      .populate('id_libro', 'titulo');
    
    console.log(`🏪 Tiendas activas: ${tiendas.length}`);
    console.log(`📚 Libros activos: ${libros.length}`);
    console.log(`📦 Inventarios existentes: ${inventarios.length}`);
    console.log(`🎯 Inventarios esperados: ${tiendas.length * libros.length}`);
    
    // CORREGIDO: Verificar que id_tienda existe antes de usar toString()
    const inventariosPorTienda = {};
    for (const inventario of inventarios) {
      if (inventario.id_tienda && inventario.id_tienda._id) {
        const tiendaId = inventario.id_tienda._id.toString();
        if (!inventariosPorTienda[tiendaId]) {
          inventariosPorTienda[tiendaId] = {
            count: 0,
            tienda: inventario.id_tienda
          };
        }
        inventariosPorTienda[tiendaId].count++;
      } else {
        console.warn(`⚠️  Inventario con id_tienda inválido: ${inventario._id}`);
      }
    }
    
    console.log('\n📊 Inventarios por tienda:');
    for (const tienda of tiendas) {
      const tiendaData = inventariosPorTienda[tienda._id.toString()];
      const count = tiendaData ? tiendaData.count : 0;
      const porcentaje = libros.length > 0 ? Math.round((count / libros.length) * 100) : 0;
      console.log(`   ${tienda.nombre} (${tienda.codigo}): ${count}/${libros.length} (${porcentaje}%)`);
    }
    
    // CORREGIDO: Verificar libros sin inventario
    const librosConInventario = new Set();
    for (const inventario of inventarios) {
      if (inventario.id_libro && inventario.id_libro._id) {
        librosConInventario.add(inventario.id_libro._id.toString());
      }
    }
    
    const librosSinInventario = libros.filter(libro => !librosConInventario.has(libro._id.toString()));
    
    if (librosSinInventario.length > 0) {
      console.log(`\n⚠️  Libros sin inventario: ${librosSinInventario.length}`);
      librosSinInventario.slice(0, 5).forEach(libro => {
        console.log(`   - ${libro.titulo}`);
      });
      if (librosSinInventario.length > 5) {
        console.log(`   ... y ${librosSinInventario.length - 5} más`);
      }
    } else {
      console.log('\n✅ Todos los libros tienen inventario asignado');
    }
    
    // NUEVO: Verificar inventarios huérfanos (sin tienda o libro válido)
    const inventariosHuerfanos = inventarios.filter(inv => 
      !inv.id_tienda || !inv.id_libro
    );
    
    if (inventariosHuerfanos.length > 0) {
      console.log(`\n⚠️  Inventarios huérfanos (sin tienda/libro válido): ${inventariosHuerfanos.length}`);
      console.log('Estos inventarios deberían ser limpiados.');
    }
    
    return {
      tiendas_count: tiendas.length,
      libros_count: libros.length,
      inventarios_count: inventarios.length,
      inventarios_esperados: tiendas.length * libros.length,
      libros_sin_inventario: librosSinInventario.length,
      inventarios_huerfanos: inventariosHuerfanos.length,
      cobertura_completa: librosSinInventario.length === 0
    };
    
  } catch (error) {
    console.error('❌ Error verificando inventarios:', error);
    throw error;
  }
}

/**
 * Limpiar inventarios huérfanos
 */
async function limpiarInventariosHuerfanos() {
  try {
    console.log('🧹 Limpiando inventarios huérfanos...');
    
    // Buscar inventarios sin tienda o libro válido
    const inventariosHuerfanos = await Inventario.find({
      $or: [
        { id_tienda: null },
        { id_libro: null },
        { id_tienda: { $exists: false } },
        { id_libro: { $exists: false } }
      ]
    });
    
    console.log(`📦 Inventarios huérfanos encontrados: ${inventariosHuerfanos.length}`);
    
    if (inventariosHuerfanos.length > 0) {
      const resultado = await Inventario.deleteMany({
        $or: [
          { id_tienda: null },
          { id_libro: null },
          { id_tienda: { $exists: false } },
          { id_libro: { $exists: false } }
        ]
      });
      
      console.log(`✅ ${resultado.deletedCount} inventarios huérfanos eliminados`);
    } else {
      console.log('✅ No se encontraron inventarios huérfanos');
    }
    
    return {
      success: true,
      inventarios_eliminados: inventariosHuerfanos.length
    };
    
  } catch (error) {
    console.error('❌ Error limpiando inventarios huérfanos:', error);
    throw error;
  }
}

/**
 * Limpiar TODOS los inventarios (USAR CON CUIDADO)
 */
async function limpiarTodosLosInventarios() {
  try {
    console.log('⚠️  ADVERTENCIA: Esta operación eliminará TODOS los inventarios');
    console.log('🔄 Eliminando inventarios...');
    
    const resultado = await Inventario.deleteMany({});
    
    console.log(`✅ ${resultado.deletedCount} inventarios eliminados`);
    
    return {
      success: true,
      inventarios_eliminados: resultado.deletedCount
    };
    
  } catch (error) {
    console.error('❌ Error limpiando inventarios:', error);
    throw error;
  }
}

/**
 * Función principal con opciones
 */
async function main() {
  const args = process.argv.slice(2);
  const comando = args[0] || 'crear';
  
  try {
    switch (comando) {
      case 'verificar':
        await verificarInventariosExistentes();
        break;
        
      case 'crear':
        await crearInventarioLibrosExistentes();
        break;
        
      case 'limpiar-huerfanos':
        await limpiarInventariosHuerfanos();
        break;
        
      case 'limpiar-todos':
        console.log('⚠️  ¿Estás seguro de que quieres eliminar TODOS los inventarios?');
        console.log('Esta operación NO se puede deshacer.');
        console.log('Presiona Ctrl+C para cancelar o Enter para continuar...');
        
        // Esperar confirmación en producción
        if (process.env.NODE_ENV === 'production') {
          await new Promise(resolve => process.stdin.once('data', resolve));
        }
        
        await limpiarTodosLosInventarios();
        break;
        
      default:
        console.log('Comandos disponibles:');
        console.log('  node crearInventarioLibrosExistentes.js crear              - Crear inventario para libros existentes');
        console.log('  node crearInventarioLibrosExistentes.js verificar          - Verificar estado actual');
        console.log('  node crearInventarioLibrosExistentes.js limpiar-huerfanos  - Limpiar inventarios huérfanos');
        console.log('  node crearInventarioLibrosExistentes.js limpiar-todos      - Limpiar TODOS los inventarios');
        process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Exportar funciones para uso programático
module.exports = {
  crearInventarioLibrosExistentes,
  verificarInventariosExistentes,
  limpiarInventariosHuerfanos,
  limpiarTodosLosInventarios,
  calcularStockInicial
};

// Si se ejecuta directamente
if (require.main === module) {
  const { connectDB } = require('../config/dbConfig');
  
  (async () => {
    try {
      await connectDB();
      await main();
    } catch (error) {
      console.error('Error conectando a la base de datos:', error);
      process.exit(1);
    }
  })();
}