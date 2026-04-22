import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

export default function ResetPassword({ onBackToLogin }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const { token: tokenFromUrl } = useParams();
  const navigate = useNavigate();
  
  // Check token immediately on mount before anything else
  useEffect(() => {
    const validateToken = async () => {
      if (!tokenFromUrl) {
        // No token found, redirect to request page
        navigate('/RequestChangePassword');
        return;
      }
      
      try {
        console.log("Token from URL:", tokenFromUrl);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/users/reset-password/${tokenFromUrl}`);
        
        console.log("Token validation response:", response);
        if (response.data.status === 'success') {
          // Valid token, set up the form
          setEmail(response.data.data?.email || '');
          setIsLoading(false);
        } else {
          // Invalid token, redirect
          console.error('Token validation failed');
          navigate('/RequestChangePassword');
        }
      } catch (err) {
        // Error, redirect
        console.error('Token validation error:', err);
        navigate('/RequestChangePassword');
      }
    };
    
    validateToken();
  }, [tokenFromUrl, navigate]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset messages
    setSuccessMessage('');
    setErrorMessage('');
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }
    
    // Validate password length
    if (newPassword.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    
    try {
        // console.log(tokenFromUrl);
        // console.log(pin);
        // console.log(newPassword);
        // console.log(confirmPassword);
        const response = await axios.post(
            `${process.env.REACT_APP_API_URL}/api/v1/users/reset-password/${tokenFromUrl}`,
            {
              verificationCode: pin,
              password: newPassword,
              passwordConfirm: confirmPassword
            },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
      
      if (response.data.status === 'success') {
        setSuccessMessage('Tu contraseña ha sido actualizada correctamente.');
        setNewPassword('');
        setConfirmPassword('');
        setPin('');
      } else {
        setErrorMessage('Hubo un problema al actualizar tu contraseña.');
      }
    } catch (err) {
      console.error('Error:', err.response?.data || err.message);
      setErrorMessage(err.response?.data?.message || 'Ha ocurrido un error. Por favor, inténtalo de nuevo más tarde.');
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700">Verificando enlace...</p>
        </div>
      </div>
    );
  }
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
            <h2 className="text-3xl font-bold mb-8">Crear nueva contraseña</h2>
            
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
            
            <form className="w-full max-w-lg" onSubmit={handleSubmit}>
              {/* Email Field (Disabled) */}
              <div className="mb-6">
                <input
                  type="email"
                  placeholder="Correo Electrónico"
                  value={email}
                  disabled
                  className="w-full py-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0 bg-gray-100"
                />
              </div>
              
              {/* New Password Field */}
              <div className="mb-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nueva Contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full py-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                />
                <button 
                  type="button"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              <div className="mb-6">
                <p className="text-xs text-gray-500">Al menos 8 caracteres</p>
              </div>
              
              {/* Confirm Password Field */}
              <div className="mb-6 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Repetir Nueva Contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full py-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                />
              </div>
              
              {/* PIN Field */}
              <div className="mb-8">
                <input
                  type="number"
                  placeholder="Código de verificación"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  className="w-full py-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                />
                <p className="text-xs text-gray-500 mt-1">Ingresa el código enviado a tu correo electrónico</p>
              </div>
              
              {/* Submit Button */}
              <div className="flex flex-col items-center gap-4">
                <button 
                  type="submit" 
                  className="bg-blue-500 text-white py-2 px-6 rounded font-medium hover:bg-blue-600 transition-colors"
                >
                  Cambiar Contraseña
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