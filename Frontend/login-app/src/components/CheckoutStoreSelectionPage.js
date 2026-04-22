import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from './UserLayout';
import axios from 'axios';
import { getAuthToken } from './UserProfilePageComponents/authUtils';

const CheckoutStoreSelectionPage = () => {
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [cartPrices, setCartPrices] = useState({});
  const [availableStores, setAvailableStores] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState(null);
  const [redirectTo, setRedirectTo] = useState(null);

  // Pricing states
  const [subtotal, setSubtotal] = useState(0);
  const [taxes, setTaxes] = useState(0);
  const [total, setTotal] = useState(0);

  // Efecto para manejar la redirección
  useEffect(() => {
    if (redirectTo) {
      navigate(redirectTo);
    }
  }, [redirectTo, navigate]);

  // Function to fetch stores from API
  const fetchStores = async () => {
    setStoresLoading(true);
    setStoresError(null);
    
    try {
      // Try different possible endpoints for public store listing
      let response;
      try {
        // First try a public endpoint
        response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/tiendas/publicas`, {
          params: {
            estado: 'activa',
            recogida_productos: true
          }
        });
      } catch (error) {
        // If public endpoint doesn't exist, try the general tiendas endpoint
        if (error.response?.status === 404) {
          response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/tiendas`, {
            params: {
              estado: 'activa',
              recogida_productos: true
            }
          });
        } else {
          throw error;
        }
      }

      if (response.data.status === 'success') {
        // Transform API data to match our component structure
        const transformedStores = response.data.data.map(store => ({
          id: store._id,
          id_tienda: store.id_tienda,
          nombre: store.nombre,
          codigo: store.codigo,
          direccion: store.direccion?.direccion_completa || 'Dirección no disponible',
          ciudad: store.direccion?.ciudad || '',
          departamento: store.direccion?.departamento || '',
          telefono: store.telefono_principal || 'No disponible',
          email: store.email || '',
          horario: 'Lu a Sá: 9 a 19 hs.', // Default since not provided in API
          distancia: '-- km', // Would need geolocation to calculate
          coordenadas: store.coordenadas || {},
          estado: store.estado,
          servicios: store.servicios || {},
          responsable: store.responsable || {}
        }));
        
        setAvailableStores(transformedStores);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      setStoresError('No se pudieron cargar las tiendas. Usando datos locales.');
      
      // Fallback to hardcoded stores if API fails
      const fallbackStores = [
        { 
          id: 'TIENDA12345678901', 
          id_tienda: 'TIENDA12345678901',
          nombre: 'Sede Principal - Centro', 
          direccion: 'Carrera 8 #23-45', 
          ciudad: 'Pereira',
          departamento: 'Risaralda',
          telefono: '3332221',
          horario: 'Lu a Sá: 9 a 19 hs.',
          distancia: '0 mts.',
          coordenadas: { latitud: 4.8126, longitud: -75.6946 },
          estado: 'activa'
        },
        { 
          id: 'TIENDA12345678902', 
          id_tienda: 'TIENDA12345678902',
          nombre: 'Sede Circunvalar', 
          direccion: 'Av. Circunvalar #9-42', 
          ciudad: 'Pereira',
          departamento: 'Risaralda',
          telefono: '3332222',
          horario: 'Lu a Sá: 10 a 20 hs.',
          distancia: '1.2 km',
          coordenadas: { latitud: 4.8145, longitud: -75.6896 },
          estado: 'activa'
        },
        { 
          id: 'TIENDA12345678903', 
          id_tienda: 'TIENDA12345678903',
          nombre: 'Centro Comercial Victoria', 
          direccion: 'C.C. Victoria Plaza Local 235', 
          ciudad: 'Pereira',
          departamento: 'Risaralda',
          telefono: '3332223',
          horario: 'Lu a Do: 10 a 20 hs.',
          distancia: '581 mts.',
          coordenadas: { latitud: 4.8156, longitud: -75.6936 },
          estado: 'activa'
        }
      ];
      setAvailableStores(fallbackStores);
    } finally {
      setStoresLoading(false);
    }
  };

  // Filtrar tiendas basadas en la búsqueda
  const filteredStores = availableStores.filter(store => 
    store.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.direccion.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.ciudad.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Validation and data loading
  useEffect(() => {
    const validateAndLoadData = async () => {
      setIsLoading(true);
      try {
        // VALIDATION: Check if shippingPreferences exists and method is "recogida_tienda"
        const shippingPrefs = localStorage.getItem('shippingPreferences');
        if (!shippingPrefs) {
          // No shipping preferences, check what data exists and navigate accordingly
          const storedCart = localStorage.getItem('shoppingCart');
          const storedPrices = localStorage.getItem('CartPrices');
          
          if (storedCart && storedCart !== "[]" && storedPrices) {
            // Has cart data, go back to delivery page
            navigate('/checkout');
            return;
          } else {
            // No cart data, go to home
            navigate('/home');
            return;
          }
        }

        const parsedPrefs = JSON.parse(shippingPrefs);
        if (parsedPrefs.method !== 'recogida_tienda') {
          // Wrong shipping method, redirect back to delivery page
          navigate('/checkout');
          return;
        }

        // If we get here, validation passed, load the rest of the data
        
        // Obtener carrito del localStorage
        const storedCart = localStorage.getItem('shoppingCart');
        if (!storedCart || storedCart === "[]") {
          navigate('/home');
          return;
        }

        const parsedCart = JSON.parse(storedCart);
        if (!Array.isArray(parsedCart) || parsedCart.length === 0) {
          navigate('/home');
          return;
        }
        setCartItems(parsedCart);
        
        // Get cart prices - THIS IS THE SINGLE SOURCE OF TRUTH (copied from delivery page)
        const storedPrices = localStorage.getItem('CartPrices');
        if (storedPrices) {
          const parsedPrices = JSON.parse(storedPrices);
          setCartPrices(parsedPrices);
          
          // Check if subtotal_base is 0 and navigate to home if true
          if (parsedPrices.subtotal_base === 0) {
            navigate('/home');
            return;
          }
          
          // Set prices from stored data only
          setSubtotal(parsedPrices.subtotal_con_descuentos || 0);
          setTaxes(parsedPrices.total_impuestos || 0);
          // Store pickup has no shipping cost, so total = subtotal + taxes
          setTotal((parsedPrices.subtotal_con_descuentos || 0) + (parsedPrices.total_impuestos || 0));
        } else {
          // No cart prices, navigate to home
          navigate('/home');
          return;
        }
        
        // Verificar si ya había seleccionado una tienda antes
        if (parsedPrefs.storeId) {
          // Find store by id_tienda or _id
          const preSelectedStore = availableStores.find(store => 
            store.id === parsedPrefs.storeId || store.id_tienda === parsedPrefs.storeId
          );
          if (preSelectedStore) {
            setSelectedStore(preSelectedStore);
          }
        }
        
        // Load stores from API
        await fetchStores();
        
      } catch (error) {
        console.error('Error al cargar datos del carrito:', error);
        navigate('/home');
      } finally {
        setIsLoading(false);
      }
    };

    validateAndLoadData();
  }, [navigate]);

  // Update selected store when stores are loaded and there was a pre-selected store
  useEffect(() => {
    if (availableStores.length > 0) {
      const shippingPrefs = localStorage.getItem('shippingPreferences');
      if (shippingPrefs) {
        const parsedPrefs = JSON.parse(shippingPrefs);
        if (parsedPrefs.storeId && !selectedStore) {
          const preSelectedStore = availableStores.find(store => 
            store.id === parsedPrefs.storeId || store.id_tienda === parsedPrefs.storeId
          );
          if (preSelectedStore) {
            setSelectedStore(preSelectedStore);
          }
        }
      }
    }
  }, [availableStores, selectedStore]);

  // Back button function - goes back to delivery page
  const handleBack = () => {
    // Delete shippingPreferences since we're going back to delivery page
    localStorage.removeItem('shippingPreferences');
    navigate('/checkout');
  };

  // Cancel button function
  const handleCancel = () => {
    // Delete required data and navigate to home
    localStorage.removeItem('shippingPreferences');
    localStorage.removeItem('tempPaymentInfo');
    navigate('/home');
  };

  // Seleccionar una tienda
  const handleSelectStore = (store) => {
    console.log("Selected:", store);
    setSelectedStore(store);
  };

  // Confirmar selección y continuar
  const handleConfirm = () => {
    if (!selectedStore) {
      alert('Por favor selecciona una tienda para continuar');
      return;
    }
    
    try {
      // Actualizar preferencias de envío
      const currentPrefs = localStorage.getItem('shippingPreferences')
        ? JSON.parse(localStorage.getItem('shippingPreferences'))
        : {};
      
      
      const updatedPrefs = {
        ...currentPrefs,
        storeId: selectedStore.id_tienda || selectedStore.id, // Use id_tienda if available, fallback to id
        storeName: selectedStore.nombre,
        storeAddress: selectedStore.direccion,
        storeCity: selectedStore.ciudad,
        storeDepartment: selectedStore.departamento
      };
      
      console.log("Selected:", selectedStore);
      // Guardar en localStorage antes de navegar
      localStorage.setItem('shippingPreferences', JSON.stringify(updatedPrefs));
      console.log("Preferencias de envío actualizadas:", updatedPrefs);
      
      // Navigate to payment page
      navigate('/checkout/payment');
    } catch (error) {
      console.error("Error al confirmar la tienda:", error);
      alert("Ha ocurrido un error al procesar su selección. Por favor intente nuevamente.");
    }
  };

  if (isLoading) {
    return (
      <UserLayout>
        <div className="bg-gray-100 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando información...</p>
          </div>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="bg-gray-100 min-h-screen">
        <div className="container mx-auto py-8 px-4">
          {/* Navigation Buttons */}
          <div className="mb-4 flex gap-3">
            <button 
              onClick={handleBack}
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              ← Volver
            </button>
            <button 
              onClick={handleCancel}
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Cancelar compra
            </button>
          </div>

          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Seleccionar tienda de recogida</h1>
          
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Columna izquierda - Lista de tiendas y búsqueda */}
            <div className="lg:w-3/5 space-y-4">
              {/* Barra de búsqueda */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Busca una ubicación"
                    className="pl-10 pr-4 py-2 border rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center mt-3 space-x-2">
                  <button className="px-4 py-1 text-sm border rounded-full text-gray-700 hover:bg-gray-50">
                    Cierra tarde
                  </button>
                  <button className="px-4 py-1 text-sm text-blue-600 hover:underline">
                    Más filtros
                  </button>
                </div>
              </div>
              
              {/* Error message for stores */}
              {storesError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">{storesError}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Lista de tiendas */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  {storesLoading ? (
                    <div className="p-6 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-500">Cargando tiendas...</p>
                    </div>
                  ) : filteredStores.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {filteredStores.map((store) => (
                        <div 
                          key={store.id} 
                          className={`p-4 hover:bg-gray-50 transition ${selectedStore?.id === store.id ? 'border-l-4 border-blue-500 bg-blue-50' : ''}`}
                        >
                          <h3 className="font-bold text-gray-800">{store.nombre}</h3>
                          <p className="text-gray-600 text-sm mt-1">
                            {store.direccion}, {store.ciudad}
                            {store.departamento && `, ${store.departamento}`}
                            {store.distancia && ` - a ${store.distancia}`}
                          </p>
                          <p className="text-gray-500 text-sm mt-1">{store.horario}</p>
                          {store.telefono && store.telefono !== 'No disponible' && (
                            <p className="text-gray-500 text-sm">Tel: {store.telefono}</p>
                          )}
                          
                          <div className="mt-3 flex justify-between items-center">
                            <p className="text-sm text-gray-500">
                              {store.estado === 'activa' ? 'Disponible para recogida' : 'No disponible'}
                            </p>
                            <button
                              className={`px-4 py-1.5 rounded text-sm font-medium ${
                                selectedStore?.id === store.id
                                  ? 'bg-blue-600 text-white'
                                  : store.estado === 'activa' 
                                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                              onClick={() => store.estado === 'activa' && handleSelectStore(store)}
                              disabled={store.estado !== 'activa'}
                            >
                              {selectedStore?.id === store.id ? 'Seleccionada' : 'Elegir'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      {searchQuery ? 'No se encontraron tiendas que coincidan con tu búsqueda' : 'No hay tiendas disponibles'}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Columna derecha - Mapa y resumen */}
            <div className="lg:w-2/5 space-y-4">
              {/* Mapa */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="h-[400px] w-full bg-gray-200 relative">
                  {/* Mapa simplificado */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-300">
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm">Mapa de ubicaciones de tiendas</p>
                      <p className="text-xs mt-1">(Integración con Google Maps en implementación final)</p>
                    </div>
                  </div>
                  
                  {/* Controles de zoom simplificados */}
                  <div className="absolute right-4 bottom-20 flex flex-col bg-white rounded-md shadow">
                    <button className="p-2 hover:bg-gray-100 border-b">
                      <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-gray-100">
                      <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Información de tienda seleccionada */}
                {selectedStore && (
                  <div className="p-4 border-t">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-bold">{selectedStore.nombre}</h3>
                        <div className="grid grid-cols-1 gap-y-2 mt-2">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Dirección</p>
                            <p className="text-sm">{selectedStore.direccion}</p>
                            {selectedStore.ciudad && (
                              <p className="text-sm">{selectedStore.ciudad}{selectedStore.departamento && `, ${selectedStore.departamento}`}</p>
                            )}
                          </div>
                          {selectedStore.telefono && selectedStore.telefono !== 'No disponible' && (
                            <div>
                              <p className="text-sm font-medium text-gray-500">Teléfono</p>
                              <p className="text-sm">{selectedStore.telefono}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-500">Horario</p>
                            <p className="text-sm">{selectedStore.horario}</p>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={handleConfirm}
                        type="button"
                        className="ml-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Resumen de compra */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-4">Resumen de compra</h2>
                <div className="border-b pb-4 mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Producto{cartItems.length !== 1 ? 's' : ''}</span>
                    <span>$ {subtotal.toLocaleString('es-CO')}</span>
                  </div>
                  
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Impuestos</span>
                    <span>$ {taxes.toLocaleString('es-CO')}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Retiro</span>
                    <span className="text-green-600">Gratis</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center font-bold">
                  <span>Total</span>
                  <span>$ {total.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default CheckoutStoreSelectionPage;