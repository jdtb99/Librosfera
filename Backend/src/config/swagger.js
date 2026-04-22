// src/config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

/**
 * Opciones de configuración para la documentación Swagger/OpenAPI
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Librosfera',
      version: '1.0.0',
      description: 'API RESTful para la tienda de libros Librosfera',
      contact: {
        name: 'Equipo de Desarrollo',
        email: 'dev@librosfera.com'
      },
      license: {
        name: 'Privada',
      },
    },
    servers: [
      {
        url: 'https://librosfera.onrender.com/',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api.librosfera.com/api/v1',
        description: 'Servidor de producción'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Usuario: {
          type: 'object',
          required: ['usuario', 'email', 'password', 'tipo_usuario'],
          properties: {
            _id: {
              type: 'string',
              description: 'ID único del usuario',
              example: '60d0fe4f5311236168a109ca'
            },
            usuario: {
              type: 'string',
              description: 'Nombre de usuario',
              example: 'juanperez'
            },
            email: {
              type: 'string',
              description: 'Correo electrónico',
              example: 'juan@ejemplo.com'
            },
            tipo_usuario: {
              type: 'string',
              enum: ['cliente', 'administrador', 'root'],
              description: 'Tipo de usuario',
              example: 'cliente'
            },
            activo: {
              type: 'boolean',
              description: 'Indica si el usuario está activo',
              example: true
            },
            fecha_registro: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de registro',
              example: '2021-06-22T12:00:00.000Z'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error'
            },
            message: {
              type: 'string',
              example: 'Error al procesar la solicitud'
            }
          }
        },
        // Nuevos esquemas para recuperación de contraseña
        PasswordResetRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email asociado a la cuenta de usuario',
              example: 'usuario@ejemplo.com'
            }
          }
        },
        TokenVerifyResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'success'
            },
            message: {
              type: 'string',
              example: 'Token válido'
            },
            data: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  example: 'us****@ejemplo.com'
                }
              }
            }
          }
        },
        PasswordResetBody: {
          type: 'object',
          required: ['verificationCode', 'password', 'passwordConfirm'],
          properties: {
            verificationCode: {
              type: 'string',
              description: 'Código de verificación de 6 dígitos',
              example: '123456'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Nueva contraseña (debe cumplir con los requisitos de complejidad)',
              example: 'Abc123$%^'
            },
            passwordConfirm: {
              type: 'string',
              format: 'password',
              description: 'Confirmación de la nueva contraseña',
              example: 'Abc123$%^'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'success'
            },
            message: {
              type: 'string',
              example: 'Operación realizada con éxito'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js', './src/models/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;