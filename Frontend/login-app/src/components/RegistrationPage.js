import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const RegistrationPage = () => {
  const navigate = useNavigate();
  const onBackToLogin = () => {
    navigate('/Login');
  };

  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  const PrintCookies = () => {
    // console.log(getCookie("authToken")); // Output: your_jwt_token
    const rawData = getCookie("data");
    if (rawData) {
      try {
        const parsedData = JSON.parse(rawData);
        console.log(parsedData); // Correct JSON object
        console.log(parsedData.Data.usuario);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    } else {
      console.log("Cookie not found!");
    }
  };

  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    DNI: '',
    genero: '',
    usuario: '',
    password: '',
    fecha_nacimiento: '',
    lugar_nacimiento: '',
    // Address fields
    pais: '',
    estado_provincia: '',
    ciudad: '',
    direccion_completa: '',
    codigo_postal: '',
    referencias: ''
  });

  // State to track selected preferences
  const [selectedPreferences, setSelectedPreferences] = useState([]);
  const [showPreferencesList, setShowPreferencesList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Countries, states and cities states
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  
  // Store country codes and state codes for API calls
  const [countryMap, setCountryMap] = useState({});
  const [stateMap, setStateMap] = useState({});
  
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [filteredStates, setFilteredStates] = useState([]);
  const [filteredCities, setFilteredCities] = useState([]);
  
  const [showCountriesList, setShowCountriesList] = useState(false);
  const [showStatesList, setShowStatesList] = useState(false);
  const [showCitiesList, setShowCitiesList] = useState(false);
  
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  
  const countryInputRef = useRef(null);
  const stateInputRef = useRef(null);
  const cityInputRef = useRef(null);

  // Sample preferences list
  const availablePreferences = ['Ficción', 'No Ficción', 'Ciencia Ficción', 'Fantasía', 'Romance', 'Biografía', 'Historia', 'Ciencia', 'Filosofía', 'Arte', 'Tecnología'];

  const genderOptions = ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir'];

  // ==================== API Keys and Configuration ====================
  // For production, store these in environment variables
  const GEONAMES_USERNAME = 'demo'; // Replace with your actual GeoNames username
  const GEODB_API_KEY = '9ef26e52c8mshb54d0e0f3b6c2e6p1c2b82jsn9c1a4b6ec2cf'; // Replace with your actual RapidAPI key

  // ==================== API Helper Functions ====================
  // Get states for a country using RapidAPI GeoDB Cities API
  const getStatesForCountry = async (countryCode) => {
    try {
      const options = {
        method: 'GET',
        url: `https://wft-geo-db.p.rapidapi.com/v1/geo/countries/${countryCode}/regions`,
        params: {
          limit: '50'
        },
        headers: {
          'X-RapidAPI-Key': GEODB_API_KEY,
          'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
        }
      };

      const response = await axios.request(options);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching states:', error);
      return [];
    }
  };

  // Get cities for a state/region using RapidAPI GeoDB Cities API
  const getCitiesForState = async (countryCode, regionCode) => {
    try {
      const options = {
        method: 'GET',
        url: `https://wft-geo-db.p.rapidapi.com/v1/geo/countries/${countryCode}/regions/${regionCode}/cities`,
        params: {
          limit: '50',
          sort: 'name'
        },
        headers: {
          'X-RapidAPI-Key': GEODB_API_KEY,
          'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
        }
      };

      const response = await axios.request(options);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  };

  // Fetch countries from API
  useEffect(() => {
    const fetchCountries = async () => {
      setIsLoadingCountries(true);
      try {
        // Using REST Countries API to get the list of countries with Spanish translations
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,translations,cca2');
        
        // Build a map of country names to country codes for later use
        const countryCodeMap = {};
        
        // Extract Spanish translations or fall back to common name
        const countryData = response.data.map(country => {
          const countryName = (country.translations.spa && country.translations.spa.common) || country.name.common;
          countryCodeMap[countryName] = country.cca2; // Store the country code
          return countryName;
        }).sort();
        
        setCountries(countryData);
        setCountryMap(countryCodeMap);
      } catch (err) {
        console.error('Error fetching countries:', err);
      } finally {
        setIsLoadingCountries(false);
      }
    };

    fetchCountries();
  }, []);

  // Fetch states/provinces when a country is selected
  useEffect(() => {
    const fetchStates = async () => {
      if (!formData.pais) {
        setStates([]);
        setStateMap({});
        return;
      }
      
      setIsLoadingStates(true);
      try {
        const countryCode = countryMap[formData.pais];
        if (!countryCode) {
          console.error('Country code not found for:', formData.pais);
          setIsLoadingStates(false);
          return;
        }
        
        // Get states/regions for the selected country
        const statesData = await getStatesForCountry(countryCode);
        
        if (statesData && statesData.length > 0) {
          // Build a map of state names to state codes for later use
          const stateCodeMap = {};
          
          // Extract state names
          const statesList = statesData.map(state => {
            stateCodeMap[state.name] = state.isoCode || state.wikiDataId;
            return state.name;
          }).sort();
          
          setStates(statesList);
          setStateMap(stateCodeMap);
        } else {
          setStates([]);
          setStateMap({});
        }
      } catch (err) {
        console.error('Error fetching states:', err);
        setStates([]);
        setStateMap({});
      } finally {
        setIsLoadingStates(false);
      }
    };

    fetchStates();
  }, [formData.pais, countryMap]);

  // Fetch cities when a state/province is selected
  useEffect(() => {
    const fetchCities = async () => {
      if (!formData.estado_provincia || !formData.pais) {
        setCities([]);
        return;
      }
      
      setIsLoadingCities(true);
      try {
        const countryCode = countryMap[formData.pais];
        const regionCode = stateMap[formData.estado_provincia];
        
        if (!countryCode || !regionCode) {
          console.error('Country or region code not found');
          setIsLoadingCities(false);
          return;
        }
        
        // Get cities for the selected state/region
        const citiesData = await getCitiesForState(countryCode, regionCode);
        
        if (citiesData && citiesData.length > 0) {
          // Extract city names
          const citiesList = citiesData.map(city => city.name).sort();
          setCities(citiesList);
        } else {
          setCities([]);
        }
      } catch (err) {
        console.error('Error fetching cities:', err);
        setCities([]);
      } finally {
        setIsLoadingCities(false);
      }
    };

    fetchCities();
  }, [formData.estado_provincia, formData.pais, countryMap, stateMap]);

  // Click outside handlers to close dropdown lists
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (countryInputRef.current && !countryInputRef.current.contains(event.target)) {
        setShowCountriesList(false);
      }
      if (stateInputRef.current && !stateInputRef.current.contains(event.target)) {
        setShowStatesList(false);
      }
      if (cityInputRef.current && !cityInputRef.current.contains(event.target)) {
        setShowCitiesList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for cascading fields
    if (name === 'pais') {
      setFormData({
        ...formData,
        [name]: value,
        estado_provincia: '', // Reset state when country changes
        ciudad: '', // Reset city when country changes
        direccion_completa: '' // Reset address when country changes
      });
    } else if (name === 'estado_provincia') {
      setFormData({
        ...formData,
        [name]: value,
        ciudad: '', // Reset city when state changes
        direccion_completa: '' // Reset address when state changes
      });
    } else if (name === 'ciudad') {
      setFormData({
        ...formData,
        [name]: value,
        direccion_completa: '' // Reset address when city changes
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }

    // Filter countries when typing in the pais field
    if (name === 'pais') {
      // Case insensitive search with Spanish accents support
      const normalizedValue = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const filtered = countries.filter(country => {
        const normalizedCountry = country.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedCountry.includes(normalizedValue);
      });
      
      setFilteredCountries(filtered);
      setShowCountriesList(value.length > 0);
    }
    
    // Filter states when typing in the estado_provincia field
    else if (name === 'estado_provincia') {
      if (!formData.pais) return; // Require country to be selected first
      
      const normalizedValue = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const filtered = states.filter(state => {
        const normalizedState = state.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedState.includes(normalizedValue);
      });
      
      setFilteredStates(filtered);
      setShowStatesList(value.length > 0);
    }
    
    // Filter cities when typing in the ciudad field
    else if (name === 'ciudad') {
      if (!formData.estado_provincia) return; // Require state to be selected first
      
      const normalizedValue = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const filtered = cities.filter(city => {
        const normalizedCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedCity.includes(normalizedValue);
      });
      
      setFilteredCities(filtered);
      setShowCitiesList(value.length > 0);
    }
  };

  // Show dropdown lists when field is clicked/focused
  const handleFocus = (fieldName) => {
    if (fieldName === 'pais') {
      setFilteredCountries(countries);
      setShowCountriesList(true);
    } else if (fieldName === 'estado_provincia' && formData.pais) {
      setFilteredStates(states);
      setShowStatesList(true);
    } else if (fieldName === 'ciudad' && formData.estado_provincia) {
      setFilteredCities(cities);
      setShowCitiesList(true);
    }
  };

  // Select a country from the dropdown
  const selectCountry = (country) => {
    setFormData({
      ...formData,
      pais: country,
      estado_provincia: '', // Reset state when country changes
      ciudad: '', // Reset city when country changes
      direccion_completa: '' // Reset address when country changes
    });
    setShowCountriesList(false);
  };

  // Select a state from the dropdown
  const selectState = (state) => {
    setFormData({
      ...formData,
      estado_provincia: state,
      ciudad: '', // Reset city when state changes
      direccion_completa: '' // Reset address when state changes
    });
    setShowStatesList(false);
  };

  // Select a city from the dropdown
  const selectCity = (city) => {
    setFormData({
      ...formData,
      ciudad: city,
      direccion_completa: '' // Reset address when city changes
    });
    setShowCitiesList(false);
  };

  // Toggle selection of a preference
  const togglePreference = (preference) => {
    if (selectedPreferences.includes(preference)) {
      setSelectedPreferences(selectedPreferences.filter(p => p !== preference));
    } else {
      setSelectedPreferences([...selectedPreferences, preference]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset states
    setError('');
    setSuccess('');
    
    // Basic validation
    if (!formData.nombres || !formData.apellidos || !formData.email || 
        !formData.usuario || !formData.password || !formData.DNI ||
        !formData.direccion_completa || !formData.ciudad || !formData.codigo_postal || !formData.pais) {
      setError('Por favor complete todos los campos obligatorios');
      return;
    }
    
    // Format the data for the API
    const userData = {
      usuario: formData.usuario,
      email: formData.email,
      password: formData.password,
      tipo_usuario: 'cliente', // Default for registration
      DNI: formData.DNI,
      nombres: formData.nombres,
      apellidos: formData.apellidos,
      fecha_nacimiento: formData.fecha_nacimiento,
      lugar_nacimiento: formData.lugar_nacimiento,
      genero: formData.genero,
      direcciones: [{
        direccion_completa: formData.direccion_completa, // Changed field name to match backend expectation
        ciudad: formData.ciudad,
        codigo_postal: formData.codigo_postal,
        pais: formData.pais,
        departamento: formData.estado_provincia || '',
        referencias: formData.referencias || ''
      }],
      preferencias: {
        temas: selectedPreferences
      }
    };

    if (userData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    
    try {
      setIsLoading(true);
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };
      // Make POST request to register API
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/v1/users/register`, userData, config);
      console.log("response");
      console.log(response);
      
      // Handle successful registration
      console.log('Registration successful:', response.data);
      setSuccess('¡Registro exitoso! Redirigiendo...');
      
      // Store user data in localStorage
      localStorage.setItem('userToken', response.data.data.token);
      localStorage.setItem('userData', JSON.stringify(response.data.data));
      
      // Redirect to login after a short delay
      setTimeout(() => {
        onBackToLogin();
      }, 2500);
      
    } catch (err) {
      console.error('Registration error:', err);
      console.log(err);
      
      // Handle specific error messages based on API response
      if (err.response) {
        if (err.response.data) {
          // Check for specific error types and display appropriate messages
          if (err.response.data.message && err.response.data.message.includes('')) {
            setError(err.response.data.message);
          } else if (err.response.data.message && err.response.data.message.includes('usuario')) {
            setError('Este nombre de usuario ya está en uso. Por favor elija otro.');
          } else if (err.response.data.message && err.response.data.message.includes('DNI')) {
            setError('Este número de documento ya está registrado. Por favor verifique sus datos.');
          } else if (err.response.data.message && err.response.data.message.includes('email')) {
            setError('Este correo electrónico ya está registrado. Por favor use otro.');
          } else {
            // Use the server's error message if available
            setError(err.response.data.message || 'Error al registrarse. Por favor intente nuevamente.');
          }
        } else {
          setError('Error al registrarse. Por favor intente nuevamente.');
        }
      } else {
        setError('Error al conectar con el servidor. Por favor verifique su conexión.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-6">Registrarse</h1>
      
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {/* Nombre */}
        <div>
          <label className="block font-medium mb-1">Nombre</label>
          <input 
            type="text" 
            name="nombres"
            value={formData.nombres}
            onChange={handleChange}
            placeholder="Escribe tu nombre" 
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
          />
        </div>
        
        {/* Apellido */}
        <div>
          <label className="block font-medium mb-1">Apellido</label>
          <input 
            type="text" 
            name="apellidos"
            value={formData.apellidos}
            onChange={handleChange}
            placeholder="Escribe tu apellido" 
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
          />
        </div>
        
        {/* Correo */}
        <div>
          <label className="block font-medium mb-1">Correo</label>
          <input 
            type="email" 
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Escribe tu correo" 
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
          />
        </div>
        
        {/* ID */}
        <div>
          <label className="block font-medium mb-1">ID</label>
          <input 
            type="text" 
            name="DNI" 
            value={formData.DNI}
            onChange={handleChange}
            placeholder="Número de documento" 
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
          />
        </div>
        
        {/* Dirección - Reordered fields */}
        <div className="space-y-4">
          <h3 className="font-medium text-lg">Dirección</h3>
          
          {/* País with Autocomplete in Spanish - FIRST */}
          <div ref={countryInputRef} className="relative">
            <label className="block font-medium mb-1">País *</label>
            <div className="relative">
              <input 
                type="text"
                name="pais"
                value={formData.pais}
                onChange={handleChange}
                onFocus={() => handleFocus('pais')}
                onClick={() => handleFocus('pais')}
                placeholder="País" 
                className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                required
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500">
                {isLoadingCountries ? (
                  <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                )}
              </div>
            </div>
            
            {/* Countries Dropdown */}
            {showCountriesList && filteredCountries.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
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
          
          {/* Estado/Provincia - SECOND */}
          <div ref={stateInputRef} className="relative">
            <label className="block font-medium mb-1">Estado/Provincia *</label>
            <div className="relative">
              <input 
                type="text"
                name="estado_provincia"
                value={formData.estado_provincia}
                onChange={handleChange}
                onFocus={() => handleFocus('estado_provincia')}
                onClick={() => handleFocus('estado_provincia')}
                placeholder={formData.pais ? "Estado o provincia" : "Seleccione primero el país"}
                className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                disabled={!formData.pais}
                required
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500">
                {isLoadingStates ? (
                  <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                )}
              </div>
            </div>
            
            {/* States Dropdown */}
            {showStatesList && filteredStates.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredStates.map(state => (
                  <div 
                    key={state}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => selectState(state)}
                  >
                    {state}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Ciudad - THIRD */}
          <div ref={cityInputRef} className="relative">
            <label className="block font-medium mb-1">Ciudad *</label>
            <div className="relative">
              <input 
                type="text"
                name="ciudad"
                value={formData.ciudad}
                onChange={handleChange}
                onFocus={() => handleFocus('ciudad')}
                onClick={() => handleFocus('ciudad')}
                placeholder={formData.estado_provincia ? "Ciudad" : "Seleccione primero el estado/provincia"}
                className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
                disabled={!formData.estado_provincia}
                required
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500">
                {isLoadingCities ? (
                  <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                )}
              </div>
            </div>
            
            {/* Cities Dropdown */}
            {showCitiesList && filteredCities.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredCities.map(city => (
                  <div 
                    key={city}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => selectCity(city)}
                  >
                    {city}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Dirección Completa - FOURTH (renamed from Calle) */}
          <div>
          <label className="block font-medium mb-1">Dirección Completa *</label>
            <input 
              type="text"
              name="direccion_completa"
              value={formData.direccion_completa}
              onChange={handleChange} 
              placeholder="Calle, número, colonia, etc." 
              className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
              required
              disabled={!formData.ciudad}
            />
          </div>
          
          {/* Código Postal */}
          <div>
            <label className="block font-medium mb-1">Código Postal *</label>
            <input 
              type="text"
              name="codigo_postal"
              value={formData.codigo_postal}
              onChange={handleChange} 
              placeholder="Código postal" 
              className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
              required
              disabled={!formData.ciudad}
            />
          </div>
          
          {/* Referencias (opcional) - FIFTH */}
          <div>
            <label className="block font-medium mb-1">Referencias</label>
            <input 
              type="text"
              name="referencias"
              value={formData.referencias}
              onChange={handleChange} 
              placeholder="Referencias adicionales (opcional)" 
              className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
              disabled={!formData.direccion_completa}
            />
          </div>
        </div>
        
        {/* Género */}
        <div className="relative">
        <label className="block font-medium mb-1">Género</label>
          <select
            name="genero"
            value={formData.genero}
            onChange={handleChange}
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0 bg-white"
          >
            <option value="">Selecciona tu género</option>
            {genderOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        
        {/* Usuario */}
        <div>
          <label className="block font-medium mb-1">Usuario</label>
          <input 
            type="text" 
            name="usuario"
            value={formData.usuario}
            onChange={handleChange} 
            placeholder="Escribe su usuario" 
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
          />
        </div>
        
        {/* Contraseña */}
        <div>
          <label className="block font-medium mb-1">Contraseña</label>
          <input 
            type="password" 
            name="password"
            value={formData.password}
            onChange={handleChange} 
            placeholder="Escribe su contraseña" 
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
          />
        </div>
        
        {/* Preferencias - Multi-Select */}
        <div className="relative">
          <label className="block font-medium mb-1">Preferencias</label>
          <div 
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 flex justify-between items-center cursor-pointer"
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
          
          {/* Dropdown Selection */}
          {showPreferencesList && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
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
        
        {/* Fecha de Nacimiento */}
        <div>
          <label className="block font-medium mb-1">Fecha de Nacimiento</label>
          <div className="relative">
            <input 
              type="date"
              name="fecha_nacimiento"
              value={formData.fecha_nacimiento}
              onChange={handleChange}
              className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
            />
            <button 
              type="button"
              onClick={() => {
                // This creates a click on the date input to open the native date picker
                document.querySelector('input[name="fecha_nacimiento"]').showPicker();
              }}
              className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Lugar de Nacimiento */}
        <div>
          <label className="block font-medium mb-1">Lugar de Nacimiento</label>
          <input 
            type="text" 
            name="lugar_nacimiento"
            value={formData.lugar_nacimiento}
            onChange={handleChange} 
            placeholder="Lugar de nacimiento" 
            className="w-full p-2 border-t-0 border-l-0 border-r-0 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0"
          />
        </div>
        
        {/* Show error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {/* Show success message */}
        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}
        
        {/* Submit Buttons */}
        <div className="mt-4 flex flex-col gap-2">
          <button 
            type="submit" 
            className={`w-full bg-blue-500 text-white py-3 rounded font-medium hover:bg-blue-600 transition-colors ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Procesando...' : 'Registrarse'}
          </button>
          
          <button 
            type="button" 
            className="w-full text-blue-500 py-2 rounded font-medium hover:underline"
            onClick={onBackToLogin}
          >
            Iniciar sesión
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationPage;