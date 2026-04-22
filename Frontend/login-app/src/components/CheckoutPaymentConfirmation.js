import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from './UserLayout';
import axios from 'axios';
import { getAuthToken } from './UserProfilePageComponents/authUtils';

function CheckoutPaymentConfirmation() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState({
    method: 'credit_card',
    cardNumber: '',
    cardExpiry: '',
    cardCVC: '',
    cardholderName: ''
  });
  const [shippingInfo, setShippingInfo] = useState({
    method: '',
    storeName: '',
    storeAddress: '',
    shippingCost: 0
  });
  
  // Estado para el total - Only read from localStorage
  const [subtotal, setSubtotal] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  
  // Load data from localStorage - simplified and consistent with enhanced validation
  useEffect(() => {
    const loadConfirmationData = () => {
      setIsLoading(true);
      
      try {
        // VALIDATION: Check if tempPaymentInfo exists - THIS IS THE ONLY REQUIREMENT
        const storedPaymentInfo = localStorage.getItem('tempPaymentInfo');
        if (!storedPaymentInfo) {
          // No payment info, check what data exists and navigate accordingly
          const shippingPrefs = localStorage.getItem('shippingPreferences');
          
          if (shippingPrefs) {
            // Has shipping preferences, go to payment page
            navigate('/checkout/payment');
            return;
          } else {
            // Check for cart data
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
        }

        const parsedPaymentInfo = JSON.parse(storedPaymentInfo);
        setPaymentInfo(parsedPaymentInfo);
        
        // Get cart items
        const storedCart = localStorage.getItem('shoppingCart');
        if (storedCart) {
          const parsedCart = JSON.parse(storedCart);
          if (Array.isArray(parsedCart)) {
            setCartItems(parsedCart);
          }
        }

        // Get prices from CartPrices - SINGLE SOURCE OF TRUTH
        const storedPrices = localStorage.getItem('CartPrices');
        if (storedPrices) {
          const parsedPrices = JSON.parse(storedPrices);
          const calculatedSubtotal = parsedPrices.subtotal_con_descuentos || 0;
          const taxAmount = parsedPrices.total_impuestos || 0;
          const finalTotal = parsedPrices.total_final || (calculatedSubtotal + taxAmount);
          
          setSubtotal(calculatedSubtotal);
          setTaxAmount(taxAmount);
          setTotal(finalTotal);
        }
        
        // Get shipping info
        const storedShippingInfo = localStorage.getItem('shippingPreferences');
        if (storedShippingInfo) {
          const parsedShippingInfo = JSON.parse(storedShippingInfo);
          setShippingInfo({ 
            method: parsedShippingInfo.method,
            storeId: parsedShippingInfo.storeId,
            storeName: parsedShippingInfo.storeName || '',
            locationStreet: parsedShippingInfo.locationStreet || '',
            shippingCost: parsedShippingInfo.shippingCost || 0,
            locationCity: parsedShippingInfo.locationCity,
            locationState: parsedShippingInfo.locationState,
            locationPostalCode: parsedShippingInfo.locationPostalCode,
            locationCountry: parsedShippingInfo.locationCountry
          });
          
          setShippingCost(parsedShippingInfo.shippingCost || 0);
        }
        
      } catch (error) {
        console.error('Error loading confirmation data:', error);
        navigate('/home');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadConfirmationData();
  }, [navigate]);

  // Back button function - goes back to payment page
  const handleBack = () => {
    navigate('/checkout/payment');
  };

  // Cancel button function
  const handleCancel = () => {
    // Delete required data and navigate to home
    localStorage.removeItem('shippingPreferences');
    localStorage.removeItem('tempPaymentInfo');
    navigate('/home');
  };
  
  // Confirm and process payment
  const handleConfirmPayment = async () => {
    try {
      setIsLoading(true);
      
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      
      const storedPaymentInfo = localStorage.getItem('tempPaymentInfo');
      if (!storedPaymentInfo) {
        alert('No se encontró información de pago. Por favor, vuelve a ingresar los datos de tu tarjeta.');
        navigate('/checkout/payment');
        return;
      }
      
      const paymentData = JSON.parse(storedPaymentInfo);
      
      const requestPayload = {
        id_tarjeta: paymentData.Id,
        tipo_envio: shippingInfo.method === 'recogida_tienda' ? 'recogida_tienda' : 'domicilio',
        id_tienda_recogida: shippingInfo.storeId,
      // id_tienda_recogida: shippingInfo.method === 'recogida_tienda' ? parseInt(shippingInfo.storeId) : '',
        direccion_envio: {
          direccion_completa: shippingInfo.locationStreet || "Dirección no especificada",
          ciudad: shippingInfo.locationCity || userData.ciudad || "Pereira",
          codigo_postal: shippingInfo.locationPostalCode || "660001",
          pais: shippingInfo.locationCountry,
          departamento: shippingInfo.locationState || userData.departamento || "Risaralda",
          referencias: userData.referencias || ""
        },
        notas_envio: shippingInfo.method === 'recogida_tienda' ? 
          `Recoger en tienda: ${shippingInfo.storeName}` : 
          "Entrega a domicilio"
      };
      
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/v1/ventas`, requestPayload, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000
      });
      
      if (response.status === 200 || response.status === 201) {
        // Payment successful - Show custom modal instead of alert
        const paymentConfirmation = {
          method: paymentInfo.method,
          cardNumber: paymentInfo.cardNumber ? paymentInfo.cardNumber.replace(/\d(?=\d{4})/g, "*") : '',
          cardholderName: paymentInfo.cardholderName,
          total,
          subtotal,
          shippingCost,
          shippingMethod: shippingInfo.method,
          timestamp: new Date().toISOString(),
          transactionId: response.data.id || response.data.transactionId
        };
        
        //localStorage.setItem('paymentData', JSON.stringify(paymentConfirmation));
        
        // Clear temporary data
        localStorage.removeItem('tempPaymentInfo');
        localStorage.removeItem('shoppingCart');
        localStorage.removeItem('CartPrices');
        localStorage.removeItem('paymentData');
        localStorage.removeItem('shippingPreferences');
        
        // Set success modal data and show it
        setPaymentSuccess({
          transactionId: response.data.data.numero_venta || 'N/A',
          total: total,
          paymentMethod: paymentInfo.method === 'credit_card' ? 'Tarjeta de crédito' : paymentInfo.method,
          shippingMethod: shippingInfo.method === 'recogida_tienda' ? 'Recoger en tienda' : 'Envío a domicilio',
          cardNumber: paymentInfo.cardNumber ? paymentInfo.cardNumber.replace(/\d(?=\d{4})/g, "*") : '',
          timestamp: new Date().toLocaleString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
        setShowSuccessModal(true);
        console.log("success response", response.data);
        
        // Auto redirect after 5 seconds
        // setTimeout(() => {
        //   handleContinueShopping();
        // }, 10000);
      }
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      
      let errorMessage = 'Ha ocurrido un error al procesar el pago. Por favor intente nuevamente.';
      
      if (error.response) {
        console.error('Error response:', error.response.data);
        errorMessage = error.response.data.message || errorMessage;
      } else if (error.request) {
        errorMessage = 'No se pudo conectar con el servidor. Verifique su conexión a internet.';
      }
      
      setPaymentError({
      message: errorMessage,
      timestamp: new Date().toLocaleString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    setShowErrorModal(true);
    console.log("cart Prices",localStorage.getItem('CartPrices'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToProfile = () => {
    setShowErrorModal(false);
    navigate('/profile');
  };
  
  const handleEditPayment = () => {
    navigate('/checkout/payment');
  };
  
  const handleContinueShopping = () => {
    setShowSuccessModal(false);
    navigate('/Home');
  };

  // Custom Success Modal - displays in the middle of the screen
  const SuccessModal = () => {
    if (!showSuccessModal || !paymentSuccess) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          {/* Header with success animation */}
          <div className="bg-gradient-to-r from-green-400 to-green-600 p-6 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Pago Exitoso!</h2>
            <p className="text-green-100">Tu compra ha sido procesada correctamente</p>
          </div>
          
          {/* Payment details */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-gray-600">💳 Método de pago:</span>
              <span className="font-semibold">{paymentSuccess.paymentMethod}</span>
            </div>
            
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-gray-600">💰 Total pagado:</span>
              <span className="font-bold text-green-600 text-lg">
                ${paymentSuccess.total.toLocaleString('es-CO')} COP
              </span>
            </div>
            
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-gray-600">📦 Envío:</span>
              <span className="font-semibold">{paymentSuccess.shippingMethod}</span>
            </div>
            
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-gray-600">🏷️ ID Transacción:</span>
              <span className="font-mono text-sm">{paymentSuccess.transactionId}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">📅 Fecha:</span>
              <span className="text-sm">{paymentSuccess.timestamp}</span>
            </div>
          </div>
          
          {/* Footer message */}
          <div className="bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600 mb-4">
              📧 Recibirás un email de confirmación con todos los detalles de tu pedido.
            </p>
            <button
              onClick={handleContinueShopping}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Continuar comprando 🛍️
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {/* Serás redirigido automáticamente en unos segundos... */}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const ErrorModal = () => {
  if (!showErrorModal || !paymentError) return null;
  
  // Check if it's a credit/balance error and parse the amounts
  const isCreditError = paymentError.message.toLowerCase().includes('saldo insuficiente');
  let availableAmount = '';
  let requiredAmount = '';
  
  if (isCreditError) {
    // Extract amounts from message like "Saldo insuficiente. Disponible: $0, Requerido: $43,051.82"
    const availableMatch = paymentError.message.match(/Disponible:\s*\$?([\d,]+(?:\.\d{2})?)/);
    const requiredMatch = paymentError.message.match(/Requerido:\s*\$?([\d,]+(?:\.\d{2})?)/);
    
    if (availableMatch) availableAmount = availableMatch[1].replace(/,$/, '');
    if (requiredMatch) requiredAmount = requiredMatch[1].replace(/,$/, '');
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header with error animation */}
        <div className="bg-gradient-to-r from-red-400 to-red-600 p-6 text-center relative">
          {/* Close button */}
          <button
            onClick={() => setShowErrorModal(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Error en el Pago</h2>
          <p className="text-red-100">No se pudo procesar tu compra</p>
        </div>
        
        {/* Error details */}
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <div className="w-full">
                {isCreditError ? (
                  <div>
                    <p className="text-sm text-red-700 font-medium mb-3">
                      Saldo insuficiente
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-red-600">💰 Disponible:</span>
                        <span className="text-sm font-semibold text-red-700">
                          ${availableAmount} COP
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-red-600">🏷️ Requerido:</span>
                        <span className="text-sm font-semibold text-red-700">
                          ${requiredAmount} COP
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-red-700 font-medium">
                    {paymentError.message}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">📅 Fecha del error:</span>
            <span className="text-sm">{paymentError.timestamp}</span>
          </div>
        </div>
        
        {/* Footer message */}
        <div className="bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600 mb-4">
            Puedes intentar nuevamente o revisar tu información de pago en tu perfil.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowErrorModal(false)}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Intentar de nuevo
            </button>
            <button
              onClick={handleGoToProfile}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Ir a perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
  
  if (isLoading) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700">Procesando pago...</p>
          </div>
        </div>
      </UserLayout>
    );
  }
  
  return (
    <UserLayout>
      {/* Success Modal */}
      <SuccessModal />
      <ErrorModal />
      <div className="bg-gray-100 min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
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

            <h1 className="text-2xl font-bold mb-6 text-center">Confirmar pago</h1>
            
            {/* Panel principal */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Sección superior - Datos de pago */}
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold mb-4">Información de pago</h2>
                
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Columna izquierda - Resumen */}
                  <div className="md:w-1/2 space-y-6">
                    {/* Resumen de compra */}
                    <div>
                      <h3 className="font-medium text-gray-700 mb-3">Resumen de la compra</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Producto</span>
                          <span>$ {subtotal.toLocaleString('es-CO')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Impuestos</span>
                          <span>$ {taxAmount.toLocaleString('es-CO')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Envío</span>
                          {shippingCost === 0 ? (
                            <span className="text-green-600">Gratis</span>
                          ) : (
                            <span>$ {shippingCost.toLocaleString('es-CO')}</span>
                          )}
                        </div>
                        <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                          <span>Total</span>
                          <span>$ {total.toLocaleString('es-CO')}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Método de envío */}
                    <div>
                      <h3 className="font-medium text-gray-700 mb-3">Método de envío</h3>
                      <div className="border border-gray-200 rounded p-3">
                        <div className="flex items-center">
                          <input 
                            type="radio"
                            checked={true}
                            readOnly
                            className="h-4 w-4 text-blue-600"
                          />
                          <label className="ml-2">
                            {shippingInfo.method === 'recogida_tienda' ? (
                              <div>
                                <span className="font-medium">Recoger en tienda</span>
                                {shippingInfo.storeName && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {shippingInfo.storeName}, {shippingInfo.storeAddress || 'dirección disponible en tu email'}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="font-medium">Envío a domicilio</span>
                                <p className="text-sm text-gray-600 mt-1">
                                  <span>
                                    {shippingInfo.locationCity}, {shippingInfo.locationState}, {shippingInfo.locationStreet}
                                    <br/>
                                    {shippingInfo.locationPostalCode}
                                  </span>
                                </p>
                                
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Columna derecha - Detalles de tarjeta */}
                  <div className="md:w-1/2">
                    <h3 className="font-medium text-gray-700 mb-3">Método de pago</h3>
                    <div className="border border-gray-200 rounded p-4">
                      <div className="flex items-center mb-4">
                        <input 
                          type="radio"
                          checked={true}
                          readOnly
                          className="h-4 w-4 text-blue-600"
                        />
                        <label className="ml-2 font-medium">
                          Tarjeta de crédito
                        </label>
                      </div>
                      
                      <div className="pl-6 space-y-4">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Número de tarjeta</p>
                          <div className="flex items-center">
                            <p className="font-medium">
                              {paymentInfo.cardNumber ? 
                                paymentInfo.cardNumber.replace(/\d(?=\d{4})/g, "*") : 
                                '•••• •••• •••• ••••'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <p className="text-sm text-gray-500 mb-1">Vencimiento</p>
                            <p className="font-medium">{paymentInfo.cardExpiry || 'MM/AA'}</p>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-500 mb-1">Código de seguridad</p>
                            <p className="font-medium">•••</p>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Titular de la tarjeta</p>
                          <p className="font-medium">{paymentInfo.cardholderName || 'Nombre del titular'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sección inferior - Botones de acción */}
              <div className="p-6 bg-gray-50 flex flex-col sm:flex-row-reverse gap-3">
                <button
                  onClick={handleConfirmPayment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md font-medium transition-colors"
                >
                  Pagar
                </button>
                <button
                  onClick={handleEditPayment}
                  className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 px-6 rounded-md font-medium transition-colors"
                >
                  Editar
                </button>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              Al confirmar, aceptas los términos y condiciones de compra
            </p>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}

export default CheckoutPaymentConfirmation;