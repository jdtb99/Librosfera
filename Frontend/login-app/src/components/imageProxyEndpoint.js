// imageProxyEndpoint.js
// Este archivo debe colocarse en tu carpeta de api o servidor Express

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Endpoint para servir como proxy de imágenes
// Permite obtener imágenes de otras fuentes evitando problemas de CORS
router.get('/api/image-proxy', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
      return res.status(400).send('URL parameter required');
    }
    
    // Opcional: verificar que la URL pertenece a dominios permitidos por seguridad
    const allowedDomains = ['localhost:5000', 'api.your-domain.com'];
    let urlIsAllowed = false;
    
    try {
      const url = new URL(imageUrl);
      urlIsAllowed = allowedDomains.some(domain => url.host.includes(domain));
    } catch (error) {
      return res.status(400).send('Invalid URL');
    }
    
    if (!urlIsAllowed) {
      console.warn(`Attempted to proxy disallowed URL: ${imageUrl}`);
      return res.status(403).send('Domain not allowed');
    }
    
    // Obtener la imagen
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(response.status).send(response.statusText);
    }
    
    // Copiar los headers relevantes
    const contentType = response.headers.get('Content-Type');
    res.setHeader('Content-Type', contentType);
    
    // Establecer los headers CORS y CORP adecuados
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Transmitir la imagen al cliente
    response.body.pipe(res);
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).send('Error proxying image');
  }
});

module.exports = router;

/*
Para usar este endpoint en tu servidor Express:

1. Importar el router:
   const imageProxyRouter = require('./path/to/imageProxyEndpoint');

2. Añadirlo a tu app Express:
   app.use(imageProxyRouter);

Alternativamente, puedes incluir este código directamente en tu archivo principal:

app.get('/api/image-proxy', async (req, res) => {
  // Código del endpoint aquí...
});
*/