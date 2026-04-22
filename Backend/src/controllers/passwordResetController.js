// src/controllers/passwordResetController.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const PasswordReset = require('../../Database/models/passwordResetModel');
const { userService } = require('../../Database/services');
const emailService = require('../utils/emailService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * Genera un token aleatorio seguro
 * @returns {String} Token generado
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Genera un código de verificación numérico de 6 dígitos
 * @returns {String} Código de verificación
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * @desc    Solicitar recuperación de contraseña
 * @route   POST /api/v1/users/forgot-password
 * @access  Public
 */
const requestPasswordReset = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // Verificar que se proporcionó un email
  if (!email) {
    return next(new AppError('Por favor proporcione su dirección de email', 400));
  }

  // Buscar usuario por email
  const usuario = await userService.buscarUsuarioPorEmail(email);
  
  // Si no se encuentra el usuario, no revelar esta información por seguridad
  // pero devolver una respuesta positiva para evitar ataques de enumeración
  if (!usuario) {
    return res.status(200).json({
      status: 'success',
      message: 'Si existe una cuenta con ese email, recibirás un correo con instrucciones para restablecer tu contraseña'
    });
  }

  // Verificar si el usuario está activo
  if (!usuario.activo) {
    return next(new AppError('Esta cuenta ha sido desactivada', 401));
  }

  // Generar token y código de verificación
  const resetToken = generateToken();
  const verificationCode = generateVerificationCode();

  // Eliminar cualquier token existente para este usuario
  await PasswordReset.deleteMany({ userId: usuario._id });

  // Crear nuevo documento de reseteo de contraseña
  await PasswordReset.create({
    userId: usuario._id,
    email: usuario.email,
    token: resetToken,
    verificationCode
  });

  // Construir el enlace de recuperación
  const resetLink = `${process.env.FRONT_URL || 'https://librosfera-awmi.onrender.com'}/reset-password/${resetToken}`;

  try {
    // Enviar email con link de recuperación y código
    await emailService.sendPasswordResetEmail(usuario.email, resetLink, verificationCode);

    await req.logActivity('usuario', 'solicitud_recuperacion_password', {
      detalles: {
        email: email
      },
      nivel_importancia: 'medio'
    });

    // Responder al cliente
    res.status(200).json({
      status: 'success',
      message: 'Se ha enviado un correo con instrucciones para restablecer tu contraseña'
    });
  } catch (error) {
    // Si falla el envío, eliminar el token creado
    await PasswordReset.deleteOne({ token: resetToken });
    
    console.error('Error al enviar email:', error);
    return next(new AppError('No se pudo enviar el email. Por favor intenta de nuevo más tarde', 500));
  }
});

/**
 * @desc    Verificar token de recuperación
 * @route   GET /api/v1/users/reset-password/:token
 * @access  Public
 */
const verifyResetToken = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  // Buscar el registro de reseteo por token
  const passwordReset = await PasswordReset.findOne({ token });

  // Verificar si el token existe y no ha expirado
  if (!passwordReset) {
    return next(new AppError('El enlace de recuperación es inválido o ha expirado', 400));
  }

  // Si el token es válido, responder con email parcialmente oculto para confirmación
  const email = passwordReset.email;
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1****$3');

  res.status(200).json({
    status: 'success',
    message: 'Token válido',
    data: {
      email: maskedEmail
    }
  });
});

/**
 * @desc    Restablecer contraseña con token y código de verificación
 * @route   POST /api/v1/users/reset-password/:token
 * @access  Public
 */
const resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { verificationCode, password, passwordConfirm } = req.body;

  // Validar que se proporcionaron todos los campos necesarios
  if (!verificationCode || !password || !passwordConfirm) {
    return next(new AppError('Por favor proporcione el código de verificación y la nueva contraseña', 400));
  }

  // Verificar que las contraseñas coinciden
  if (password !== passwordConfirm) {
    return next(new AppError('Las contraseñas no coinciden', 400));
  }

  // Verificar complejidad de la contraseña
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return next(new AppError('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial', 400));
  }

  // Buscar el registro de reseteo por token
  const passwordReset = await PasswordReset.findOne({ token });

  // Verificar si el token existe y no ha expirado
  if (!passwordReset) {
    return next(new AppError('El enlace de recuperación es inválido o ha expirado', 400));
  }

  // Verificar que el código de verificación coincide
  if (passwordReset.verificationCode !== verificationCode) {
    return next(new AppError('El código de verificación es incorrecto', 400));
  }

  // Encriptar la nueva contraseña
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Actualizar la contraseña del usuario
  try {
    await userService.actualizarUsuario(
      passwordReset.userId,
      { password: passwordHash },
      null,
      null
    );
  
    // Eliminar todos los tokens de reseteo para este usuario
    await PasswordReset.deleteMany({ userId: passwordReset.userId });

    await req.logActivity('usuario', 'recuperacion_password_completada', {
      detalles: {
        email: passwordReset.email
      },
      nivel_importancia: 'medio'
    });
  
    // Responder al cliente PRIMERO antes de enviar el correo
    res.status(200).json({
      status: 'success',
      message: 'Contraseña restablecida con éxito'
    });
  
    // Enviar email de confirmación SIN await para que no bloquee
    emailService.sendPasswordChangedEmail(passwordReset.email)
      .catch(err => console.error('Error al enviar correo de confirmación:', err));
      
  } catch (error) {
    console.error('Error al actualizar contraseña:', error);
    return next(new AppError('Error al restablecer la contraseña. Por favor intenta de nuevo', 500));
  }
});

module.exports = {
  requestPasswordReset,
  verifyResetToken,
  resetPassword
};