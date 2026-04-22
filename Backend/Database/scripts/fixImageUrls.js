// Reemplaza URLs de imágenes de libros que apunten a producción por la URL local.
// Uso: node Database/scripts/fixImageUrls.js
// Permite sobreescribir de qué URL a cuál vía variables de entorno:
//   FROM_URL (default: https://librosfera.onrender.com)
//   TO_URL   (default: process.env.BASE_URL || http://localhost:5000)

require('dotenv').config();
const mongoose = require('mongoose');
const Libro = require('../models/libroModel');

const FROM_URL = process.env.FROM_URL || 'https://librosfera.onrender.com';
const TO_URL = process.env.TO_URL || process.env.BASE_URL || 'http://localhost:5000';

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('Falta MONGO_URI en .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Conectado. Reemplazando "${FROM_URL}" por "${TO_URL}" en imagenes[].url`);

  const libros = await Libro.find({ 'imagenes.url': { $regex: FROM_URL } });
  console.log(`Libros con URLs a reemplazar: ${libros.length}`);

  let imagenesActualizadas = 0;
  for (const libro of libros) {
    let cambios = 0;
    libro.imagenes = libro.imagenes.map(img => {
      if (img.url && img.url.includes(FROM_URL)) {
        img.url = img.url.replace(FROM_URL, TO_URL);
        cambios++;
      }
      return img;
    });
    libro.markModified('imagenes');
    await libro.save();
    imagenesActualizadas += cambios;
    console.log(`  - ${libro.titulo}: ${cambios} imagen(es) actualizadas`);
  }

  console.log(`\nTotal imágenes actualizadas: ${imagenesActualizadas}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
