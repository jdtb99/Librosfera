import React, { useState } from 'react';

const RechargeBalancePage = ({ onCancel, onRecharge, savedCards = [] }) => {
  // Estado para el formulario
  const [formData, setFormData] = useState({
    amount: 50000, // Cantidad predeterminada en COP
    paymentMethod: savedCards.length > 0 ? 'savedCard' : 'newCard',
    selectedCardIndex: savedCards.length > 0 ? 0 : null,
    // Datos para nueva tarjeta
    cardNumber: '',
    cardholderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    bank: ''
  });

  // Estado para errores
  const [errors, setErrors] = useState({});
  
  // Estado para carga
  const [isLoading, setIsLoading] = useState(false);
  
  // Montos de recarga predefinidos (en pesos colombianos)
  const rechargeAmounts = [
    { amount: 50000, label: '$50,000' },
    { amount: 100000, label: '$100,000' },
    { amount: 200000, label: '$200,000' },
    { amount: 500000, label: '$500,000' }
  ];
  
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
      return 'Desconocido';
    }
  };

  // Manejador de cambio en inputs
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    
    if (name === 'cardNumber') {
      // Formatear número de tarjeta para que solo tenga números
      const formattedValue = value.replace(/\D/g, '');
      setFormData({ ...formData, [name]: formattedValue });
    } else if (type === 'radio' && name === 'amount') {
      setFormData({ ...formData, [name]: parseInt(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  // Manejador para cambiar método de pago
  const handlePaymentMethodChange = (method) => {
    setFormData({
      ...formData,
      paymentMethod: method,
      selectedCardIndex: method === 'savedCard' && savedCards.length > 0 ? 0 : null
    });
  };
  
  // Manejador para seleccionar tarjeta guardada
  const handleCardSelection = (index) => {
    setFormData({
      ...formData,
      selectedCardIndex: index,
      paymentMethod: 'savedCard'
    });
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};
    
    // Validar cantidad de recarga
    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Debe seleccionar un monto de recarga válido';
    }
    
    // Si se está usando tarjeta nueva, validar todos los campos
    if (formData.paymentMethod === 'newCard') {
      // Validar número de tarjeta
      if (!formData.cardNumber) {
        newErrors.cardNumber = 'El número de tarjeta es obligatorio';
      } else if (formData.cardNumber.length < 13 || formData.cardNumber.length > 19) {
        newErrors.cardNumber = 'El número de tarjeta debe tener entre 13 y 19 dígitos';
      }
      
      // Validar nombre del titular
      if (!formData.cardholderName || !formData.cardholderName.trim()) {
        newErrors.cardholderName = 'El nombre del titular es obligatorio';
      }
      
      // Validar mes de expiración
      if (!formData.expiryMonth) {
        newErrors.expiryMonth = 'El mes es obligatorio';
      }
      
      // Validar año de expiración
      if (!formData.expiryYear) {
        newErrors.expiryYear = 'El año es obligatorio';
      }
      
      // Validar fecha de expiración (que no esté vencida)
      if (formData.expiryMonth && formData.expiryYear) {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        const expYear = parseInt(formData.expiryYear);
        const expMonth = parseInt(formData.expiryMonth);
        
        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
          newErrors.expiry = 'La tarjeta ha expirado';
        }
      }
      
      // Validar CVV
      if (!formData.cvv) {
        newErrors.cvv = 'El código de seguridad es obligatorio';
      } else if (formData.cvv.length < 3 || formData.cvv.length > 4) {
        newErrors.cvv = 'El código de seguridad debe tener 3 o 4 dígitos';
      }
      
      // Validar banco
      if (!formData.bank || !formData.bank.trim()) {
        newErrors.bank = 'El nombre del banco es obligatorio';
      }
    } else if (formData.paymentMethod === 'savedCard') {
      // Si usa tarjeta guardada, verificar que haya seleccionado una
      if (formData.selectedCardIndex === null) {
        newErrors.selectedCardIndex = 'Debe seleccionar una tarjeta';
      }
    }
    
    return newErrors;
  };

  // Manejador para enviar formulario
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validar formulario
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
    
    setIsLoading(true);
    
    // Preparar datos para el pago
    let paymentData;
    
    if (formData.paymentMethod === 'savedCard') {
      // Usando tarjeta guardada
      paymentData = {
        type: 'savedCard',
        card: savedCards[formData.selectedCardIndex]
      };
    } else {
      // Usando nueva tarjeta
      const cardType = detectCardType(formData.cardNumber);
      const lastFour = formData.cardNumber.slice(-4);
      
      paymentData = {
        type: 'newCard',
        card: {
          type: cardType,
          lastFour,
          cardholderName: formData.cardholderName,
          expiryMonth: formData.expiryMonth,
          expiryYear: formData.expiryYear,
          bank: formData.bank
        }
      };
    }
    
    // En una aplicación real, aquí enviaríamos la solicitud al servidor
    // Simulamos una respuesta exitosa después de 1.5 segundos
    setTimeout(() => {
      onRecharge(formData.amount, paymentData);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Recargar Saldo</h2>
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
        {/* Sección de montos de recarga */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-700 mb-3">Selecciona el monto a recargar</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {rechargeAmounts.map((option) => (
              <div 
                key={option.amount}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  formData.amount === option.amount 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-blue-300'
                }`}
                onClick={() => setFormData({...formData, amount: option.amount})}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    id={`amount-${option.amount}`}
                    name="amount"
                    value={option.amount}
                    checked={formData.amount === option.amount}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor={`amount-${option.amount}`} className="ml-2 font-medium">
                    {option.label}
                  </label>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Al recargar {option.label} COP, tendrás ese saldo disponible inmediatamente
                </div>
              </div>
            ))}
          </div>
          
          {errors.amount && (
            <p className="text-red-500 text-xs mt-2">{errors.amount}</p>
          )}
        </div>
        
        {/* Sección de método de pago */}
        <div className="mb-6 border-t pt-6">
          <h3 className="text-lg font-medium text-gray-700 mb-3">Método de pago</h3>
          
          {/* Opciones de método de pago */}
          <div className="flex space-x-4 mb-4">
            {savedCards.length > 0 && (
              <button 
                type="button"
                className={`px-4 py-2 rounded-md ${
                  formData.paymentMethod === 'savedCard' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                onClick={() => handlePaymentMethodChange('savedCard')}
              >
                Tarjeta guardada
              </button>
            )}
            
            <button 
              type="button"
              className={`px-4 py-2 rounded-md ${
                formData.paymentMethod === 'newCard' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => handlePaymentMethodChange('newCard')}
            >
              Nueva tarjeta
            </button>
          </div>
          
          {/* Tarjetas guardadas */}
          {formData.paymentMethod === 'savedCard' && savedCards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {savedCards.map((card, index) => (
                <div 
                  key={index}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    formData.selectedCardIndex === index 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                  onClick={() => handleCardSelection(index)}
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{card.bank}</p>
                      <p className="text-sm text-gray-600">
                        {card.type} •••• {card.lastFour}
                      </p>
                    </div>
                    <div className="w-10">
                      {card.type === 'Visa' && (
                        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="white"/>
                          <path d="M21.6267 28.8999H18.2653L20.202 19.0999H23.5653L21.6267 28.8999ZM30.4653 19.3867C29.7053 19.0999 28.602 18.7999 27.262 18.7999C24.0267 18.7999 21.7253 20.5133 21.7033 22.9619C21.682 24.7467 23.342 25.7353 24.614 26.3467C25.9193 26.9733 26.342 27.3867 26.342 27.9476C26.3353 28.8133 25.2867 29.2133 24.3153 29.2133C22.9873 29.2133 22.2833 29.0133 21.1433 28.5619L20.722 28.3553L20.262 31.0133C21.1573 31.3867 22.8753 31.7133 24.6553 31.7267C28.082 31.7267 30.342 30.0399 30.3663 27.4076C30.3793 26.0133 29.482 24.9476 27.522 24.0133C26.3433 23.4399 25.6267 23.0399 25.6267 22.4533C25.6333 21.9219 26.2353 21.3619 27.5673 21.3619C28.6673 21.3476 29.4753 21.6133 30.0887 21.8867L30.3967 22.0133L30.8433 19.4533L30.4653 19.3867ZM36.602 19.0999H34.0553C33.2953 19.0999 32.7353 19.2999 32.3887 19.9619L27.8753 28.8999H31.2953C31.2953 28.8999 31.8353 27.4733 31.9353 27.2133H35.5653C35.642 27.5399 35.9353 28.8999 35.9353 28.8999H39.0007L36.602 19.0999ZM32.8953 24.9219C33.0953 24.3999 33.9153 22.3019 33.9153 22.3019C33.9073 22.3219 34.1153 21.7619 34.242 21.4219L34.4153 22.2019C34.4153 22.2019 34.9087 24.4133 35.0087 24.9219H32.8953Z" fill="#00579F"/>
                          <path d="M16.8667 19.0999L13.6667 25.7066L13.3333 24.1733C12.7733 22.4199 11.0667 20.5333 9.14667 19.5733L12.0533 28.8866H15.5L20.4333 19.0999H16.8667Z" fill="#00579F"/>
                          <path d="M11.5333 19.0999H6.71998L6.66665 19.3666C10.22 20.1666 12.6667 21.9666 13.3333 24.1733L12.1467 19.9733C11.9733 19.2733 11.82 19.1133 11.5333 19.0999Z" fill="#FAA61A"/>
                        </svg>
                      )}
                      {card.type === 'Mastercard' && (
                        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="white"/>
                          <path d="M24 32C28.4183 32 32 28.4183 32 24C32 19.5817 28.4183 16 24 16C19.5817 16 16 19.5817 16 24C16 28.4183 19.5817 32 24 32Z" fill="#F26122"/>
                          <path d="M24 16C21.25 16 18.75 17.2 17 19.15C17.7879 18.3669 18.7373 17.7461 19.7868 17.3297C20.8362 16.9133 21.9625 16.7099 23.1 16.7333C24.2224 16.7129 25.3375 16.9179 26.371 17.3345C27.4045 17.7511 28.3368 18.3703 29.1047 19.1491C29.8726 19.9279 30.4785 20.8686 30.8806 21.9076C31.2827 22.9467 31.4721 24.0645 31.4367 25.1867C31.41 26.3242 31.2066 27.4505 30.7902 28.5C30.3738 29.5494 29.7531 30.4988 28.97 31.2867C30.92 29.5333 32.12 27.0333 32.12 24.0333C32.12 21.0333 30.9433 18.5333 29 16.75C27.6162 16.2518 26.115 16.0027 24.6033 16.0267C24.4033 16.0267 24.2033 16.0267 24 16.0267V16Z" fill="#EA1D25"/>
                          <path d="M16 24C16 27.0333 17.1767 29.5333 19.1233 31.3167C20.5103 31.8213 22.0168 32.0654 23.5333 32.0333C23.7333 32.0333 23.9333 32.0333 24.1333 32.0333C26.9367 32.0333 29.45 30.85 31.2 28.95C30.4083 29.7333 29.455 30.3538 28.4015 30.7683C27.348 31.1828 26.2173 31.3827 25.0833 31.3533C23.9609 31.3737 22.8458 31.1687 21.8123 30.7521C20.7789 30.3356 19.8465 29.7164 19.0786 28.9376C18.3107 28.1588 17.7048 27.2181 17.3027 26.1791C16.9007 25.14 16.7112 24.0222 16.7467 22.9C16.7733 21.7625 16.9767 20.6362 17.3932 19.5868C17.8096 18.5373 18.4303 17.5879 19.2133 16.8C17.2733 18.5533 16 21.05 16 24Z" fill="#F69E1E"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {errors.selectedCardIndex && (
                <p className="text-red-500 text-xs mt-1 col-span-2">{errors.selectedCardIndex}</p>
              )}
            </div>
          )}
          
          {/* Formulario de nueva tarjeta */}
          {formData.paymentMethod === 'newCard' && (
            <div className="space-y-4">
              {/* Número de tarjeta */}
              <div>
                <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Número de tarjeta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="cardNumber"
                  name="cardNumber"
                  maxLength="19"
                  placeholder="1234 5678 9012 3456"
                  value={formData.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}
                  onChange={handleChange}
                  className={`w-full p-2 border ${errors.cardNumber ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {errors.cardNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>
                )}
              </div>
              
              {/* Nombre del titular */}
              <div>
                <label htmlFor="cardholderName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del titular <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="cardholderName"
                  name="cardholderName"
                  placeholder="Como aparece en la tarjeta"
                  value={formData.cardholderName}
                  onChange={handleChange}
                  className={`w-full p-2 border ${errors.cardholderName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {errors.cardholderName && (
                  <p className="text-red-500 text-xs mt-1">{errors.cardholderName}</p>
                )}
              </div>
              
              {/* Fila de campos de expiración y CVV */}
              <div className="grid grid-cols-3 gap-4">
                {/* Mes de expiración */}
                <div>
                  <label htmlFor="expiryMonth" className="block text-sm font-medium text-gray-700 mb-1">
                    Mes <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="expiryMonth"
                    name="expiryMonth"
                    value={formData.expiryMonth}
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
                
                {/* Año de expiración */}
                <div>
                  <label htmlFor="expiryYear" className="block text-sm font-medium text-gray-700 mb-1">
                    Año <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="expiryYear"
                    name="expiryYear"
                    value={formData.expiryYear}
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
                
                {/* CVV */}
                <div>
                  <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                    CVV <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="cvv"
                    name="cvv"
                    placeholder="123"
                    maxLength="4"
                    value={formData.cvv}
                    onChange={handleChange}
                    className={`w-full p-2 border ${errors.cvv ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
              
              {/* Mostrar errores de expiración */}
              {(errors.expiryMonth || errors.expiryYear || errors.expiry || errors.cvv) && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.expiry || errors.expiryMonth || errors.expiryYear || errors.cvv}
                </p>
              )}
              
              {/* Banco emisor */}
              <div>
                <label htmlFor="bank" className="block text-sm font-medium text-gray-700 mb-1">
                  Banco emisor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="bank"
                  name="bank"
                  placeholder="Nombre del banco"
                  value={formData.bank}
                  onChange={handleChange}
                  className={`w-full p-2 border ${errors.bank ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {errors.bank && (
                  <p className="text-red-500 text-xs mt-1">{errors.bank}</p>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Resumen de recarga */}
        <div className="border-t pt-4 mb-6">
          <h3 className="text-lg font-medium text-gray-700 mb-3">Resumen de recarga</h3>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between text-lg font-bold">
              <span>Total a pagar</span>
              <span className="text-blue-600">${formData.amount.toLocaleString('es-CO')} COP</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              El saldo se acreditará a tu cuenta inmediatamente después de realizar el pago.
            </p>
          </div>
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
                Procesando...
              </>
            ) : (
              'Recargar saldo'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RechargeBalancePage;