import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AddCardPage from './AddCardPage';
import RechargeBalancePage from './RechargeBalancePage';
import { getCookie } from './authUtils';

const CardPage = () => {
  const [showAddCard, setShowAddCard] = useState(false);
  const [showRechargeBalance, setShowRechargeBalance] = useState(false);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [cardToModify, setCardToModify] = useState(null);
  const [amountType, setAmountType] = useState('precio fijo');
  const [amountValue, setAmountValue] = useState('');
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('add');
  const [selectedCard, setSelectedCard] = useState(null);

  // Saldo predeterminado (en pesos)
  const accountBalance = 0;

  // Base URL para la API
  const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;

  // Configuración base para axios
  const token = getCookie("data");
  const UserData = token ? JSON.parse(token) : null;
  const authToken = UserData?.authToken || '';
  console.log("token", authToken);


  const axiosConfig = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  // Función para obtener todas las tarjetas del usuario
  const fetchCards = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/tarjetas`, axiosConfig);
      
      if (response.data.status === 'success') {
        // Transformar los datos de la API al formato que espera el componente
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
          balance: card.saldo || 0 // Show 0 instead of null for all cards
        }));
        
        setCards(transformedCards);
      }
    } catch (err) {
      console.error('Error fetching cards:', err);
      setError('Error al cargar las tarjetas. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // useEffect para cargar las tarjetas al montar el componente
  useEffect(() => {
    fetchCards();
  }, []);

  // useEffect para mostrar mensajes de acción
  useEffect(() => {
    if (actionMessage.text && !isModalOpen) {
      setIsMessageVisible(true);
      const timer = setTimeout(() => {
        setIsMessageVisible(false);  // Hide the message after 5 seconds
        setActionMessage({ type: '', text: '' }); // Clear the message
      }, 5000);
      return () => clearTimeout(timer);  // Clean up the timeout if the component unmounts or the actionMessage changes
    }
  }, [actionMessage, isModalOpen]);

  // Función para manejar el clic en agregar tarjeta
  const handleAddCardClick = () => {
    setShowAddCard(true);
    setShowRechargeBalance(false);
    setCurrentView('add');
  };

  // Función para cancelar la adición de tarjeta
  const handleCancelAddCard = () => {
    setShowAddCard(false);
    fetchCards();
  };

  // Función para guardar una nueva tarjeta
  const handleSaveCard = async (cardData) => {
    try {
      const cardPayload = {
        numero_tarjeta: cardData.cardNumber.replace(/\s/g, ''),
        nombre_titular: cardData.cardholderName.toUpperCase(),
        mes_expiracion: parseInt(cardData.expiryMonth),
        anio_expiracion: parseInt(cardData.expiryYear),
        cvv: cardData.cvv,
        tipo: cardData.cardType || 'credito',
        marca: cardData.cardBrand ? cardData.cardBrand.toLowerCase() : undefined
      };

      const response = await axios.post(`${API_BASE_URL}/tarjetas`, cardPayload, axiosConfig);
      
      if (response.data.status === 'success') {
        // Recargar las tarjetas desde el servidor
        await fetchCards();
        setShowAddCard(false);
        
        setActionMessage({
          type: 'success',
          text: 'Tarjeta agregada correctamente'
        });
      }
    } catch (err) {
      console.error('Error saving card:', err);
      // Manejar error (puedes mostrar un mensaje al usuario)
      alert('Error al guardar la tarjeta. Por favor, verifica los datos e intenta de nuevo.');
    }
  };

  // Función para mostrar modal de modificar monto
  const handleModifyAmountClick = (card) => {
    setCardToModify(card);
    setAmountType('precio fijo');
    setAmountValue('');
    setIsAmountModalOpen(true);
  };

  // Función para cancelar modificación de monto
  const cancelModifyAmount = () => {
    setIsAmountModalOpen(false);
    setCardToModify(null);
    setAmountValue('');
  };

  // Función para manejar el cambio en el input de monto
  const handleAmountChange = (e) => {
    const value = e.target.value;
    
    if (amountType === 'precio fijo') {
      // Solo números positivos y 0
      if (/^\d*$/.test(value)) {
        setAmountValue(value);
      }
    } else {
      // Ajuste relativo: números y signo negativo solo al inicio
      if (value === '' || value === '-') {
        setAmountValue(value);
      } else if (/^-?\d*$/.test(value)) {
        setAmountValue(value);
      }
    }
  };

  // Función para confirmar modificación de monto
  const confirmModifyAmount = async () => {
    if (!cardToModify || !amountValue) return;
    
    try {
      let finalAmount;
      
      if (amountType === 'precio fijo') {
        // Para precio fijo, el monto final es la diferencia entre el valor deseado y el actual
        finalAmount = parseFloat(amountValue) - cardToModify.balance;
      } else {
        // Para ajuste relativo, usar el valor directamente
        finalAmount = parseFloat(amountValue);
      }

      const response = await axios.patch(
        `${API_BASE_URL}/tarjetas/${cardToModify.id}/saldo`,
        {
          monto: finalAmount,
          descripcion: amountType === 'precio fijo' 
            ? `Ajuste a precio fijo: ${amountValue}` 
            : `Ajuste relativo: ${finalAmount >= 0 ? '+' : ''}${finalAmount}`
        },
        axiosConfig
      );
      
      if (response.data.status === 'success') {
        await fetchCards();
        setActionMessage({
          type: 'success',
          text: 'Monto modificado correctamente'
        });
      }
    } catch (err) {
      console.error('Error modifying amount:', err);
      setActionMessage({
        type: 'error',
        text: 'Error al modificar el monto. Por favor, intenta de nuevo.'
      });
    } finally {
      setIsAmountModalOpen(false);
      setCardToModify(null);
      setAmountValue('');
    }
  };
  const handleDeleteCardClick = (cardId, cardName) => {
    setCardToDelete({ id: cardId, name: cardName });
    setIsModalOpen(true);
  };

  // Función para confirmar eliminación de tarjeta
  const confirmDeleteCard = async () => {
    if (!cardToDelete) return;
    
    try {
      const response = await axios.delete(`${API_BASE_URL}/tarjetas/${cardToDelete.id}`, axiosConfig);
      
      if (response.data.status === 'success') {
        await fetchCards();
        setActionMessage({
          type: 'success',
          text: 'Tarjeta eliminada correctamente'
        });
      }
    } catch (err) {
      console.error('Error deleting card:', err);
      setActionMessage({
        type: 'error',
        text: 'Error al eliminar la tarjeta. Por favor, intenta de nuevo.'
      });
    } finally {
      setIsModalOpen(false);
      setCardToDelete(null);
    }
  };

  // Función para cancelar eliminación de tarjeta
  const cancelDeleteCard = () => {
    setIsModalOpen(false);
    setCardToDelete(null);
  };

  // Función para eliminar una tarjeta (antigua - ahora usa confirmación)
  const handleDeleteCard = async (cardId) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/tarjetas/${cardId}`, axiosConfig);
      
      if (response.data.status === 'success') {
        // Recargar las tarjetas desde el servidor
        await fetchCards();
        console.log('Tarjeta eliminada exitosamente');
      }
    } catch (err) {
      console.error('Error deleting card:', err);
      alert('Error al eliminar la tarjeta. Por favor, intenta de nuevo.');
    }
  };

  // Función para establecer tarjeta como predeterminada
  const handleSetDefaultCard = async (cardId) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/tarjetas/${cardId}/predeterminada`, {}, axiosConfig);
      
      if (response.data.status === 'success') {
        await fetchCards();
        setActionMessage({
          type: 'success',
          text: 'Tarjeta establecida como predeterminada'
        });
      }
    } catch (err) {
      console.error('Error setting default card:', err);
      setActionMessage({
        type: 'error',
        text: 'Error al establecer la tarjeta como predeterminada.'
      });
    }
  };

  // Función para mostrar la página de recarga de saldo
  const handleRechargeBalanceClick = () => {
    setShowRechargeBalance(true);
    setShowAddCard(false);
  };

  // Función para cancelar la recarga de saldo
  const handleCancelRecharge = () => {
    setShowRechargeBalance(false);
  };

  const handleEditCard = (card) => {
    setSelectedCard(card);
    setShowAddCard(true);
    setCurrentView('edit');
  };

  // Función para procesar la recarga de saldo
  const handleRechargeBalance = async (amount, paymentMethod) => {
    try {
      // Si el método de pago es una tarjeta específica, usar su saldo
      if (paymentMethod.type === 'card' && paymentMethod.cardId) {
        const response = await axios.patch(
          `${API_BASE_URL}/tarjetas/${paymentMethod.cardId}/saldo`,
          {
            monto: parseFloat(amount),
            descripcion: 'Recarga de saldo'
          },
          axiosConfig
        );
        
        if (response.data.status === 'success') {
          setActionMessage({
            type: 'success',
            text: 'Recarga realizada correctamente'
          });
          await fetchCards();
        }
      } else {
        setActionMessage({
          type: 'success',
          text: 'Recarga procesada correctamente'
        });
        console.log(`Recarga de ${amount} con método de pago:`, paymentMethod);
      }
      
      setShowRechargeBalance(false);
    } catch (err) {
      console.error('Error processing recharge:', err);
      setActionMessage({
        type: 'error',
        text: 'Error al procesar la recarga. Por favor, intenta de nuevo.'
      });
    }
  };

  if (showAddCard) {
    return <AddCardPage onSave={handleSaveCard} onCancel={handleCancelAddCard} card={selectedCard} mode={currentView} />;
  }

  if (showRechargeBalance) {
    return <RechargeBalancePage 
      onCancel={handleCancelRecharge} 
      onRecharge={handleRechargeBalance}
      savedCards={cards}
    />;
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando tarjetas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6 h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={fetchCards}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 h-full">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Métodos de Pago</h2>
      
      {/* Message Display */}
      {isMessageVisible && actionMessage.text && (
        <div className={`mb-4 p-4 rounded-md ${
          actionMessage.type === 'success' 
            ? 'bg-green-100 border border-green-400 text-green-700' 
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {actionMessage.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{actionMessage.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* Amount Modification Modal */}
      {isAmountModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 text-center mb-4">
                Modificar Monto
              </h3>
              <div className="px-7 py-3">
                <p className="text-sm text-gray-500 mb-4 text-center">
                  Tarjeta: <strong>{cardToModify?.bank} •••• {cardToModify?.lastFour}</strong><br/>
                  Saldo actual: <strong>${cardToModify?.balance.toLocaleString('es-CO')} COP</strong>
                </p>
                
                {/* Toggle for amount type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de modificación
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="precio fijo"
                        checked={amountType === 'precio fijo'}
                        onChange={(e) => {
                          setAmountType(e.target.value);
                          setAmountValue('');
                        }}
                        className="mr-2"
                      />
                      Precio fijo
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="ajuste relativo"
                        checked={amountType === 'ajuste relativo'}
                        onChange={(e) => {
                          setAmountType(e.target.value);
                          setAmountValue('');
                        }}
                        className="mr-2"
                      />
                      Ajuste relativo
                    </label>
                  </div>
                </div>

                {/* Amount input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto
                  </label>
                  <input
                    type="text"
                    value={amountValue}
                    onChange={handleAmountChange}
                    placeholder={
                      amountType === 'precio fijo' 
                        ? 'Ingrese monto fijo de tarjeta' 
                        : 'Ingrese ajuste (+100 o -50)'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {amountType === 'precio fijo' && (
                    <p className="text-xs text-gray-500 mt-1">
                      El saldo se ajustará a este monto exacto
                    </p>
                  )}
                  {amountType === 'ajuste relativo' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Número positivo para aumentar, negativo para disminuir
                    </p>
                  )}
                </div>
              </div>
              
              <div className="items-center px-4 py-3">
                <button
                  onClick={confirmModifyAmount}
                  disabled={!amountValue}
                  className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Modificar monto
                </button>
                <button
                  onClick={cancelModifyAmount}
                  className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">Confirmar eliminación</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  ¿Estás seguro de que deseas eliminar la tarjeta <strong>{cardToDelete?.name}</strong>? Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={confirmDeleteCard}
                  className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300 mr-2"
                >
                  Eliminar tarjeta
                </button>
                <button
                  onClick={cancelDeleteCard}
                  className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Mis Tarjetas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tarjeta de Saldo (siempre visible) */}
          {/* <div className="border border-gray-300 rounded-lg p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md relative">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-sm opacity-80">Tarjeta de</p>
                <p className="font-bold text-lg">SALDO</p>
              </div>
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            <div className="mb-8">
              <p className="text-sm opacity-80">Saldo disponible</p>
              <div className="font-bold text-2xl flex items-baseline">
                ${accountBalance.toLocaleString('es-CO')}
                <span className="text-sm ml-1 opacity-90">COP</span>
              </div>
            </div>
            
            <div className="text-sm opacity-80 mb-4">
              <p>Válida indefinidamente</p>
            </div>
            
            <button 
              onClick={handleRechargeBalanceClick}
              className="w-full bg-white text-blue-600 font-medium py-2 px-4 rounded-md hover:bg-blue-50 transition-colors"
            >
              Recargar saldo
            </button>
          </div> */}
          
          {/* Tarjetas guardadas */}
          {cards.map((card) => (
            <div key={card.id} className="border border-gray-300 rounded-lg p-4 bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md relative cursor-pointer hover:shadow-lg transition-shadow"
                 onClick={() => handleEditCard(card.id)}>
              {/* Indicador de tarjeta predeterminada */}
              {card.isDefault && (
                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Principal
                </div>
              )}
              
              {/* Botón para eliminar la tarjeta */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCardClick(card.id, `${card.bank} •••• ${card.lastFour}`);
                }}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                title="Eliminar tarjeta"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm opacity-80">Tarjeta {card.type}</p>
                  <p className="font-bold text-lg">{card.bank}</p>
                </div>
                <div className="w-12 h-8">
                  {card.type === 'Visa' && (
                    <svg className="h-full w-full" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="white"/>
                      <path d="M21.6267 28.8999H18.2653L20.202 19.0999H23.5653L21.6267 28.8999BM30.4653 19.3867C29.7053 19.0999 28.602 18.7999 27.262 18.7999C24.0267 18.7999 21.7253 20.5133 21.7033 22.9619C21.682 24.7467 23.342 25.7353 24.614 26.3467C25.9193 26.9733 26.342 27.3867 26.342 27.9476C26.3353 28.8133 25.2867 29.2133 24.3153 29.2133C22.9873 29.2133 22.2833 29.0133 21.1433 28.5619L20.722 28.3553L20.262 31.0133C21.1573 31.3867 22.8753 31.7133 24.6553 31.7267C28.082 31.7267 30.342 30.0399 30.3663 27.4076C30.3793 26.0133 29.482 24.9476 27.522 24.0133C26.3433 23.4399 25.6267 23.0399 25.6267 22.4533C25.6333 21.9219 26.2353 21.3619 27.5673 21.3619C28.6673 21.3476 29.4753 21.6133 30.0887 21.8867L30.3967 22.0133L30.8433 19.4533L30.4653 19.3867ZM36.602 19.0999H34.0553C33.2953 19.0999 32.7353 19.2999 32.3887 19.9619L27.8753 28.8999H31.2953C31.2953 28.8999 31.8353 27.4733 31.9353 27.2133H35.5653C35.642 27.5399 35.9353 28.8999 35.9353 28.8999H39.0007L36.602 19.0999ZM32.8953 24.9219C33.0953 24.3999 33.9153 22.3019 33.9153 22.3019C33.9073 22.3219 34.1153 21.7619 34.242 21.4219L34.4153 22.2019C34.4153 22.2019 34.9087 24.4133 35.0087 24.9219H32.8953Z" fill="#00579F"/>
                      <path d="M16.8667 19.0999L13.6667 25.7066L13.3333 24.1733C12.7733 22.4199 11.0667 20.5333 9.14667 19.5733L12.0533 28.8866H15.5L20.4333 19.0999H16.8667Z" fill="#00579F"/>
                      <path d="M11.5333 19.0999H6.71998L6.66665 19.3666C10.22 20.1666 12.6667 21.9666 13.3333 24.1733L12.1467 19.9733C11.9733 19.2733 11.82 19.1133 11.5333 19.0999Z" fill="#FAA61A"/>
                    </svg>
                  )}
                  {card.type === 'Mastercard' && (
                    <svg className="h-full w-full" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="white"/>
                      <path d="M24 32C28.4183 32 32 28.4183 32 24C32 19.5817 28.4183 16 24 16C19.5817 16 16 19.5817 16 24C16 28.4183 19.5817 32 24 32Z" fill="#F26122"/>
                      <path d="M24 16C21.25 16 18.75 17.2 17 19.15C17.7879 18.3669 18.7373 17.7461 19.7868 17.3297C20.8362 16.9133 21.9625 16.7099 23.1 16.7333C24.2224 16.7129 25.3375 16.9179 26.371 17.3345C27.4045 17.7511 28.3368 18.3703 29.1047 19.1491C29.8726 19.9279 30.4785 20.8686 30.8806 21.9076C31.2827 22.9467 31.4721 24.0645 31.4367 25.1867C31.41 26.3242 31.2066 27.4505 30.7902 28.5C30.3738 29.5494 29.7531 30.4988 28.97 31.2867C30.92 29.5333 32.12 27.0333 32.12 24.0333C32.12 21.0333 30.9433 18.5333 29 16.75C27.6162 16.2518 26.115 16.0027 24.6033 16.0267C24.4033 16.0267 24.2033 16.0267 24 16.0267V16Z" fill="#EA1D25"/>
                      <path d="M16 24C16 27.0333 17.1767 29.5333 19.1233 31.3167C20.5103 31.8213 22.0168 32.0654 23.5333 32.0333C23.7333 32.0333 23.9333 32.0333 24.1333 32.0333C26.9367 32.0333 29.45 30.85 31.2 28.95C30.4083 29.7333 29.455 30.3538 28.4015 30.7683C27.348 31.1828 26.2173 31.3827 25.0833 31.3533C23.9609 31.3737 22.8458 31.1687 21.8123 30.7521C20.7789 30.3356 19.8465 29.7164 19.0786 28.9376C18.3107 28.1588 17.7048 27.2181 17.3027 26.1791C16.9007 25.14 16.7112 24.0222 16.7467 22.9C16.7733 21.7625 16.9767 20.6362 17.3932 19.5868C17.8096 18.5373 18.4303 17.5879 19.2133 16.8C17.2733 18.5533 16 21.05 16 24Z" fill="#F69E1E"/>
                    </svg>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm opacity-80">Número de tarjeta</p>
                <p className="font-mono">•••• •••• •••• {card.lastFour}</p>
              </div>
              
              {/* Mostrar saldo para todas las tarjetas */}
              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm opacity-80">Saldo disponible</p>
                    <p className="font-bold text-lg">${card.balance.toLocaleString('es-CO')} COP</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModifyAmountClick(card);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-full transition-colors flex items-center gap-1"
                    title="Modificar monto"
                  > 
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>Saldo
                  </button>
                </div>
              </div>
              
              <div className="flex justify-between mb-4">
                <div>
                  <p className="text-xs opacity-80">TITULAR</p>
                  <p className="text-sm">{card.cardholderName}</p>
                </div>
                <div>
                  <p className="text-xs opacity-80">VENCE</p>
                  <p className="text-sm">{card.expiryMonth}/{card.expiryYear}</p>
                </div>
              </div>
              
              {/* Botón para establecer como predeterminada */}
              {!card.isDefault && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetDefaultCard(card.id);
                  }}
                  className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  Establecer como principal
                </button>
              )}
            </div>
          ))}
          
          {/* Tarjeta para añadir nueva */}
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={handleAddCardClick}
            style={{ minHeight: '180px' }}
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Añadir tarjeta</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardPage;