import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CachedImage from '../CachedImage';
import { getAuthToken } from './authUtils';
import { UpdateQuantityBook } from '../cartUtils';

const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;

const CartPage = ({ updateCartCount }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingQuantity, setUpdatingQuantity] = useState({});
  const [cartTotals, setCartTotals] = useState({});
  const navigate = useNavigate();
  
  
  // SOLUCIÓN 1: Usar useRef para controlar si ya se hizo la carga inicial
  const hasLoadedInitially = useRef(false);

  

  // SOLUCIÓN 2: Memoizar la función de carga para evitar recreaciones
  const fetchCartItems = useCallback(async () => {
    // Evitar múltiples llamadas simultáneas
    if (isLoading && hasLoadedInitially.current) {
      return;
    }

    setIsLoading(true);
    setError(null);
    localStorage.removeItem('shoppingCart');
    
    try {
      console.log('Fetching cart data from API...');
      
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
            stock: item.id_libro.stock_disponible_consolidado ? item.id_libro.stock_disponible_consolidado : 0,
            editorial: '',
            estado: 'nuevo',
            anio_publicacion: ''
          },
          itemId: item._id,
          subtotal: item.subtotal
        }));

        console.log("Item", items);
       
        setCartItems(cartWithDetails);
        
        const localStorageCart = cartWithDetails.map(item => ({
          bookId: item.bookId,
          quantity: item.quantity
        }));
        
        localStorage.setItem('shoppingCart', JSON.stringify(localStorageCart));
        localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
        
        // Dispatch events
        const cartChangeEvent = new CustomEvent('cartUpdated', {
          bubbles: true,
          detail: {
            action: 'sync',
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(cartChangeEvent);
        window.dispatchEvent(new Event('globalCartUpdate'));
       
        // SOLUCIÓN 3: Solo actualizar cartCount si la función existe y tenemos datos válidos
        if (updateCartCount && typeof updateCartCount === 'function') {
          updateCartCount(carrito.n_item);
        }
      } else {
        setCartItems([]);
        localStorage.removeItem('shoppingCart');
        localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
        
        if (updateCartCount && typeof updateCartCount === 'function') {
          updateCartCount(0);
        }
      }
    } catch (error) {
      console.error('Error al cargar carrito desde API:', error);
      if (error.response?.status === 401) {
        setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else {
        setError('Ocurrió un error al cargar los elementos del carrito. Por favor, intenta de nuevo más tarde.');
      }
    } finally {
      setIsLoading(false);
      hasLoadedInitially.current = true;
    }
  }, []); // SOLUCIÓN 4: Dependencias vacías para evitar ejecuciones innecesarias

  // SOLUCIÓN 5: useEffect simplificado que solo se ejecuta una vez al montar
  useEffect(() => {
    if (!hasLoadedInitially.current) {
      fetchCartItems();
    }
  }, []); // Solo se ejecuta al montar el componente

  const fetchCartTotals = useCallback(async () => {
  try {
    const responseTotal = await axios.get(`${API_BASE_URL}/carrito/total`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (responseTotal.data.status === 'success' && responseTotal.data.data) {
      //console.log("total:", responseTotal);
      return responseTotal.data.data.totales;;
    }
    return null;
  } catch (error) {
    console.error('Error fetching cart totals:', error);
    return null;
  }
}, []);

  // Función para calcular el subtotal
  const calculateSubtotal = useCallback(async () => {
  // Try to get totals from API first
  const apiTotals = await fetchCartTotals();
  //console.log("apitotal", apiTotals);
  
  if (apiTotals) {
    setCartTotals(apiTotals);
    //console.log("Cartotals:", apiTotals); // Fixed: log apiTotals instead of cartTotals
    return apiTotals;
  }

  // Fallback to local calculation if API fails
  const fallbackTotal = cartItems.reduce((total, item) => {
    const price = item.bookDetails?.precio || 0;
    return total + (price * item.quantity);
  }, 0);
  
  const fallbackTotals = {
    subtotal_base: fallbackTotal,
    subtotal_con_descuentos: fallbackTotal,
    total_descuentos: 0,
    total_impuestos: 0,
    costo_envio: 0,
    total_final: fallbackTotal,
    codigos_aplicados: [],
    problemas: { precio_cambiado: 0, sin_stock: 0 }
  };
  
  
  setCartTotals(fallbackTotals);
  return fallbackTotals;
}, [cartItems, fetchCartTotals]);

useEffect(() => {
  if (cartItems.length > 0) {
    calculateSubtotal();
  } else {
    setCartTotals({});
  }
}, [cartItems, calculateSubtotal]);

  // SOLUCIÓN 6: Memoizar updateQuantity para evitar recreaciones
  const updateQuantity = useCallback(async (itemId, newQuantity, item) => {
    if (newQuantity < 1) return;
    
    console.log("Edit quantity:", itemId, newQuantity, item);
    
    setUpdatingQuantity(prev => ({ ...prev, [itemId]: true }));
    
    try {
      const result = await UpdateQuantityBook(item.bookId._id, newQuantity);

      if(result === "success"){
        const updatedCart = cartItems.map(cartItem => 
          cartItem.itemId === itemId 
            ? { ...cartItem, quantity: newQuantity }
            : cartItem
        );
        
        setCartItems(updatedCart);
        
        const simplifiedCart = updatedCart.map(item => ({
          bookId: item.bookId,
          quantity: item.quantity
        }));
        
        localStorage.setItem('shoppingCart', JSON.stringify(simplifiedCart));
        
        if (updateCartCount && typeof updateCartCount === 'function') {
          updateCartCount(simplifiedCart.reduce((total, item) => total + item.quantity, 0));
        }
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setUpdatingQuantity(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    }
  }, [cartItems, updateCartCount]);

  // SOLUCIÓN 7: Memoizar removeItem
  const removeItem = useCallback(async (itemId, bookId) => {

    console.log("Delete:",itemId);
  try {
    // Call API to remove item from server
    await axios.delete(`${API_BASE_URL}/carrito/item/${bookId}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    // Update local state and localStorage
    const updatedCart = cartItems.filter(item => item.itemId !== itemId);
    setCartItems(updatedCart);
    
    const simplifiedCart = updatedCart.map(item => ({
      bookId: item.bookId,
      quantity: item.quantity
    }));
    
    localStorage.setItem('shoppingCart', JSON.stringify(simplifiedCart));
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    if (updateCartCount && typeof updateCartCount === 'function') {
      updateCartCount(simplifiedCart.reduce((total, item) => total + item.quantity, 0));
    }

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

  } catch (error) {
    console.error('Error removing item from cart:', error);
    // Still update UI even if API call fails to maintain consistency
    const updatedCart = cartItems.filter(item => item.itemId !== itemId);
    setCartItems(updatedCart);
    
    const simplifiedCart = updatedCart.map(item => ({
      bookId: item.bookId,
      quantity: item.quantity
    }));
    
    localStorage.setItem('shoppingCart', JSON.stringify(simplifiedCart));
    
    if (updateCartCount && typeof updateCartCount === 'function') {
      updateCartCount(simplifiedCart.reduce((total, item) => total + item.quantity, 0));
    }
  }
}, [cartItems, updateCartCount]);

  // SOLUCIÓN 8: Memoizar clearCart
  const clearCart = useCallback(async () => {
  try {
    // Call API to clear entire cart from server
    await axios.delete(`${API_BASE_URL}/carrito`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    // Clear local state and localStorage
    setCartItems([]);
    localStorage.removeItem('shoppingCart');
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    if (updateCartCount && typeof updateCartCount === 'function') {
      updateCartCount(0);
    }

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

  } catch (error) {
    console.error('Error clearing cart:', error);
    // Still update UI even if API call fails
    setCartItems([]);
    localStorage.removeItem('shoppingCart');
    localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
    
    if (updateCartCount && typeof updateCartCount === 'function') {
      updateCartCount(0);
    }
  }
}, [updateCartCount]);





  const goToCheckout = useCallback(async () => {
    // Always fetch fresh cart totals before saving
    const freshCartTotals = await fetchCartTotals();
    
    // Save the fresh cart totals to localStorage
    const dataToSave = freshCartTotals || cartTotals;
    localStorage.setItem('CartPrices', JSON.stringify(dataToSave));
    
    navigate('/checkout');
  }, [navigate, cartTotals, fetchCartTotals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando elementos del carrito...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center bg-red-100 p-6 rounded-lg max-w-md">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-700">{error}</p>
          <button 
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            onClick={() => {
              hasLoadedInitially.current = false;
              fetchCartItems();
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white p-8 rounded-lg shadow-sm">
        <svg className="w-24 h-24 text-gray-400 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-700 mb-2">Tu carrito está vacío</h2>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          No tienes productos en tu carrito de compras. Explora nuestro catálogo y agrega los libros que desees comprar.
        </p>
        <button 
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          onClick={() => navigate('/home')}
        >
          Explorar catálogo
        </button>
      </div>
    );
  }

  const customScrollbarStyle = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #a1a1a1;
    }
    
    .custom-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: #c1c1c1 #f1f1f1;
    }

    input[type="number"]::-webkit-outer-spin-button,
    input[type="number"]::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    
    input[type="number"] {
      -moz-appearance: textfield;
    }
  `;  

  return (
    <div className="h-full bg-gray-50">
      <style>{customScrollbarStyle}</style>
      
      <div className="max-w-6xl mx-auto p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Mi Carrito de Compras</h2>
          <button 
            className="text-red-600 flex items-center hover:text-red-700 text-sm"
            onClick={clearCart}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Vaciar carrito
          </button>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-6 flex-grow">
          <div className="w-full lg:w-2/3 h-full">
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-700">Productos ({cartItems.length})</h3>
              </div>
              
              <div className="flex-grow overflow-y-auto custom-scrollbar">
                <div className="divide-y divide-gray-200">
                  {cartItems.map((item) => (
                    <div key={item.bookDetails?._id} className="p-4 flex flex-col sm:flex-row gap-4">
                      <div className="w-24 h-32 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
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
                      
                      <div className="flex-grow">
                        <div className="flex justify-between">
                          <div>
                            <h4 className="font-medium text-gray-800">{item.bookDetails?.titulo}</h4>
                            <p className="text-sm text-gray-600 mb-1">{item.bookDetails?.autor_nombre_completo}</p>
                            
                            {item.bookDetails?.editorial && (
                              <p className="text-xs text-gray-500 mb-2">
                                {item.bookDetails.editorial}, {item.bookDetails.estado === 'nuevo' ? 'Nuevo' : 'Usado'}
                                {item.bookDetails.anio_publicacion ? `, ${item.bookDetails.anio_publicacion}` : ''}
                              </p>
                            )}
                            
                            {item.bookDetails?.stock > 0 ? (
                              <p className="text-xs text-green-600 mb-2">
                                Disponible: {item.bookDetails.stock} unidades
                              </p>
                            ) : (
                              <p className="text-xs text-red-600 mb-2">
                                Agotado
                              </p>
                            )}
                          </div>
                          
                          <button 
                            className="w-2 h-3 text-gray-400 hover:text-red-500"
                            onClick={() => removeItem(item.itemId, item.bookId._id)}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4">
                          <div className="mb-3 sm:mb-0">
                            {item.bookId?.precio_info?.precio_base && 
                            item.bookId.precio_info.precio_base !== item.bookId.precio ? (
                              <div className="flex flex-col">
                                <span className="text-sm line-through text-gray-500">
                                  ${item.bookId.precio_info.precio_base.toLocaleString('es-CO')}
                                </span>
                                <span className="text-lg font-bold text-red-600">
                                  ${item.bookId.precio.toLocaleString('es-CO')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-lg font-bold">
                                ${item.bookId.precio?.toLocaleString('es-CO')}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center">
                            <span className="text-sm text-gray-600 mr-3">Cantidad:</span>
                            <div className="flex border border-gray-300 rounded">
                              <button 
                                className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                                onClick={() => updateQuantity(item.itemId, item.quantity - 1, item)}
                                disabled={updatingQuantity[item.itemId]}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                              </button>
                              
                              {updatingQuantity[item.itemId] ? (
                                <div className="w-12 h-8 flex items-center justify-center border-x border-gray-300">
                                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              ) : (
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={item.quantity} 
                                  onChange={(e) => updateQuantity(item.itemId, parseInt(e.target.value) || 1, item)}
                                  className="w-12 h-8 text-center border-x border-gray-300 appearance-none"
                                  style={{
                                    MozAppearance: 'textfield',
                                    WebkitAppearance: 'none',
                                    margin: 0
                                  }}
                                  disabled={updatingQuantity[item.itemId]}
                                />
                              )}
                              
                              <button 
                                className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                                onClick={() => updateQuantity(item.itemId, item.quantity + 1, item)}
                                disabled={updatingQuantity[item.itemId]}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full lg:w-1/3 lg:h-auto">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden sticky top-6">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-700">Resumen de la compra</h3>
              </div>
              <div className="p-4">
                <div className="space-y-3 mb-4">
  <div className="flex justify-between">
    <span className="text-gray-600">Subtotal</span>
    <div className="flex items-center gap-2">
      {cartTotals?.subtotal_base && cartTotals?.subtotal_con_descuentos && 
       cartTotals.subtotal_base !== cartTotals.subtotal_con_descuentos ? (
        <>
          <span className="text-sm line-through text-gray-500">
            ${cartTotals.subtotal_base.toLocaleString('es-CO')}
          </span>
          <span className="font-medium text-red-600">
            ${cartTotals.subtotal_con_descuentos.toLocaleString('es-CO')}
          </span>
        </>
      ) : (
        <span className="font-medium">
          ${cartTotals?.subtotal_con_descuentos ? cartTotals.subtotal_con_descuentos.toLocaleString('es-CO') : '0'}
        </span>
      )}
    </div>
  </div>
  
  {cartTotals && cartTotals.total_descuentos > 0 && (
    <div className="flex justify-between text-green-600">
      <span>Descuento:</span>
      <span>-${cartTotals.total_descuentos.toLocaleString('es-CO')}</span>
    </div>
  )}
  
  {cartTotals && cartTotals.total_impuestos > 0 && (
    <div className="flex justify-between">
      <span className="text-gray-600">Impuestos:</span>
      <span className="font-medium">${cartTotals.total_impuestos.toLocaleString('es-CO')}</span>
    </div>
  )}
  
  <div className="flex justify-between">
    <span className="text-gray-600">Envío</span>
    <span className="text-green-600">
      {cartTotals && cartTotals.costo_envio > 0 
        ? `${cartTotals.costo_envio.toLocaleString('es-CO')}` 
        : 'Gratis'
      }
    </span>
  </div>
  <div className="flex justify-between pt-3 border-t border-gray-200">
    <span className="text-lg font-bold">Total</span>
    <span className="text-lg font-bold">
      ${cartTotals?.total_final ? cartTotals.total_final.toLocaleString('es-CO') : '0'}
    </span>
  </div>
{/* 
                  {cartTotals && (cartTotals.problemas.precio_cambiado > 0 || cartTotals.problemas.sin_stock > 0) && (
                  <div className="text-xs text-orange-600 mt-2 p-2 bg-orange-50 rounded">
                    {cartTotals.problemas.precio_cambiado > 0 && (
                      <div>⚠️ {cartTotals.problemas.precio_cambiado} productos con precio modificado</div>
                    )}
                    {cartTotals.problemas.sin_stock > 0 && (
                      <div>⚠️ {cartTotals.problemas.sin_stock} productos sin stock</div>
                    )}
                  </div>
                )} */}
                </div>

                <button 
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  onClick={goToCheckout}
                >
                  Proceder al pago
                </button>
                
                <p className="text-xs text-gray-500 text-center mt-4">
                  Los precios y disponibilidad están sujetos a cambios. La entrega está disponible únicamente en Colombia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;