import React, { useState, useEffect, useCallback , useRef} from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CachedImage from './CachedImage'; 
import { clearCart as clearCartUtil } from './cartUtils'; // Importar utilidad para vaciar el carrito
import { getAuthToken } from './UserProfilePageComponents/authUtils';
import {UpdateQuantityBook} from './cartUtils';

// URL base para las llamadas a la API
const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;

const ShoppingCart = ({ isOpen, onClose, updateCartCount }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const cartRef = useRef(null);
  const [updatingQuantity, setUpdatingQuantity] = useState({});
  const [cartTotals, setCartTotals] = useState({});
  const navigate = useNavigate();

  // Efecto para cargar los elementos del carrito del localStorage
  useEffect(() => {
  const fetchCartItems = async () => {
    setIsLoading(true);
    try {
      // REMOVED: localStorage.removeItem('shoppingCart'); - This was causing the reload cycle
      
      const response = await axios.get(`${API_BASE_URL}/carrito`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (response.data.status === 'success' && response.data.data) {
        const { carrito, items } = response.data.data;
        
        const cartWithDetails = items.map(item => ({
          bookId: item.id_libro,
          quantity: item.cantidad,
          bookDetails: {
            _id: item.id_libro,
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
        
        setCartItems(cartWithDetails);
        setCartTotals(carrito);
        
        // Save to localStorage - same format as CartPage
        const localStorageCart = cartWithDetails.map(item => ({
          bookId: item.bookId,
          quantity: item.quantity
        }));
        
        localStorage.setItem('shoppingCart', JSON.stringify(localStorageCart));
        localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
        
        // Dispatch events - same as CartPage
        const cartChangeEvent = new CustomEvent('cartUpdated', {
          bubbles: true,
          detail: {
            action: 'sync',
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(cartChangeEvent);
        window.dispatchEvent(new Event('globalCartUpdate'));
        
        updateCartCount(carrito.n_libros_diferentes);
      } else {
        setCartItems([]);
        setCartTotals({});
        
        // Only clear localStorage when cart is actually empty from server
        localStorage.removeItem('shoppingCart');
        localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
        
        updateCartCount(0);
      }
    } catch (error) {
      console.error('Error al cargar elementos del carrito:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isOpen) {
    fetchCartItems();
  }
}, [isOpen, updateCartCount]);

  // Efecto para cerrar el carrito al hacer clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cartRef.current && !cartRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);


  // Función para actualizar la cantidad de un item
  // Función para actualizar la cantidad de un item
const updateQuantity = useCallback(async (itemId, newQuantity, item) => {
    if (newQuantity < 1) return;
    
    console.log("Edit quantity:");
    console.log(itemId);
    console.log(newQuantity);
    console.log(item);
    
    // Set loading state for this specific item
    setUpdatingQuantity(prev => ({ ...prev, [itemId]: true }));
    
    try {
      const result = await UpdateQuantityBook(item.bookId._id, newQuantity);

      if(result === "success"){
        // Update cart items using the correct identifier (itemId)
        const updatedCart = cartItems.map(cartItem => 
          cartItem.itemId === itemId 
            ? { ...cartItem, quantity: newQuantity }
            : cartItem
        );
        
        setCartItems(updatedCart);
        
        // Update localStorage
        const simplifiedCart = updatedCart.map(item => ({
          bookId: item.bookId,
          quantity: item.quantity
        }));
        
        localStorage.setItem('shoppingCart', JSON.stringify(simplifiedCart));
        localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
        
        // Dispatch events
        const cartChangeEvent = new CustomEvent('cartUpdated', {
          bubbles: true,
          detail: {
            action: 'update_quantity',
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(cartChangeEvent);
        window.dispatchEvent(new Event('globalCartUpdate'));
        
        // Update cart count with total quantity
        if (updateCartCount) {
          updateCartCount(updatedCart.reduce((total, item) => total + item.quantity, 0));
        }
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      // Remove loading state
      setUpdatingQuantity(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    }
  }, [cartItems, updateCartCount]);

  // Función para eliminar un item del carrito
  const removeItem = async (itemId, bookId) => {
  try {
    await axios.delete(`${API_BASE_URL}/carrito/item/${bookId}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    const updatedCart = cartItems.filter(item => item.itemId !== itemId);
    setCartItems(updatedCart);
    
    // Update localStorage - same format as CartPage
    const simplifiedCart = updatedCart.map(item => ({
      bookId: item.bookId,
      quantity: item.quantity
    }));
    
    localStorage.setItem('shoppingCart', JSON.stringify(simplifiedCart));
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    updateCartCount(simplifiedCart.reduce((total, item) => total + item.quantity, 0));

    // Dispatch events - same as CartPage
    const cartChangeEvent = new CustomEvent('cartUpdated', {
      bubbles: true,
      detail: {
        action: 'remove_item',
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(cartChangeEvent);
    window.dispatchEvent(new Event('globalCartUpdate'));

  } catch (error) {
    console.error('Error removing item from cart:', error);
    // Still update UI and localStorage even if API call fails
    const updatedCart = cartItems.filter(item => item.itemId !== itemId);
    setCartItems(updatedCart);
    
    const simplifiedCart = updatedCart.map(item => ({
      bookId: item.bookId,
      quantity: item.quantity
    }));
    
    localStorage.setItem('shoppingCart', JSON.stringify(simplifiedCart));
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    updateCartCount(simplifiedCart.reduce((total, item) => total + item.quantity, 0));
  }
};


  // Función para vaciar todo el carrito utilizando la utilidad importada
  const clearCart = () => {
    if (clearCartUtil()) {
      setCartItems([]);
      updateCartCount(0);
    }
  };

  // Función para ir al checkout
  const fetchCartTotals = useCallback(async () => {
  try {
    const responseTotal = await axios.get(`${API_BASE_URL}/carrito/total`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (responseTotal.data.status === 'success' && responseTotal.data.data) {
      return responseTotal.data.data.totales;
    }
    return null;
  } catch (error) {
    console.error('Error fetching cart totals:', error);
    return null;
  }
}, []);

  // Función para ir al checkout
  const goToCheckout = useCallback(async () => {
    // Always fetch fresh cart totals before saving
    const freshCartTotals = await fetchCartTotals();
    
    // Save the fresh cart totals to localStorage
    const dataToSave = freshCartTotals || cartTotals;
    localStorage.setItem('CartPrices', JSON.stringify(dataToSave));
    
    onClose();
    navigate('/checkout');
  }, [navigate, cartTotals, fetchCartTotals, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="bg-black bg-opacity-50 absolute inset-0" onClick={onClose}></div>
      
      <div 
        ref={cartRef}
        className="relative bg-white w-full max-w-md h-full flex flex-col shadow-xl overflow-hidden"
        style={{ maxHeight: '100vh' }}
      >
        {/* Cabecera del carrito */}
        <div className="px-4 py-1.5 bg-gray-800 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Mi Carrito de Compras
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700 transition-colors">
            <svg className="w-10 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Contenido del carrito */}
        <div className="flex-grow overflow-y-auto p-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-500">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-lg font-medium mb-2">Tu carrito está vacío</p>
              <p className="text-sm text-center mb-4">Agrega libros a tu carrito para comprarlos.</p>
              <button 
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                onClick={() => {
                  onClose();
                  navigate('/home');
                }}
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={item.bookDetails?._id} className="flex border-b pb-4">
                  {/* Imagen del libro - Ahora usando CachedImage */}
                  <div className="w-20 h-24 flex-shrink-0 bg-gray-100 overflow-hidden">
                    {item.bookDetails?.imagenes && item.bookDetails.imagenes.length > 0 ? (
                      <CachedImage 
                        src={item.bookDetails.imagenes[0].url} 
                        alt={item.bookDetails.titulo || "Libro"} 
                        className="w-full h-full object-contain"
                        fallbackSrc={`${process.env.REACT_APP_API_URL}/uploads/libros/Default.png`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Información del libro */}
                  <div className="ml-4 flex-grow">
                    <div className="flex justify-between">
                      <h3 className="font-medium text-sm line-clamp-2">{item.bookDetails?.titulo}</h3>
                      <button 
                        className="text-gray-400 hover:text-red-500"
                        onClick={() => removeItem(item, item.bookId._id)}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-1">{item.bookDetails?.autor_nombre_completo}</p>
                    
                    {/* Precio */}
                    <div className="flex items-center mb-2">
                      {item.bookId?.precio_info?.precio_base && 
                      item.bookId.precio_info.precio_base !== item.bookId.precio ? (
                        <div className="flex flex-col">
                          <span className="text-xs line-through text-gray-500">
                            ${item.bookId.precio_info.precio_base.toLocaleString('es-CO')}
                          </span>
                          <span className="text-sm font-bold text-red-600">
                            ${item.bookId.precio.toLocaleString('es-CO')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold">
                          ${item.bookId?.precio?.toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                    
                    {/* Control de cantidad */}
                    <div className="flex items-center">
                      <button 
                        className="w-8 h-8 flex items-center justify-center border rounded-l bg-gray-100 hover:bg-gray-200"
                        onClick={() => updateQuantity(item.itemId, item.quantity - 1, item)}
                        disabled={updatingQuantity[item.bookId]} 
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <input 
                        type="number" 
                        min="1" 
                        value={item.quantity} 
                        onChange={(e) => updateQuantity(item.bookDetails?._id, parseInt(e.target.value))}
                        className="w-10 h-8 text-center border-t border-b"
                         disabled={updatingQuantity[item.bookId]}
                      />
                      <button 
                        className="w-8 h-8 flex items-center justify-center border rounded-r bg-gray-100 hover:bg-gray-200"
                        onClick={() => updateQuantity(item.itemId, item.quantity + 1, item)}
                        disabled={updatingQuantity[item.bookId]}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Resumen y botones de acción */}
        <div className="border-t p-4 bg-gray-50">
          {cartItems.length > 0 && (
            <>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Subtotal</span>
                <div className="flex flex-col items-end">
          {/* Show base subtotal crossed out if there are any discounts */}
          {cartItems.some(item => 
            cartTotals.totales.subtotal_base && 
            cartTotals.totales.subtotal_base !== cartTotals.totales.subtotal_con_descuentos
          ) && (
            <span className="text-xs line-through text-gray-500">
              ${cartTotals.totales.subtotal_base.toLocaleString('es-CO')}
            </span>
          )}
          <span className="font-bold text-red-600">
            ${cartTotals.totales.subtotal_con_descuentos.toLocaleString('es-CO')}
          </span>
        </div>
      </div>
      <div className="flex justify-between mb-4">
        <span className="text-gray-600">Envío</span>
        <span className="text-green-600 font-medium">Gratis</span>
      </div>
      <div className="h-px bg-gray-300 mb-4"></div>
      <div className="flex justify-between mb-6">
        <span className="text-lg font-bold">Total</span>
        <span className="text-lg font-bold">${cartTotals.totales.subtotal_con_descuentos.toLocaleString('es-CO')}</span>
      </div>
    </>
  )}
          
          <div className="grid grid-cols-2 gap-4">
            {cartItems.length > 0 ? (
              <>
                <button 
                  className="bg-white border border-red-600 text-red-600 py-2 px-4 rounded hover:bg-red-50"
                  onClick={clearCart}
                >
                  Vaciar carrito
                </button>
                <button 
                  className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                  onClick={goToCheckout}
                >
                  Proceder al pago
                </button>
              </>
            ) : (
              <button 
                className="col-span-2 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                onClick={() => {
                  onClose();
                  navigate('/home');
                }}
              >
                Seguir comprando
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShoppingCart;