import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UserLayout from './UserLayout';
import axios from 'axios';
import CachedImage from './CachedImage';
import { getCartCount } from './cartUtils';
import { getAuthToken } from './UserProfilePageComponents/authUtils';

// URL base for API calls
const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;

// Create a caching mechanism for API responses
const apiCache = {
  data: {},
  timestamp: {},
  // Cache duration in milliseconds (5 minutes)
  cacheDuration: 5 * 60 * 1000,
  
  // Store data in cache
  set(key, data) {
    this.data[key] = data;
    this.timestamp[key] = Date.now();
  },
  
  // Get data from cache if valid
  get(key) {
    if (!this.data[key]) return null;
    
    const age = Date.now() - this.timestamp[key];
    if (age > this.cacheDuration) {
      // Cache expired
      delete this.data[key];
      delete this.timestamp[key];
      return null;
    }
    
    return this.data[key];
  },
  
  // Check if cache is valid
  isValid(key) {
    return this.get(key) !== null;
  }
};

// BookCard component extracted outside the HomePage component
const BookCard = React.memo(({ book, booksInCart, handleAddToCart }) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [validImageUrls, setValidImageUrls] = useState([]);
  const [imagesVerified, setImagesVerified] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  
  // Check if this book is in the cart
  const isInCart = booksInCart.has(book._id);
  
  useEffect(() => {
    // Only run image verification once
    if (!imagesVerified && book.imagenes && book.imagenes.length > 0) {
      const verifyImages = async () => {
        // Simplified image verification - just use the images without verification
        setValidImageUrls(book.imagenes);
        setImagesVerified(true);
      };
      
      verifyImages();
    } else if (!imagesVerified) {
      // No images or empty array - set default and mark as verified
      setValidImageUrls([{ 
        url: `${process.env.REACT_APP_API_URL}/uploads/libros/Default.png`,
        alt_text: "Default book image"
      }]);
      setImagesVerified(true);
    }
  }, [book.imagenes, imagesVerified]);

  const navigateToDetail = () => {
    navigate(`/libro/${book._id}`);
  };

  // Handler for adding to cart
  const onAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isInCart || !book.stock_disponible || book.stock_disponible <= 0) {
      return;
    }
    
    setAddingToCart(true);
    
    try {
      await handleAddToCart(e, book);
    } finally {
      setTimeout(() => {
        setAddingToCart(false);
      }, 500);
    }
  };

  // Function to navigate between images
  const navigateImages = (e, direction) => {
    e.stopPropagation();
    
    if (!validImageUrls || validImageUrls.length <= 1) return;
    
    if (direction === 'next') {
      setCurrentImageIndex((prev) => 
        prev === validImageUrls.length - 1 ? 0 : prev + 1
      );
    } else {
      setCurrentImageIndex((prev) => 
        prev === 0 ? validImageUrls.length - 1 : prev - 1
      );
    }
  };

  // Calculate price with and without discount
  const precioBase = book.precio_info?.precio_base || book.precio;
  const tieneDescuento = book.precio_info?.descuentos?.some(d => d.activo);
  const porcentajeDescuento = tieneDescuento 
    ? book.precio_info.descuentos.find(d => d.activo && d.tipo === 'porcentaje')?.valor || 0 
    : 0;
  
  // Format stock
  const stockDisponible = book.stock_disponible || 0;

  console.log("Book:", book);

  return (
    <div 
      className="book-card flex flex-col h-full border bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={navigateToDetail}
    >
      {/* Book image with navigation arrows */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <div 
          className="flex transition-transform duration-300 ease-in-out w-full h-full"
          style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
        >
          {validImageUrls.length > 0 ? (
            validImageUrls.map((image, index) => (
              <div key={index} className="min-w-full h-full flex-shrink-0">
                <CachedImage 
                  src={image.url} 
                  alt={image.alt_text || "Imagen de libro"} 
                  className="w-full h-full object-contain"
                />
              </div>
            ))
          ) : (
            <div className="min-w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">
              <span className="material-icons-outlined text-6xl">book</span>
            </div>
          )}
        </div>
        
        {/* Discount tag if applicable */}
        {porcentajeDescuento > 0 && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
            {porcentajeDescuento}% DCTO
          </div>
        )}
        
        {/* Image navigation arrows - only if there's more than one image */}
        {validImageUrls && validImageUrls.length > 1 && (
          <>
            <button 
              className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 hover:bg-opacity-100 z-10"
              onClick={(e) => navigateImages(e, 'prev')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-800" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button 
              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 hover:bg-opacity-100 z-10"
              onClick={(e) => navigateImages(e, 'next')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-800" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </div>
      
      {/* Book information */}
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="font-bold text-sm line-clamp-2 mb-1 hover:text-blue-600">
          {book.titulo}
        </h3>
        <p className="text-gray-600 text-sm mb-2">{book.autor_nombre_completo}</p>
        
        {/* Rating stars if available */}
        {book.calificaciones && (
          <div className="flex mb-1">
            {[...Array(5)].map((_, i) => (
              <span 
                key={i} 
                className={`text-lg ${i < (book.calificaciones.promedio || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </span>
            ))}
            {book.calificaciones.cantidad > 0 && (
              <span className="text-xs text-gray-500 ml-1">({book.calificaciones.cantidad})</span>
            )}
          </div>
        )}
        
        {/* Publisher and edition information */}
        {book.editorial && (
          <p className="text-xs text-gray-500 mb-3">
            {book.editorial}, {book.estado === 'nuevo' ? 'Nuevo' : 'Usado'}
            {book.anio_publicacion ? `, ${book.anio_publicacion}` : ''}
          </p>
        )}
        
        {/* Availability */}
        <p className={`text-xs ${stockDisponible > 0 ? 'text-green-600' : 'text-red-600'} mb-2`}>
          {stockDisponible > 0 
            ? `Quedan ${stockDisponible} ${stockDisponible === 1 ? 'unidad' : 'unidades'}`
            : 'Agotado'}
        </p>
        
        {/* Price */}
        <div className="mt-auto">
          {tieneDescuento ? (
            <div>
              <span className="text-xs line-through text-gray-500">
                ${precioBase.toLocaleString('es-CO')}
              </span>
              <div className="text-lg font-bold text-red-600">
                ${(book.precio).toLocaleString('es-CO')}
              </div>
            </div>
          ) : (
            <div className="text-lg font-bold">
              ${book.precio.toLocaleString('es-CO')}
            </div>
          )}
        </div>
        
        {/* Add to cart button */}
        <div className="mt-2 flex">
          <button 
            className={`flex items-center justify-center px-3 py-1 rounded-full text-sm w-full transition-colors
              ${stockDisponible <= 0 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isInCart
                  ? 'bg-green-600 text-white cursor-default'
                  : addingToCart 
                    ? 'bg-gray-400 text-white cursor-wait' 
                    : 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'}`}
            onClick={onAddToCart}
            disabled={stockDisponible <= 0 || addingToCart || isInCart}
          >
            {addingToCart ? (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Agregando...
              </span>
            ) : isInCart ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Agregado
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Agregar al carrito
              </>
            )}
          </button>
        </div>

        {/* View details button */}
        <div className="mt-2">
          <button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigateToDetail();
            }}
          >
            Ver detalles
          </button>
        </div>
      </div>
    </div>
  );
});

// Main HomePage component
const HomePage = () => {
  const [allBooks, setAllBooks] = useState([]);
  const [featuredBooks, setFeaturedBooks] = useState([]);
  const [discountedBooks, setDiscountedBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 8,
    totalPages: 0
  });
  const navigate = useNavigate();
  
  // Cart state
  const [cartCount, setCartCount] = useState(0);
  const [booksInCart, setBooksInCart] = useState(new Set());
  
  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  // Function to update cart count
  const updateCartCount = useCallback((count) => {
    setCartCount(count);
  }, []);

  // Toast component
  const Toast = ({ message, type, visible }) => {
    if (!visible) return null;
    
    return (
      <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out ${
        visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
      } ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
      }`}>
        <div className="flex items-center">
          {type === 'success' && (
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {type === 'error' && (
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="font-medium">{message}</span>
        </div>
      </div>
    );
  };
  
  // Function to show toast notifications
  const showToast = useCallback((message, type = 'success') => {
    setToast({ visible: true, message, type });
    
    // Hide after 2 seconds
    setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 2000);
  }, []);

  // Function to get books in cart - optimized to not cause re-renders
  const getBooksInCart = useCallback(() => {
    try {
      const currentCart = localStorage.getItem('shoppingCart') 
        ? JSON.parse(localStorage.getItem('shoppingCart')) 
        : [];
      
      // Extract book IDs properly, handling both full book objects and ID strings
      const bookIds = new Set(currentCart.map(item => {
        if (typeof item.bookId === 'string') {
          return item.bookId;
        } else if (item.bookId && typeof item.bookId === 'object') {
          return item.bookId._id || item.bookId.id;
        }
        return null;
      }).filter(id => id !== null));
      
      setBooksInCart(bookIds);
      return bookIds;
    } catch (error) {
      console.error('Error al leer el carrito:', error);
      return new Set();
    }
  }, []);

  // Function to fetch books - uses cache when possible
  const fetchAllBooks = useCallback(async (page = 1, limit = 50) => {
    const cacheKey = `allBooks_${page}_${limit}`;
    
    // Check cache first
    if (apiCache.isValid(cacheKey)) {
      const cachedData = apiCache.get(cacheKey);
      setAllBooks(cachedData.books);
      setPagination(cachedData.pagination);
      return cachedData.books;
    }
    
    try {
      const response = await axios.get(`${API_BASE_URL}/libros`, {
        params: {
          page,
          limit,
          solo_disponibles: true,
          sort: 'fecha_registro',
          order: 'desc'
        }
      });

      if (response.data.status === 'success') {
        const books = response.data.data;
        const pagination = response.data.paginacion;
        
        // Save to cache
        apiCache.set(cacheKey, { books, pagination });
        
        setAllBooks(books);
        setPagination(pagination);
        return books;
      }
    } catch (error) {
      console.error('Error al obtener libros:', error);
      return [];
    }
  }, []);

  // Function to fetch featured books - uses cache
  const fetchFeaturedBooks = useCallback(async () => {
    const cacheKey = 'featuredBooks';
    
    // // Check cache first
    // if (apiCache.isValid(cacheKey)) {
    //   setFeaturedBooks(apiCache.get(cacheKey));
    //   return apiCache.get(cacheKey);
    // }
    
    try {
      const response = await axios.get(`${API_BASE_URL}/libros/destacados`, {
        params: {
          limit: 4,
          min_calificacion: 4
        }
      });

      if (response.data.status === 'success') {
        const books = response.data.data;
        
        // Save to cache
        apiCache.set(cacheKey, books);
        
        setFeaturedBooks(books);
        return books;
      }
    } catch (error) {
      console.error('Error al obtener libros destacados:', error);
      return [];
    }
  }, []);

  // Function to fetch discounted books - uses cache
  const fetchDiscountedBooks = useCallback(async () => {
    const cacheKey = 'discountedBooks';
    
    // Check cache first
    if (apiCache.isValid(cacheKey)) {
      setDiscountedBooks(apiCache.get(cacheKey));
      return apiCache.get(cacheKey);
    }
    
    try {
      const response = await axios.get(`${API_BASE_URL}/libros/descuentos`, {
        params: {
          limit: 4,
          min_descuento: 10
        }
      });

      if (response.data.status === 'success') {
        const books = response.data.data;
        
        // Save to cache
        apiCache.set(cacheKey, books);
        
        setDiscountedBooks(books);
        return books;
      }
    } catch (error) {
      console.error('Error al obtener libros con descuento:', error);
      return [];
    }
  }, []);

  // Function to set original categories - cached
  const fetchCategories = useCallback(() => {
    const cacheKey = 'categories';
    
    // Check cache first
    if (apiCache.isValid(cacheKey)) {
      setCategories(apiCache.get(cacheKey));
      return apiCache.get(cacheKey);
    }
    
    // Use original categories from previous code
    const originalCategories = [
      'Ficción', 'No Ficción', 'Ciencia Ficción', 'Fantasía', 'Romance', 'Biografía', 'Historia', 'Ciencia', 'Filosofía', 'Arte', 'Tecnología'
    ];
    
    // Save to cache
    apiCache.set(cacheKey, originalCategories);
    
    setCategories(originalCategories);
    return originalCategories;
  }, []);

  // Function to load page - reuses fetchAllBooks
  const loadPage = useCallback(async (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setIsLoading(true);
    await fetchAllBooks(newPage, pagination.limit);
    setIsLoading(false);
    // Scroll up for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchAllBooks, pagination.totalPages, pagination.limit]);

  // Function to render stars for rating
  const renderStars = useCallback((rating) => {
    const calculatedRating = rating || 0;
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <span 
          key={i} 
          className={`text-lg ${i < calculatedRating ? 'text-yellow-400' : 'text-gray-300'}`}
        >
          ★
        </span>
      );
    }
    return stars;
  }, []);

  // Function to add to cart - optimized to not trigger unnecessary re-renders
  const handleAddToCart = useCallback(async (e, book) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if already in cart
    if (booksInCart.has(book._id)) {
      return;
    }
    
    // Check if there's available stock
    if (!book.stock_disponible || book.stock_disponible <= 0) {
      showToast('Lo sentimos, este libro no está disponible en inventario.', 'error');
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) {
        showToast('Debes iniciar sesión para agregar productos al carrito', 'error');
        return;
      }

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/v1/carrito/agregar`, {
        id_libro: book._id,
        cantidad: 1
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        const currentCart = localStorage.getItem('shoppingCart') 
          ? JSON.parse(localStorage.getItem('shoppingCart')) 
          : [];
        
        currentCart.push({
          bookId: book,
          quantity: 1
        });
        
        localStorage.setItem('shoppingCart', JSON.stringify(currentCart));

        const newCount = response.data.data.carrito.n_item;
        updateCartCount(newCount);

        setBooksInCart(prevBooksInCart => {
          const newBooksInCart = new Set(prevBooksInCart);
          newBooksInCart.add(book._id);
          return newBooksInCart;
        });
        
        // Update last modified timestamp
        localStorage.setItem('cartLastUpdated', new Date().getTime().toString());
        
        // Dispatch a single event for cart updates
        window.dispatchEvent(new CustomEvent('cartUpdated', {
          bubbles: true,
          detail: {
            bookId: book._id,
            action: 'add',
            timestamp: Date.now(),
            serverResponse: response.data
          }
        }));
        
        showToast(response.data.message || `${book.titulo} agregado al carrito`);
      }
    } catch (error) {
      console.error('Error al agregar al carrito:', error);
      
      if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 400:
            showToast(data.message || 'Datos inválidos o límites excedidos', 'error');
            break;
          case 401:
            showToast('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'error');
            break;
          case 403:
            showToast('No tienes permisos para realizar esta acción', 'error');
            break;
          case 409:
            showToast(data.message || 'Stock insuficiente o límites de carrito alcanzados', 'error');
            break;
          case 500:
            showToast('Error interno del servidor. Intenta más tarde.', 'error');
            break;
          default:
            showToast(data.message || 'Ocurrió un error inesperado al agregar el libro al carrito', 'error');
        }
      } else if (error.request) {
        showToast('Error de conexión. Verifica tu internet e intenta nuevamente.', 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    }
  }, [booksInCart, showToast, updateCartCount]);

  // Initial data loading - optimized to fetch data only once
  useEffect(() => {
    let isMounted = true;
    
    // Load initial cart count and books in cart
    setCartCount(getCartCount());
    getBooksInCart();
    
    // Function to load all necessary data
    const fetchAllData = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      try {
        await Promise.all([
          fetchAllBooks(),
          fetchFeaturedBooks(),
          fetchDiscountedBooks(),
          fetchCategories()
        ]);
      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAllData();

    // Optimized event listener for cart synchronization
    const handleCartUpdate = (e) => {
      getBooksInCart();
      setCartCount(getCartCount());
    };

    // Use a single event listener for cart updates
    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, [fetchAllBooks, fetchFeaturedBooks, fetchDiscountedBooks, fetchCategories, getBooksInCart]);

  // Memoized sections to prevent unnecessary re-renders
  const PromoBanner = useMemo(() => {
    return () => (
      <div className="relative overflow-hidden rounded-lg mb-8 bg-blue-900">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">BOOKS 60% DCTO</h2>
          <p className="text-xl mb-6">¡Celebremos juntos el mes del libro!</p>
          <button 
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full flex items-center"
            onClick={() => navigate('/ofertas')}
          >
            VER MÁS <span className="material-icons-outlined ml-1">arrow_forward</span>
          </button>
        </div>
      </div>
    );
  }, [navigate]);

  // Categories list - memoized to prevent re-renders
  const CategoriesList = useMemo(() => {
    return () => (
      <div className="bg-white p-6 rounded-lg shadow-sm sticky top-4">
        <h2 className="text-lg font-bold mb-4">Categorías</h2>
        <div className="max-h-[calc(100vh-150px)] overflow-y-auto">
          <ul className="divide-y divide-gray-200">
            {categories.length > 0 ? (
              categories.map((category, index) => (
                <li key={index}>
                  <a 
                    href={`/libros/categoria/${encodeURIComponent(category)}`}
                    className="block py-2 text-sm hover:text-blue-600 transition-colors"
                  >
                    {category}
                  </a>
                </li>
              ))
            ) : (
              <li className="py-2 text-sm text-gray-500">Cargando categorías...</li>
            )}
          </ul>
        </div>
      </div>
    );
  }, [categories]);

  // Featured books section - memoized
  const FeaturedBooksSection = useMemo(() => {
    return () => {
      if (featuredBooks.length === 0) return null;
      
      return (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Libros Destacados</h2>
            <Link to="/libros/destacados" className="text-blue-600 text-sm hover:underline">Ver todos</Link>
          </div>
          
          <div className="border-t-4 border-blue-600 mb-4"></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredBooks.map(book => (
              <BookCard 
                key={book._id} 
                book={book} 
                booksInCart={booksInCart}
                handleAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </div>
      );
    };
  }, [featuredBooks, booksInCart, handleAddToCart]);

  // Discounted books section - memoized
  const DiscountedBooksSection = useMemo(() => {
    return () => {
      if (discountedBooks.length === 0) return null;
      
      return (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">CyberBooks - Hasta 60% dcto</h2>
            <Link to="/libros/descuentos" className="text-blue-600 text-sm hover:underline">Ver todos</Link>
          </div>
          
          <div className="border-t-4 border-red-600 mb-4"></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {discountedBooks.map(book => (
              <BookCard 
                key={book._id} 
                book={book} 
                booksInCart={booksInCart}
                handleAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </div>
      );
    };
  }, [discountedBooks, booksInCart, handleAddToCart]);

  // All books section - memoized
  const AllBooksSection = useMemo(() => {
    return () => {
      if (allBooks.length === 0 && !isLoading) return (
        <div className="mb-8 text-center p-8 bg-gray-50 rounded-lg">
          <span className="material-icons-outlined text-4xl text-gray-400 mb-2">auto_stories</span>
          <p className="text-gray-600">No se encontraron libros disponibles</p>
        </div>
      );
      
      return (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Catálogo Completo</h2>
            <Link to="/libros" className="text-blue-600 text-sm hover:underline">Ver catálogo</Link>
          </div>
          
          <div className="border-t-4 border-gray-600 mb-4"></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {allBooks.map(book => (
              <BookCard 
                key={book._id} 
                book={book} 
                booksInCart={booksInCart}
                handleAddToCart={handleAddToCart}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="inline-flex rounded-md shadow">
                <button
                  onClick={() => loadPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className={`relative inline-flex items-center px-4 py-2 rounded-l-md border text-sm font-medium
                    ${pagination.page === 1 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="material-icons-outlined text-sm">chevron_left</span>
                  Anterior
                </button>
                
                <div className="relative inline-flex items-center px-4 py-2 border-t border-b text-sm font-medium bg-white text-gray-700">
                  Página {pagination.page} de {pagination.totalPages}
                </div>
                
                <button
                  onClick={() => loadPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className={`relative inline-flex items-center px-4 py-2 rounded-r-md border text-sm font-medium
                    ${pagination.page === pagination.totalPages 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Siguiente
                  <span className="material-icons-outlined text-sm">chevron_right</span>
                </button>
              </nav>
            </div>
          )}
        </div>
      );
    };
  }, [allBooks, isLoading, pagination, booksInCart, handleAddToCart, loadPage]);

  // Home content - combined sections
  const HomeContent = useMemo(() => {
    return () => {
      if (isLoading) {
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-700">Cargando catálogo de libros...</p>
            </div>
          </div>
        );
      }

      return (
        <div className="container mx-auto py-6 px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Categories column (left) - sticky position */}
            <div className="md:w-1/4 lg:w-1/5">
              <CategoriesList />
            </div>
            
            {/* Main content (right) */}
            <div className="md:w-3/4 lg:w-4/5">
              <PromoBanner />
              <DiscountedBooksSection />
              <FeaturedBooksSection />
              <AllBooksSection />
            </div>
          </div>
        </div>
      );
    };
  }, [isLoading, CategoriesList, PromoBanner, DiscountedBooksSection, FeaturedBooksSection, AllBooksSection]);

  return (
    <UserLayout cartCount={cartCount} updateCartCount={updateCartCount}>
      <HomeContent />
      {/* Toast notifications */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        visible={toast.visible} 
      />
    </UserLayout>
  );
};

export default HomePage;