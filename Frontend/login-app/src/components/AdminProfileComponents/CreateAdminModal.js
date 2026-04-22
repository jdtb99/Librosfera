import React, { useState } from 'react';
import axios from 'axios';

const CreateAdminModal = ({ isOpen, onClose, getAuthToken, API_BASE_URL }) => {
  const [success, setSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const { email, password } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccess('');
    
    try {
      // Make POST request to backend API
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/users/admin`,
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAuthToken()}`,
          },
        }
      );

      // Clear form
      setFormData({
        email: '',
        password: ''
      });
      setSuccess('Administrador creado con éxito!');
      
      // Close modal after success (with delay for user to see the success message)
      setTimeout(() => {
        onClose(true); // true indicates refresh needed
      }, 2000);
      
    } catch (err) {
      console.error('Error creating admin:', err.response?.data || err.message);
      setErrorMessage(err.response?.data?.message || 'Error creando administrador');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button 
          onClick={() => onClose(false)} 
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-2xl font-bold">Crear Administrador</h2>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
            {errorMessage}
          </div>
        )}
        
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
            <input 
              type="email"
              className="w-full p-2 border border-gray-300 rounded"
              name="email"
              id="email"
              value={email}
              onChange={onChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input 
              type="password"
              className="w-full p-2 border border-gray-300 rounded"
              name="password"
              id="password"
              value={password}
              onChange={onChange}
              required
            />
          </div>
          
          <div className="flex justify-between gap-4 pt-4">
            <button 
              type="button" 
              onClick={() => onClose(false)}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded font-medium hover:bg-gray-300 transition-colors"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded font-medium hover:bg-blue-600 transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAdminModal;