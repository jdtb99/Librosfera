// src/controllers/direccionController.js
const { userService } = require('../../Database/services');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');

/**
 * @desc    Obtener todas las direcciones del usuario
 * @route   GET /api/v1/direcciones
 * @access  Private
 */
const obtenerDirecciones = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para ver sus direcciones', 401));
    }

    const usuario = await userService.obtenerUsuarioCompleto(req.user._id);
    
    if (!usuario) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    // Obtener direcciones y ordenar por predeterminada primero
    const direcciones = usuario.direcciones || [];
    direcciones.sort((a, b) => {
      if (a.predeterminada && !b.predeterminada) return -1;
      if (!a.predeterminada && b.predeterminada) return 1;
      return 0;
    });

    return res.status(200).json({
      status: 'success',
      resultados: direcciones.length,
      data: direcciones
    });
  } catch (error) {
    console.error('Error obteniendo direcciones:', error);
    return next(new AppError(`Error al obtener direcciones: ${error.message}`, 500));
  }
});

/**
 * @desc    Agregar nueva dirección
 * @route   POST /api/v1/direcciones
 * @access  Private
 */
const agregarDireccion = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para agregar direcciones', 401));
    }

    const {
      tipo,
      direccion_completa,
      ciudad,
      departamento,
      codigo_postal,
      pais = 'Colombia',
      telefono_contacto,
      referencia,
      predeterminada = false
    } = req.body;

    // Validaciones básicas
    if (!direccion_completa || !ciudad || !departamento) {
      return next(new AppError('La dirección completa, ciudad y departamento son obligatorios', 400));
    }

    const usuario = await userService.obtenerUsuarioCompleto(req.user._id);
    
    if (!usuario) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    // Si no tiene direcciones, crear el array
    if (!usuario.direcciones) {
      usuario.direcciones = [];
    }

    // Si es la primera dirección o se marca como predeterminada, desmarcar otras
    if (usuario.direcciones.length === 0 || predeterminada) {
      usuario.direcciones.forEach(dir => {
        dir.predeterminada = false;
      });
    }

    // Crear nueva dirección
    const nuevaDireccion = {
      tipo: tipo || 'casa',
      direccion_completa,
      ciudad,
      departamento,
      codigo_postal,
      pais,
      telefono_contacto,
      referencia,
      predeterminada: usuario.direcciones.length === 0 || predeterminada,
      fecha_creacion: new Date()
    };

    // Agregar la nueva dirección
    usuario.direcciones.push(nuevaDireccion);

    // Guardar usuario actualizado
    await userService.actualizarUsuario(
      req.user._id,
      undefined, // userData
      { direcciones: usuario.direcciones }, // profileData
      undefined // tipoData
    );

    // Obtener la dirección recién creada (última en el array)
    const direccionCreada = usuario.direcciones[usuario.direcciones.length - 1];

    await req.logActivity('usuario', 'agregar_direccion', {
      detalles: {
        ciudad: direccionCreada.ciudad,
        departamento: direccionCreada.departamento,
        predeterminada: direccionCreada.predeterminada
      }
    });

    return res.status(201).json({
      status: 'success',
      message: 'Dirección agregada exitosamente',
      data: direccionCreada
    });
  } catch (error) {
    console.error('Error agregando dirección:', error);
    return next(new AppError(`Error al agregar dirección: ${error.message}`, 400));
  }
});

/**
 * @desc    Actualizar una dirección específica
 * @route   PUT /api/v1/direcciones/:id
 * @access  Private
 */
const actualizarDireccion = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para actualizar direcciones', 401));
    }

    const { id } = req.params;
    const datosActualizacion = req.body;

    const usuario = await userService.obtenerUsuarioCompleto(req.user._id);
    
    if (!usuario || !usuario.direcciones) {
      return next(new AppError('Usuario no encontrado o sin direcciones', 404));
    }

    // Buscar la dirección por ID
    const direccionIndex = usuario.direcciones.findIndex(
      dir => dir._id && dir._id.toString() === id
    );

    if (direccionIndex === -1) {
      return next(new AppError('Dirección no encontrada', 404));
    }

    // Si se marca como predeterminada, desmarcar las demás
    if (datosActualizacion.predeterminada === true) {
      usuario.direcciones.forEach((dir, index) => {
        if (index !== direccionIndex) {
          dir.predeterminada = false;
        }
      });
    }

    // Actualizar la dirección
    const direccionActual = usuario.direcciones[direccionIndex];
    Object.keys(datosActualizacion).forEach(key => {
      if (datosActualizacion[key] !== undefined) {
        direccionActual[key] = datosActualizacion[key];
      }
    });

    direccionActual.fecha_actualizacion = new Date();

    // Guardar cambios
    await userService.actualizarUsuario(
      req.user._id,
      undefined,
      { direcciones: usuario.direcciones },
      undefined
    );

    await req.logActivity('usuario', 'actualizar_direccion', {
      detalles: {
        direccion_id: id,
        campos_actualizados: Object.keys(datosActualizacion)
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Dirección actualizada exitosamente',
      data: direccionActual
    });
  } catch (error) {
    console.error('Error actualizando dirección:', error);
    return next(new AppError(`Error al actualizar dirección: ${error.message}`, 400));
  }
});

/**
 * @desc    Eliminar una dirección
 * @route   DELETE /api/v1/direcciones/:id
 * @access  Private
 */
const eliminarDireccion = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para eliminar direcciones', 401));
    }

    const { id } = req.params;

    const usuario = await userService.obtenerUsuarioCompleto(req.user._id);
    
    if (!usuario || !usuario.direcciones) {
      return next(new AppError('Usuario no encontrado o sin direcciones', 404));
    }

    // Buscar la dirección por ID
    const direccionIndex = usuario.direcciones.findIndex(
      dir => dir._id && dir._id.toString() === id
    );

    if (direccionIndex === -1) {
      return next(new AppError('Dirección no encontrada', 404));
    }

    const direccionAEliminar = usuario.direcciones[direccionIndex];
    const eraPredeterminada = direccionAEliminar.predeterminada;

    // Eliminar la dirección
    usuario.direcciones.splice(direccionIndex, 1);

    // Si era predeterminada y quedan direcciones, hacer predeterminada la primera
    if (eraPredeterminada && usuario.direcciones.length > 0) {
      usuario.direcciones[0].predeterminada = true;
    }

    // Guardar cambios
    await userService.actualizarUsuario(
      req.user._id,
      undefined,
      { direcciones: usuario.direcciones },
      undefined
    );

    await req.logActivity('usuario', 'eliminar_direccion', {
      detalles: {
        direccion_id: id,
        ciudad: direccionAEliminar.ciudad,
        era_predeterminada: eraPredeterminada
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Dirección eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando dirección:', error);
    return next(new AppError(`Error al eliminar dirección: ${error.message}`, 400));
  }
});

/**
 * @desc    Establecer dirección como predeterminada
 * @route   PATCH /api/v1/direcciones/:id/predeterminada
 * @access  Private
 */
const establecerDireccionPredeterminada = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para modificar direcciones', 401));
    }

    const { id } = req.params;

    const usuario = await userService.obtenerUsuarioCompleto(req.user._id);
    
    if (!usuario || !usuario.direcciones) {
      return next(new AppError('Usuario no encontrado o sin direcciones', 404));
    }

    // Buscar la dirección por ID
    const direccionIndex = usuario.direcciones.findIndex(
      dir => dir._id && dir._id.toString() === id
    );

    if (direccionIndex === -1) {
      return next(new AppError('Dirección no encontrada', 404));
    }

    // Desmarcar todas las direcciones como predeterminadas
    usuario.direcciones.forEach(dir => {
      dir.predeterminada = false;
    });

    // Marcar la seleccionada como predeterminada
    usuario.direcciones[direccionIndex].predeterminada = true;

    // Guardar cambios
    await userService.actualizarUsuario(
      req.user._id,
      undefined,
      { direcciones: usuario.direcciones },
      undefined
    );

    await req.logActivity('usuario', 'cambiar_direccion_predeterminada', {
      detalles: {
        direccion_id: id,
        ciudad: usuario.direcciones[direccionIndex].ciudad
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Dirección establecida como predeterminada',
      data: usuario.direcciones[direccionIndex]
    });
  } catch (error) {
    console.error('Error estableciendo dirección predeterminada:', error);
    return next(new AppError(`Error al establecer dirección predeterminada: ${error.message}`, 400));
  }
});

/**
 * @desc    Obtener dirección predeterminada
 * @route   GET /api/v1/direcciones/predeterminada
 * @access  Private
 */
const obtenerDireccionPredeterminada = catchAsync(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para ver su dirección predeterminada', 401));
    }

    const usuario = await userService.obtenerUsuarioCompleto(req.user._id);
    
    if (!usuario || !usuario.direcciones) {
      return res.status(200).json({
        status: 'success',
        message: 'El usuario no tiene direcciones registradas',
        data: null
      });
    }

    const direccionPredeterminada = usuario.direcciones.find(dir => dir.predeterminada);

    if (!direccionPredeterminada) {
      // Si no hay predeterminada pero sí hay direcciones, tomar la primera
      const primeraDireccion = usuario.direcciones[0];
      if (primeraDireccion) {
        primeraDireccion.predeterminada = true;
        await userService.actualizarUsuario(
          req.user._id,
          undefined,
          { direcciones: usuario.direcciones },
          undefined
        );
        
        return res.status(200).json({
          status: 'success',
          data: primeraDireccion
        });
      }
      
      return res.status(200).json({
        status: 'success',
        message: 'No hay direcciones registradas',
        data: null
      });
    }

    return res.status(200).json({
      status: 'success',
      data: direccionPredeterminada
    });
  } catch (error) {
    console.error('Error obteniendo dirección predeterminada:', error);
    return next(new AppError(`Error al obtener dirección predeterminada: ${error.message}`, 500));
  }
});

module.exports = {
  obtenerDirecciones,
  agregarDireccion,
  actualizarDireccion,
  eliminarDireccion,
  establecerDireccionPredeterminada,
  obtenerDireccionPredeterminada
};