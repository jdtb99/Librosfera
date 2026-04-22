import React, { useState } from 'react';

export default function PasswordResetPage({ onBackToLogin }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
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
            
            <form className="w-full max-w-lg">
              {/* Email Field */}
              <div className="mb-6">
                <input
                  type="email"
                  placeholder="Correo Electrónico"
                  className="w-full py-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                />
              </div>
              
              {/* Current Password Field */}
              <div className="mb-6 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña Actual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
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
              
              {/* New Password Field */}
              <div className="mb-1">
                <input
                  type="password"
                  placeholder="Nueva Contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full py-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                />
              </div>
              <div className="mb-6">
                <p className="text-xs text-gray-500">Al menos 8 caracteres</p>
              </div>
              
              {/* Confirm Password Field */}
              <div className="mb-8">
                <input
                  type="password"
                  placeholder="Repetir Nueva Contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full py-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                />
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
                  onClick={onBackToLogin}
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