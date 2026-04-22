// ImageCacheService.js
// Este servicio gestiona el almacenamiento y recuperación de imágenes en cache

class ImageCacheService {
  constructor() {
    this.dbName = 'imageCache';
    this.storeName = 'images';
    this.db = null;
    this.ready = this.initDB();
  }

  // Inicializar la base de datos IndexedDB
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'url' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('Image cache database initialized');
        resolve(true);
      };

      request.onerror = (event) => {
        console.error('Error initializing image cache database:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Guardar una imagen en la cache
  async cacheImage(url, imageBlob) {
    await this.ready;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.put({
        url,
        blob: imageBlob,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => {
        console.error('Error caching image:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Obtener una imagen de la cache
  async getImage(url) {
    await this.ready;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(url);

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result && result.blob) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = (event) => {
        console.error('Error retrieving cached image:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Cargar una imagen, primero intentando recuperarla de la cache
  // Si no está en cache, la descarga y la almacena
  async loadImage(url) {
    if (!url) return null;

    try {
      // Intenta obtener la imagen de la caché
      let imageBlob = await this.getImage(url);
      
      // Si no está en caché, la descarga
      if (!imageBlob) {
        console.log('Image not in cache, fetching:', url);
        
        // Intenta tanto con CORS como con no-cors
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            imageBlob = await response.blob();
          }
        } catch (corsError) {
          console.log('CORS fetch failed, trying no-cors');
          try {
            // Intento con proxy para evitar CORS
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (response.ok) {
              imageBlob = await response.blob();
            }
          } catch (noCorsError) {
            console.error('Failed to fetch image with proxy:', noCorsError);
            return null;
          }
        }
        
        // Si se descargó correctamente, guárdala en caché
        if (imageBlob) {
          await this.cacheImage(url, imageBlob);
        } else {
          console.error('Failed to fetch image:', url);
          return null;
        }
      }
      
      // Crea un URL de objeto para la imagen
      return URL.createObjectURL(imageBlob);
    } catch (error) {
      console.error('Error in loadImage:', error);
      return null;
    }
  }

  // Limpiar imágenes antiguas (más de 7 días)
  async cleanupOldImages() {
    await this.ready;
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.timestamp < oneWeekAgo) {
            store.delete(cursor.key);
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log('Old images cleanup completed');
        resolve(true);
      };
    });
  }
}

// Exportar una instancia única para compartir en toda la aplicación
const imageCacheService = new ImageCacheService();
export default imageCacheService;