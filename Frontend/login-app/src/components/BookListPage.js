import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import UserLayout from './UserLayout';
import CachedImage from './CachedImage';
import { useCallback } from 'react';
import { getCartCount } from './cartUtils';
import { getAuthToken } from './UserProfilePageComponents/authUtils';

// URL base para las llamadas a la API
const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;

const BookListPage = ({ category }) => {
    
    const { categoryName } = useParams();
    const [books, setBooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
    const [cartCount, setCartCount] = useState(0);
    const [booksInCart, setBooksInCart] = useState(new Set());
    // Store actual filters and form state separately to prevent auto-requests
    const [formFilters, setFormFilters] = useState({
        titulo: '',
        autor: '',
        genero: '',
        editorial: '',
        idioma: '',
        estado: '',
        precio_min: '',
        precio_max: '',
        anio_min: '',
        anio_max: '',
        sort: 'fecha_registro',
        order: 'desc'
    });
    
    // CHANGE: This state will only be used when actually making API requests
    const [activeFilters, setActiveFilters] = useState({
        titulo: '',
        autor: '',
        genero: '',
        editorial: '',
        idioma: '',
        estado: '',
        precio_min: '',
        precio_max: '',
        anio_min: '',
        anio_max: '',
        sort: 'fecha_registro',
        order: 'desc'
    });
    
    const [showFilters, setShowFilters] = useState(false);

    const updateCartCount = useCallback((count) => {
        setCartCount(count);
      }, []);
    
    const [pagination, setPagination] = useState({
      total: 0,
      page: 1, 
      limit: 50, // Más libros por página que en la home
      totalPages: 0
    });
    const navigate = useNavigate();
    
    // Efectos para cargar libros basados en la categoría
    useEffect(() => {
        setBooks([]);
        setIsLoading(true);
      
      // Set initial filter values based on category
      const initialFilters = {
        titulo: '',
        autor: '',
        genero: category === 'categoria' && categoryName ? categoryName : '',
        editorial: '',
        idioma: '',
        estado: '',
        precio_min: '',
        precio_max: '',
        anio_min: '',
        anio_max: '',
        sort: 'fecha_registro',
        order: 'desc'
    };

    
  
    // CHANGE: Update both form and active filters
        setFormFilters(initialFilters);
        setActiveFilters(initialFilters);
    
        // Initial fetch with these filters
        fetchBooks(1, initialFilters);
    },  [category, categoryName]);

    useEffect(() => {

        
        // CHANGE: Only update form filters when category changes - don't fetch books immediately
        if (category === 'categoria' && categoryName) {
            setFormFilters(prev => ({
                ...prev,
                genero: categoryName
            }));
        } else if (category !== 'categoria') { // Only update if not already in this category
            setFormFilters(prev => ({
                ...prev,
                genero: ''
            }));
        }
        // CHANGE: Removed automatic fetchBooks call
    }, [category, categoryName]);

    // Handle form filter changes without triggering API requests
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFormFilters(prev => ({
            ...prev,
            [name]: value
        }));
        // No immediate fetching - will only happen when Apply button is clicked
        
    };

    // Apply current form filters and trigger a fetch
    const applyFilters = () => {
        setActiveFilters(formFilters);
        fetchBooks(1, formFilters);
      };


    // Reset filters to default values
    const resetFilters = () => {
        const resetValues = {
            titulo: '',
            autor: '',
            genero: category === 'categoria' ? categoryName : '',
            editorial: '',
            idioma: '',
            estado: '',
            precio_min: '',
            precio_max: '',
            anio_min: '',
            anio_max: '',
            sort: 'fecha_registro',
            order: 'desc'
        };
      
        // Update both form filters and active filters
        setFormFilters(resetValues);
        setActiveFilters(resetValues);
      
        // Fetch books with reset filters
        fetchBooks(1, resetValues);
    };

  // Función para obtener los libros según la categoría seleccionada
  const fetchBooks = async (page = 1, filtersToUse = activeFilters) => {
    try {
      let response;
      let endpoint = '';
      // Use the current pagination state directly
      const limit = pagination.limit;
      
      // Crear objeto params con todos los filtros disponibles
      const params = { 
        page, 
        limit,
        solo_disponibles: true // Por defecto siempre mostrar solo disponibles
      };
      
      // Handle sort and order correctly
      if (filtersToUse.sort === 'precio-desc') {
        params.sort = 'precio';
        params.order = 'desc';
      } else {
        // Add all non-empty filters to params object
        Object.entries(filtersToUse).forEach(([key, value]) => {
          if (value && value !== '') {
            params[key] = value;
          }
        });
      }
      
      // Determinar qué endpoint usar según la categoría
      switch(category) {
        case 'destacados':
          endpoint = `${API_BASE_URL}/libros/destacados`;
          params.min_calificacion = params.min_calificacion || 4;
          setTitle('Libros Destacados');
          break;
        
        case 'descuentos':
          endpoint = `${API_BASE_URL}/libros/descuentos`;
          params.min_descuento = params.min_descuento || 5;
          setTitle('Libros con Descuento');
          break;
        
        case 'categoria':
          endpoint = `${API_BASE_URL}/libros`;
          params.genero = categoryName;
          setTitle(`Categoría: ${categoryName}`);
          break;
        
        case 'todos':
        default:
          endpoint = `${API_BASE_URL}/libros`;
          if (!params.sort) {
            params.sort = 'fecha_registro';
            params.order = 'desc';
          }
          setTitle('Todos los Libros');
          break;
      }
      
      console.log('Fetch params:', params);
      
      // Hacer la petición a la API
      response = await axios.get(endpoint, { params });
      
      if (response.data.status === 'success') {
        setBooks(response.data.data);
        
        // Asegurar que la estructura de paginación es correcta
        const paginationData = {
          total: response.data.resultados || 0,
          page: response.data.paginacion?.page || page,
          limit: response.data.paginacion?.limit || limit,
          totalPages: response.data.paginacion?.totalPages || 
                     Math.ceil((response.data.resultados || 0) / limit)
        };
        
        setPagination(paginationData);
        console.log('Libros cargados:', response.data.resultados);
        console.log('Paginación:', paginationData);
      } else {
        console.error('Error en respuesta:', response.data);
      }
    } catch (error) {
      console.error('Error al obtener libros:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para cargar la siguiente página
  const loadPage = async (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setIsLoading(true);
    
    await fetchBooks(newPage);
    // Scroll hacia arriba para mejor UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = useCallback((message, type = 'success') => {
      setToast({ visible: true, message, type });
      
      // Hide after 2 seconds
      setTimeout(() => {
        setToast({ visible: false, message: '', type: 'success' });
      }, 2000);
    }, []);

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

  const toggleShowFilters = useCallback(() => {
    setShowFilters(prev => !prev);
    // No data fetching here, just toggle the filters visibility
  }, []);

  // Función para renderizar estrellas de calificación
  const renderStars = (rating) => {
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
  };

  // Componente para mostrar un libro (reutilizado de HomePage)
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


  // Lista de filtros de categoría (según corresponda)
  const Filters = () => {
    // Track if we're using custom price range
    const [useCustomPriceRange, setUseCustomPriceRange] = useState(false);
    
    // Helper to determine selected price range value
    const getPriceRangeValue = () => {
      if (useCustomPriceRange) return 'custom';
      if (!formFilters.precio_min && !formFilters.precio_max) return '';
      return `${formFilters.precio_min || '0'}-${formFilters.precio_max || ''}`;
    };
  
    return (
      <div className="mb-6">
        <button 
            onClick={toggleShowFilters}
            className="w-full bg-white rounded-lg shadow-sm p-3 flex justify-between items-center"
        >
            <span className="font-semibold">Filtros</span>
            <span className="material-icons-outlined text-blue-600">
                {showFilters ? 'Contraer' : 'Expandir'}
            </span>
        </button>
        
        {showFilters && (
          <div className="p-4 bg-white rounded-lg shadow-sm mt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sort option */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ordenar por</label>
                <select 
                  name="sort" 
                  className="w-full border rounded p-2 text-sm"
                  value={formFilters.sort}
                  onChange={(e) => {
                    // Update both sort and order in the form state only
                    const newSort = e.target.value;
                    let newOrder;
                    
                    if (newSort === 'precio') {
                      // For price, we need to check which option was selected
                      const selectElement = e.target;
                      const selectedOption = selectElement.options[selectElement.selectedIndex].text;
                      newOrder = selectedOption.includes('menor a mayor') ? 'asc' : 'desc';
                    } else {
                      newOrder = newSort === 'fecha_registro' ? 'desc' : 'asc';
                    }
                    
                    setFormFilters(prev => ({
                      ...prev,
                      sort: newSort,
                      order: newOrder
                    }));
                  }}
                >
                  <option value="fecha_registro">Más nuevos</option>
                  <option value="precio">Precio: menor a mayor</option>
                  <option value="precio-desc">Precio: mayor a menor</option>
                  <option value="calificaciones.promedio">Mejor calificados</option>
                  <option value="titulo">Título (A-Z)</option>
                </select>
              </div>
              
              {/* Estado filter */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Estado</label>
                <select 
                  name="estado"
                  className="w-full border rounded p-2 text-sm"
                  value={formFilters.estado}
                  onChange={handleFilterChange}
                >
                  <option value="">Todos</option>
                  <option value="nuevo">Nuevo</option>
                  <option value="usado">Usado</option>
                </select>
              </div>
              
              {/* Price range predefined */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Precio</label>
                <select 
                  className="w-full border rounded p-2 text-sm"
                  value={getPriceRangeValue()}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      // Enable custom price range inputs
                      setUseCustomPriceRange(true);
                      // Clear existing price filters
                      setFormFilters(prev => ({
                        ...prev,
                        precio_min: '',
                        precio_max: ''
                      }));
                    } else {
                      // Disable custom price range
                      setUseCustomPriceRange(false);
                      // Parse the selected range
                      const range = e.target.value.split('-');
                      setFormFilters(prev => ({
                        ...prev,
                        precio_min: range[0] || '',
                        precio_max: range[1] || ''
                      }));
                    }
                  }}
                >
                  <option value="">Todos los precios</option>
                  <option value="0-50000">Hasta $50.000</option>
                  <option value="50000-100000">$50.000 - $100.000</option>
                  <option value="100000-200000">$100.000 - $200.000</option>
                  <option value="200000-">Más de $200.000</option>
                  {/* <option value="custom">Rango personalizado</option> */}
                </select>
              </div>
            </div>
            
            {/* Custom price range - only show when custom range is selected */}
            {useCustomPriceRange && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Precio mínimo</label>
                  <input
                    type="number"
                    name="precio_min"
                    placeholder="Desde $"
                    className="w-full border rounded p-2 text-sm"
                    value={formFilters.precio_min}
                    onChange={handleFilterChange}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Precio máximo</label>
                  <input
                    type="number"
                    name="precio_max"
                    placeholder="Hasta $"
                    className="w-full border rounded p-2 text-sm"
                    value={formFilters.precio_max}
                    onChange={handleFilterChange}
                  />
                </div>
              </div>
            )}
            
            {/* Year range inputs */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Año desde</label>
                <input
                  type="number"
                  name="anio_min"
                  placeholder="Año mínimo"
                  className="w-full border rounded p-2 text-sm"
                  value={formFilters.anio_min}
                  onChange={handleFilterChange}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Año hasta</label>
                <input
                  type="number"
                  name="anio_max"
                  placeholder="Año máximo"
                  className="w-full border rounded p-2 text-sm"
                  value={formFilters.anio_max}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
            
            {/* Filter action buttons */}
            <div className="mt-4 flex justify-end">
                <button 
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded mr-2"
                    onClick={resetFilters}
                >
                    Limpiar filtros
                </button>
                <button 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                    onClick={applyFilters}
                >
                    Aplicar filtros
                </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const MemoizedFilters = React.memo(Filters);

  // Contenido principal que se mostrará dentro del layout
  const ListContent = () => {
    // Mostrar estado de carga
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700">Cargando libros...</p>
          </div>
        </div>
      );
    }
    
    // Mostrar mensaje si no hay libros
    if (books.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl text-gray-300 mb-3">📚</div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">No se encontraron libros</h3>
          <p className="text-gray-600 mb-4">
            No hay libros disponibles que coincidan con los criterios seleccionados.
          </p>
          <button 
            onClick={() => navigate('/Home')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    
    // Asegurarse de que pagination existe y tiene los valores esperados
    const totalResults = pagination?.total || 0;
    const currentPage = pagination?.page || 1;
    const totalPages = pagination?.totalPages || 0;
    
    // Mostrar lista de libros
    return (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">{title}</h1>
            <div className="text-sm text-gray-600">
              {totalResults} {totalResults === 1 ? 'resultado' : 'resultados'}
            </div>
          </div>
          
          {/* Filters component is now shown on all page types */}
          <MemoizedFilters />
          
          {/* Grid de libros - Remove console.log that causes unnecessary re-renders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
            {books.map(book => (
              <BookCard 
                key={book._id} 
                book={book} 
                booksInCart={booksInCart}
                handleAddToCart={handleAddToCart}
              />
            ))}
          </div>
        
        {/* Paginación - solo mostrar si hay más de una página */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8 mb-4">
            <nav className="inline-flex rounded-md shadow">
              <button
                onClick={() => loadPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center px-4 py-2 rounded-l-md border text-sm font-medium
                  ${currentPage === 1 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <span className="material-icons-outlined text-sm">chevron_left</span>
                Anterior
              </button>
              
              <div className="relative inline-flex items-center px-4 py-2 border-t border-b text-sm font-medium bg-white text-gray-700">
                Página {currentPage} de {totalPages}
              </div>
              
              <button
                onClick={() => loadPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center px-4 py-2 rounded-r-md border text-sm font-medium
                  ${currentPage === totalPages 
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

  return (
    <UserLayout>
      <div className="container mx-auto py-6 px-4">
        <ListContent />
      </div>
    </UserLayout>
  );
};

export default BookListPage;