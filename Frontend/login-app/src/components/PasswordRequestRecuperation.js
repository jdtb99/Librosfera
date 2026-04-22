import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function PasswordResetRequest({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async e => {
    e.preventDefault();

    if (isLoading) return;

    // Reset messages
    setSuccessMessage('');
    setErrorMessage('');
    setIsLoading(true);

    try {
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // Make POST request to backend API
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/v1/users/forgot-password`, {
        email: email,
      }, config);

      // Check for success status
      console.log(response);
      if (response.data.status === "success") {
        setSuccessMessage(response.data.message);
        // Clear form
        setEmail('');
      }

    } catch (err) {
      console.error('Error:', err.response?.data || err.message);
      setErrorMessage('Ha ocurrido un error. Por favor, inténtalo de nuevo más tarde.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to handle navigation back to login
  const handleBackToLogin = () => {
    navigate('/Login', { replace: true });
  };
  
  return (
    <div className="flex h-screen w-full">
      {/* Left Side - Black Background with Logo */}
      <div className="hidden md:flex md:w-1/2 bg-black text-white flex-col items-center justify-center">
        <div className="mb-6 w-2/5">
          <img 
            src="/l2.png" 
            alt="Librosfera Logo" 
            className="w-full h-auto"
          />
        </div>
        <h1 className="text-5xl font-bold mb-2">Librosfera</h1>
        <p className="text-xl">Tu librería de confianza</p>
      </div>
      
      {/* Right Side - Password Reset Form */}
      <div className="w-full md:w-1/2 flex flex-col h-full">
        <div className="flex flex-col justify-between h-full p-10">
          {/* Top Section (Only visible on mobile) */}
          <div className="md:hidden flex flex-col items-center mb-6">
            <div className="w-2/5 mb-4">
              <img src="/l2.png" alt="Librosfera Logo" className="w-full h-auto" />
            </div>
            <h1 className="text-3xl font-bold">Librosfera</h1>
          </div>
          
          {/* Password Reset Form Section */}
          <div className="flex-grow flex flex-col justify-center">
            <h2 className="text-3xl font-bold mb-8">Recuperar contraseña</h2>
            
            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
                <p>{successMessage}</p>
              </div>
            )}
            
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <p>{errorMessage}</p>
              </div>
            )}
            
            <form className="w-full max-w-lg" onSubmit={onSubmit}>
              {/* Email Field */}
              <div className="mb-8">
                <input
                  type="email"
                  placeholder="Correo Electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full py-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                />
              </div>
              
              {/* Submit Button */}
              <div className="flex flex-col items-center gap-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-500 text-white py-2 px-6 rounded font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Enviando...' : 'Solicitar nueva contraseña'}
                </button>
                
                <button 
                  type="button" 
                  className="text-gray-500 hover:underline"
                  onClick={handleBackToLogin}
                >
                  Volver a iniciar sesión
                </button>
              </div>
            </form>
          </div>
          
          {/* Bottom Section (empty to maintain layout) */}
          <div className="mt-auto"></div>
        </div>
      </div>
    </div>
  );
}