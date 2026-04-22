import React, { useState, useEffect } from 'react';
import { formatDate } from './authUtils';
import { useNavigate } from 'react-router-dom';
import CachedImage from '../CachedImage';
import EditProfile from '../EditProfile';
import axios from 'axios';
import { getAuthToken } from './authUtils';


const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;

const ProfilePage = ({ userData }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addresses, setAddresses] = useState(userData?.direcciones || []);
  
  // Estado para el formulario de dirección
  const [addressForm, setAddressForm] = useState({
    tipo: 'casa',
    direccion_completa: '',
    ciudad: '',
    departamento: '',
    codigo_postal: '',
    pais: 'Colombia',
    telefono_contacto: '',
    referencia: '',
    predeterminada: false
  });

  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Get primary address if available
  const primaryAddress = addresses && addresses.length > 0 
    ? addresses.find(addr => addr.es_principal) || addresses[0]
    : null;
    
  // Handle logout click
  const handleLogout = () => {
    localStorage.removeItem('shoppingCart');
    document.cookie = "data=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = '/Login';
  };

  // Define profile image base URL - same as in EditProfile
  const PROFILE_PIC_BASE_URL = '';
  const DEFAULT_PROFILE_PIC = `${process.env.REACT_APP_API_URL}/uploads/profiles/default.jpg`;

  // Get profile image URL
  const profileImage = userData?.foto_perfil 
    ? `${PROFILE_PIC_BASE_URL}${userData.foto_perfil}`
    : `${PROFILE_PIC_BASE_URL}${DEFAULT_PROFILE_PIC}`;

  // Handle edit profile button click
  const handleEditProfile = () => {
    setIsEditing(true);
  };

  // Handle go back from edit profile
  const handleGoBack = () => {
    setIsEditing(false);
  };

  const getAxiosConfig = () => {
    const token = getAuthToken();
    return {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
    };
  }

  const fetchAddresses = async () => {
    try {
      setIsLoadingAddresses(true);
      const response = await axios.get(`${API_BASE_URL}/direcciones`, getAxiosConfig());
      if (response.data.status === 'success') {
        setAddresses(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      if (error.response?.status === 401) {
        // Handle unauthorized - maybe redirect to login
        console.log('Unauthorized access - redirecting to login');
      }
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  useEffect(() => {
  fetchAddresses();
}, []);

  // Handle address form changes
  const handleAddressChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAddressForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Open address modal for adding new address
  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({
      tipo: 'casa',
      direccion_completa: '',
      ciudad: '',
      departamento: '',
      codigo_postal: '',
      pais: 'Colombia',
      telefono_contacto: '',
      referencia: '',
      predeterminada: addresses.length === 0 // Primera dirección será predeterminada por defecto
    });
    setShowAddressModal(true);
  };

  // Open address modal for editing existing address
  const handleEditAddress = (address, index) => {
    setEditingAddress(index);
    setAddressForm({
      tipo: address.tipo || 'casa',
      direccion_completa: address.direccion_completa || '',
      ciudad: address.ciudad || '',
      departamento: address.departamento || '',
      codigo_postal: address.codigo_postal || '',
      pais: address.pais || 'Colombia',
      telefono_contacto: address.telefono_contacto || '',
      referencia: address.referencia || '',
      predeterminada: address.predeterminada || false
    });
    setShowAddressModal(true);
  };

  // Save address (add or edit)
  const handleSaveAddress = async () => {
    if (!addressForm.direccion_completa.trim() || !addressForm.ciudad.trim() || !addressForm.departamento.trim()) {
      alert('Por favor completa los campos obligatorios (Dirección completa, Ciudad, Departamento)');
      return;
    }

    try {
      if (editingAddress !== null) {
        // Editando dirección existente
        const addressId = addresses[editingAddress]._id;
        const response = await axios.put(
          `${API_BASE_URL}/direcciones/${addressId}`, 
          addressForm, 
          getAxiosConfig()
        );
        
        if (response.data.status === 'success') {
          // Refetch addresses to get updated data
          await fetchAddresses();
          
          // If setting as predeterminada, make API call
          if (addressForm.predeterminada) {
            await axios.patch(
              `${API_BASE_URL}/direcciones/${addressId}/predeterminada`, 
              {}, 
              getAxiosConfig()
            );
          }
        }
      } else {
        // Agregando nueva dirección
        const response = await axios.post(
          `${API_BASE_URL}/direcciones`, 
          addressForm, 
          getAxiosConfig()
        );
        
        if (response.data.status === 'success') {
          // Refetch addresses to get updated data
          await fetchAddresses();
          
          // If setting as predeterminada, make API call
          if (addressForm.predeterminada && response.data.data) {
            await axios.patch(
              `${API_BASE_URL}/direcciones/${response.data.data._id}/predeterminada`, 
              {}, 
              getAxiosConfig()
            );
          }
        }
      }
      
      setShowAddressModal(false);
      console.log('Dirección guardada exitosamente');
    } catch (error) {
      console.error('Error saving address:', error);
      if (error.response?.status === 401) {
        alert('Sesión expirada. Por favor inicia sesión nuevamente.');
      } else if (error.response?.status === 400) {
        alert('Datos inválidos. Por favor revisa la información ingresada.');
      } else {
        alert('Error al guardar la dirección. Por favor intenta nuevamente.');
      }
    }
  };


  // Delete address
  const handleDeleteAddress = async (index) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta dirección?')) {
      try {
        const addressId = addresses[index]._id;
        const response = await axios.delete(
          `${API_BASE_URL}/direcciones/${addressId}`, 
          getAxiosConfig()
        );
        
        if (response.data.status === 'success') {
          await fetchAddresses(); // Refetch addresses
          console.log('Dirección eliminada exitosamente');
        }
      } catch (error) {
        console.error('Error deleting address:', error);
        if (error.response?.status === 401) {
          alert('Sesión expirada. Por favor inicia sesión nuevamente.');
        } else if (error.response?.status === 404) {
          alert('Dirección no encontrada.');
        } else {
          alert('Error al eliminar la dirección. Por favor intenta nuevamente.');
        }
      }
    }
  };

  // Set address as primary
  const handleSetPrimary = async (index) => {
    try {
      const addressId = addresses[index]._id;
      const response = await axios.patch(
        `${API_BASE_URL}/direcciones/${addressId}/predeterminada`, 
        {}, 
        getAxiosConfig()
      );
      
      if (response.data.status === 'success') {
        await fetchAddresses(); // Refetch addresses to update state
        console.log('Dirección predeterminada actualizada');
      }
    } catch (error) {
      console.error('Error setting primary address:', error);
      if (error.response?.status === 401) {
        alert('Sesión expirada. Por favor inicia sesión nuevamente.');
      } else if (error.response?.status === 404) {
        alert('Dirección no encontrada.');
      } else {
        alert('Error al establecer dirección predeterminada. Por favor intenta nuevamente.');
      }
    }
  };

  // Cancel address modal
  const handleCancelAddress = () => {
    setShowAddressModal(false);
    setEditingAddress(null);
  };

  // If in editing mode, show the EditProfile component
  if (isEditing) {
    return <EditProfile userData={userData} userType={userData?.tipo_usuario} onGoBack={handleGoBack} />;
  }

  return (
    <div className="w-full flex flex-col h-full bg-gray-50 overflow-y-auto p-6">
      <div className="flex flex-col min-h-full">
        <h2 className="text-3xl font-bold mb-8">Mi Perfil</h2>
        
        {/* User Profile Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Profile Image - updated to use CachedImage like in EditProfile */}
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-blue-500">
              <CachedImage 
                src={profileImage} 
                alt="Perfil" 
                className="w-full h-full object-cover"
                fallbackSrc={`${PROFILE_PIC_BASE_URL}${DEFAULT_PROFILE_PIC}`}
              />
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
                <button 
                  className="bg-blue-500 text-white py-2 px-6 rounded font-medium hover:bg-blue-600 transition-colors"
                  onClick={handleEditProfile}
                >
                  Editar Perfil
                </button>
                
                {userData?.tipo_usuario === "root" && (
                  <button 
                    onClick={() => window.location.href = '/CreateAdmin'}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            </div>
          </div>

          {/* Addresses Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-semibold">Direcciones de Envío</h4>
              <button
                onClick={handleAddAddress}
                className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors"
              >
                + Agregar
              </button>
            </div>

            {isLoadingAddresses ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p>Cargando direcciones...</p>
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No tienes direcciones registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((address, index) => (
                  <div key={address._id || index} className={`border rounded-lg p-3 ${address.predeterminada ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium capitalize">{address.tipo}</p>
                          {address.predeterminada && (
                            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Principal</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {address.direccion_completa}
                        </p>
                        <p className="text-sm text-gray-600">
                          {address.ciudad}, {address.departamento}
                          {address.codigo_postal && ` ${address.codigo_postal}`}
                        </p>
                        <p className="text-sm text-gray-600">{address.pais}</p>
                        {address.telefono_contacto && (
                          <p className="text-sm text-gray-600">Tel: {address.telefono_contacto}</p>
                        )}
                        {address.referencia && (
                          <p className="text-sm text-gray-500 italic">{address.referencia}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 ml-2">
                        <button
                          onClick={() => handleEditAddress(address, index)}
                          className="text-blue-500 hover:text-blue-700 text-xs"
                        >
                          Editar
                        </button>
                        {!address.predeterminada && (
                          <button
                            onClick={() => handleSetPrimary(index)}
                            className="text-green-500 hover:text-green-700 text-xs"
                          >
                            Hacer predeterminada
                          </button>
                        )}
                        {addresses.length > 1 && (
                          <button
                            onClick={() => handleDeleteAddress(index)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <button 
                  className="text-blue-500 hover:underline"
                  onClick={handleEditProfile}
                >
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
                  onClick={handleLogout}
                >
                  Salir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingAddress !== null ? 'Editar Dirección' : 'Agregar Nueva Dirección'}
              </h3>
              
              <div className="space-y-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de dirección
                  </label>
                  <select
                    name="tipo"
                    value={addressForm.tipo}
                    onChange={handleAddressChange}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="casa">Casa</option>
                    <option value="trabajo">Trabajo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección completa *
                  </label>
                  <input
                    type="text"
                    name="direccion_completa"
                    value={addressForm.direccion_completa}
                    onChange={handleAddressChange}
                    placeholder="Calle 123 #45-67, Apartamento 8B"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ciudad *
                    </label>
                    <input
                      type="text"
                      name="ciudad"
                      value={addressForm.ciudad}
                      onChange={handleAddressChange}
                      placeholder="Bogotá"
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departamento *
                    </label>
                    <input
                      type="text"
                      name="departamento"
                      value={addressForm.departamento}
                      onChange={handleAddressChange}
                      placeholder="Cundinamarca"
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código Postal
                    </label>
                    <input
                      type="text"
                      name="codigo_postal"
                      value={addressForm.codigo_postal}
                      onChange={handleAddressChange}
                      placeholder="110111"
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      País
                    </label>
                    <select
                      name="pais"
                      value={addressForm.pais}
                      onChange={handleAddressChange}
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Colombia">Colombia</option>
                      <option value="México">México</option>
                      <option value="Argentina">Argentina</option>
                      <option value="Chile">Chile</option>
                      <option value="Perú">Perú</option>
                      <option value="España">España</option>
                      <option value="Estados Unidos">Estados Unidos</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono de contacto
                  </label>
                  <input
                    type="tel"
                    name="telefono_contacto"
                    value={addressForm.telefono_contacto}
                    onChange={handleAddressChange}
                    placeholder="+57 300 123 4567"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referencia
                  </label>
                  <input
                    type="text"
                    name="referencia"
                    value={addressForm.referencia}
                    onChange={handleAddressChange}
                    placeholder="Edificio azul, al lado del parque"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="predeterminada"
                    checked={addressForm.predeterminada}
                    onChange={handleAddressChange}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">
                    Establecer como dirección predeterminada
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleCancelAddress}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAddress}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;