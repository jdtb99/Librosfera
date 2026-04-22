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
    if(response.status === 200){
      console.log(response.data.user.tipo_usuario);
      console.log(response.data.user.tipo_usuario == "root");
      return response.data.user.tipo_usuario == "root";
    }
    return false;
  } catch (err) {
    // If there is an error, return false
    return false;
  }
};

const CreateAdminPage = () => {
  const navigate = useNavigate();
  const rawData = getCookie("data");

  const [success, setSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [tokenG, setTokenG] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
      email: '',
      password: ''
  });

  useEffect(() => {
    const checkAuth = async () => {
      console.log("Function executed before component renders!");
      
      if (!rawData) {
        console.log("No data found, redirecting...");
        navigate("/Login", { replace: true });
        return;
      }
      
      try {
        const parsedData = JSON.parse(rawData);
        console.log("verify response:");
        
        // Use await here to get the actual boolean result
        const isVerified = await verifyToken(parsedData.Data.token);
        
        if (!isVerified) {
          console.log("Not authorized as root, redirecting...");
          navigate("/Login", { replace: true });
          return;
        }
        
        // Only set these if user is verified as root
        setTokenG(parsedData.Data.token);
        setIsAuthorized(true);
      } catch (error) {
        console.error("Error parsing data:", error);
        navigate("/Login", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };
    
    // Call the async function
    checkAuth();
  }, [rawData, navigate]);

  // Return null while checking authorization or if not authorized
  if (isLoading || !isAuthorized) {
    return null;
  }

  const { email, password } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async e => {
    e.preventDefault();
    
    try {
      // Make POST request to backend API
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/v1/users/admin`,
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${String(tokenG)}`,
          },
        }
      );

      // Print the response
      console.log('Response received:', response.data);
      
      // Clear form
      setFormData({
        email: '',
        password: ''
      });
      setSuccess('Administrador creado con exito!');
      
    } catch (err) {
      console.error('Error adding item:', err.response?.data || err.message);
      setErrorMessage('Error creando administrador');
    }
  }; 

  // Only render the form if user is authorized
  return (
    <div className="w-full min-h-screen p-6">
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="w-32 h-32 mb-4">
            <img 
              src="/l2.png" 
              alt="Librosfera Logo" 
              className="w-full h-auto"
            />
          </div>
          <h1 className="text-2xl font-bold">Crear Administrador</h1>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
              <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <p>{errorMessage}</p>
              </div>
        )}
        
        <form className="space-y-6" onSubmit={onSubmit}>
          {/* Email Field with Label */}
          <div className="flex items-center">
            <label className="w-36 text-right pr-4">Correo electrónico</label>
            <input 
              type="email"
              className="flex-1 p-2 border border-gray-300 rounded"
              name="email"
              id="email"
              value={email}
              onChange={onChange}
            />
          </div>
          
          {/* Password Field with Label */}
          <div className="flex items-center">
            <label className="w-36 text-right pr-4">Contraseña</label>
            <input 
              type="password"
              className="flex-1 p-2 border border-gray-300 rounded"
              name="password"
              id="password"
              value={password}
              onChange={onChange}
            />
          </div>
          
          {/* Buttons - Crear and Cancelar */}
          <div className="flex justify-center gap-4 mt-8">
            <button 
              type="submit" 
              className="bg-blue-500 text-white py-2 px-16 rounded font-medium hover:bg-blue-600 transition-colors"
            >
              Crear
            </button>
            <button 
              type="button" 
              onClick={() => navigate('/')}
              className="bg-gray-200 text-gray-800 py-2 px-16 rounded font-medium hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAdminPage;