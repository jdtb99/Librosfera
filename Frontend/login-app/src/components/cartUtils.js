// cartUtils.js - Funciones de utilidad para el carrito de compras
import axios from "axios";
import { getAuthToken } from "./UserProfilePageComponents/authUtils";
import { Await } from "react-router-dom";

// SOLUCIÓN: Cache para evitar múltiples llamadas simultáneas
let fetchCartPromise = null;
let lastFetchTime = 0;
const FETCH_CACHE_DURATION = 5000; // 5 segundos de cache

/**
 * Agrega un libro al carrito de compras
 * @param {Object} book - Datos del libro a agregar
 * @param {Number} quantity - Cantidad a agregar (por defecto 1)
 * @returns {Object} - Estado de la operación y el número total de elementos en el carrito
 */
export const addToCart = (book, quantity = 1) => {
  try {
    // Verificar si hay stock disponible
    if (!book.stock || book.stock <= 0) {
      return {
        success: false,
        message: 'Lo sentimos, este libro no está disponible en inventario.',
        totalItems: getCartCount()
      };
    }

    // Obtener el carrito actual del localStorage
    const currentCart = localStorage.getItem('shoppingCart') 
      ? JSON.parse(localStorage.getItem('shoppingCart')) 
      : [];
    
    // Comprobar si el libro ya está en el carrito
    const existingItemIndex = currentCart.findIndex(item => item.bookId === book._id);
    
    if (existingItemIndex >= 0) {
      // Incrementar la cantidad si el libro ya está en el carrito
      currentCart[existingItemIndex].quantity += quantity;
    } else {
      // Agregar el libro al carrito con la cantidad especificada
      currentCart.push({
        bookId: book._id,
        quantity: quantity
      });
    }
    
    // Guardar el carrito actualizado en localStorage
    localStorage.setItem('shoppingCart', JSON.stringify(currentCart));
    
    // Actualizar timestamp
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    // Calcular el total de items en el carrito
    const totalItems = currentCart.reduce((total, item) => total + item.quantity, 0);
    
    return {
      success: true,
      message: `${book.titulo || book.title} agregado al carrito`,
      totalItems: totalItems
    };
    
  } catch (error) {
    console.error('Error al agregar al carrito:', error);
    return {
      success: false,
      message: 'Ocurrió un error al agregar el libro al carrito',
      totalItems: getCartCount()
    };
  }
};

/**
 * Obtiene el número total de elementos en el carrito
 * SOLUCIÓN: Simplificado para evitar errores
 * @returns {Number} - Cantidad total de elementos
 */
export const getCartCount = () => {
  try {
    const storedCart = localStorage.getItem('shoppingCart');
    if (storedCart) {
      const parsedCart = JSON.parse(storedCart);
      // CORRIGIDO: Calcular correctamente la cantidad total
      return parsedCart.reduce((total, item) => total + (item.quantity || 0), 0);
    }
    return 0;
  } catch (error) {
    console.error('Error al obtener el contador del carrito:', error);
    return 0;
  }
};

/**
 * Vacía el carrito de compras
 * @returns {Boolean} - True si se vació correctamente
 */
export const clearCart = async () => {
  try {
    // Try API first
    await clearCartAPI();
    return true;
  } catch (error) {
    console.error('Error al vaciar el carrito via API:', error);
    
    // Fallback to local clear
    try {
      localStorage.removeItem('shoppingCart');
      localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
      return true;
    } catch (localError) {
      console.error('Error al vaciar el carrito localmente:', localError);
      return false;
    }
  }
};

/**
 * SOLUCIÓN: Función mejorada para actualizar cantidad
 * @param {string} BookId - ID del libro
 * @param {number} Quantity - Nueva cantidad
 * @returns {Promise<string>} - Status de la operación
 */
export const UpdateQuantityBook = async (BookId, Quantity) => {
  try {
    const updateData = {
      "cantidad": Quantity
    };

    console.log(`Updating quantity for book ${BookId} to ${Quantity}`);

    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/api/v1/carrito/item/${BookId}`, 
      updateData, 
      {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Update-Reason': 'user_modification'
        },
        timeout: 30000,
      }
    );

    console.log('Update quantity success:', response.data);
    
    // Actualizar timestamp para forzar sincronización
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    return response.data.status;
  } catch (error) {
    console.error('Error updating quantity:', error.response ? error.response.data : error.message);
    throw error;
  }
};

/**
 * SOLUCIÓN: Función optimizada para obtener carrito de la API
 * Implementa cache para evitar múltiples llamadas simultáneas
 * @returns {Promise<void>}
 */
export const fetchCartUtils = async () => {
  // Verificar si ya hay una llamada en progreso o si es muy reciente
  const now = Date.now();
  if (fetchCartPromise && (now - lastFetchTime) < FETCH_CACHE_DURATION) {
    console.log('Using cached cart fetch request');
    return fetchCartPromise;
  }

  // Crear nueva promesa y actualizar timestamps
  lastFetchTime = now;
  fetchCartPromise = performCartFetch();

  try {
    await fetchCartPromise;
  } finally {
    // Limpiar la promesa después de 5 segundos
    setTimeout(() => {
      if (fetchCartPromise && (Date.now() - lastFetchTime) >= FETCH_CACHE_DURATION) {
        fetchCartPromise = null;
      }
    }, FETCH_CACHE_DURATION);
  }
};

/**
 * Función interna que realiza el fetch del carrito
 * @returns {Promise<void>}
 */
const performCartFetch = async () => {
  console.log('Fetching cart from API...');
  
  // Limpiar cart actual antes de hacer la llamada
  //localStorage.removeItem('shoppingCart');
  
  try {
    const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;
    const response = await axios.get(`${API_BASE_URL}/carrito`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      },
      timeout: 15000 // Timeout más corto
    });
   
    if (response.data.status === 'success' && response.data.data) {
      const { carrito, items } = response.data.data;
     
      // Transformar datos de la API
      const cartWithDetails = items.map(item => ({
        bookId: item.id_libro,
        quantity: item.cantidad,
        bookDetails: {
          id: item.id_libro,
          titulo: item.metadatos.titulo_libro,
          autor_nombre_completo: item.metadatos.autor_libro,
          precio: item.precios.precio_base,
          precio_info: {
            descuentos: item.codigos_aplicados.map(codigo => ({
              activo: true,
              tipo: 'porcentaje',
              valor: codigo.tipo_descuento === 'porcentaje' ? (codigo.descuento_aplicado / item.precios.precio_base) * 100 : 0
            }))
          },
          imagenes: item.metadatos.imagen_portada ? [{ url: item.metadatos.imagen_portada }] : [],
          stock: item.metadatos.disponible ? 10 : 0,
          editorial: '',
          estado: 'nuevo',
          anio_publicacion: ''
        },
        itemId: item._id,
        subtotal: item.subtotal
      }));
     
      // Guardar en localStorage
      const localStorageCart = cartWithDetails.map(item => ({
        bookId: item.bookId,
        quantity: item.quantity
      }));
      
      localStorage.setItem('shoppingCart', JSON.stringify(localStorageCart));
      localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
      
      // Dispatch eventos de sincronización
      const cartChangeEvent = new CustomEvent('cartUpdated', {
        bubbles: true,
        detail: {
          action: 'sync',
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(cartChangeEvent);
      window.dispatchEvent(new Event('globalCartUpdate'));
     
      console.log(`Cart synchronized: ${carrito.n_item} items`);
    } else {
      // No hay datos del carrito
      localStorage.removeItem('shoppingCart');
      localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
      console.log('Cart is empty');
    }
  } catch (error) {
    console.error('Error al cargar carrito desde API:', error);
    
    // En caso de error, no eliminar el cart local para no perder datos
    if (error.response?.status !== 401) {
      // Solo si no es error de autenticación, mantener cart local
      console.log('Manteniendo carrito local debido a error de red');
    }
    
    throw error; // Re-lanzar el error para que el componente pueda manejarlo
  }
};

/**
 * SOLUCIÓN: Función para verificar si el carrito necesita sincronización
 * @returns {boolean} - True si necesita sincronización
 */
export const needsCartSync = () => {
  const lastUpdated = localStorage.getItem('cartLastUpdated');
  if (!lastUpdated) return true;
  
  const timeDiff = Date.now() - parseInt(lastUpdated);
  return timeDiff > (60 * 1000); // Sincronizar si han pasado más de 1 minuto
};

/**
 * SOLUCIÓN: Función para sincronizar cart solo cuando sea necesario
 * @returns {Promise<void>}
 */
export const syncCartIfNeeded = async () => {
  if (needsCartSync()) {
    await fetchCartUtils();
  }
};


export const removeCartItem = async (itemId) => {
  try {
    const response = await axios.delete(
      `${process.env.REACT_APP_API_URL}/api/v1/carrito/item/${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('Remove item success:', response.data);
    
    // Update localStorage timestamp
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    // Dispatch events
    const cartChangeEvent = new CustomEvent('cartUpdated', {
      bubbles: true,
      detail: {
        action: 'remove_item',
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(cartChangeEvent);
    window.dispatchEvent(new Event('globalCartUpdate'));
    
    return response.data.status;
  } catch (error) {
    console.error('Error removing cart item:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// NEW function to clear entire cart via API
export const clearCartAPI = async () => {
  try {
    const response = await axios.delete(
      `${process.env.REACT_APP_API_URL}/api/v1/carrito`,
      {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('Clear cart success:', response.data);
    
    // Clear localStorage
    localStorage.removeItem('shoppingCart');
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    // Dispatch events
    const cartChangeEvent = new CustomEvent('cartUpdated', {
      bubbles: true,
      detail: {
        action: 'clear_cart',
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(cartChangeEvent);
    window.dispatchEvent(new Event('globalCartUpdate'));
    
    return response.data.status;
  } catch (error) {
    console.error('Error clearing cart:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// NEW function to get cart totals from API
export const getCartTotals = async () => {
  try {
    const response = await axios.get(
      `${process.env.REACT_APP_API_URL}/api/v1/carrito/total`,
      {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('Get cart totals success:', response.data);
    
    if (response.data.status === 'success' && response.data.data) {
      return {
        status: 'success',
        data: response.data.data
      };
    }
    
    return {
      status: 'error',
      data: null
    };
  } catch (error) {
    console.error('Error getting cart totals:', error.response ? error.response.data : error.message);
    return {
      status: 'error',
      data: null,
      error: error.response ? error.response.data : error.message
    };
  }
};