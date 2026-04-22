import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ShoppingCart from './ShoppingCart'; // Importar el componente de carrito
import { fetchCartUtils } from './cartUtils';

// Helper function to get cookie data - same as in AdminProfile
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

// Componente de layout para usuarios normales (no administradores)
const UserLayout = ({ children, cartCount = 0, updateCartCount }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const searchRef = useRef(null);
  const [isCartOpen, setIsCartOpen] = useState(false); // Estado para controlar la visibilidad del carrito

  // Verificar la autenticación al cargar el componente
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Obtener datos directamente de la cookie
        const dataCookie = getCookie("data");
        
        if (!dataCookie) {
          console.log("No user logged in");
          setUserData(null);
          setIsLoading(false);
          localStorage.removeItem('shoppingCart');
          return;
        }
        
        // Análisis de los datos de la cookie
        const parsedData = JSON.parse(dataCookie);
        
        if (!parsedData || !parsedData.Data) {
          console.log("Invalid data structure in cookie");
          setUserData(null);
          setIsLoading(false);
          localStorage.removeItem('shoppingCart');
          return;
        }
        
        console.log("User data loaded from cookie");
        console.log(parsedData.Data);
        setUserData(parsedData.Data);

        if (parsedData && !(parsedData.Data.tipo_usuario == "administrador")&& !(parsedData.Data.tipo_usuario == "root")) {
          fetchCartUtils();
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking authentication:", error);
        setUserData(null);
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Función para manejar la búsqueda
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      } 
      
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/libros/autocompletar`, {
          params: {
            q: searchTerm.trim(),
            limit: 5
          }
        });
        
        if (response.data && response.data.status === 'success') {
          setSuggestions(response.data.data);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error("Error fetching search suggestions:", error);
        setSuggestions([]);
      }
    };
    
    // Debounce para evitar demasiadas llamadas API
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        fetchSuggestions();
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);
  
  // Función para manejar la búsqueda
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Redireccionar a la página de resultados de búsqueda con el término como parámetro
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      setShowSuggestions(false);
    }
  };

  // Función para manejar la selección de sugerencia
  const handleSuggestionSelect = (suggestion) => {
    setSearchTerm(suggestion.titulo);
    setShowSuggestions(false);
    navigate(`/search?q=${encodeURIComponent(suggestion.titulo)}`);
  };

  // Función para cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem('shoppingCart');
    // Limpiar las cookies
    document.cookie.split(";").forEach((cookie) => {
      document.cookie = cookie
        .replace(/^ +/, "")
        .replace(/=.*/, "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/");
    });
    
    // Actualizar estado local
    setUserData(null);
    
    // Redireccionar a la página de login
    navigate('/login');
  };

  // Función para ir al perfil de usuario según su tipo
  const goToProfile = () => {
    if (!userData) {
      navigate('/login');
      return;
    }
    
    const userType = userData.tipo_usuario?.toLowerCase();
    
    if (userType === 'administrador') {
      navigate('/AdminProfile');
    } else if (userType === 'root') {
      navigate('/RootProfile');
    } else {
      navigate('/Profile');
    }
  };

  // Función para alternar la visibilidad del carrito
  const toggleCart = (e) => {
    e.preventDefault(); // Prevenir navegación
    setIsCartOpen(!isCartOpen);
  };

  // Verificar el tipo de usuario (Si está logueado)
  const isLoggedIn = !!userData;
  const userType = userData?.tipo_usuario?.toLowerCase();
  const isAdminOrRoot = userType === 'administrador' || userType === 'root';
  const isRegularUser = isLoggedIn && !isAdminOrRoot;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        {/* Top navigation bar */}
        <div className="bg-gray-800 text-white">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/home" className="font-bold text-xl">Librosfera</Link>
              <span className="text-sm">Tu librería de confianza</span>
            </div>
            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                // Opciones para usuarios logueados
                <>
                  <button 
                    onClick={goToProfile}
                    className="text-sm hover:underline cursor-pointer"
                  >
                    Mi Cuenta
                  </button>
                  
                  {/* Mostrar "Mis Pedidos" solo para usuarios regulares (clientes) */}
                  {/* {isRegularUser && (
                    <Link to="/mis-pedidos" className="text-sm hover:underline">
                      Mis Pedidos
                    </Link>
                  )} */}
                  
                  <button 
                    onClick={handleLogout}
                    className="text-sm hover:underline cursor-pointer"
                  >
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                // Opciones para usuarios no logueados
                <>
                  <Link to="/login" className="text-sm hover:underline">
                    Iniciar Sesión
                  </Link>
                  <Link to="/register" className="text-sm hover:underline">
                    Registrarse
                  </Link>
                </>
                
              )}
            </div>
          </div>
        </div>
        
        {/* Search and cart bar */}
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-6 w-full">
            <Link to="/home" className="hidden md:block">
              <img 
                src="/l2.png" 
                alt="Librosfera Logo" 
                className="h-12"
              />
            </Link>
            <form onSubmit={handleSearch} className="flex-1 flex">
              <div className="relative w-full" ref={searchRef}>
                <input
                  type="text"
                  placeholder="Buscar por título, autor, ISBN..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => searchTerm.trim().length >= 2 && setShowSuggestions(true)}
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button 
                  type="submit"
                  className="absolute right-2 top-1 bg-blue-600 text-white px-4 py-1 rounded-lg hover:bg-blue-700"
                >
                  Buscar
                </button>
                
                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white shadow-lg rounded-lg mt-1 max-h-80 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                      <div 
                        key={suggestion._id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer bg-gray-50 text-gray-700 border-b border-gray-100"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <div className="font-medium">{suggestion.titulo}</div>
                        {suggestion.autor_nombre_completo && (
                          <div className="text-sm text-gray-500">{suggestion.autor_nombre_completo}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </div>
          
          <div className="ml-6">
            {/* Botón del carrito - Ahora abre el carrito desplegable en vez de navegar */}
            <button 
              onClick={toggleCart}
              className="relative inline-block p-2 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Navigation links - modificados para estar distribuidos uniformemente */}
        {/* <nav className="bg-gray-100">
          <div className="container mx-auto">
            <ul className="flex justify-between items-center px-4 py-3 text-sm">
              {[
                { to: "/novedades", label: "Novedades" },
                { to: "/mas-vendidos", label: "Más Vendidos" },
                { to: "/recomendados", label: "Recomendados" },
                { to: "/ofertas", label: "Ofertas" },
                { to: "/preventas", label: "Preventas" },
                { to: "/libros-digitales", label: "Libros Digitales" },
                { to: "/audiolibros", label: "Audiolibros" },
              ].map((link, index) => (
                <li key={index} className="px-4">
                  <span className="text-gray-400 cursor-not-allowed whitespace-nowrap font-medium">
                    {link.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </nav> */}
      </header>
      
      {/* Main content */}
      <main className="flex-grow">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Sobre Librosfera</h3>
              <ul className="space-y-2">
                <li><span className="text-gray-300 cursor-not-allowed">Quiénes Somos</span></li>
                <li><span className="text-gray-300 cursor-not-allowed">Contacto</span></li>
                <li><span className="text-gray-300 cursor-not-allowed">Trabaja con Nosotros</span></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Ayuda</h3>
              <ul className="space-y-2">
                <li><span className="text-gray-300 cursor-not-allowed">Preguntas Frecuentes</span></li>
                <li><span className="text-gray-300 cursor-not-allowed">Cómo Comprar</span></li>
                <li><span className="text-gray-300 cursor-not-allowed">Métodos de Pago</span></li>
                <li><span className="text-gray-300 cursor-not-allowed">Envíos</span></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Mi Cuenta</h3>
              <ul className="space-y-2">
                <li><span className="text-gray-300 cursor-not-allowed">Iniciar Sesión</span></li>
                <li><span className="text-gray-300 cursor-not-allowed">Mis Pedidos</span></li>
                <li><span className="text-gray-300 cursor-not-allowed">Lista de Deseos</span></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Síguenos</h3>
              <div className="flex space-x-4">
                <span className="text-gray-300 cursor-not-allowed">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </span>
                <span className="text-gray-300 cursor-not-allowed">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                  </svg>
                </span>
                <span className="text-gray-300 cursor-not-allowed">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.332.014 7.052.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Suscríbete a nuestro boletín</h4>
                <form className="flex">
                  <input
                    type="email"
                    placeholder="Tu correo electrónico"
                    className="px-3 py-2 w-full text-gray-800 rounded-l focus:outline-none cursor-not-allowed"
                    disabled
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700 cursor-not-allowed"
                    disabled
                  >
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-600 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} Librosfera. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Componente de carrito desplegable */}
      <ShoppingCart 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        updateCartCount={updateCartCount}
      />
    </div>
  );
};

export default UserLayout;