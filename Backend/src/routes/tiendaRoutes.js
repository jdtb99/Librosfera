// src/routes/tiendaRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  // Controladores públicos
  obtenerTiendasPublicas,
  buscarTiendasCercanas,
  buscarTiendasPorCiudad,
  verificarDisponibilidadLibro,
  obtenerDetalleTienda,
  verificarCodigoRecogida,
  
  // Controladores administrativos
  crearTienda,
  listarTiendasAdmin,
  obtenerTiendaAdmin,
  actualizarTienda,
  cambiarEstadoTienda,
  obtenerInventarioTienda,
  obtenerRecogidasTienda,
  procesarRecogida,
  obtenerEstadisticasTiendas,
  agregarNotaTienda
} = require('../controllers/tiendaController');

const { protect, authorize } = require('../middleware/authMiddleware');

// ==========================================
// RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
// ==========================================

// Obtener tiendas activas (para clientes)
router.get('/', obtenerTiendasPublicas);

// Buscar tiendas cercanas por coordenadas
router.get('/cercanas', buscarTiendasCercanas);

// Buscar tiendas por ciudad
router.get('/ciudad/:ciudad', buscarTiendasPorCiudad);

// Verificar disponibilidad de libro en tiendas
router.get('/disponibilidad/:idLibro', verificarDisponibilidadLibro);

// Verificar código de recogida (para QR)
router.get('/recogida/:codigo', verificarCodigoRecogida);

// Obtener detalle de tienda específica (última ruta pública con parámetro)
router.get('/:id', obtenerDetalleTienda);

// ==========================================
// RUTAS ADMINISTRATIVAS (CON AUTENTICACIÓN)
// ==========================================

// Todas las rutas admin requieren autenticación
router.use('/admin', protect, authorize('administrador', 'root'));

// Estadísticas generales (antes de las rutas con parámetros)
router.get('/admin/estadisticas', obtenerEstadisticasTiendas);

// Listar todas las tiendas (admin)
router.get('/admin/todas', listarTiendasAdmin);

// Crear nueva tienda
router.post('/admin', crearTienda);

// Procesar recogida específica
router.patch('/admin/recogidas/:idRecogida', procesarRecogida);

// Rutas específicas de una tienda (con ID)
// Obtener tienda por ID (admin - completa)
router.get('/admin/:id', obtenerTiendaAdmin);

// Actualizar tienda
router.put('/admin/:id', actualizarTienda);

// Cambiar estado de tienda
router.patch('/admin/:id/estado', cambiarEstadoTienda);

// Obtener inventario de tienda
router.get('/admin/:id/inventario', obtenerInventarioTienda);

// Obtener recogidas de tienda
router.get('/admin/:id/recogidas', obtenerRecogidasTienda);

// Agregar nota interna a tienda
router.post('/admin/:id/notas', agregarNotaTienda);

// ==========================================
// RUTAS ESPECIALES PARA INTEGRACIÓN
// ==========================================

// Buscar tiendas con stock específico (para sistema interno)
router.get('/admin/stock/:idLibro', protect, authorize('administrador', 'root'), async (req, res, next) => {
  try {
    const { idLibro } = req.params;
    const { cantidad = 1, incluir_sin_stock = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(idLibro)) {
      return res.status(400).json({
        status: 'error',
        message: 'ID de libro inválido'
      });
    }

    const tiendaService = require('../../Database/services/tiendaService');
    const tiendasConStock = await tiendaService.verificarDisponibilidadEnTiendas(
      idLibro,
      parseInt(cantidad)
    );

    // Si se requiere incluir tiendas sin stock para transferencias
    let todasLasTiendas = tiendasConStock;
    if (incluir_sin_stock === 'true') {
      const TiendaFisica = require('../../Database/models/tiendaFisicaModel');
      const tiendasActivas = await TiendaFisica.find({ estado: 'activa' });
      
      // Combinar con tiendas sin stock
      const idsConStock = tiendasConStock.map(t => t.tienda._id.toString());
      const tiendasSinStock = tiendasActivas
        .filter(tienda => !idsConStock.includes(tienda._id.toString()))
        .map(tienda => ({
          tienda,
          stock_disponible: 0,
          puede_recoger: tienda.servicios?.recogida_productos || false,
          esta_abierta: tiendaService._evaluarHorario ? tiendaService._evaluarHorario(tienda.horarios) : false
        }));
      
      todasLasTiendas = [...tiendasConStock, ...tiendasSinStock];
    }

    res.status(200).json({
      status: 'success',
      libro_id: idLibro,
      cantidad_solicitada: parseInt(cantidad),
      tiendas_con_stock: tiendasConStock.length,
      total_tiendas: todasLasTiendas.length,
      data: todasLasTiendas
    });
  } catch (error) {
    console.error('Error buscando tiendas con stock:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al buscar tiendas con stock'
    });
  }
});

// Transferir stock entre tiendas
router.post('/admin/transferir-stock', protect, authorize('administrador', 'root'), async (req, res, next) => {
  try {
    const {
      id_libro,
      tienda_origen,
      tienda_destino,
      cantidad,
      motivo = 'Transferencia administrativa'
    } = req.body;

    // Validaciones
    if (!mongoose.Types.ObjectId.isValid(id_libro) ||
        !mongoose.Types.ObjectId.isValid(tienda_origen) ||
        !mongoose.Types.ObjectId.isValid(tienda_destino)) {
      return res.status(400).json({
        status: 'error',
        message: 'IDs inválidos proporcionados'
      });
    }

    if (!cantidad || cantidad < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'La cantidad debe ser mayor a 0'
      });
    }

    if (tienda_origen === tienda_destino) {
      return res.status(400).json({
        status: 'error',
        message: 'La tienda origen y destino no pueden ser la misma'
      });
    }

    const Inventario = require('../../Database/models/inventarioModel');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verificar stock en tienda origen
      const inventarioOrigen = await Inventario.findOne({
        id_libro,
        id_tienda: tienda_origen
      }).session(session);

      if (!inventarioOrigen || inventarioOrigen.stock_disponible < cantidad) {
        throw new Error('Stock insuficiente en tienda origen');
      }

      // Registrar salida en tienda origen
      await inventarioOrigen.registrarSalida(
        cantidad,
        'transferencia',
        req.user._id,
        null,
        `Transferencia a otra tienda: ${motivo}`
      );

      // Buscar o crear inventario en tienda destino
      let inventarioDestino = await Inventario.findOne({
        id_libro,
        id_tienda: tienda_destino
      }).session(session);

      if (!inventarioDestino) {
        inventarioDestino = new Inventario({
          id_libro,
          id_tienda: tienda_destino,
          stock_total: 0,
          stock_disponible: 0,
          stock_reservado: 0
        });
      }

      // Registrar entrada en tienda destino
      await inventarioDestino.registrarEntrada(
        cantidad,
        'transferencia',
        req.user._id,
        `Transferencia desde otra tienda: ${motivo}`
      );

      await session.commitTransaction();

      // Log de actividad
      await req.logActivity('inventario', 'transferir_stock', {
        entidad_afectada: {
          tipo: 'libro',
          id: id_libro
        },
        detalles: {
          tienda_origen,
          tienda_destino,
          cantidad,
          motivo
        },
        nivel_importancia: 'medio'
      });

      res.status(200).json({
        status: 'success',
        message: 'Transferencia de stock completada exitosamente',
        data: {
          libro_id: id_libro,
          tienda_origen,
          tienda_destino,
          cantidad_transferida: cantidad,
          motivo
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error en transferencia de stock:', error);
    res.status(500).json({
      status: 'error',
      message: `Error en transferencia: ${error.message}`
    });
  }
});

module.exports = router;