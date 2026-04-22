import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {getCookie} from './authUtils';

const AddCardPage = ({ onSave, onCancel, card, mode = 'add' }) => {
  const isEditMode = mode === 'edit';
  
  // Estado para los datos de la tarjeta
  const [formMessage, setFormMessage] = useState({ type: '', text: '' });
  const [cardData, setCardData] = useState({
    ultimos_digitos: '',
    Estado: '',
    marca: '',
    predeterminada: '',
    cardNumber: '',
    cardholderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    tipo: 'credito'
  });

  // Estado para errores de validación
  const [errors, setErrors] = useState({});
  
  // Estado para gestionar la carga
  const [isLoading, setIsLoading] = useState(false);

  // Get authentication token from cookies
  const getAuthToken = () => {
    const dataCookie = getCookie("data");
    if (!dataCookie) return '';
    
    try {
      const parsedData = JSON.parse(dataCookie);
      return parsedData.authToken || '';
    } catch (e) {
      console.error('Error parsing auth token:', e);
      return '';
    }
  };

  // Load card data when in edit mode
  useEffect(() => {
    const fetchCardDetails = async () => {
      console.log("card", card);
      try {
        console.log("card", card);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/tarjetas/${card}`, {
          headers: {
            Authorization: `Bearer ${getAuthToken()}` // Replace with actual token or dynamic auth
          }
        });

        const fetchedCard = response.data;

        console.log("Fetched card for edit:", fetchedCard);

        const maskedCardNumber = `**** **** **** ${fetchedCard.data.ultimos_digitos}`;

        setCardData({
          ultimos_digitos: `${fetchedCard.data.ultimos_digitos}`,
          Estado: fetchedCard.data.activa,
          marca: fetchedCard.data.marca,
          predeterminada: fetchedCard.data.predeterminada,
          cardNumber: '', // Never show full number in UI
          cardholderName: fetchedCard.data.nombre_titular || '',
          expiryMonth: fetchedCard.data.fecha_expiracion?.mes?.toString().padStart(2, '0') || '',
          expiryYear: fetchedCard.data.fecha_expiracion?.anio?.toString() || '',
          cvv: '', // Never show CVV in edit
          tipo: fetchedCard.data.tipo || 'credito'
        });

        console.log(fetchedCard.data.ultimos_digitos);
      } catch (error) {
        console.error('Failed to fetch card details:', error);
      }
    };

    console.log("card", card);

    if (isEditMode && card) {
      fetchCardDetails();
    }
  }, [isEditMode, card]);

  // Manejador de cambios en los inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'cardNumber') {
      // Formatear número de tarjeta para que solo tenga números
      const formattedValue = value.replace(/\D/g, '');
      setCardData({ ...cardData, [name]: formattedValue });
    } else {
      setCardData({ ...cardData, [name]: value });
    }
  };

  // Detectar tipo de tarjeta basado en el número
  const detectCardType = (number) => {
    const firstDigit = number.charAt(0);
    const firstTwoDigits = number.substring(0, 2);
    
    if (firstDigit === '4') {
      return 'Visa';
    } else if (['51', '52', '53', '54', '55'].includes(firstTwoDigits)) {
      return 'Mastercard';
    } else if (['34', '37'].includes(firstTwoDigits)) {
      return 'Amex';
    } else {
      return '';
    }
  };

  // Actualizar tipo de tarjeta cuando cambia el número
  React.useEffect(() => {
    if (cardData.cardNumber.length >= 2) {
      const type = detectCardType(cardData.cardNumber);
      setCardData(prev => ({ ...prev, type }));
    }
  }, [cardData.cardNumber]);

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};
    
    // En modo edición, algunos campos son opcionales
    if (!isEditMode) {
      // Validar número de tarjeta (solo en modo agregar)
      if (!cardData.cardNumber) {
        newErrors.cardNumber = 'El número de tarjeta es obligatorio';
      } else if (cardData.cardNumber.length < 13 || cardData.cardNumber.length > 19) {
        newErrors.cardNumber = 'El número de tarjeta debe tener entre 13 y 19 dígitos';
      }
      
      // Validar CVV (solo en modo agregar)
      if (!cardData.cvv) {
        newErrors.cvv = 'El código de seguridad es obligatorio';
      } else if (cardData.cvv.length < 3 || cardData.cvv.length > 4) {
        newErrors.cvv = 'El código de seguridad debe tener 3 o 4 dígitos';
      }
    }
    
    // Validar nombre del titular
    if (!cardData.cardholderName.trim()) {
      newErrors.cardholderName = 'El nombre del titular es obligatorio';
    }
    
    // Validar mes de expiración
    if (!cardData.expiryMonth) {
      newErrors.expiryMonth = 'El mes es obligatorio';
    }
    
    // Validar año de expiración
    if (!cardData.expiryYear) {
      newErrors.expiryYear = 'El año es obligatorio';
    }
    
    // Validar fecha de expiración (que no esté vencida)
    if (cardData.expiryMonth && cardData.expiryYear) {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      const expYear = parseInt(cardData.expiryYear);
      const expMonth = parseInt(cardData.expiryMonth);
      
      if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
        newErrors.expiry = 'La tarjeta ha expirado';
      }
    }

    if (!cardData.tipo) {
      newErrors.tipo = 'El tipo de tarjeta es obligatorio';
    }
    
    return newErrors;
  };

  // Manejar el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar formulario
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
    
    setIsLoading(true);

    try {
      const token = getAuthToken();
      if (!token) {
        setFormMessage({ type: 'error', text: 'No se encontró la sesión. Por favor inicie sesión nuevamente.' });
        setIsLoading(false);
        return;
      }

      let response;

      if (isEditMode) {
        // Preparar datos para la API de actualización
        const updateData = {
          nombre_titular: cardData.cardholderName.toUpperCase(),
          mes_expiracion: parseInt(cardData.expiryMonth),
          anio_expiracion: parseInt(cardData.expiryYear),
          tipo: cardData.tipo
        };

        // Solo incluir marca si tenemos número de tarjeta
        if (cardData.cardNumber && cardData.type) {
          updateData.marca = cardData.type.toLowerCase();
        }

        // Realizar petición PUT para actualizar
        response = await axios.put(`${process.env.REACT_APP_API_URL}/api/v1/tarjetas/${card}`, updateData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        });
      } else {
        // Preparar datos para la API de creación
        const apiData = {
          numero_tarjeta: cardData.cardNumber,
          nombre_titular: cardData.cardholderName.toUpperCase(),
          mes_expiracion: parseInt(cardData.expiryMonth),
          anio_expiracion: parseInt(cardData.expiryYear),
          cvv: cardData.cvv,
          tipo: cardData.tipo,
          marca: cardData.type?.toLowerCase() || ''
        };

        // Realizar petición POST para crear
        response = await axios.post(`${process.env.REACT_APP_API_URL}/api/v1/tarjetas`, apiData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        });
      }

      setFormMessage({ 
        type: 'success', 
        text: isEditMode ? 'Tarjeta actualizada exitosamente.' : 'Tarjeta agregada exitosamente.' 
      });
      setTimeout(() => onCancel(), 1500);
      
    } catch (error) {
      console.error('Error al guardar la tarjeta:', error);
      setFormMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al procesar la solicitud. Intente nuevamente.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Display card number for preview
  const displayCardNumber = () => {
    if (isEditMode && card) {
      return `**** **** **** ${cardData.ultimos_digitos}`;
    } else if (cardData.cardNumber) {
      return cardData.cardNumber.replace(/(\d{4})/g, '$1 ').trim();
    } else {
      return '•••• •••• •••• ••••';
    }
  };

  // Get card type for display
  const getCardTypeForDisplay = () => {
    if (isEditMode && card) {
      return cardData.marca ? cardData.marca.charAt(0).toUpperCase() + cardData.marca.slice(1) : '';
    }
    return cardData.marca || '';
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">
          {isEditMode ? 'Editar Tarjeta' : 'Añadir Tarjeta'}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección de previsualización de tarjeta */}
        <div className="mb-6">
          <div className={`h-48 w-full rounded-xl p-5 ${
            getCardTypeForDisplay() === 'Visa' ? 'bg-gradient-to-r from-blue-500 to-blue-700' : 
            getCardTypeForDisplay() === 'Mastercard' ? 'bg-gradient-to-r from-red-500 to-yellow-500' : 
            'bg-gradient-to-r from-gray-700 to-gray-900'
          } text-white shadow-lg`}>
            <div className="flex justify-between items-start mb-4">
              <div className="text-sm font-light opacity-80">
                {cardData.marca || 'Banco'}
              </div>
              <div className="w-12 h-8">
                {getCardTypeForDisplay() === 'Visa' && (
                  <svg className="h-full w-full" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="white"/>
                    <path d="M21.6267 28.8999H18.2653L20.202 19.0999H23.5653L21.6267 28.8999ZM30.4653 19.3867C29.7053 19.0999 28.602 18.7999 27.262 18.7999C24.0267 18.7999 21.7253 20.5133 21.7033 22.9619C21.682 24.7467 23.342 25.7353 24.614 26.3467C25.9193 26.9733 26.342 27.3867 26.342 27.9476C26.3353 28.8133 25.2867 29.2133 24.3153 29.2133C22.9873 29.2133 22.2833 29.0133 21.1433 28.5619L20.722 28.3553L20.262 31.0133C21.1573 31.3867 22.8753 31.7133 24.6553 31.7267C28.082 31.7267 30.342 30.0399 30.3663 27.4076C30.3793 26.0133 29.482 24.9476 27.522 24.0133C26.3433 23.4399 25.6267 23.0399 25.6267 22.4533C25.6333 21.9219 26.2353 21.3619 27.5673 21.3619C28.6673 21.3476 29.4753 21.6133 30.0887 21.8867L30.3967 22.0133L30.8433 19.4533L30.4653 19.3867ZM36.602 19.0999H34.0553C33.2953 19.0999 32.7353 19.2999 32.3887 19.9619L27.8753 28.8999H31.2953C31.2953 28.8999 31.8353 27.4733 31.9353 27.2133H35.5653C35.642 27.5399 35.9353 28.8999 35.9353 28.8999H39.0007L36.602 19.0999ZM32.8953 24.9219C33.0953 24.3999 33.9153 22.3019 33.9153 22.3019C33.9073 22.3219 34.1153 21.7619 34.242 21.4219L34.4153 22.2019C34.4153 22.2019 34.9087 24.4133 35.0087 24.9219H32.8953Z" fill="#00579F"/>
                    <path d="M16.8667 19.0999L13.6667 25.7066L13.3333 24.1733C12.7733 22.4199 11.0667 20.5333 9.14667 19.5733L12.0533 28.8866H15.5L20.4333 19.0999H16.8667Z" fill="#00579F"/>
                    <path d="M11.5333 19.0999H6.71998L6.66665 19.3666C10.22 20.1666 12.6667 21.9666 13.3333 24.1733L12.1467 19.9733C11.9733 19.2733 11.82 19.1133 11.5333 19.0999Z" fill="#FAA61A"/>
                  </svg>
                )}
                {getCardTypeForDisplay() === 'Mastercard' && (
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
              <div className="font-medium">
                {displayCardNumber()}
              </div>
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs opacity-80">TITULAR</p>
                <p className="font-medium">
                  {cardData.cardholderName || 'NOMBRE DEL TITULAR'}
                </p>
              </div>
              <div>
                <p className="text-xs opacity-80">VENCE</p>
                <p className="font-medium">
                  {cardData.expiryMonth || 'MM'}/{cardData.expiryYear || 'YY'}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Formulario de la tarjeta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Número de tarjeta - solo en modo agregar */}
          {!isEditMode && (
            <div className="col-span-2">
              <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Número de tarjeta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="cardNumber"
                name="cardNumber"
                maxLength="19"
                placeholder="1234 5678 9012 3456"
                value={cardData.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}
                onChange={handleChange}
                className={`w-full p-2 border ${errors.cardNumber ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {errors.cardNumber && (
                <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>
              )}
            </div>
          )}

          {/* Información de tarjeta existente en modo edición */}
          {isEditMode && card && (
            <div className="col-span-2">
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Información de la tarjeta</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Número:</span>
                    <span className="ml-2 font-mono">**** **** **** {cardData.ultimos_digitos}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Marca:</span>
                    <span className="ml-2 capitalize">{cardData.marca}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Estado:</span>
                    <span className={`ml-2 ${cardData.Estado ? 'text-green-600' : 'text-red-600'}`}>
                      {cardData.Estado ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Predeterminada:</span>
                    <span className={`ml-2 ${cardData.predeterminada ? 'text-blue-600' : 'text-gray-600'}`}>
                      {cardData.predeterminada ? 'Sí' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Nombre del titular */}
          <div className="col-span-2">
            <label htmlFor="cardholderName" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del titular <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="cardholderName"
              name="cardholderName"
              placeholder="Como aparece en la tarjeta"
              value={cardData.cardholderName}
              onChange={handleChange}
              onKeyPress={(e) => {
                // Solo permitir letras, espacios y teclas de control
                if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'Enter') {
                  e.preventDefault();
                }
              }}
              onPaste={(e) => {
                // Prevenir pegar contenido con números o símbolos
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text');
                const lettersOnly = paste.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
                if (lettersOnly) {
                  setCardData({ ...cardData, cardholderName: lettersOnly });
                }
              }}
              className={`w-full p-2 border ${errors.cardholderName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.cardholderName && (
              <p className="text-red-500 text-xs mt-1">{errors.cardholderName}</p>
            )}
          </div>
          
          {/* Fecha de expiración */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de expiración <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <select
                  name="expiryMonth"
                  value={cardData.expiryMonth}
                  onChange={handleChange}
                  className={`w-full p-2 border ${errors.expiryMonth || errors.expiry ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="">Mes</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = i + 1;
                    return (
                      <option key={month} value={month.toString().padStart(2, '0')}>
                        {month.toString().padStart(2, '0')}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <select
                  name="expiryYear"
                  value={cardData.expiryYear}
                  onChange={handleChange}
                  className={`w-full p-2 border ${errors.expiryYear || errors.expiry ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="">Año</option>
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            {(errors.expiryMonth || errors.expiryYear || errors.expiry) && (
              <p className="text-red-500 text-xs mt-1">
                {errors.expiry || errors.expiryMonth || errors.expiryYear}
              </p>
            )}
          </div>
          
          {/* CVV - solo en modo agregar */}
          {!isEditMode && (
            <div>
              <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                Código de seguridad (CVV) <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="cvv"
                name="cvv"
                placeholder="123"
                maxLength="4"
                value={cardData.cvv}
                onChange={handleChange}
                onKeyPress={(e) => {
                  // Solo permitir números (0-9) y teclas de control
                  if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'Enter') {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => {
                  // Prevenir pegar contenido no numérico
                  e.preventDefault();
                  const paste = (e.clipboardData || window.clipboardData).getData('text');
                  const numericOnly = paste.replace(/\D/g, '');
                  if (numericOnly) {
                    setCardData({ ...cardData, cvv: numericOnly.slice(0, 4) });
                  }
                }}
                className={`w-full p-2 border ${errors.cvv ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {errors.cvv && (
                <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>
              )}
            </div>
          )}
          
          {/* Tipo de tarjeta */}
          <div className={!isEditMode ? '' : 'col-span-2'}>
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de tarjeta <span className="text-red-500">*</span>
            </label>
            <select
              id="tipo"
              name="tipo"
              value={cardData.tipo}
              onChange={handleChange}
              className={`w-full p-2 border ${errors.tipo ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="credito">Crédito</option>
              <option value="debito">Débito</option>
            </select>
            {errors.tipo && (
              <p className="text-red-500 text-xs mt-1">{errors.tipo}</p>
            )}
          </div>

          {/* Show API error if exists */}
          {errors.api && (
            <div className="col-span-2">
              <p className="text-red-500 text-sm">{errors.api}</p>
            </div>
          )}

          {formMessage.text && (
            <div className={`col-span-2 mt-3 p-3 rounded ${formMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {formMessage.text}
            </div>
          )}
        </div>
        
        {/* Botones de acción */}
        <div className="flex justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none flex items-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isEditMode ? 'Actualizando...' : 'Guardando...'}
              </>
            ) : (
              isEditMode ? 'Actualizar tarjeta' : 'Guardar tarjeta'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddCardPage;