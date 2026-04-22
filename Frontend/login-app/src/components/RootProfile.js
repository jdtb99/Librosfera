import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from './AdminProfileComponents/Sidebar';
import Dashboard from './AdminProfileComponents/Dashboard';
import ManageBooks from './AdminProfileComponents/ManageBooks';
import ManageMessages from './AdminProfileComponents/ManageMessages';
import ManageUsers from './AdminProfileComponents/ManageUsers';
import ProfilePage from './AdminProfileComponents/ProfilePage';
import EditProfile from './EditProfile';

// Helper function to get cookie data
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

const RootProfile = () => {
  const [activeTab, setActiveTab] = useState('inicio');
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const navigate = useNavigate();
  
  // Check authentication on mount and redirect immediately if needed
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get data directly from cookie
        const dataCookie = getCookie("data");
        
        if (!dataCookie) {
          console.log("No data cookie found, redirecting to login");
          navigate('/Login');
          return;
        }
        
        // Parse the cookie data
        const parsedData = JSON.parse(dataCookie);
        console.log("Parsed cookie data:", parsedData);
        
        if (!parsedData || !parsedData.Data) {
          console.log("Invalid data structure in cookie, redirecting to login");
          navigate('/Login');
          return;
        }
        
        const userType = parsedData.Data.tipo_usuario?.toLowerCase();
        console.log("User type detected:", userType);
        
        // Route users to the appropriate profile page
        if (!userType) {
          console.log("No user type found, redirecting to login");
          window.location.replace('/Login');
          return;
        } else if (userType === 'administrador') {
          console.log("Admin user detected, redirecting to AdminProfile");
          window.location.replace('/AdminProfile');
          return;
        } else if (userType === 'usuario' || userType === 'cliente') {
          console.log("Regular user detected, redirecting to Profile");
          window.location.replace('/Profile');
          return;
        } else if (userType !== 'root') {
          console.log("Unknown user type, redirecting to login");
          window.location.replace('/Login');
          return;
        }
        
        // Only proceed if we are definitely a root user
        console.log("Root user confirmed, loading root admin panel");
        setUserData(parsedData.Data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error in RootProfile auth check:", error);
        navigate('/Login');
      }
    };
    
    checkAuth();
  }, [navigate]);
  
  useEffect(() => {
    window.isEditingProfile = isEditingProfile;
  }, [isEditingProfile]);


  // Handler para editar perfil
   const handleEditProfile = (value) => {
    if (value === false) {
      setIsEditingProfile(false);
      // Refrescar datos del usuario
      const refreshData = async () => {
        try {
          // Get data directly from cookie
          const dataCookie = getCookie("data");
          if (dataCookie) {
            const parsedData = JSON.parse(dataCookie);
            if (parsedData && parsedData.Data) {
              setUserData(parsedData.Data);
            }
          }
        } catch (error) {
          console.error("Error refreshing user data:", error);
        }
      };
      refreshData();
    } else {
      console.log("handle opt: ", value);
      setIsEditingProfile(true);
    }
  };
  // Handler para regresar de la edición de perfil
  const handleGoBack = () => {
    setIsEditingProfile(false);
    // Refrescar datos del usuario (en un caso real, aquí harías una nueva solicitud)
    const refreshData = async () => {
      try {
        // Get data directly from cookie
        const dataCookie = getCookie("data");
        if (dataCookie) {
          const parsedData = JSON.parse(dataCookie);
          if (parsedData && parsedData.Data) {
            setUserData(parsedData.Data);
          }
        }
      } catch (error) {
        console.error("Error refreshing user data:", error);
      }
    };
    refreshData();
  };

  const handleLogout = () => {
    localStorage.removeItem('shoppingCart');
    // Limpiar las cookies
    document.cookie.split(";").forEach((cookie) => {
      document.cookie = cookie
        .replace(/^ +/, "")
        .replace(/=.*/, "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/");
    });
    
    // Redireccionar a la página de login
    navigate('/login');
  };

  // Función para ir al perfil de usuario
  const goToHome = () => {
    navigate('/Home');
  };
  
  // Render loading state if no userData yet
  if (isLoading || !userData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#f9fafb]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700">Cargando panel de administración root...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen">
      {/* Top navigation bar only */}
      <header className="bg-white shadow-sm w-full">
        <div className="bg-gray-800 text-white">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/home" className="font-bold text-xl">Librosfera</Link>
              <span className="text-sm">Panel de Administración Root</span>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={goToHome}
                className="text-sm hover:underline cursor-pointer"
              >
                Inicio
              </button>
              <button 
                onClick={handleLogout}
                className="text-sm hover:underline cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-1 bg-[#f9fafb]">
        {isEditingProfile ? (
          <>
            {/* Left sidebar */}
            <Sidebar 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              userData={userData}
              isLoading={isLoading}
              onEditProfile={handleEditProfile}
            />
            
            {/* Main content area */}
            <div className="flex-1 flex h-full overflow-y-auto p-6">
              <EditProfile 
                userData={userData}
                userType="root"
                onGoBack={handleGoBack}
              />
            </div>
          </>
        ) : (
          <>
            {/* Left sidebar */}
            <Sidebar 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              userData={userData}
              isLoading={isLoading}
              onEditProfile={handleEditProfile}
            />
            
            {/* Main content area */}
            <div className="flex-1 flex h-full">
              {activeTab === 'inicio' && <Dashboard userData={userData} />}
              {/* {activeTab === 'administrar-libro' && <ManageBooks />} */}
              {activeTab === 'gestionar-usuarios' && <ManageUsers />}
              {/* {activeTab === 'gestionar-mensajes' && <ManageMessages />} */}
              {activeTab === 'mi-perfil' && <ProfilePage userData={userData} onEditProfile={handleEditProfile} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RootProfile;