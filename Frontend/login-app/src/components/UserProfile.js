import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './UserProfilePageComponents/Sidebar';
import Dashboard from './UserProfilePageComponents/Dashboard';
import ProfilePage from './UserProfilePageComponents/ProfilePage';
import PurchasesPage from './UserProfilePageComponents/PurchasesPage';
import CartPage from './UserProfilePageComponents/CartPage';
import CardPage from './UserProfilePageComponents/CardPage';
import MessagesPage from './UserProfilePageComponents/MessagesPage';
import ReturnsPage from './UserProfilePageComponents/ReturnsPage'; // Nuevo componente de devoluciones
import EditProfile from './EditProfile';
import { fetchUserData, logoutUser } from './UserProfilePageComponents/authUtils';
import { getCartCount } from './cartUtils';

const UserProfile = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // SOLUCIÓN 1: Usar useCallback para memoizar updateCartCount
  const updateCartCount = useCallback((count) => {
    setCartCount(count);
  }, []);

  // Cargar el contador del carrito al iniciar (solo una vez)
  useEffect(() => {
    setCartCount(getCartCount());
  }, []);
  
  // Helper function to get cookie data
  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  // Check authentication and user type immediately on mount
  useEffect(() => {
    const checkUserTypeAndRedirect = async () => {
      const dataCookie = getCookie("data");
      
      if (!dataCookie) {
        console.log("No data cookie found, redirecting to login");
        window.location.replace('/Login');
        return;
      }
      
      try {
        const parsedData = JSON.parse(dataCookie);
        console.log("Parsed cookie data in UserProfile:", parsedData);
        
        if (!parsedData || !parsedData.Data) {
          console.log("Invalid data structure in cookie, redirecting to login");
          navigate('/Login');
          return;
        }
        
        if (parsedData.Data && parsedData.Data.tipo_usuario) {
          const userType = parsedData.Data.tipo_usuario.toLowerCase();
          
          if (userType === 'administrador') {
            console.log("Admin user detected, redirecting to AdminProfile");
            window.location.replace('/AdminProfile');
            return;
          } else if (userType === 'root') {
            console.log("Root user detected, redirecting to RootProfile");
            window.location.replace('/RootProfile');
            return;
          } else if (userType !== 'usuario' && userType !== 'cliente') {
            console.log("Unknown user type, redirecting to login");
            window.location.replace('/Login');
            return;
          }
        }
        
        console.log("Regular user confirmed, loading profile");
        setUserData(parsedData.Data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking user type:", error);
        window.location.replace('/Login');
      }
    };
    
    checkUserTypeAndRedirect();
  }, [navigate]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);
  
  // SOLUCIÓN 2: Optimizar el refresh de datos - solo cuando sea necesario
  const refreshUserData = useCallback(async () => {
    const result = await fetchUserData();
    
    if (result.success) {
      setUserData(result.data);
    } else {
      window.location.replace('/Login');
    }
  }, []);

  // SOLUCIÓN 3: Reducir llamadas innecesarias - solo refrescar en casos específicos
  useEffect(() => {
    // Solo refrescar datos si no estamos cargando y no estamos editando perfil
    // Y solo para ciertos tabs que realmente necesitan datos frescos
    if (!isLoading && !isEditingProfile && (activeTab === 'profile' || activeTab === 'compras')) {
      refreshUserData();
    }
  }, [activeTab, isLoading, isEditingProfile, refreshUserData]);

  useEffect(() => {
    window.isEditingProfile = isEditingProfile;
  }, [isEditingProfile]);
  
  // SOLUCIÓN 4: Memoizar handler para editar perfil
  const handleEditProfile = useCallback((value) => {
    if (value === false) {
      setIsEditingProfile(false);
      // Solo refrescar si realmente cambiamos de edición a no edición
      refreshUserData();
    } else {
      setIsEditingProfile(true);
    }
  }, [refreshUserData]);
  
  // Handler para regresar de la edición de perfil
  const handleGoBack = useCallback(() => {
    setIsEditingProfile(false);
    refreshUserData();
  }, [refreshUserData]);

  // Función para cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem('shoppingCart');
    document.cookie.split(";").forEach((cookie) => {
      document.cookie = cookie
        .replace(/^ +/, "")
        .replace(/=.*/, "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/");
    });
    
    navigate('/login');
  };

  const goToProfile = () => {
    navigate('/Profile');
  };
  
  if (isLoading || !userData) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700">Verificando información de usuario...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white shadow-sm w-full">
        <div className="bg-gray-800 text-white">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/home" className="font-bold text-xl">Librosfera</Link>
              <span className="text-sm">Tu librería de confianza</span>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={goToProfile}
                className="text-sm hover:underline cursor-pointer"
              >
                Mi Cuenta
              </button>
              {/* <Link to="/mis-pedidos" className="text-sm hover:underline">Mis Pedidos</Link> */}
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

      <div className="flex flex-1 bg-[#f9fafb]">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          userData={userData}
          isLoading={isLoading}
          onEditProfile={handleEditProfile}
          onDataRefresh={null}
          cartCount={cartCount}
        />
        
        <div className="flex-1">
          {isEditingProfile ? (
            <div className="h-full overflow-y-auto p-6">
              <EditProfile 
                userData={userData}
                userType="user"
                onGoBack={handleGoBack}
              />
            </div>
          ) : (
            <div className="h-full">
              {activeTab === 'home' && <Dashboard userData={userData} onEditProfile={handleEditProfile} />}
              {activeTab === 'profile' && <ProfilePage userData={userData} onEditProfile={handleEditProfile} />}
              {activeTab === 'mensajes' && <MessagesPage />}
              {activeTab === 'compras' && <PurchasesPage />}
              {activeTab === 'devoluciones' && <ReturnsPage />}
              {activeTab === 'carrito' && <CartPage updateCartCount={updateCartCount} />}
              {activeTab === 'tarjeta' && <CardPage />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;