// src/controllers/userController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { userService } = require('../../Database/services');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * Genera un token JWT para autenticación
 * @param {String} id - ID del usuario
 * @returns {String} Token JWT
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

/**
 * @desc    Registrar un nuevo usuario
 * @route   POST /api/v1/users/register
 * @access  Public
 */
// Función para sanitizar texto (previene XSS)
const sanitizeText = (text) => {
  if (!text) return text;
  // Convertir a string si no lo es
  const str = String(text);
  // Escapar caracteres HTML peligrosos
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Función para normalizar texto
const normalizeText = (text) => {
  if (!text) return text;
  // Convertir a string y recortar espacios
  return String(text).trim();
};

// Función para sanitizar y validar longitud
const sanitizeAndValidateLength = (text, fieldName, minLength = 1, maxLength = 100) => {
  if (!text) return { value: text, isValid: true };
  
  const sanitized = sanitizeText(normalizeText(text));
  
  if (sanitized.length < minLength) {
    return { 
      value: sanitized, 
      isValid: false, 
      error: `El campo ${fieldName} debe tener al menos ${minLength} caracteres` 
    };
  }
  
  if (sanitized.length > maxLength) {
    return { 
      value: sanitized, 
      isValid: false, 
      error: `El campo ${fieldName} no puede exceder los ${maxLength} caracteres` 
    };
  }
  
  return { value: sanitized, isValid: true };
};

const registerUser = catchAsync(async (req, res, next) => {
  // Sanitizar campos básicos
  const usuario = normalizeText(req.body.usuario);
  const email = normalizeText(req.body.email);
  const password = req.body.password;
  const tipo_usuario = normalizeText(req.body.tipo_usuario);
  const { ...restData } = req.body;

  // Validar longitudes
  const validaciones = [
    sanitizeAndValidateLength(usuario, 'Usuario', 3, 50),
    sanitizeAndValidateLength(email, 'Email', 5, 100),
    sanitizeAndValidateLength(tipo_usuario, 'Tipo de usuario', 1, 20)
  ];
  
  // Verificar si hay errores de validación
  for (const validacion of validaciones) {
    if (!validacion.isValid) {
      return next(new AppError(validacion.error, 400));
    }
  }

  // Verificar tipo de usuario válido
  if (!['cliente', 'administrador', 'root'].includes(tipo_usuario)) {
    return next(new AppError('Tipo de usuario no válido', 400));
  }

  // Verificación explícita de permisos y ruta
  // Caso 1: Registro de cliente (permitido para todos)
  const isClientRegistration = tipo_usuario === 'cliente';
  
  // Caso 2: Registro de admin/root (requiere autenticación como root)
  const isAdminRegistration = tipo_usuario === 'administrador';
  const isRootRegistration = tipo_usuario === 'root';
  
  // Si se intenta crear admin o root, verificar si es admin desde ruta específica
  if (isAdminRegistration && req.originalUrl.includes('/admin')) {
    // Esta es la ruta específica para crear admins, continuar con verificación normal
    if (!req.user || req.user.tipo_usuario !== 'root') {
      return next(new AppError('No tiene permisos para crear un usuario administrador', 403));
    }
  } 
  // Verificar permisos si es admin pero no es la ruta específica
  else if (isAdminRegistration) {
    // Log detallado para depuración
    console.log('Solicitud de creación de administrador:');
    //  console.log('Usuario autenticado:', req.user ? ${req.user._id} (${req.user.tipo_usuario}) : 'No autenticado');
    console.log('Ruta:', req.originalUrl);
    
    if (!req.user) {
      return next(new AppError('Debe autenticarse para crear un usuario administrador', 401));
    }
    
    if (req.user.tipo_usuario !== 'root') {
      return next(new AppError('Solo un usuario root puede crear administradores', 403));
    }
  }
  // Verificar permisos para crear root
  else if (isRootRegistration) {
    // Si hay un usuario autenticado, debe ser root
    if (req.user && req.user.tipo_usuario !== 'root') {
      return next(new AppError('No tiene permisos para crear un usuario root', 403));
    }
    
    // Si no hay usuario autenticado, verificar si existe algún usuario root
    if (!req.user) {
      const rootCount = await Usuario.countDocuments({ tipo_usuario: 'root' });
      
      // Si ya existe al menos un root, no permitir crear otro sin autenticación
      if (rootCount > 0) {
        return next(new AppError('No tiene permisos para crear un usuario root', 403));
      }
      
      // Si no existe ningún root, permitir la creación del primero
      console.log('Creando primer usuario root mediante API pública');
    }
  }

  // Verificar si el usuario ya existe
  const disponible = await userService.verificarDisponibilidad(email, usuario);
  if (!disponible) {
    return next(new AppError('El usuario o email ya están registrados', 400));
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new AppError('El formato del email no es válido', 400));
  }

  // Encriptar contraseña
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Validar complejidad de contraseña
  if (password.length < 8) {
    return next(new AppError('La contraseña debe tener al menos 8 caracteres', 400));
  }

  // Datos básicos del usuario
  const userData = {
    usuario,
    email,
    password: passwordHash,
    tipo_usuario
  };

  // Separar los datos según su tipo
  let profileData = {};
  let tipoData = {};

  // Extraer los datos según el tipo de usuario
  if (tipo_usuario === 'cliente' || tipo_usuario === 'administrador') {
    const { 
      DNI, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, 
      genero, direcciones, telefono, telefono_alternativo, foto_perfil, 
      ...restTipoData 
    } = restData;
    
    // Sanitizar datos del perfil
    const sanitizedDNI = sanitizeText(normalizeText(DNI));
    const sanitizedNombres = sanitizeText(normalizeText(nombres));
    const sanitizedApellidos = sanitizeText(normalizeText(apellidos));
    const sanitizedLugarNacimiento = sanitizeText(normalizeText(lugar_nacimiento));
    const sanitizedGenero = sanitizeText(normalizeText(genero));
    const sanitizedTelefono = sanitizeText(normalizeText(telefono));
    const sanitizedTelefonoAlt = sanitizeText(normalizeText(telefono_alternativo));
    
    // Validar longitudes de campos clave
    const profileValidaciones = [
      sanitizeAndValidateLength(sanitizedNombres, 'Nombres', 2, 100),
      sanitizeAndValidateLength(sanitizedApellidos, 'Apellidos', 2, 100),
      sanitizeAndValidateLength(sanitizedLugarNacimiento, 'Lugar de nacimiento', 2, 150),
      sanitizeAndValidateLength(sanitizedDNI, 'DNI', 5, 20)
    ];
    
    // Verificar errores de validación
    for (const validacion of profileValidaciones) {
      if (!validacion.isValid) {
        return next(new AppError(validacion.error, 400));
      }
    }
    
    // Sanitizar direcciones si existen
    let sanitizedDirecciones = [];
    if (direcciones) {
      if (Array.isArray(direcciones)) {
        sanitizedDirecciones = direcciones.map(dir => {
          if (typeof dir === 'object') {
            // Si es un objeto con propiedades
            const sanitizedDir = {};
            for (const [key, value] of Object.entries(dir)) {
              if (typeof value === 'string') {
                const validacion = sanitizeAndValidateLength(value, key, 1, 200);
                if (!validacion.isValid) {
                  return next(new AppError(validacion.error, 400));
                }
                sanitizedDir[key] = validacion.value;
              } else {
                sanitizedDir[key] = value;
              }
            }
            return sanitizedDir;
          } else if (typeof dir === 'string') {
            // Si es simplemente un string
            const validacion = sanitizeAndValidateLength(dir, 'Dirección', 5, 200);
            if (!validacion.isValid) {
              return next(new AppError(validacion.error, 400));
            }
            return validacion.value;
          }
          return dir;
        });
      } else if (typeof direcciones === 'string') {
        const validacion = sanitizeAndValidateLength(direcciones, 'Dirección', 5, 200);
        if (!validacion.isValid) {
          return next(new AppError(validacion.error, 400));
        }
        sanitizedDirecciones = [validacion.value];
      } else if (typeof direcciones === 'object') {
        // Si es un solo objeto
        const sanitizedDir = {};
        for (const [key, value] of Object.entries(direcciones)) {
          if (typeof value === 'string') {
            const validacion = sanitizeAndValidateLength(value, key, 1, 200);
            if (!validacion.isValid) {
              return next(new AppError(validacion.error, 400));
            }
            sanitizedDir[key] = validacion.value;
          } else {
            sanitizedDir[key] = value;
          }
        }
        sanitizedDirecciones = [sanitizedDir];
      }
    }
    
    profileData = { 
      DNI: sanitizedDNI, 
      nombres: sanitizedNombres, 
      apellidos: sanitizedApellidos, 
      fecha_nacimiento,
      lugar_nacimiento: sanitizedLugarNacimiento, 
      genero: sanitizedGenero,
      direcciones: sanitizedDirecciones,
      telefono: sanitizedTelefono,
      telefono_alternativo: sanitizedTelefonoAlt,
      foto_perfil: foto_perfil
    };
    
    // Validación de DNI si está presente
    if (profileData.DNI) {
      // La validación exacta dependerá del formato específico que uses para DNI
      // Este es un ejemplo simple
      if (profileData.DNI.length < 5) {
        return next(new AppError('El formato del DNI no es válido', 400));
      }
    }

    // Validación de teléfono si está presente
    if (profileData.telefono) {
      const telefonoRegex = /^\+?[0-9]{8,15}$/;
      if (!telefonoRegex.test(profileData.telefono)) {
        return next(new AppError('El formato del teléfono no es válido', 400));
      }
    }
    
    // Validación mejorada de fecha de nacimiento para asegurar edad razonable
    if (profileData.fecha_nacimiento) {
      // Convertir a objeto Date si viene como string
      const fechaNacimiento = new Date(profileData.fecha_nacimiento);
      const fechaActual = new Date();
      
      // Verificar si es una fecha válida
      if (isNaN(fechaNacimiento.getTime())) {
        return next(new AppError('La fecha de nacimiento no es válida', 400));
      }
      
      // Verificar que no sea una fecha futura
      if (fechaNacimiento > fechaActual) {
        return next(new AppError('La fecha de nacimiento no puede ser una fecha futura', 400));
      }
      
      // Calcular edad
      let edad = fechaActual.getFullYear() - fechaNacimiento.getFullYear();
      const mesActual = fechaActual.getMonth();
      const diaActual = fechaActual.getDate();
      const mesNacimiento = fechaNacimiento.getMonth();
      const diaNacimiento = fechaNacimiento.getDate();
      
      // Ajustar edad si aún no ha cumplido años en el año actual
      if (mesActual < mesNacimiento || (mesActual === mesNacimiento && diaActual < diaNacimiento)) {
        edad--;
      }
      
      // Verificar que tenga al menos 18 años
      if (edad < 18) {
        return next(new AppError('El usuario debe tener al menos 18 años cumplidos', 400));
      }
      
      // Verificar que la edad sea razonable (menos de 120 años)
      const EDAD_MAXIMA = 120;
      if (edad > EDAD_MAXIMA) {
        return next(new AppError(`La edad no puede ser mayor a ${EDAD_MAXIMA} años`, 400));
      }
    }
    
    tipoData = restTipoData;
  } else {
    // Sanitizar todos los campos en restData para tipo root
    tipoData = {};
    
    for (const [key, value] of Object.entries(restData)) {
      if (typeof value === 'string') {
        // Sanitizar y validar longitud para campos de texto
        const validacion = sanitizeAndValidateLength(value, key, 1, 200);
        if (!validacion.isValid) {
          return next(new AppError(validacion.error, 400));
        }
        tipoData[key] = validacion.value;
      } else if (typeof value === 'object' && value !== null) {
        // Para objetos anidados, aplicamos sanitización recursiva
        if (Array.isArray(value)) {
          tipoData[key] = value.map(item => 
            typeof item === 'string' ? sanitizeText(normalizeText(item)) : item
          );
        } else {
          // Para objetos que no son arrays
          tipoData[key] = {};
          for (const [subKey, subValue] of Object.entries(value)) {
            if (typeof subValue === 'string') {
              tipoData[key][subKey] = sanitizeText(normalizeText(subValue));
            } else {
              tipoData[key][subKey] = subValue;
            }
          }
        }
      } else {
        // Para números, booleanos, etc.
        tipoData[key] = value;
      }
    }
  }

  // Crear usuario según su tipo
  let nuevoUsuario;

  switch (tipo_usuario) {
    case 'cliente':
      nuevoUsuario = await userService.crearCliente(userData, profileData, tipoData);
      break;
    case 'administrador':
      nuevoUsuario = await userService.crearAdministrador(userData, profileData, tipoData);
      break;
    case 'root':
      nuevoUsuario = await userService.crearRoot(userData, tipoData);
      break;
  }

  // Eliminar password de la respuesta
  if (nuevoUsuario && nuevoUsuario.password) {
    delete nuevoUsuario.password;
  }

  await req.logActivity('usuario', 'registro', {
    detalles: {
      tipo_usuario: tipo_usuario,
      email: email,
      usuario: usuario
    }
  });

  // Responder con información del usuario y token
  res.status(201).json({
    status: 'success',
    data: {
      ...nuevoUsuario,
      token: generateToken(nuevoUsuario._id),
    },
  });
});

/**
 * @desc    Crear un administrador con datos mínimos (solo email y password)
 * @route   POST /api/v1/users/admin
 * @access  Private/Root
 */
const createAdmin = catchAsync(async (req, res, next) => {
  const { email, password, usuario, ...restData } = req.body;
  
  // Verificar datos mínimos obligatorios
  if (!email || !password) {
    return next(new AppError('Email y contraseña son obligatorios', 400));
  }
  
  // Verificar que el usuario sea root
  if (!req.user || req.user.tipo_usuario !== 'root') {
    return next(new AppError('Solo usuarios root pueden crear administradores', 403));
  }
  
  // Verificar disponibilidad de email y usuario
  const disponible = await userService.verificarDisponibilidad(
    email, 
    usuario || null
  );
  
  if (!disponible) {
    return next(new AppError('El email o nombre de usuario ya está en uso', 400));
  }
  
  // Encriptar contraseña
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  // Datos básicos del usuario
  const userData = {
    email,
    password: passwordHash,
    tipo_usuario: 'administrador'
  };
  
  // Agregar usuario si se proporciona
  if (usuario) {
    userData.usuario = usuario;
  } else {
    // Generar nombre de usuario a partir del email si no se proporciona
    userData.usuario = email.split('@')[0] + '_admin';
  }
  
  try {
    // Crear administrador con datos mínimos
    const nuevoAdmin = await userService.crearAdministrador(userData, restData);
    
    // Eliminar password de la respuesta
    if (nuevoAdmin && nuevoAdmin.password) {
      delete nuevoAdmin.password;
    }
    const perfilCompleto = nuevoAdmin.DNI && nuevoAdmin.nombres && nuevoAdmin.apellidos;
    
    await req.logActivity('administracion', 'creacion_administrador', {
      detalles: {
        email: email,
        usuario: nuevoAdmin.usuario,
        perfil_completo: perfilCompleto
      },
      nivel_importancia: 'alto'
    });
    
    // Verificar si el perfil está completo
    
    
    // Responder con información del administrador y token
    res.status(201).json({
      status: 'success',
      message: perfilCompleto 
        ? 'Administrador creado con perfil completo' 
        : 'Administrador creado con datos mínimos. Se requiere completar el perfil',
      data: {
        ...nuevoAdmin,
        token: generateToken(nuevoAdmin._id),
      },
    });
  } catch (error) {
    return next(new AppError(`Error al crear administrador: ${error.message}`, 500));
  }
});

/**
 * @desc    Autenticar usuario / obtener token
 * @route   POST /api/v1/users/login
 * @access  Public
 */
const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Validar que se proporcionaron email y password
  if (!email || !password) {
    return next(new AppError('Por favor proporcione email y contraseña', 400));
  }

  // Verificar email y obtener usuario completo
  const usuario = await userService.buscarUsuarioPorEmail(email);
  if (!usuario) {
    await req.logActivity('seguridad', 'intento_login_fallido', {
      detalles: {
        email: email,
        razon: 'Email no existe'
      },
      nivel_importancia: 'bajo'
    });
    return next(new AppError('Credenciales inválidas', 401));
  }

  // Verificar si el usuario está activo
  if (!usuario.activo) {
    await req.logActivity('seguridad', 'intento_login_fallido', {
      detalles: {
        email: email,
        razon: 'Usuario desactivado'
      },
      nivel_importancia: 'bajo'
    });
    return next(new AppError('Esta cuenta ha sido desactivada', 401));
  }

  // Verificar contraseña
  const isMatch = await bcrypt.compare(password, usuario.password);
  if (!isMatch) {
    await req.logActivity('seguridad', 'intento_login_fallido', {
      detalles: {
        email: email,
        razon: 'Contraseña incorrecta'
      },
      nivel_importancia: 'bajo'
    });
    return next(new AppError('Credenciales inválidas', 401));
  }

  // Eliminar password de la respuesta
  delete usuario.password;
  await req.logActivity('usuario', 'login', {
    id_usuario: usuario._id,
    usuario_info: {
      usuario: usuario.usuario,
      email: usuario.email,
      tipo_usuario: usuario.tipo_usuario
    },
    nivel_importancia: 'bajo'
  });
  // Responder con información del usuario y token
  res.status(200).json({
    status: 'success',
    data: {
      ...usuario,
      token: generateToken(usuario._id),
    },
  });
});

/**
 * @desc    Obtener perfil del usuario
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
const getUserProfile = catchAsync(async (req, res, next) => {
  // Obtener información completa del usuario
  const usuarioCompleto = await userService.obtenerUsuarioCompleto(req.user._id);
  
  if (!usuarioCompleto) {
    return next(new AppError('Usuario no encontrado', 404));
  }
  
  // Eliminar password por seguridad
  delete usuarioCompleto.password;
  
  res.status(200).json({
    status: 'success',
    data: usuarioCompleto,
  });
});

/**
 * @desc    Actualizar perfil del usuario
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
const updateUserProfile = catchAsync(async (req, res, next) => {
  const { password, email, usuario, ...restData } = req.body;
  
  // Datos a actualizar en el esquema de usuario base
  const userData = {};
  
  // Si se incluye nueva contraseña, encriptarla
  if (password) {
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(password, salt);
  }

  // Si se intenta cambiar email o usuario, verificar que no estén en uso
  if (email || usuario) {
    const disponible = await userService.verificarDisponibilidad(
      email || null, 
      usuario || null, 
      req.user._id
    );

    if (!disponible) {
      return next(new AppError('El email o nombre de usuario ya está en uso por otra cuenta', 400));
    }

    if (email) userData.email = email;
    if (usuario) userData.usuario = usuario;
  }
  
  // Separar datos según el tipo de usuario
  let profileData = {};
  let tipoData = {};
  
  if (req.user.tipo_usuario === 'cliente' || req.user.tipo_usuario === 'administrador') {
    const { 
      DNI, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, 
      genero, direcciones, telefono, telefono_alternativo, foto_perfil, 
      ...restTipoData 
    } = restData;
    
    if (DNI || nombres || apellidos || fecha_nacimiento || lugar_nacimiento || 
        genero || direcciones || telefono || telefono_alternativo || foto_perfil) {
      profileData = {};
      if (DNI) profileData.DNI = DNI;
      if (nombres) profileData.nombres = nombres;
      if (apellidos) profileData.apellidos = apellidos;
      if (fecha_nacimiento) profileData.fecha_nacimiento = fecha_nacimiento;
      if (lugar_nacimiento) profileData.lugar_nacimiento = lugar_nacimiento;
      if (genero) profileData.genero = genero;
      if (direcciones) {
        profileData.direcciones = Array.isArray(direcciones) ? direcciones : [direcciones];
      }
      if (telefono) profileData.telefono = telefono;
      if (telefono_alternativo) profileData.telefono_alternativo = telefono_alternativo;
      if (foto_perfil) profileData.foto_perfil = foto_perfil;
    }
    
    tipoData = Object.keys(restTipoData).length > 0 ? restTipoData : undefined;
  } else {
    tipoData = Object.keys(restData).length > 0 ? restData : undefined;
  }

  // Actualizar usuario con los datos separados
  const usuarioActualizado = await userService.actualizarUsuario(
    req.user._id,
    Object.keys(userData).length > 0 ? userData : undefined,
    Object.keys(profileData).length > 0 ? profileData : undefined,
    tipoData
  );
  
  // Eliminar password por seguridad
  if (usuarioActualizado && usuarioActualizado.password) {
    delete usuarioActualizado.password;
  }

  await req.logActivity('usuario', 'actualizacion_perfil', {
    detalles: {
      campos_actualizados: Object.keys(req.body)
    }
  });

  res.status(200).json({
    status: 'success',
    data: usuarioActualizado,
  });
});

/**
 * @desc    Eliminar usuario (desactivación lógica)
 * @route   DELETE /api/v1/users/profile
 * @access  Private
 */
const deleteUser = catchAsync(async (req, res, next) => {
  // Guardar información del usuario antes de desactivarlo (para el log)
  const usuarioADesactivar = await Usuario.findById(req.user._id).lean();
  
  // Desactivación lógica del usuario
  await userService.desactivarUsuario(req.user._id);

  // Registrar la desactivación
  await req.logActivity('usuario', 'desactivacion', {
    id_usuario: req.user._id,
    estado_anterior: { activo: true },
    estado_nuevo: { activo: false },
    detalles: {
      tipo_usuario: usuarioADesactivar.tipo_usuario,
      email: usuarioADesactivar.email
    },
    nivel_importancia: 'alto'
  });

  res.status(200).json({
    status: 'success',
    message: 'Usuario desactivado correctamente',
  });
});

/**
 * @desc    Obtener todos los usuarios
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
const getUsers = catchAsync(async (req, res, next) => {
  // Parámetros de paginación
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Construir filtros desde los query params
  const filtros = {
    tipo_usuario: req.query.tipo || undefined,
    activo: req.query.activo !== undefined ? req.query.activo : undefined,
    email: req.query.email || undefined,
    usuario: req.query.usuario || undefined
  };

  // Filtrar undefined
  Object.keys(filtros).forEach(key => 
    filtros[key] === undefined && delete filtros[key]
  );

  // Obtener usuarios con paginación
  const resultado = await userService.listarUsuarios(filtros, page, limit);

  res.status(200).json({
    status: 'success',
    resultados: resultado.datos.length,
    paginacion: resultado.paginacion,
    data: resultado.datos,
  });
});

/**
 * @desc    Obtener un usuario por ID
 * @route   GET /api/v1/users/:id
 * @access  Private/Admin
 */
const getUserById = catchAsync(async (req, res, next) => {
  try {
    // Obtener información completa del usuario
    const usuarioCompleto = await userService.obtenerUsuarioCompleto(req.params.id);
    
    if (!usuarioCompleto) {
      return next(new AppError('Usuario no encontrado', 404));
    }
    
    // Eliminar password por seguridad
    if (usuarioCompleto.password) {
      delete usuarioCompleto.password;
    }

    res.status(200).json({
      status: 'success',
      data: usuarioCompleto,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * @desc    Actualizar un usuario por ID (admin)
 * @route   PUT /api/v1/users/:id
 * @access  Private/Admin
 */
const updateUser = catchAsync(async (req, res, next) => {
  // Verificar si el usuario existe
  const usuario = await userService.obtenerUsuarioCompleto(req.params.id);
  
  if (!usuario) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  // El usuario root no puede ser modificado excepto por otro root
  if (usuario.tipo_usuario === 'root' && req.user.tipo_usuario !== 'root') {
    return next(new AppError('No tiene permisos para modificar un usuario root', 403));
  }

  const { password, email, usuario: nombreUsuario, ...restData } = req.body;
  
  // Datos a actualizar en el esquema de usuario base
  const userData = {};
  
  // Si se incluye nueva contraseña, encriptarla
  if (password) {
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(password, salt);
  }

  // Si se intenta cambiar email o usuario, verificar que no estén en uso
  if (email || nombreUsuario) {
    const disponible = await userService.verificarDisponibilidad(
      email || null, 
      nombreUsuario || null, 
      req.params.id
    );

    if (!disponible) {
      return next(new AppError('El email o nombre de usuario ya está en uso por otra cuenta', 400));
    }

    if (email) userData.email = email;
    if (nombreUsuario) userData.usuario = nombreUsuario;
  }
  
  // Separar datos según el tipo de usuario
  let profileData = {};
  let tipoData = {};
  
  if (usuario.tipo_usuario === 'cliente' || usuario.tipo_usuario === 'administrador') {
    const { 
      DNI, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, 
      genero, direcciones, telefono, telefono_alternativo, foto_perfil, 
      ...restTipoData 
    } = restData;
    
    if (DNI || nombres || apellidos || fecha_nacimiento || lugar_nacimiento || 
        genero || direcciones || telefono || telefono_alternativo || foto_perfil) {
      profileData = {};
      if (DNI) profileData.DNI = DNI;
      if (nombres) profileData.nombres = nombres;
      if (apellidos) profileData.apellidos = apellidos;
      if (fecha_nacimiento) profileData.fecha_nacimiento = fecha_nacimiento;
      if (lugar_nacimiento) profileData.lugar_nacimiento = lugar_nacimiento;
      if (genero) profileData.genero = genero;
      if (direcciones) {
        profileData.direcciones = Array.isArray(direcciones) ? direcciones : [direcciones];
      }
      if (telefono) profileData.telefono = telefono;
      if (telefono_alternativo) profileData.telefono_alternativo = telefono_alternativo;
      if (foto_perfil) profileData.foto_perfil = foto_perfil;
    }
    
    tipoData = Object.keys(restTipoData).length > 0 ? restTipoData : undefined;
  } else {
    tipoData = Object.keys(restData).length > 0 ? restData : undefined;
  }

  // Actualizar usuario con los datos separados
  const usuarioActualizado = await userService.actualizarUsuario(
    req.params.id,
    Object.keys(userData).length > 0 ? userData : undefined,
    Object.keys(profileData).length > 0 ? profileData : undefined,
    tipoData
  );
  
  // Eliminar password por seguridad
  if (usuarioActualizado && usuarioActualizado.password) {
    delete usuarioActualizado.password;
  }

  await req.logActivity('administracion', 'actualizacion_usuario', {
    entidad_afectada: {
      tipo: 'usuario',
      id: req.params.id,
      nombre: usuarioActualizado.usuario
    },
    detalles: {
      campos_actualizados: Object.keys(req.body)
    },
    nivel_importancia: 'medio'
  });

  res.status(200).json({
    status: 'success',
    data: usuarioActualizado,
  });
});

/**
 * @desc    Eliminar un usuario por ID (admin)
 * @route   DELETE /api/v1/users/:id
 * @access  Private/Admin
 */
const deleteUserById = catchAsync(async (req, res, next) => {
  // Verificar si el usuario existe
  const usuario = await userService.obtenerUsuarioCompleto(req.params.id);
  
  if (!usuario) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  // El usuario root no puede ser eliminado excepto por otro root
  if (usuario.tipo_usuario === 'root' && req.user.tipo_usuario !== 'root') {
    return next(new AppError('No tiene permisos para eliminar un usuario root', 403));
  }

  // Verificar que un usuario no se elimine a sí mismo
  if (req.user._id.toString() === req.params.id) {
    return next(new AppError('No puede eliminar su propia cuenta por esta vía', 400));
  }

  // Desactivación lógica del usuario
  await userService.desactivarUsuario(req.params.id);
  
  await req.logActivity('administracion', 'desactivacion_usuario', {
    entidad_afectada: {
      tipo: 'usuario',
      id: req.params.id,
      nombre: usuario.usuario
    },
    nivel_importancia: 'alto'
  });

  res.status(200).json({
    status: 'success',
    message: 'Usuario desactivado correctamente',
  });
});

/**
 * @desc    Subir foto de perfil
 * @route   POST /api/v1/users/profile/foto
 * @access  Private
 */
const uploadProfilePhoto = catchAsync(async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para subir una foto', 401));
    }

    // Verificar que se ha subido un archivo
    if (!req.file) {
      return next(new AppError('No se ha subido ningún archivo', 400));
    }

    console.log('Archivo recibido en controlador:', req.file);

    // Verificar que el archivo es una imagen
    if (!req.file.mimetype.startsWith('image')) {
      return next(new AppError('El archivo debe ser una imagen', 400));
    }

    // Verificar tamaño máximo (2MB)
    if (req.file.size > 2 * 1024 * 1024) {
      return next(new AppError('La imagen no puede ser mayor a 2MB', 400));
    }

    // Actualizar foto de perfil del usuario
    const usuarioActualizado = await userService.actualizarFotoPerfil(
      req.user._id,
      req.file
    );

    // Eliminar password por seguridad
    if (usuarioActualizado && usuarioActualizado.password) {
      delete usuarioActualizado.password;
    }

    return res.status(200).json({
      status: 'success',
      message: 'Foto de perfil actualizada correctamente',
      data: usuarioActualizado
    });
  } catch (error) {
    console.error('Error subiendo foto de perfil:', error);
    return next(new AppError(`Error al subir foto: ${error.message}`, 400));
  }
});

/**
 * @desc    Eliminar foto de perfil (establecer a default)
 * @route   DELETE /api/v1/users/profile/foto
 * @access  Private
 */
const deleteProfilePhoto = catchAsync(async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return next(new AppError('Debe iniciar sesión para eliminar su foto', 401));
    }

    // Eliminar foto de perfil (restaurar a default)
    const usuarioActualizado = await userService.eliminarFotoPerfil(req.user._id);

    // Eliminar password por seguridad
    if (usuarioActualizado && usuarioActualizado.password) {
      delete usuarioActualizado.password;
    }

    return res.status(200).json({
      status: 'success',
      message: 'Foto de perfil eliminada correctamente',
      data: usuarioActualizado
    });
  } catch (error) {
    console.error('Error eliminando foto de perfil:', error);
    return next(new AppError(`Error al eliminar foto: ${error.message}`, 400));
  }
});

/**
 * @desc    Subir foto de perfil para otro usuario (admin)
 * @route   POST /api/v1/users/:id/foto
 * @access  Private/Admin
 */
const uploadUserPhoto = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para actualizar fotos de otros usuarios', 403));
    }

    // Verificar que se ha subido un archivo
    if (!req.file) {
      return next(new AppError('No se ha subido ningún archivo', 400));
    }

    console.log('Archivo recibido en controlador:', req.file);
    console.log('ID de usuario a actualizar:', req.params.id);

    // Verificar que el archivo es una imagen
    if (!req.file.mimetype.startsWith('image')) {
      return next(new AppError('El archivo debe ser una imagen', 400));
    }

    // Verificar tamaño máximo (2MB)
    if (req.file.size > 2 * 1024 * 1024) {
      return next(new AppError('La imagen no puede ser mayor a 2MB', 400));
    }

    // Actualizar foto de perfil del usuario especificado
    const usuarioActualizado = await userService.actualizarFotoPerfil(
      req.params.id,
      req.file
    );

    // Eliminar password por seguridad
    if (usuarioActualizado && usuarioActualizado.password) {
      delete usuarioActualizado.password;
    }

    return res.status(200).json({
      status: 'success',
      message: 'Foto de perfil actualizada correctamente',
      data: usuarioActualizado
    });
  } catch (error) {
    console.error('Error subiendo foto de perfil:', error);
    return next(new AppError(`Error al subir foto: ${error.message}`, 400));
  }
});

/**
 * @desc    Eliminar foto de perfil de otro usuario (admin)
 * @route   DELETE /api/v1/users/:id/foto
 * @access  Private/Admin
 */
const deleteUserPhoto = catchAsync(async (req, res, next) => {
  try {
    // Verificar permisos de administrador
    if (!req.user || (req.user.tipo_usuario !== 'administrador' && req.user.tipo_usuario !== 'root')) {
      return next(new AppError('No tiene permisos para eliminar fotos de otros usuarios', 403));
    }

    console.log('Eliminando foto de usuario:', req.params.id);

    // Eliminar foto de perfil del usuario especificado
    const usuarioActualizado = await userService.eliminarFotoPerfil(req.params.id);

    // Eliminar password por seguridad
    if (usuarioActualizado && usuarioActualizado.password) {
      delete usuarioActualizado.password;
    }

    return res.status(200).json({
      status: 'success',
      message: 'Foto de perfil eliminada correctamente',
      data: usuarioActualizado
    });
  } catch (error) {
    console.error('Error eliminando foto de perfil:', error);
    return next(new AppError(`Error al eliminar foto: ${error.message}`, 400));
  }
});

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  deleteUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUserById,
  createAdmin,
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadUserPhoto,
  deleteUserPhoto,
};