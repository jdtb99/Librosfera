import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from './UserLayout';
import axios from 'axios';
import { getAuthToken } from './UserProfilePageComponents/authUtils';

const CheckoutDeliveryPage = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [cartPrices, setCartPrices] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [userAddresses, setUserAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  
  // Resumen de compra - Only read from localStorage, don't calculate
  const [subtotal, setSubtotal] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [taxes, setTaxes] = useState(0);
  const [total, setTotal] = useState(0);

  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  // Ubicación del usuario
  const [userLocation, setUserLocation] = useState({
    City: '',
    State: '',
    Country: '',
    Postal: '',
    Street: '',
  });

  // Function to fetch user addresses
  const fetchUserAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/direcciones`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`
        }
      });
      
      if (response.data.status === 'success') {
        setUserAddresses(response.data.data);
        // Set default address if exists
        const defaultAddress = response.data.data.find(addr => addr.predeterminada);
        if (defaultAddress) {
          setSelectedAddress(defaultAddress);
          setUserLocation({
            City: defaultAddress.ciudad,
            State: defaultAddress.departamento,
            Country: defaultAddress.pais,
            Postal: defaultAddress.codigo_postal,
            Street: defaultAddress.calle
          });
        } else if (response.data.data.length > 0) {
          // If no default address, select the first one
          const firstAddress = response.data.data[0];
          setSelectedAddress(firstAddress);
          setUserLocation({
            City: firstAddress.ciudad,
            State: firstAddress.departamento,
            Country: firstAddress.pais,
            Postal: firstAddress.codigo_postal,
            Street: firstAddress.calle
          });
        }
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  // Load data from localStorage - simplified and consistent
  useEffect(() => {
    const loadCheckoutData = () => {
      setIsLoading(true);
      
      try {
        // Get cart items - VALIDATION REQUIRED
        const storedCart = localStorage.getItem('shoppingCart');
        if (!storedCart || storedCart === "[]") {
          // If cart is empty, navigate to home immediately
          navigate('/home');
          return;
        }
        
        const parsedCart = JSON.parse(storedCart);
        if (!Array.isArray(parsedCart) || parsedCart.length === 0) {
          navigate('/home');
          return;
        }
        setCartItems(parsedCart);
        
        // Get cart prices - THIS IS THE SINGLE SOURCE OF TRUTH
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
          // Don't set total here - let delivery method effect handle it
        } else {
          // No cart prices, navigate to home
          navigate('/home');
          return;
        }
        
        // Get user location
        const userData = localStorage.getItem('userData');
        if (userData) {
          const parsedUserData = JSON.parse(userData);
          setUserLocation({
            ciudad: parsedUserData.ciudad || 'Pereira',
            departamento: parsedUserData.departamento || 'Risaralda'
          });
        }
        
      } catch (error) {
        console.error('Error loading checkout data:', error);
        navigate('/home');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCheckoutData();
  }, [navigate]);

  // Update shipping cost and total when delivery method changes
  useEffect(() => {
    if (deliveryMethod === 'domicilio') {
      const cost = 7000;
      setShippingCost(cost);
      setTotal(subtotal + cost + taxes);
    } else if (deliveryMethod === 'recogida_tienda') {
      setShippingCost(0);
      setTotal(subtotal + taxes);
    }
  }, [deliveryMethod, subtotal, taxes, userLocation]);

  // Handle delivery method change
  const handleDeliveryMethodChange = (method) => {
    if(method == 'domicilio'){
      setShowAddressDropdown(true);
      fetchUserAddresses();
      
      const Usdata = getCookie('data');
     
      // console.log("usdata:", Usdata);

      // Parse the user data if it's a string
      let userData;
      try {
        userData = typeof Usdata === 'string' ? JSON.parse(Usdata) : Usdata;
      } catch (error) {
        console.error('Error parsing user data:', error);
        userData = null;
      }

      // Extract address information from user data
      if (userData && userData.Data && userData.Data.direcciones && userData.Data.direcciones.length > 0) {
        // Get the first address from the user's addresses array
        const firstAddress = userData.Data.direcciones[0];

        console.log("First:", firstAddress);

        setUserLocation({
          City: firstAddress.ciudad || '',
          State: '', // Not available in the cookie data
          Country: firstAddress.pais || '',
          Postal: firstAddress.codigo_postal || '',
          Street: firstAddress.calle || ''
        });
      }
    } else {
      setShowAddressDropdown(false);
    }

    setDeliveryMethod(method);
  };

  // Handle address selection
  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
    setUserLocation({
      City: address.ciudad,
      State: address.departamento,
      Country: address.pais,
      Postal: address.codigo_postal,
      Street: address.calle
    });
  };

  // Cancel button function
  const handleCancel = () => {
    // Delete required data and navigate to home
    localStorage.removeItem('shippingPreferences');
    localStorage.removeItem('tempPaymentInfo');
    navigate('/home');
  };

  // Continue to next step
  const handleContinue = () => {
    if (!deliveryMethod) {
      alert('Por favor selecciona un método de entrega para continuar');
      return;
    }
    
    try {
      // Update CartPrices with final total
      const updatedCartPrices = { ...cartPrices, total_final: total };
      localStorage.setItem('CartPrices', JSON.stringify(updatedCartPrices));
    

      console.log("userLocation: ", userLocation);
      // Save shipping preferences with user address data
      const shippingPreferences = {
        method: deliveryMethod,
        storeId: '',
        shippingCost,
        locationCity: userLocation.City || userLocation.ciudad,
        locationState: userLocation.State,
        locationStreet: userLocation.Street || '',
        locationCountry: userLocation.Country || '',
        locationPostalCode: userLocation.Postal || ''
      };
          
      localStorage.setItem('shippingPreferences', JSON.stringify(shippingPreferences));
      
      // Navigate based on delivery method
      if (deliveryMethod === 'recogida_tienda') {
        navigate('/checkout/store-selection');
      } else if (deliveryMethod === 'domicilio') {
        navigate('/checkout/payment');
      }
    } catch (error) {
      console.error("Error en el proceso de navegación:", error);
      alert("Ha ocurrido un error al procesar su solicitud. Por favor intente nuevamente.");
    }
  };

  return (
    <UserLayout>
      <div className="bg-gray-100 min-h-screen">
        <div className="container mx-auto py-8 px-4">
          

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Columna principal - Opciones de envío */}
            <div className="lg:w-3/5">
              <h1 className="text-2xl font-bold mb-6">Elige la forma de entrega</h1>
              
              {/* Opciones de envío */}
              <div className="bg-white rounded-lg shadow-sm">
                {/* Opción: Envío a domicilio */}
                <div 
                  className={`p-6 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    deliveryMethod === 'domicilio' ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => handleDeliveryMethodChange('domicilio')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input 
                        type="radio"
                        id="delivery-home"
                        name="delivery-method"
                        value="domicilio"
                        checked={deliveryMethod === 'domicilio'}
                        onChange={() => handleDeliveryMethodChange('domicilio')}
                        className="h-5 w-5 text-blue-600 pointer-events-none"
                      />
                      <label htmlFor="delivery-home" className="ml-3 text-lg cursor-pointer">
                        Enviar a domicilio
                      </label>
                    </div>
                    <span className="font-bold">$ {deliveryMethod === 'domicilio' ? shippingCost.toLocaleString('es-CO') : '7.000'}</span>
                  </div>
                  
                  {deliveryMethod === 'domicilio' && (
                    <div className="mt-3 ml-8 text-gray-600">
                      {userLocation.City}, {userLocation.Country}
                    </div>
                  )}

                  {/* Address Dropdown */}
                  {showAddressDropdown && deliveryMethod === 'domicilio' && (
                    <div className="mt-4 ml-8">
                      {loadingAddresses ? (
                        <div className="text-gray-500">Cargando direcciones...</div>
                      ) : userAddresses.length > 0 ? (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dirección seleccionada:
                          </label>
                          <select 
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={selectedAddress?._id || ''}
                            onChange={(e) => {
                              const address = userAddresses.find(addr => addr._id === e.target.value);
                              if (address) handleAddressSelect(address);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {userAddresses.map((address) => (
                              <option key={address._id} value={address._id}>
                                {address.tipo} - {address.direccion_completa}, {address.ciudad}
                                {address.predeterminada && ' (Predeterminada)'}
                              </option>
                            ))}
                          </select>
                          {selectedAddress && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm">
                              <div><strong>Dirección:</strong> {selectedAddress.direccion_completa}</div>
                              <div><strong>Ciudad:</strong> {selectedAddress.ciudad}, {selectedAddress.departamento}</div>
                              {selectedAddress.codigo_postal && (
                                <div><strong>Código Postal:</strong> {selectedAddress.codigo_postal}</div>
                              )}
                              {selectedAddress.telefono_contacto && (
                                <div><strong>Teléfono:</strong> {selectedAddress.telefono_contacto}</div>
                              )}
                              {selectedAddress.referencia && (
                                <div><strong>Referencia:</strong> {selectedAddress.referencia}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-500">
                          No tienes direcciones guardadas. 
                          <button 
                            className="text-blue-600 hover:text-blue-800 ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/Profile', { state: { activeTab: 'profile' } });
                            }}
                          >
                            Agregar dirección
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Opción: Retiro en tienda */}
                <div 
                  className={`p-6 cursor-pointer hover:bg-gray-50 transition-colors ${
                    deliveryMethod === 'recogida_tienda' ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => handleDeliveryMethodChange('recogida_tienda')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input 
                        type="radio"
                        id="delivery-pickup"
                        name="delivery-method"
                        value="tienda"
                        checked={deliveryMethod === 'recogida_tienda'}
                        onChange={() => handleDeliveryMethodChange('recogida_tienda')}
                        className="h-5 w-5 text-blue-600 pointer-events-none"
                      />
                      <label htmlFor="delivery-pickup" className="ml-3 text-lg cursor-pointer">
                        Retiro en un punto de entrega
                      </label>
                    </div>
                    <span className="font-bold text-green-600">Gratis</span>
                  </div>
                  
                  {deliveryMethod === 'recogida_tienda' && (
                    <div className="mt-3 ml-8 text-gray-600">
                      Selecciona esta opción para recoger tu pedido en una de nuestras tiendas físicas. 
                      Podrás elegir la ubicación en el siguiente paso.
                    </div>
                  )}
                </div>
              </div>

              
              
              {/* Botón continuar */}
              <div className="mt-4 flex justify-between">
                <button
                  onClick={handleCancel}
                  className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Cancelar compra
                </button>
                
                <button
                  onClick={handleContinue}
                  type="button"
                  className={`font-medium py-3 px-6 rounded-md transition-colors ${
                    !deliveryMethod || (deliveryMethod === 'domicilio' && (!selectedAddress || userAddresses.length === 0))
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  disabled={!deliveryMethod || (deliveryMethod === 'domicilio' && (!selectedAddress || userAddresses.length === 0))}
                >
                  Continuar
                </button>
              </div>
            </div>
            
            {/* Columna lateral - Resumen de compra */}
            <div className="lg:w-2/5">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-4">Resumen de compra</h2>
                <div className="border-b pb-4 mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Producto</span>
                    <span>$ {subtotal.toLocaleString('es-CO')}</span>
                  </div>

                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Impuestos</span>
                    <span>$ {taxes.toLocaleString('es-CO')}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Envío</span>
                    {deliveryMethod === 'recogida_tienda' ? (
                      <span className="text-green-600">Gratis</span>
                    ) : (
                      <span>$ {shippingCost.toLocaleString('es-CO')}</span>
                    )}
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

export default CheckoutDeliveryPage;