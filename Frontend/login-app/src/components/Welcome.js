import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
};

const verifyToken = async (token) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/auth/verify-token`, {
        headers: {
          'Authorization': `Bearer ${String(token)}`,
        },
      });
  
      // If request is successful, return true
      console.log(response);
      
      return true;
    } catch (err) {
      // If there is an error, return false
      // setError(err.response ? err.response.data : 'Error verifying token');
      return false;
    }
  };

export default function ProfilePage() {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      // Get data from cookies
      const token = getCookie("data");
      const UserData = JSON.parse(token);
      
      const isVerified = await verifyToken(UserData.Data.token);
      console.log("token:");
      console.log(UserData.Data.token);

      if (!token || !isVerified) {
        console.log('No token found in cookies, redirecting to login...');
        //navigate('/Login');
        return;
      }

      try {
        console.log(UserData.Data);
        setUserData(UserData.Data);
      } catch (err) {
        console.error('Error parsing user data:', err);
        setError('No se pudo cargar la información del perfil');
        navigate('/Login');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [navigate]);
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700">Cargando perfil...</p>
        </div>
      </div>
    );
  }
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Get primary address if available
  const primaryAddress = userData?.direcciones && userData.direcciones.length > 0 
    ? userData.direcciones[0]
    : null;
  
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left Side - Black Background with Logo */}
      <div className="hidden md:flex md:w-1/3 bg-black text-white flex-col items-center justify-center h-full sticky top-0">
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
      
      {/* Right Side - Profile Content */}
      <div className="w-full md:w-2/3 flex flex-col h-full bg-gray-50 overflow-y-auto">
        <div className="flex flex-col min-h-full p-10">
          {/* Top Section (Only visible on mobile) */}
          <div className="md:hidden flex flex-col items-center mb-6">
            <div className="w-2/5 mb-4">
              <img src="/l2.png" alt="Librosfera Logo" className="w-full h-auto" />
            </div>
            <h1 className="text-3xl font-bold">Librosfera</h1>
          </div>
          
          {/* Profile Section */}
          {error ? (
            <div className="flex-grow flex flex-col items-center justify-center">
              <div className="bg-red-100 p-4 rounded-lg text-red-700 mb-4">
                <p>{error}</p>
              </div>
              <button 
                onClick={() => navigate('/Login')}
                className="bg-blue-500 text-white py-2 px-6 rounded font-medium hover:bg-blue-600 transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <div className="flex-grow flex flex-col">
              <h2 className="text-3xl font-bold mb-8">Mi Perfil</h2>
              
              {/* User Profile Card */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  {/* Profile Image */}
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {userData?.foto_perfil && userData.foto_perfil !== "default.jpg" ? (
                      <img 
                        src={`/uploads/profiles/${userData.foto_perfil}`} 
                        alt={`${userData.nombres}'s profile`} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl text-gray-400">
                        {userData?.nombres?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold">{userData?.nombres} {userData?.apellidos}</h3>
                    <p className="text-gray-600 mb-1">{userData?.email}</p>
                    <p className="text-gray-500 text-sm mb-4">@{userData?.usuario}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-gray-500 text-sm">ID Cliente</p>
                        <p className="font-medium">{userData?.id_cliente || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm">Miembro desde</p>
                        <p className="font-medium">{formatDate(userData?.fecha_registro)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm">Tipo de cuenta</p>
                        <p className="font-medium capitalize">{userData?.tipo_usuario || 'Usuario'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm">DNI</p>
                        <p className="font-medium">{userData?.DNI || 'No especificado'}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <button className="bg-blue-500 text-white py-2 px-6 rounded font-medium hover:bg-blue-600 transition-colors">
                        Editar Perfil
                      </button>
                      
                      {userData?.tipo_usuario === "root" && (
                        <button 
                          onClick={() => navigate('/CreateAdmin')}
                          className="bg-purple-600 text-white py-2 px-6 rounded font-medium hover:bg-purple-700 transition-colors"
                        >
                          Crear Administrador
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* User Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h4 className="text-xl font-semibold mb-4">Información Personal</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-500 text-sm">Nombre Completo</p>
                      <p className="font-medium">{userData?.nombres || 'N/A'} {userData?.apellidos || ''}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Correo Electrónico</p>
                      <p className="font-medium">{userData?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Fecha de Nacimiento</p>
                      <p className="font-medium">{formatDate(userData?.fecha_nacimiento)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Lugar de Nacimiento</p>
                      <p className="font-medium">{userData?.lugar_nacimiento || 'No especificado'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Género</p>
                      <p className="font-medium">{userData?.genero || 'No especificado'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Dirección</p>
                      <p className="font-medium">
                        {primaryAddress ? (
                          <>
                            {primaryAddress.calle}, {primaryAddress.ciudad}, {primaryAddress.pais}
                          </>
                        ) : 'No especificada'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Account Settings and Preferences */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h4 className="text-xl font-semibold mb-4">Preferencias</h4>
                  
                  <div className="mb-6">
                    <p className="text-gray-500 text-sm mb-2">Temas de Interés</p>
                    <div className="flex flex-wrap gap-2">
                      {userData?.preferencias?.temas && userData.preferencias.temas.length > 0 ? (
                        userData.preferencias.temas.map((tema, index) => (
                          <span 
                            key={index} 
                            className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                          >
                            {tema}
                          </span>
                        ))
                      ) : (
                        <p className="text-gray-500">No hay temas seleccionados</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-gray-500 text-sm mb-2">Autores Favoritos</p>
                    {userData?.preferencias?.autores && userData.preferencias.autores.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {userData.preferencias.autores.map((autor, index) => (
                          <span 
                            key={index} 
                            className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm"
                          >
                            {autor}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No hay autores favoritos seleccionados</p>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Recibir Noticias</p>
                        <p className="text-gray-500 text-sm">Suscripción al boletín</p>
                      </div>
                      <div className="relative">
                        <div className={`w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${userData?.suscrito_noticias ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform duration-300 ease-in-out ${userData?.suscrito_noticias ? 'transform translate-x-5' : ''}`}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Cambiar Contraseña</p>
                        <p className="text-gray-500 text-sm">Actualiza tu contraseña de acceso</p>
                      </div>
                      <button className="text-blue-500 hover:underline">
                        Cambiar
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-600">Cerrar Sesión</p>
                        <p className="text-gray-500 text-sm">Salir de tu cuenta</p>
                      </div>
                      <button 
                        className="text-red-600 hover:underline"
                        onClick={() => {
                          document.cookie = "data=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                          navigate('/Login');
                        }}
                      >
                        Salir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}