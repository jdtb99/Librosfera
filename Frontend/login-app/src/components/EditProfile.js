import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CachedImage from './CachedImage';
import { refreshUserData } from './UserProfilePageComponents/authUtils';

const EditProfile = ({ userData, userType = 'user', onGoBack }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [isDefaultProfilePic, setIsDefaultProfilePic] = useState(true);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [showCountriesList, setShowCountriesList] = useState(false);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingProfilePic, setIsLoadingProfilePic] = useState(false);
  const countryInputRef = useRef(null);
  const [showPreferencesList, setShowPreferencesList] = useState(false);
  const [selectedPreferences, setSelectedPreferences] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [alternatePhone, setAlternatePhone] = useState('');

  // Available preferences list (same as in registration)
  const availablePreferences = ['Ficción', 'No Ficción', 'Ciencia Ficción', 'Fantasía', 'Romance', 'Biografía', 'Historia', 'Ciencia', 'Filosofía', 'Arte', 'Tecnología'];

  // Gender options (same as in registration)
  const genderOptions = ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir'];

  const [formData, setFormData] = useState({
    usuario: '',
    email: '',
    nombres: '',
    apellidos: '',
    DNI: '',
    telefono: '',
    telefono_alternativo: '',
    genero: '',
    fecha_nacimiento: '',
    lugar_nacimiento: '',
    // Address fields
    calle: '',
    ciudad: '',
    codigo_postal: '',
    pais: '',
    estado_provincia: '',
    referencias: '',
    tipo_direccion: 'Casa',
    // Password fields (keep existing ones)
    password: '',
    confirmPassword: '',
    // News subscription
    suscrito_noticias: false
  });

  console.log("User: ", userType);

  // Utility function to get cookie
  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

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

  const token = getCookie("data");
  const UserData = token ? JSON.parse(token) : null;
  const authToken = UserData?.token || '';

  // Configure axios defaults
  const api = axios.create({
    baseURL: `${process.env.REACT_APP_API_URL}/api/v1`,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  
  // Define profile image base URL
  const PROFILE_PIC_BASE_URL = '';
  const DEFAULT_PROFILE_PIC = `${process.env.REACT_APP_API_URL}/uploads/profiles/default.jpg`;

  // Fetch countries for autocomplete, just like in registration
  useEffect(() => {
    const fetchCountries = async () => {
      setIsLoadingCountries(true);
      try {
        // This would normally be an API call like in the registration component
        // For now, we'll use a simplified approach with common countries in Spanish
        const commonCountries = [
          'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica', 
          'Cuba', 'Ecuador', 'El Salvador', 'España', 'Estados Unidos', 'Guatemala', 
          'Honduras', 'México', 'Nicaragua', 'Panamá', 'Paraguay', 'Perú', 
          'Puerto Rico', 'República Dominicana', 'Uruguay', 'Venezuela'
        ];
        setCountries(commonCountries.sort());
      } catch (err) {
        console.error('Error fetching countries:', err);
      } finally {
        setIsLoadingCountries(false);
      }
    };

    fetchCountries();
  }, []);

  // Click outside handler for country dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (countryInputRef.current && !countryInputRef.current.contains(event.target)) {
        setShowCountriesList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load user data when component mounts
  useEffect(() => {
    if (userData) {
      setIsLoadingProfilePic(true);
      
      // Set basic user data
      setFormData({
        usuario: userData.usuario || '',
        email: userData.email || '',
        nombres: userData.nombres || '',
        apellidos: userData.apellidos || '',
        DNI: userData.DNI || '',
        telefono: userData.telefono || '',
        telefono_alternativo: userData.telefono_alternativo || '',
        genero: userData.genero || '',
        fecha_nacimiento: userData.fecha_nacimiento || '',
        lugar_nacimiento: userData.lugar_nacimiento || '',
        suscrito_noticias: userData.suscrito_noticias || false,
        // Address fields - assuming primary address is the first one
        calle: userData.direcciones && userData.direcciones[0]?.calle || '',
        ciudad: userData.direcciones && userData.direcciones[0]?.ciudad || '',
        codigo_postal: userData.direcciones && userData.direcciones[0]?.codigo_postal || '',
        pais: userData.direcciones && userData.direcciones[0]?.pais || '',
        estado_provincia: userData.direcciones && userData.direcciones[0]?.estado_provincia || '',
        referencias: userData.direcciones && userData.direcciones[0]?.referencias || '',
        tipo_direccion: userData.direcciones && userData.direcciones[0]?.tipo || 'Casa',
        // Password fields (empty by default)
        password: '',
        confirmPassword: '',
      });

      // Set preferences if available
      if (userData.preferencias && userData.preferencias.temas) {
        setSelectedPreferences(userData.preferencias.temas);
      }

      // Set profile image if available
      if (userData.foto_perfil && userData.foto_perfil !== DEFAULT_PROFILE_PIC) {
        setPreviewImage(`${PROFILE_PIC_BASE_URL}${userData.foto_perfil}`);
        setIsDefaultProfilePic(false);
      } else {
        setPreviewImage(`${PROFILE_PIC_BASE_URL}${DEFAULT_PROFILE_PIC}`);
        setIsDefaultProfilePic(true);
      }
      
      setIsLoadingProfilePic(false);
    }
  }, [userData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });

    // Filter countries when typing in the pais field
    if (name === 'pais') {
      // Case insensitive search with Spanish accents support
      const normalizedValue = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const filtered = countries.filter(country => {
        const normalizedCountry = country.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedCountry.startsWith(normalizedValue);
      });
      
      setFilteredCountries(filtered);
      setShowCountriesList(value.length > 0);
    }
  };

  // Select a country from the dropdown
  const selectCountry = (country) => {
    setFormData({
      ...formData,
      pais: country
    });
    setShowCountriesList(false);
  };

  // Toggle selection of a preference
  const togglePreference = (preference) => {
    if (selectedPreferences.includes(preference)) {
      setSelectedPreferences(selectedPreferences.filter(p => p !== preference));
    } else {
      setSelectedPreferences([...selectedPreferences, preference]);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Store the file for later upload
      setSelectedFile(file);
      
      // Create a URL for previewing the image
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result);
        setIsDefaultProfilePic(false);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeProfileImage = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setErrorMessage('No se encontró el token de autenticación');
        return;
      }
      
      // Set loading state
      setIsLoadingProfilePic(true);
      
      // Call API to reset profile image to default
      const response = await api.delete('/users/profile/foto', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.status === 'success') {
        // Reset to default image
        setPreviewImage(`${PROFILE_PIC_BASE_URL}${DEFAULT_PROFILE_PIC}`);
        setSelectedFile(null);
        setIsDefaultProfilePic(true);
        setSuccessMessage('Foto de perfil eliminada correctamente');
      } else {
        setErrorMessage('Error al eliminar la foto de perfil');
      }
    } catch (error) {
      console.error('Error removing profile photo:', error);
      setErrorMessage('Error al eliminar la foto de perfil: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoadingProfilePic(false);
    }
  };

  // Upload profile photo function using axios
  const uploadProfilePhoto = async (file) => {
    if (!file) return null;
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }
      
      const formData = new FormData();
      formData.append('foto_perfil', file);
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/v1/users/profile/foto`, 
        formData, 
        {
          headers: {
            'Content-Type': 'multipart/form-data', // Important for file uploads
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );
      
      console.log('Foto de perfil actualizada:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (formData.password && formData.password !== formData.confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      // Create the primary address
      const primaryAddress = {
        calle: formData.calle,
        ciudad: formData.ciudad,
        codigo_postal: formData.codigo_postal,
        pais: formData.pais,
        tipo: formData.tipo_direccion || 'Casa'
      };
      
      // If there's a secondary address in the existing user data, include it
      let direcciones = [primaryAddress];
      if (userData?.direcciones && userData.direcciones.length > 1) {
        direcciones = [primaryAddress, ...userData.direcciones.slice(1)];
      }
      
      // Prepare data for API submission - follow the exact format from the curl example
      const updatedUserData = {
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        telefono: formData.telefono,
        telefono_alternativo: formData.telefono_alternativo,
        direcciones: direcciones,
        email: formData.email,
        genero: formData.genero,
        suscrito_noticias: formData.suscrito_noticias,
        preferencias: {
          temas: selectedPreferences,
          autores: userData?.preferencias?.autores || []
        }
      };
      
      // Add password only if provided
      if (formData.password) {
        updatedUserData.password = formData.password;
      }
      
      console.log('Datos enviados:', updatedUserData);
      const token = getAuthToken();
      
      // Make API call to update profile data using axios with proper headers
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/v1/users/profile`, 
        updatedUserData, 
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );
  
      console.log('Perfil actualizado con éxito:', response.data);
      
      // If there's a profile photo, upload it separately
      if (selectedFile) {
        await uploadProfilePhoto(selectedFile);
      }
      
      // NEW CODE: Update cookies after successful profile update
      const refreshResult = await refreshUserData();
      if (refreshResult.success) {
        console.log('Usuario actualizado en cookies:', refreshResult.data);
      } else {
        console.error('Error al actualizar cookies:', refreshResult.error);
      }
      
      setSuccessMessage('Perfil actualizado con éxito');
      
      // Redirect after a short delay
      setTimeout(() => {
        if (onGoBack) {
          onGoBack();
        } else {
          navigate(userType === 'admin' ? '/AdminProfile' : '/Profile');
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      // Handle axios error response
      const errorMsg = error.response?.data?.message || error.message || 'Error al actualizar el perfil';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-white">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          Editar Perfil
        </h1>
        
        
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Left column - Photo and info */}
        <div className="w-full md:w-1/3 p-6">
          <div className="flex flex-col items-center">
            {/* Profile image */}
            <div className="relative w-40 h-40 rounded-full overflow-hidden bg-gray-200 mb-4 border-4 border-blue-500">
              {isLoadingProfilePic ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-300">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <CachedImage 
                    src={previewImage || `${PROFILE_PIC_BASE_URL}${DEFAULT_PROFILE_PIC}`} 
                    alt="Perfil" 
                    className="w-full h-full object-cover"
                    fallbackSrc={`${PROFILE_PIC_BASE_URL}${DEFAULT_PROFILE_PIC}`}
                  />
                  {!isDefaultProfilePic && (
                    <button 
                      type="button"
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('¿Estás seguro de eliminar la foto de perfil?')) {
                          removeProfileImage();
                        }
                      }}
                      title="Eliminar foto"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button 
                onClick={() => document.getElementById('profile-image-input').click()}
                className="bg-blue-500 text-white px-4 py-2 rounded-md mb-8"
                disabled={isLoadingProfilePic}
              >
                Cambiar foto
              </button>
              
              {!isDefaultProfilePic && (
                <button 
                  onClick={() => {
                    if (window.confirm('¿Estás seguro de eliminar la foto de perfil?')) {
                      removeProfileImage();
                    }
                  }}
                  className="bg-red-500 text-white px-4 py-2 rounded-md mb-8"
                  disabled={isLoadingProfilePic}
                >
                  Eliminar foto
                </button>
              )}
            </div>
            
            <input 
              id="profile-image-input"
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageChange}
            />
            
            <div className="w-full bg-gray-100 p-4 rounded-lg">
              <div className="mb-2">
                <span className="text-gray-600 font-semibold">Tipo de usuario:</span>
                <span className="ml-2">
                  
                  {userType === 'administrador' ? 'Administrador' : userType === 'admin' ? 'Administrador': userType === 'cliente' ? 'Cliente' : userType === 'root' ? 'Root' : ''}
                </span>
              </div>
              
              <div className="mb-2">
                <span className="text-gray-600 font-semibold">Miembro desde:</span>
                <span className="ml-2">{userData?.fecha_registro || '2023-01-01'}</span>
              </div>
              
              <div>
                <span className="text-gray-600 font-semibold">Última actualización:</span>
                <span className="ml-2">{userData?.ultima_actualizacion || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right column - Form */}
        <div className="w-full md:w-2/3 p-6">
          <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-semibold mb-4">Información Personal</h2>
            
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-gray-700 mb-1">Nombre de usuario</label>
                <input
                  type="text"
                  name="usuario"
                  value={formData.usuario}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">El nombre de usuario no se puede cambiar</p>
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Nombres</label>
                <input
                  type="text"
                  name="nombres"
                  value={formData.nombres}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Apellidos</label>
                <input
                  type="text"
                  name="apellidos"
                  value={formData.apellidos}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">ID/DNI</label>
                <input
                  type="text"
                  name="DNI"
                  value={formData.DNI}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Teléfono Principal</label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Teléfono Alternativo</label>
                <input
                  type="tel"
                  name="telefono_alternativo"
                  value={formData.telefono_alternativo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Género</label>
                <select
                  name="genero"
                  value={formData.genero}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="">Selecciona tu género</option>
                  {genderOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Fecha de Nacimiento</label>
                <input
                  type="date"
                  name="fecha_nacimiento"
                  value={formData.fecha_nacimiento}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="block text-gray-700 mb-1">Lugar de Nacimiento</label>
                <input
                  type="text"
                  name="lugar_nacimiento"
                  value={formData.lugar_nacimiento}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="suscrito_noticias"
                    checked={formData.suscrito_noticias}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span>Suscribirse a noticias y promociones</span>
                </label>
              </div>
            </div>
            
            {/* Address Information */}
            <h2 className="text-xl font-semibold mb-4">Dirección Principal</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-gray-700 mb-1">Calle</label>
                <input
                  type="text"
                  name="calle"
                  value={formData.calle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Ciudad</label>
                <input
                  type="text"
                  name="ciudad"
                  value={formData.ciudad}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Código Postal</label>
                <input
                  type="text"
                  name="codigo_postal"
                  value={formData.codigo_postal}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              {/* País with Autocomplete */}
              <div ref={countryInputRef} className="relative">
                <label className="block text-gray-700 mb-1">País</label>
                <input
                  type="text"
                  name="pais"
                  value={formData.pais}
                  onChange={handleChange}
                  onFocus={() => formData.pais.length > 0 && setShowCountriesList(true)}
                  placeholder="País"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
                {isLoadingCountries && (
                  <div className="absolute right-2 top-10 transform">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                
                {/* Countries Dropdown */}
                {showCountriesList && filteredCountries.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredCountries.map(country => (
                      <div 
                        key={country}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => selectCountry(country)}
                      >
                        {country}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Estado/Provincia</label>
                <input
                  type="text"
                  name="estado_provincia"
                  value={formData.estado_provincia}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Tipo de Dirección</label>
                <select
                  name="tipo_direccion"
                  value={formData.tipo_direccion}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="Casa">Casa</option>
                  <option value="Trabajo">Trabajo</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Referencias</label>
                <input
                  type="text"
                  name="referencias"
                  value={formData.referencias}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            {/* Preferences */}
            <h2 className="text-xl font-semibold mb-4">Preferencias</h2>
            <div className="mb-6">
              <label className="block text-gray-700 mb-1">Temas de Interés</label>
              <div 
                className="w-full p-2 border border-gray-300 rounded-md flex justify-between items-center cursor-pointer"
                onClick={() => setShowPreferencesList(!showPreferencesList)}
              >
                <div className="truncate">
                  {selectedPreferences.length > 0 
                    ? selectedPreferences.join(', ') 
                    : "Selecciona preferencias"}
                </div>
                <div className="text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
              
              {/* Preferences Dropdown */}
              {showPreferencesList && (
                <div className="relative z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {availablePreferences.map((preference) => (
                    <div 
                      key={preference}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                      onClick={() => togglePreference(preference)}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedPreferences.includes(preference)}
                        onChange={() => {}}
                        className="mr-2"
                      />
                      {preference}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Change Password */}
            <h2 className="text-xl font-semibold mb-4">Cambiar contraseña</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-gray-700 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Dejar en blanco para mantener la actual"
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres</p>
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Confirmar contraseña</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Success or error messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            <p>{successMessage}</p>
          </div>
        )}
        
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <p>{errorMessage}</p>
          </div>
        )}
            
            {/* Submit Buttons */}
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={onGoBack}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                disabled={isLoading}
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                disabled={isLoading}
              >
                {isLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;