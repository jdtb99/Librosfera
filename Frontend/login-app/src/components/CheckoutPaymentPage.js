import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserLayout from './UserLayout';
import axios from 'axios';
import { getAuthToken } from './UserProfilePageComponents/authUtils';

const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;

function CheckoutPaymentPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);
  const [shippingInfo, setShippingInfo] = useState({
    method: '',
    storeName: '',
    storeAddress: '',
    shippingCost: 0
  });
  
  // Estados para el formulario de pago
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardid, setCardId] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  
  // Estado para el total - Only read from localStorage
  const [subtotal, setSubtotal] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [taxes, setTaxes] = useState(0);
  const [total, setTotal] = useState(0);

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCard, setSelectedCard] = useState('');
  const [isCardSelected, setIsCardSelected] = useState(false);

  const axiosConfig = {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  const fetchCards = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/tarjetas`, axiosConfig);
      
      if (response.data.status === 'success') {
        const transformedCards = response.data.data.map(card => ({
          id: card.id_tarjeta,
          type: card.marca === 'visa' ? 'Visa' : 'Mastercard',
          bank: `${card.tipo.charAt(0).toUpperCase() + card.tipo.slice(1)} ${card.marca.toUpperCase()}`,
          lastFour: card.ultimos_digitos,
          cardholderName: card.nombre_titular,
          expiryMonth: card.fecha_expiracion.mes.toString().padStart(2, '0'),
          expiryYear: card.fecha_expiracion.anio.toString().slice(-2),
          isDefault: card.predeterminada,
          isActive: card.activa,
          cardType: card.tipo,
          balance: card.saldo || 0
        }));
        
        setCards(transformedCards);

        const defaultCard = transformedCards.find(card => card.isDefault && card.isActive);
        if (defaultCard) {
          setSelectedCard(defaultCard.id);
          setCardId(defaultCard.id);
          setCardNumber(`**** **** **** ${defaultCard.lastFour}`);
          setExpiry(`${defaultCard.expiryMonth}/${defaultCard.expiryYear}`);
          setCvc('***');
          setCardholderName(defaultCard.cardholderName);
          setIsCardSelected(true);
        }
      }
    } catch (err) {
      console.error('Error fetching cards:', err);
      setError('Error al cargar las tarjetas. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Load data from localStorage - simplified and consistent with enhanced validation
  useEffect(() => {
    const loadPaymentData = () => {
      setIsLoading(true);
      
      try {
        // Get cart items first
        const storedCart = localStorage.getItem('shoppingCart');
        if (!storedCart || storedCart === "[]") {
          navigate('/home');
          return;
        }
        
        const parsedCart = JSON.parse(storedCart);
        if (Array.isArray(parsedCart)) {
          setCartItems(parsedCart);
        }
        
        // VALIDATION: Check if shippingPreferences exists - THIS IS THE ONLY REQUIREMENT
        const storedShippingInfo = localStorage.getItem('shippingPreferences');
        if (!storedShippingInfo) {
          // No shipping preferences, check what data exists and navigate accordingly
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

        const parsedShippingInfo = JSON.parse(storedShippingInfo);
        setShippingInfo(parsedShippingInfo);
        setShippingCost(parsedShippingInfo.shippingCost || 0);
        
        // Get prices from CartPrices - SINGLE SOURCE OF TRUTH
        const storedPrices = localStorage.getItem('CartPrices');
        if (storedPrices) {
          const parsedPrices = JSON.parse(storedPrices);
          setSubtotal(parsedPrices.subtotal_con_descuentos || 0);
          setTaxes(parsedPrices.total_impuestos || 0);
          setTotal(parsedPrices.total_final || (parsedPrices.subtotal_con_descuentos + parsedPrices.total_impuestos));
        }
        
      } catch (error) {
        console.error('Error loading payment data:', error);
        navigate('/home');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPaymentData();
    fetchCards();
  }, [navigate]);

  // Back button function - goes back to previous page based on shipping method
  const handleBack = () => {
    // Delete tempPaymentInfo since we're going back
    localStorage.removeItem('tempPaymentInfo');
    
    // Navigate based on shipping method
    if (shippingInfo.method === 'recogida_tienda') {
      navigate('/checkout/store-selection');
    } else {
      navigate('/checkout');
    }
  };

  // Cancel button function
  const handleCancel = () => {
    // Delete required data and navigate to home
    localStorage.removeItem('shippingPreferences');
    localStorage.removeItem('tempPaymentInfo');
    navigate('/home');
  };

  const handleCardSelection = (cardId) => {
    setSelectedCard(cardId);
    
    if (cardId === '') {
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setCardholderName('');
      setIsCardSelected(false); 
    } else {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        setCardId(cardId);
        setCardNumber(`**** **** **** ${card.lastFour}`);
        setExpiry(`${card.expiryMonth}/${card.expiryYear}`);
        setCvc('***');
        setCardholderName(card.cardholderName);
        setIsCardSelected(true);
      }
    }
  };

  const validateForm = () => {
    if (!cardNumber) {
      alert('Por favor, ingresa el número de tarjeta');
      return false;
    }
    if (!expiry) {
      alert('Por favor, ingresa la fecha de vencimiento');
      return false;
    }
    if (!cvc) {
      alert('Por favor, ingresa el código de seguridad');
      return false;
    }
    if (!cardholderName) {
      alert('Por favor, ingresa el nombre del titular');
      return false;
    }
    return true;
  };
  
  const handleContinuePayment = () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      const paymentInfo = {
        Id: cardid,
        method: paymentMethod,
        cardNumber,
        cardExpiry: expiry,
        cardCVC: cvc,
        cardholderName
      };
      
      localStorage.setItem('tempPaymentInfo', JSON.stringify(paymentInfo));
      navigate('/checkout/confirm-payment');
    } catch (error) {
      console.error('Error al procesar los datos:', error);
      alert('Ha ocurrido un error al procesar los datos. Por favor intente nuevamente.');
    }
  };
  
  if (isLoading) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700">Cargando información de pago...</p>
          </div>
        </div>
      </UserLayout>
    );
  }
  
  if (!shippingInfo.method) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-700 mb-4">No hay información de envío disponible</p>
            <button 
              onClick={() => navigate('/checkout')} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Volver a método de envío
            </button>
          </div>
        </div>
      </UserLayout>
    );
  }
  
  return (
    <UserLayout>
      <div className="bg-gray-100 min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Navigation Buttons */}
            <div className="mb-4 flex gap-3">
              <button 
                onClick={handleBack}
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                ← Volver
              </button>

            </div>

            <div className="flex flex-col md:flex-row gap-8">
              {/* Columna izquierda - Información de envío y producto */}
              <div className="md:w-2/3">
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-xl font-bold">Información de pago</h1>
                    <button
                      onClick={() => navigate('/profile', { state: { activeTab: 'tarjeta' } })}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors text-sm"
                    >
                      Añadir Tarjeta
                    </button>
                  </div>
                  
                  {/* Método de pago */}
                  <div className="mb-6">
                    <label className="block text-gray-700 mb-2">Método de pago</label>
                    <div className="relative">
                      <select
                        value={selectedCard}
                        onChange={(e) => handleCardSelection(e.target.value)}
                        className="block w-full border border-gray-300 rounded-md px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        disabled={loading}
                      >
                        <option value="">Seleccionar Tarjetas</option>
                        {cards.filter(card => card.isActive).map(card => (
                          <option key={card.id} value={card.id}>
                            {card.bank} **** {card.lastFour}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {error && (
                      <p className="text-red-500 text-sm mt-1">{error}</p>
                    )}
                    {loading && (
                      <p className="text-gray-500 text-sm mt-1">Cargando tarjetas...</p>
                    )}
                  </div>
                  
                  {/* Información de la tarjeta */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-700 mb-2">Número de tarjeta</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="1234 1234 1234 1234"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          disabled={true}
                          className="block w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 cursor-not-allowed"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <div className="flex space-x-1">
                            <span className="text-gray-400">Visa</span>
                            <span className="text-gray-400">MC</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="w-1/2">
                        <label className="block text-gray-700 mb-2">Fecha de vencimiento</label>
                        <input
                          type="text"
                          placeholder="MM / YY"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          disabled={true}
                          className="block w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="w-1/2">
                        <label className="block text-gray-700 mb-2">Código de seguridad</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="CVC"
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value)}
                            disabled={true}
                            className="block w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 cursor-not-allowed"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2v6a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-gray-700 mb-2">Nombre del titular</label>
                      <input
                        type="text"
                        placeholder="Nombre como aparece en la tarjeta"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        disabled={true}
                        className="block w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Método de envío */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-lg font-bold mb-4">Método de envío</h2>
                  
                  <div className="border border-gray-200 rounded-lg">
                    <div className="p-4">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          checked={true}
                          readOnly
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label className="ml-3">
                          <div className="flex justify-between w-full items-center">
                            <span className="font-medium">{shippingInfo.method === 'recogida_tienda' ? 'Recoger en tienda' : 'Envío a domicilio'}</span>
                            <div className="">
                              {shippingInfo.method === 'recogida_tienda' ? (
                                <p className="text-green-600 font-bold">Gratis</p>
                              ) : (
                                <span><p className="font-bold"> ${shippingCost.toLocaleString('es-CO')}</p></span>
                              )}
                            </div>
                          </div>
                        </label>
                      </div>
                      
                      <div className="mt-2 ml-7 text-sm text-gray-600">
                        {shippingInfo.method === 'recogida_tienda' && shippingInfo.storeName && (
                          <span>{shippingInfo.storeName}, {shippingInfo.storeAddress || 'dirección disponible en tu email'}</span>
                        )}
                        {shippingInfo.method === 'domicilio' && (
                          <span>
                            {shippingInfo.locationCity}, {shippingInfo.locationState}, {shippingInfo.locationStreet}
                            <br />
                            {shippingInfo.locationPostalCode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                onClick={handleCancel}
                className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Cancelar compra
              </button>
              </div>
              
              {/* Columna derecha - Resumen y botón de pago */}
              <div className="md:w-1/3">
                <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                  <h2 className="text-xl font-bold mb-6">Resumen de compra</h2>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Producto</span>
                      <span>$ {subtotal.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Impuestos</span>
                      <span>$ {taxes.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Envío</span>
                      {shippingInfo.method === 'recogida_tienda' ? (
                        <span className="text-green-600">Gratis</span>
                      ) : (
                        <span>$ {shippingCost.toLocaleString('es-CO')}</span>
                      )}
                    </div>
                    <div className="border-t pt-4 flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>$ {total.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleContinuePayment}
                    disabled={!isCardSelected} // Add this line
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      isCardSelected 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`} // Modified className
                  >
                    Continuar
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center mt-4">
                    Al confirmar, aceptas los términos y condiciones de compra
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}

export default CheckoutPaymentPage;