// Database/services/index.js
const userService = require('./userService');
const libroService = require('./libroService');
const activityLogService = require('./activityLogService');
const tarjetaService = require('./tarjetaService');
const carritoService = require('./carritoService');
const ventaService = require('./ventaService');
const devolucionService = require('./devolucionService');
const mensajeriaService = require('./mensajeriaService');

module.exports = {
  userService,
  tarjetaService,
  libroService,
  activityLogService,
  carritoService,
  ventaService,
  devolucionService,
  mensajeriaService,
};