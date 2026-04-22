import React, { useState, useEffect } from 'react';
import RegistrationPage from './RegistrationPage';
import PasswordResetPage from './PasswordRequestRecuperation';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const clearCookies = () => {
  document.cookie.split(";").forEach((cookie) => {
    document.cookie = cookie
      .replace(/^ +/, "")
      .replace(/=.*/, "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/");
  });
  console.log("Cookies cleared!");
};

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
    if(response.status === 200){
      return true;
    }
    return false;
  } catch (err) {
    // If there is an error, return false
    return false;
  }
};

const LoginPage = () => {
  //clearCookies();

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [rememberMe, setRememberMe] = useState(false);

  // Check for existing token when component mounts
  useEffect(() => {
    const checkExistingToken = async () => {
      try {
        const rawData = getCookie("data");
        
        if (rawData) {
          const parsedData = JSON.parse(rawData);
          if (parsedData && parsedData.Data && parsedData.Data.token) {
            // Verify token validity
            const isValid = await verifyToken(parsedData.Data.token);
            
            if (isValid) {
              console.log("Valid token found, checking user type for redirect");
              
              // Check user type for proper redirection
              if (parsedData.Data.tipo_usuario === 'administrador') {
                console.log("Admin user detected, redirecting to AdminProfile");
                navigate('/AdminProfile');
              } else if (parsedData.Data.tipo_usuario === 'root') {
                console.log("Root user detected, redirecting to Profile");
                navigate('/Profile');
              } else {
                console.log("Regular user detected, redirecting to Home");
                navigate('/Home'); // Redirección a nueva página principal
              }
              return;
            } else {
              console.log("Token found but invalid or expired");
            }
          }
        }

        const rememberedData = localStorage.getItem('rememberedLogin');
        if (rememberedData) {
          const parsedRememberedData = JSON.parse(rememberedData);
          setFormData({
            email: parsedRememberedData.email,
            password: parsedRememberedData.password
          });
          setRememberMe(true);
        }

      } catch (error) {
        console.error("Error checking existing token:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkExistingToken();
  }, [navigate]);

  const { email, password } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const Redirect = (response) => {
    // Store user data in cookie
    const userData = { authToken: response.data.data.token, Data: response.data.data };
    console.log("User data being stored:", userData.Data);
    document.cookie = `data=${encodeURIComponent(JSON.stringify(userData))}; path=/; max-age=3600; Secure;`;
    
    // Determine redirect based on user type
    if (userData.Data.tipo_usuario === 'administrador') {
      console.log("Admin login detected, redirecting to AdminProfile");
      navigate('/AdminProfile');
    } else if (userData.Data.tipo_usuario === 'root') {
      console.log("Root login detected, redirecting to Profile");
      navigate('/Profile');
    } else {
      console.log("Regular user login detected, redirecting to Home");
      navigate('/Home'); // Redirección a nueva página principal
    }
  };

  const onSubmit = async e => {
    e.preventDefault();
    
    try {
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };
      console.log("Login attempt with:", formData);
      
      // Make POST request to backend API
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/v1/users/login`, formData, config);
      
      // Print the response
      console.log('Login response received:', response.data);

       if (rememberMe) {
        // Save login data to localStorage
        localStorage.setItem('rememberedLogin', JSON.stringify({
          email: formData.email,
          password: formData.password
        }));
      } else {
        // Remove remembered login data if checkbox is unchecked
        localStorage.removeItem('rememberedLogin');
      }
      
      // Clear form
      setFormData({
        email: '',
        password: ''
      });
      
      setSuccessMessage('Ingreso satisfactorio.');
      if(response){
        Redirect(response);
      }

    } catch (err) {
      if(err.message == 'Request failed with status code 401'){
        console.error('Login error:', err.response.data);
        setErrorMessage(err.response.data.message);
      }else{
        setErrorMessage("Error conectando con la base de datos");
        console.log(err.message);
      }
    }
  };

  const [showRegistration, setShowRegistration] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  
  // If registration page should be shown, render it instead
  if (showRegistration) {
    return <RegistrationPage onBackToLogin={() => setShowRegistration(false)} />;
  }
  
  // If password reset page should be shown, render it instead
  if (showPasswordReset) {
    return <PasswordResetPage onBackToLogin={() => setShowPasswordReset(false)} />;
  }

  // Show loading indicator while checking token validity
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full border-t-transparent border-blue-600" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-2">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      {/* Left Side - Black Background with Logo */}
      <div className="hidden md:flex md:w-1/2 bg-black text-white flex-col items-center justify-center">
        <div className="mb-6 w-2/5">
        <Link to="/home" className="hidden md:block">
          <img 
            src="/l2.png" 
            alt="Librosfera Logo" 
            className="w-full h-auto"
          />
          </Link>
        </div>      
        <h1 className="text-5xl font-bold mb-2">Librosfera</h1>
        <p className="text-xl">Tu librería de confianza</p>
      </div>
      
      {/* Right Side - Login Form */}
      <div className="w-full md:w-1/2 flex flex-col h-full">
        <div className="flex flex-col justify-between h-full p-10">
          {/* Top Section (Only visible on mobile) */}
          <div className="md:hidden flex flex-col items-center mb-6">
            <div className="w-2/5 mb-4">
              <img 
                src="/l2.png" 
                alt="Librosfera Logo" 
                className="w-full h-auto"
              />
            </div>
            <h1 className="text-3xl font-bold">Librosfera</h1>
          </div>
          
          {/* Login Form Section */}
          <div className="flex-grow flex flex-col justify-center">
            <h2 className="text-4xl font-bold mb-6">Iniciar Sesión</h2>
            <p className="mb-6">
              ¿No tienes cuenta? <a 
                href="/Register"  
                className="text-blue-600 font-medium"
              >
                Crear Cuenta
              </a>
            </p>

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
              <div className="mb-6">
                <input
                  type="email"
                  placeholder="Correo Electrónico"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  name="email"
                  id="email"
                  value={email}
                  onChange={onChange}
                />
              </div>
              
              {/* Password Field */}
              <div className="mb-6">
                <input
                  type="password"
                  placeholder="Contraseña"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  name="password"
                  id="password"
                  value={password}
                  onChange={onChange}
                />
              </div>
              
              {/* Remember Me and Change Password */}
              <div className="flex items-center justify-between mb-6">
                <label className="flex items-center select-none">
                  <input 
                    type="checkbox" 
                    className="mr-2"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Recordarme
                </label>
                <a 
                  href="/RequestChangePassword" 
                  className="text-gray-500"
                >
                  Recuperar Contraseña
                </a>
              </div>
              
              {/* Login Button */}
              <button 
                type="submit" 
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Iniciar sesión
              </button>
            </form>
          </div>
          
          {/* Bottom Registration Link */}
          <div className="mt-auto">
            <p className="text-gray-500 text-center">
              ¿Eres nuevo? <a 
                href="/Register" 
                className="text-blue-600 font-medium"
              >
                Registrarse
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;