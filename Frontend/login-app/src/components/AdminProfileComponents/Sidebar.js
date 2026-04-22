import React, { useState } from 'react';
import { logoutUser } from '../UserProfilePageComponents/authUtils';
import CachedImage from '../CachedImage';


const Sidebar = ({ activeTab, setActiveTab, userData, isLoading, onEditProfile }) => {
  // Función para manejar el logout
  const handleLogout = async () => {
    localStorage.removeItem('shoppingCart');
    await logoutUser();
    window.location.replace('/Login');
  };

  // Check if the user is a root user
  const isRootUser = userData && userData.tipo_usuario === 'root';

  // Elementos de navegación para el administrador con iconos SVG
  const navItems = [
    { 
      id: 'inicio', 
      name: 'Inicio', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      hideForRoot: false // visible for root
    },
    { 
      id: 'administrar-libro', 
      name: 'Administrar Libros', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      hideForRoot: true // hidden for root
    },
    { 
      id: 'administrar-ventas', 
      name: 'Administrar Ventas', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      ),
      hideForRoot: true // hidden for root
    },
    { 
      id: 'gestionar-devoluciones', 
      name: 'Gestionar Devoluciones', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      ),
      hideForRoot: true // hidden for root
    },
    { 
      id: 'gestionar-usuarios', 
      name: 'Gestionar Usuarios', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
      hideForRoot: false // visible for root
    },
    { 
      id: 'gestionar-mensajes', 
      name: 'Gestionar Mensajes', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      ),
      hideForRoot: true // hidden for root
    },
    { 
      id: 'administrar-tiendas', 
      name: 'Administrar Tiendas', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      hideForRoot: true // hidden for root (manteniendo consistencia con otras opciones de administración)
    },
    { 
      id: 'mi-perfil', 
      name: 'Mi Perfil', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      hideForRoot: false // visible for root
    }
  ];
  const PROFILE_PIC_BASE_URL = '';
  const DEFAULT_PROFILE_PIC = `${process.env.REACT_APP_API_URL}/uploads/profiles/default.jpg`;

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    // Close the EditProfile when navigating to other sections
    if (window.isEditingProfile) {
      onEditProfile(false);
    }
  };

  const getProfileImageSrc = () => {
    if (userData?.foto_perfil) {
      return `${PROFILE_PIC_BASE_URL}${userData.foto_perfil}`;
    } else if (userData?.profileImage) {
      return userData.profileImage;
    } else {
      return `${PROFILE_PIC_BASE_URL}${DEFAULT_PROFILE_PIC}`;
    }
  };

  // Handle edit profile - no refresh needed here since EditProfile will handle it
  const handleEditProfile = () => {
    onEditProfile();
  };

  // Filter nav items based on user type
  // For root users, hide items marked as hideForRoot: true
  // For all other users (including admins), show all navigation items
  const filteredNavItems = isRootUser 
    ? navItems.filter(item => !item.hideForRoot)
    : navItems;

  // If current activeTab is now hidden for root users, reset to 'inicio'
  React.useEffect(() => {
    // Only reset the tab if the user is root and is on a tab that's hidden for root users
    if (isRootUser && ['administrar-libro', 'administrar-ventas', 'gestionar-devoluciones', 'gestionar-mensajes', 'administrar-tiendas'].includes(activeTab)) {
      setActiveTab('inicio');
    }
  }, [isRootUser, activeTab, setActiveTab]);

  return (
    <div className="w-64 bg-gray-700 h-full flex flex-col">
      {/* User info section at the top */}
      <div className="flex flex-col items-center justify-center py-8 border-b border-gray-600">
        <div className="w-24 h-24 bg-white rounded-full overflow-hidden mb-4">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <CachedImage 
              src={getProfileImageSrc()}
              alt={userData?.usuario || 'Usuario'} 
              className="w-full h-full object-cover"
              fallbackSrc={`${PROFILE_PIC_BASE_URL}${DEFAULT_PROFILE_PIC}`}
              fallbackComponent={
                <div className="w-full h-full flex items-center justify-center bg-yellow-200">
                  <span className="text-4xl font-bold text-yellow-500">
                    {userData?.usuario?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              }
            />
          )}
        </div>
        <h2 className="text-white text-xl font-semibold mb-1">
          {isLoading ? 'Cargando...' : (userData?.usuario || 'Usuario')}
        </h2>
        <p className="text-gray-300 text-sm mb-3">
          {isLoading ? '' : (userData?.email || '')}
        </p>
        {/* Display user type badge */}
        {userData?.tipo_usuario && (
          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
            userData.tipo_usuario === 'root' 
              ? 'bg-red-100 text-red-800' 
              : userData.tipo_usuario === 'administrador'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-blue-100 text-blue-800'
          }`}>
            {userData.tipo_usuario.charAt(0).toUpperCase() + userData.tipo_usuario.slice(1)}
          </div>
        )}
        <button 
          onClick={handleEditProfile}
          className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
          disabled={isLoading}
        >
          Editar Perfil
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 py-4">
        <ul>
          {filteredNavItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center py-3 px-6 text-left relative ${
                  activeTab === item.id
                    ? 'bg-gray-800 text-white border-l-4 border-blue-500'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className={`mr-3 ${activeTab === item.id ? 'text-white' : 'text-gray-400'}`}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.name}</span>
                
                {/* Indicador activo para administrar-libro */}
                {activeTab === item.id && item.id === 'administrar-libro' && (
                  <span className="ml-auto mr-2 w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout button */}
      <div className="px-10 py-0">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center py-3 px-4 text-left text-gray-300 hover:bg-gray-800 hover:text-white rounded"
        >
          <span className="mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span> 
          <span>Cerrar Sesión</span>
        </button>
      </div>

      {/* Company logo at bottom */}
      <div className="p-1 border-t border-gray-600 text-center">
        <h3 className="text-white text-xl font-bold">Librosfera</h3>
        <p className="text-gray-400 text-sm">Tu librería de confianza</p>
      </div>
    </div>
  );
};

export default Sidebar;