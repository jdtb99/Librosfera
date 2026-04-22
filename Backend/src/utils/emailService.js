// src/utils/emailService.js
const nodemailer = require('nodemailer');
// const QRCode = require('qrcode');

/**
 * Servicio extendido para el envío de correos electrónicos
 * Incluye plantillas para ventas y devoluciones
 */
class EmailService {
  constructor() {
    // Configuración del transporter de nodemailer con Gmail
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'tu-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'tu-contraseña-de-aplicación'
      }
    });
  }

  /**
   * Envía un correo de recuperación de contraseña
   * @param {String} to - Dirección de correo del destinatario
   * @param {String} resetLink - Enlace de restablecimiento de contraseña
   * @param {String} verificationCode - Código de verificación numérico
   * @returns {Promise} Resultado del envío
   */
  async sendPasswordResetEmail(to, resetLink, verificationCode) {
    try {
      // Configuración del correo
      const mailOptions = {
        from: `"Librosfera - Sistema de Recuperación de Contraseña" <${process.env.EMAIL_USER || 'tu-email@gmail.com'}>`,
        to,
        subject: 'Recuperación de Contraseña',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #333; text-align: center;">Recuperación de Contraseña</h2>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Si no has sido tú, puedes ignorar este correo.</p>
            <p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Restablecer Contraseña</a>
            </div>
            <p>O copia y pega el siguiente enlace en tu navegador:</p>
            <p style="word-break: break-all; background-color: #f7f7f7; padding: 10px; border-radius: 4px;">${resetLink}</p>
            <p>También necesitarás el siguiente código de verificación cuando se te solicite:</p>
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 24px; letter-spacing: 5px; font-weight: bold; color: #333; background-color: #f0f0f0; padding: 10px; border-radius: 4px; display: inline-block;">${verificationCode}</p>
            </div>
            <p style="margin-top: 40px; font-size: 12px; color: #777; text-align: center;">
              Este enlace y código caducarán en 1 hora por razones de seguridad.<br>
              Si no solicitaste este cambio, por favor contacta con nosotros inmediatamente.
            </p>
          </div>
        `
      };

      // Enviar el correo
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Correo de recuperación enviado:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error al enviar correo de recuperación:', error);
      throw error;
    }
  }

  /**
   * Envía un correo de confirmación de cambio de contraseña
   * @param {String} to - Dirección de correo del destinatario
   * @returns {Promise} Resultado del envío
   */
  async sendPasswordChangedEmail(to) {
    try {
      // Configuración del correo
      const mailOptions = {
        from: `"Librosfera - Sistema de Seguridad" <${process.env.EMAIL_USER || 'tu-email@gmail.com'}>`,
        to,
        subject: 'Contraseña Actualizada con Éxito',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #333; text-align: center;">Contraseña Actualizada</h2>
            <p>Tu contraseña ha sido actualizada con éxito.</p>
            <p>Si no has realizado este cambio, por favor contacta inmediatamente con nuestro equipo de soporte o intenta recuperar tu cuenta.</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${process.env.FRONT_URL || 'https://tusitio.com'}/contacto" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Contactar Soporte</a>
            </div>
            <p style="margin-top: 40px; font-size: 12px; color: #777; text-align: center;">
              Este es un mensaje automático, por favor no respondas a este correo.
            </p>
          </div>
        `
      };

      // Enviar el correo
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Correo de confirmación enviado:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error al enviar correo de confirmación:', error);
      throw error;
    }
  }

  /**
   * Envía confirmación de compra
   */
  async sendPurchaseConfirmation(to, venta, usuario) {
    try {
      const itemsHtml = venta.items.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            ${item.snapshot.titulo}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
            ${item.cantidad}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
            $${item.precios.precio_unitario_final.toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
            $${item.precios.subtotal.toLocaleString()}
          </td>
        </tr>
      `).join('');

      const mailOptions = {
        from: `"Librosfera" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Confirmación de Compra #${venta.numero_venta}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
              <h1 style="color: #28a745; text-align: center; margin-bottom: 30px;">
                ¡Gracias por tu compra!
              </h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-bottom: 20px;">Hola ${usuario.nombres},</h2>
                
                <p style="color: #666; line-height: 1.6;">
                  Tu pedido ha sido confirmado y está siendo procesado. Te mantendremos informado sobre el estado de tu envío.
                </p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="color: #333; margin-bottom: 10px;">Detalles del Pedido</h3>
                  <p><strong>Número de Orden:</strong> ${venta.numero_venta}</p>
                  <p><strong>Fecha:</strong> ${new Date(venta.fecha_creacion).toLocaleDateString('es-ES')}</p>
                  <p><strong>Estado:</strong> ${this._traducirEstado(venta.estado)}</p>
                </div>
                
                <h3 style="color: #333; margin-top: 30px; margin-bottom: 20px;">Productos Comprados</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="padding: 10px; text-align: left;">Producto</th>
                      <th style="padding: 10px; text-align: center;">Cantidad</th>
                      <th style="padding: 10px; text-align: right;">Precio</th>
                      <th style="padding: 10px; text-align: right;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
                
                <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
                  <h3 style="color: #333; margin-bottom: 15px;">Resumen del Pago</h3>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Subtotal:</span>
                    <span>$${venta.totales.subtotal_con_descuentos.toLocaleString()}</span>
                  </div>
                  ${venta.totales.total_descuentos > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #28a745;">
                    <span>Descuentos:</span>
                    <span>-$${venta.totales.total_descuentos.toLocaleString()}</span>
                  </div>
                  ` : ''}
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Impuestos:</span>
                    <span>$${venta.totales.total_impuestos.toLocaleString()}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Envío:</span>
                    <span>$${venta.totales.costo_envio.toLocaleString()}</span>
                  </div>
                  <hr style="margin: 15px 0;">
                  <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold;">
                    <span>Total:</span>
                    <span style="color: #28a745;">$${venta.totales.total_final.toLocaleString()}</span>
                  </div>
                </div>
                
                <div style="margin-top: 30px; padding: 20px; background-color: #e8f5e9; border-radius: 5px;">
                  <h3 style="color: #333; margin-bottom: 15px;">Información de Envío</h3>
                  <p><strong>Método:</strong> ${venta.envio.tipo === 'domicilio' ? 'Envío a Domicilio' : 'Recogida en Tienda'}</p>
                  ${venta.envio.tipo === 'domicilio' && venta.envio.direccion ? `
                    <p><strong>Dirección:</strong><br>
                    ${venta.envio.direccion.calle}<br>
                    ${venta.envio.direccion.ciudad}, ${venta.envio.direccion.estado}<br>
                    ${venta.envio.direccion.codigo_postal}
                    </p>
                  ` : ''}
                </div>
                
                <div style="text-align: center; margin-top: 40px;">
                  <a href="${process.env.FRONT_URL}/Profile/purchases//${venta.numero_venta}" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Ver Estado del Pedido
                  </a>
                </div>
              </div>
              
              <p style="text-align: center; color: #666; margin-top: 30px; font-size: 12px;">
                Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.<br>
                Este es un correo automático, por favor no respondas directamente.
              </p>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Confirmación de compra enviada:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error enviando confirmación de compra:', error);
      throw error;
    }
  }

  /**
   * Envía notificación de cancelación de orden
   */
  async sendOrderCancellation(to, venta) {
    try {
      const mailOptions = {
        from: `"Librosfera" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Orden Cancelada #${venta.numero_venta}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #fff3cd; padding: 30px; border-radius: 10px; border: 1px solid #ffeaa7;">
              <h1 style="color: #856404; text-align: center;">Orden Cancelada</h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                <p>Tu orden <strong>#${venta.numero_venta}</strong> ha sido cancelada.</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Motivo:</strong> ${venta.cancelacion.motivo}</p>
                  <p><strong>Fecha de cancelación:</strong> ${new Date(venta.cancelacion.fecha).toLocaleString('es-ES')}</p>
                </div>
                
                ${venta.pago.estado_pago === 'reembolsado' ? `
                <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="color: #155724; margin-bottom: 10px;">Reembolso en Proceso</h3>
                  <p style="color: #155724;">
                    El monto de <strong>$${venta.totales.total_final.toLocaleString()}</strong> será reembolsado 
                    a tu método de pago original en un plazo de 3-5 días hábiles.
                  </p>
                </div>
                ` : ''}
                
                <p style="margin-top: 30px;">
                  Si tienes alguna pregunta sobre esta cancelación, no dudes en contactarnos.
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONT_URL}/contacto" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Contactar Soporte
                  </a>
                </div>
              </div>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Notificación de cancelación enviada:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error enviando notificación de cancelación:', error);
      throw error;
    }
  }

  /**
   * Envía notificación de envío
   */
  async sendShippingNotification(to, venta) {
    try {
      const mailOptions = {
        from: `"Librosfera" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Tu pedido #${venta.numero_venta} ha sido enviado`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
              <h1 style="color: #007bff; text-align: center;">¡Tu pedido está en camino!</h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                <p>Nos complace informarte que tu pedido <strong>#${venta.numero_venta}</strong> ha sido enviado.</p>
                
                <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="color: #1976d2; margin-bottom: 15px;">Información de Envío</h3>
                  <p><strong>Empresa de envío:</strong> ${venta.envio.empresa_envio || 'Envío Express'}</p>
                  <p><strong>Número de guía:</strong> ${venta.envio.numero_guia}</p>
                  <p><strong>Fecha estimada de entrega:</strong> ${new Date(venta.envio.fecha_entrega_estimada).toLocaleDateString('es-ES')}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONT_URL}/rastrear/${venta.envio.numero_guia}" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Rastrear Pedido
                  </a>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 30px;">
                  <h4 style="color: #333; margin-bottom: 15px;">Productos Enviados:</h4>
                  <ul style="list-style: none; padding: 0;">
                    ${venta.items.map(item => `
                      <li style="padding: 10px 0; border-bottom: 1px solid #eee;">
                        ${item.snapshot.titulo} - Cantidad: ${item.cantidad}
                      </li>
                    `).join('')}
                  </ul>
                </div>
                
                <p style="margin-top: 30px; color: #666;">
                  Te enviaremos otra notificación cuando tu pedido haya sido entregado.
                </p>
              </div>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Notificación de envío enviada:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error enviando notificación de envío:', error);
      throw error;
    }
  }

  /**
   * Envía confirmación de entrega
   */
  async sendDeliveryConfirmation(to, venta) {
    try {
      const mailOptions = {
        from: `"Librosfera" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Tu pedido #${venta.numero_venta} ha sido entregado`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
              <h1 style="color: #28a745; text-align: center;">¡Pedido Entregado!</h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                <p>Tu pedido <strong>#${venta.numero_venta}</strong> ha sido entregado exitosamente.</p>
                
                <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Fecha de entrega:</strong> ${new Date(venta.envio.fecha_entrega_real).toLocaleString('es-ES')}</p>
                </div>
                
                <p style="margin: 30px 0;">
                  Esperamos que disfrutes tus productos. Si tienes algún problema con tu pedido, 
                  recuerda que tienes <strong>8 días</strong> para solicitar una devolución.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONT_URL}/mis-pedidos/${venta.numero_venta}/calificar" 
                     style="background-color: #ffc107; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">
                    Calificar Productos
                  </a>
                  <a href="${process.env.FRONT_URL}/mis-pedidos/${venta.numero_venta}" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Ver Detalles
                  </a>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 30px;">
                  <p style="margin: 0; text-align: center;">
                    <strong>¿Necesitas devolver algún producto?</strong><br>
                    Tienes hasta el <strong>${this._calcularFechaLimiteDevolucion(venta.envio.fecha_entrega_real)}</strong> 
                    para solicitar una devolución.
                  </p>
                </div>
              </div>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Confirmación de entrega enviada:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error enviando confirmación de entrega:', error);
      throw error;
    }
  }

  /**
   * Envía confirmación de devolución con código QR
   */
  async sendReturnConfirmation(to, devolucion) {
    try {
      const itemsHtml = devolucion.items.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            ${item.info_libro.titulo}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
            ${item.cantidad_a_devolver}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            ${this._traducirMotivoDevolucion(item.motivo)}
          </td>
        </tr>
      `).join('');

      const mailOptions = {
        from: `"Librosfera - Devoluciones" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Solicitud de Devolución #${devolucion.codigo_devolucion}`,
        attachments: [{
          filename: `qr-devolucion-${devolucion.codigo_devolucion}.png`,
          content: devolucion.qr_code.imagen_base64.split(',')[1],
          encoding: 'base64'
        }],
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
              <h1 style="color: #ff6b6b; text-align: center;">Solicitud de Devolución Recibida</h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                <p>Hemos recibido tu solicitud de devolución. A continuación encontrarás toda la información necesaria.</p>
                
                <div style="background-color: #ffe0e0; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="color: #c92a2a; margin-bottom: 15px;">Información de la Devolución</h3>
                  <p><strong>Código de devolución:</strong> ${devolucion.codigo_devolucion}</p>
                  <p><strong>Orden original:</strong> ${devolucion.numero_venta}</p>
                  <p><strong>Fecha de solicitud:</strong> ${new Date(devolucion.fecha_solicitud).toLocaleDateString('es-ES')}</p>
                  <p><strong>Estado:</strong> ${this._traducirEstadoDevolucion(devolucion.estado)}</p>
                </div>
                
                <h3 style="color: #333; margin: 20px 0;">Productos a Devolver</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="padding: 10px; text-align: left;">Producto</th>
                      <th style="padding: 10px; text-align: center;">Cantidad</th>
                      <th style="padding: 10px; text-align: left;">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
                
                <div style="background-color: #e7f5ff; padding: 20px; border-radius: 5px; margin: 30px 0; text-align: center;">
                  <h3 style="color: #1971c2; margin-bottom: 15px;">Código QR para Devolución</h3>
                  <p style="margin-bottom: 20px;">
                    Presenta este código QR en la tienda o pégalo en tu paquete de devolución:
                  </p>
                  <img src="cid:qr-devolucion" alt="QR Code" style="max-width: 200px; margin: 0 auto;">
                  <p style="margin-top: 20px;">
                    <a href="${devolucion.qr_code.url_rastreo}" style="color: #1971c2;">
                      ${devolucion.qr_code.url_rastreo}
                    </a>
                  </p>
                </div>
                
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h4 style="color: #856404; margin-bottom: 15px;">⚠️ Importante</h4>
                  <ul style="color: #856404; margin: 0; padding-left: 20px;">
                    <li>Tienes hasta el <strong>${new Date(devolucion.fecha_limite_envio).toLocaleDateString('es-ES')}</strong> para enviar los productos.</li>
                    <li>Los productos deben estar en las mismas condiciones en que fueron recibidos.</li>
                    <li>Incluye todos los accesorios y empaques originales.</li>
                    <li>El código QR adjunto es único e intransferible.</li>
                  </ul>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${devolucion.qr_code.url_rastreo}" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Ver Estado de la Devolución
                  </a>
                </div>
              </div>
              
              <p style="text-align: center; color: #666; margin-top: 30px; font-size: 12px;">
                Si tienes preguntas sobre el proceso de devolución, no dudes en contactarnos.<br>
                El código QR también está adjunto a este correo como imagen.
              </p>
            </div>
          </div>
        `
      };

      // Agregar imagen QR embebida
      mailOptions.html = mailOptions.html.replace(
        'src="cid:qr-devolucion"',
        `src="${devolucion.qr_code.imagen_base64}"`
      );

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Confirmación de devolución enviada:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error enviando confirmación de devolución:', error);
      throw error;
    }
  }

  /**
   * Envía notificación de aprobación de devolución
   */
  async sendReturnApproval(to, devolucion) {
    try {
      const mailOptions = {
        from: `"Librosfera - Devoluciones" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Devolución Aprobada #${devolucion.codigo_devolucion}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #d4edda; padding: 30px; border-radius: 10px;">
              <h1 style="color: #155724; text-align: center;">Devolución Aprobada</h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                <p>Tu solicitud de devolución <strong>#${devolucion.codigo_devolucion}</strong> ha sido aprobada.</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="color: #333; margin-bottom: 15px;">Próximos Pasos</h3>
                  <ol style="margin: 0; padding-left: 20px;">
                    <li style="margin-bottom: 10px;">Empaca los productos de forma segura</li>
                    <li style="margin-bottom: 10px;">Incluye el código QR que te enviamos anteriormente</li>
                    <li style="margin-bottom: 10px;">Envía el paquete a nuestra dirección o entrégalo en tienda</li>
                    <li>Una vez recibido, procesaremos tu reembolso</li>
                  </ol>
                </div>
                
                <p style="margin-top: 30px;">
                  Recuerda que debes enviar los productos antes del 
                  <strong>${new Date(devolucion.fecha_limite_envio).toLocaleDateString('es-ES')}</strong>.
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${devolucion.qr_code.url_rastreo}" 
                     style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Ver Instrucciones Completas
                  </a>
                </div>
              </div>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Error enviando aprobación de devolución:', error);
      throw error;
    }
  }

  /**
   * Envía notificación de rechazo de devolución
   */
  async sendReturnRejection(to, devolucion, motivo) {
    try {
      const mailOptions = {
        from: `"Librosfera - Devoluciones" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Devolución Rechazada #${devolucion.codigo_devolucion}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8d7da; padding: 30px; border-radius: 10px;">
              <h1 style="color: #721c24; text-align: center;">Devolución Rechazada</h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                <p>Lamentamos informarte que tu solicitud de devolución <strong>#${devolucion.codigo_devolucion}</strong> ha sido rechazada.</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="color: #721c24; margin-bottom: 10px;">Motivo del Rechazo</h3>
                  <p style="margin: 0;">${motivo}</p>
                </div>
                
                <p style="margin-top: 30px;">
                  Si crees que esto es un error o tienes preguntas adicionales, 
                  por favor contacta con nuestro equipo de atención al cliente.
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONT_URL}/contacto" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Contactar Soporte
                  </a>
                </div>
              </div>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Error enviando rechazo de devolución:', error);
      throw error;
    }
  }

  /**
   * Envía resultado de inspección
   */
  async sendInspectionResult(to, devolucion) {
    try {
      const itemsHtml = devolucion.items.map(item => {
        if (!item.inspeccion) return '';
        
        let estadoHtml = '';
        if (item.inspeccion.resultado === 'aprobado') {
          estadoHtml = '<span style="color: #28a745;">✓ Aprobado</span>';
        } else if (item.inspeccion.resultado === 'rechazado') {
          estadoHtml = '<span style="color: #dc3545;">✗ Rechazado</span>';
        } else {
          estadoHtml = `<span style="color: #ffc107;">Parcial (${item.inspeccion.porcentaje_reembolso}%)</span>`;
        }
        
        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
              ${item.info_libro.titulo}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
              ${estadoHtml}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
              $${item.monto_reembolso.toLocaleString()}
            </td>
          </tr>
        `;
      }).join('');

      const mailOptions = {
        from: `"Librosfera - Devoluciones" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Resultado de Inspección - Devolución #${devolucion.codigo_devolucion}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
              <h1 style="color: #007bff; text-align: center;">Inspección Completada</h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                <p>Hemos completado la inspección de los productos de tu devolución <strong>#${devolucion.codigo_devolucion}</strong>.</p>
                
                <h3 style="color: #333; margin: 20px 0;">Resultado de la Inspección</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="padding: 10px; text-align: left;">Producto</th>
                      <th style="padding: 10px; text-align: center;">Estado</th>
                      <th style="padding: 10px; text-align: right;">Reembolso</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">
                        Total a Reembolsar:
                      </td>
                      <td style="padding: 10px; text-align: right; font-weight: bold; color: #28a745;">
                        $${devolucion.totales.monto_aprobado_reembolso.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                
                <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 30px 0;">
                  <h4 style="color: #155724; margin-bottom: 10px;">Próximos Pasos</h4>
                  <p style="color: #155724; margin: 0;">
                    Tu reembolso de <strong>$${devolucion.totales.monto_aprobado_reembolso.toLocaleString()}</strong> 
                    será procesado en las próximas 24-48 horas hábiles.
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${devolucion.qr_code.url_rastreo}" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Ver Detalles Completos
                  </a>
                </div>
              </div>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Error enviando resultado de inspección:', error);
      throw error;
    }
  }

  /**
   * Envía confirmación de reembolso
   */
  async sendRefundConfirmation(to, devolucion) {
    try {
      const mailOptions = {
        from: `"Librosfera - Devoluciones" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Reembolso Completado - Devolución #${devolucion.codigo_devolucion}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #d4edda; padding: 30px; border-radius: 10px;">
              <h1 style="color: #155724; text-align: center;">✓ Reembolso Completado</h1>
              
              <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                <p>Tu reembolso ha sido procesado exitosamente.</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="color: #333; margin-bottom: 15px;">Detalles del Reembolso</h3>
                  <p><strong>Código de devolución:</strong> ${devolucion.codigo_devolucion}</p>
                  <p><strong>Monto reembolsado:</strong> $${devolucion.totales.monto_reembolsado.toLocaleString()}</p>
                  <p><strong>Método:</strong> ${this._traducirMetodoReembolso(devolucion.reembolso.metodo)}</p>
                  <p><strong>Referencia:</strong> ${devolucion.reembolso.referencia_reembolso}</p>
                  <p><strong>Fecha:</strong> ${new Date(devolucion.reembolso.fecha_completado).toLocaleString('es-ES')}</p>
                </div>
                
                <p style="margin-top: 30px;">
                  El reembolso debería reflejarse en tu cuenta en un plazo de 3-5 días hábiles, 
                  dependiendo de tu institución financiera.
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                  <p style="color: #666; margin-bottom: 20px;">
                    Gracias por tu comprensión durante este proceso.
                  </p>
                  <a href="${process.env.FRONT_URL}" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Seguir Comprando
                  </a>
                </div>
              </div>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Error enviando confirmación de reembolso:', error);
      throw error;
    }
  }

  // Métodos auxiliares privados
  _traducirEstado(estado) {
    const estados = {
      'pendiente_pago': 'Pendiente de Pago',
      'pago_aprobado': 'Pago Aprobado',
      'preparando': 'En Preparación',
      'listo_para_envio': 'Listo para Envío',
      'enviado': 'Enviado',
      'en_transito': 'En Tránsito',
      'entregado': 'Entregado',
      'cancelado': 'Cancelado',
      'reembolsado': 'Reembolsado',
      'fallo_pago': 'Fallo en el Pago'
    };
    return estados[estado] || estado;
  }

  _traducirEstadoDevolucion(estado) {
    const estados = {
      'solicitada': 'Solicitada',
      'aprobada': 'Aprobada',
      'rechazada': 'Rechazada',
      'esperando_envio': 'Esperando Envío',
      'en_transito': 'En Tránsito',
      'recibida': 'Recibida',
      'en_inspeccion': 'En Inspección',
      'reembolso_aprobado': 'Reembolso Aprobado',
      'reembolso_procesando': 'Procesando Reembolso',
      'reembolso_completado': 'Reembolso Completado',
      'cerrada': 'Cerrada',
      'cancelada': 'Cancelada'
    };
    return estados[estado] || estado;
  }

  _traducirMotivoDevolucion(motivo) {
    const motivos = {
      'producto_dañado': 'Producto Dañado',
      'producto_incorrecto': 'Producto Incorrecto',
      'no_coincide_descripcion': 'No Coincide con la Descripción',
      'no_satisfecho': 'No Satisfecho',
      'error_compra': 'Error en la Compra',
      'producto_no_llego': 'Producto No Llegó',
      'otro': 'Otro'
    };
    return motivos[motivo] || motivo;
  }

  _traducirMetodoReembolso(metodo) {
    const metodos = {
      'tarjeta_original': 'Tarjeta Original',
      'credito_tienda': 'Crédito en Tienda',
      'transferencia': 'Transferencia Bancaria'
    };
    return metodos[metodo] || metodo;
  }

  _calcularFechaLimiteDevolucion(fechaEntrega) {
    const fecha = new Date(fechaEntrega);
    fecha.setDate(fecha.getDate() + 8);
    return fecha.toLocaleDateString('es-ES');
  }
}

// Exportar instancia del servicio
module.exports = new EmailService();