import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addToCart } from './cartUtils'; // Importar la utilidad del carrito

const BookCard = ({ book, updateCartCount }) => {
  const navigate = useNavigate();
  const [addingToCart, setAddingToCart] = useState(false); // Estado para mostrar animación al agregar al carrito
  
  // Función para navegar a la página de detalles del libro
  const goToBookDetails = () => {
    navigate(`/book/${book.id}`);
  };
  
  // Función para renderizar estrellas de calificación
  const renderStars = (rating) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <span 
          key={i} 
          className={`text-lg ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
        >
          ★
        </span>
      );
    }
    return stars;
  };

  // Nueva función para agregar al carrito
  const handleAddToCart = (e) => {
    e.stopPropagation(); // Evitar navegación a los detalles del libro
    
    // Verificar stock
    if (!book.stock || book.stock <= 0) {
      alert('Lo sentimos, este libro no está disponible en inventario.');
      return;
    }
    
    // Mostrar indicador de carga
    setAddingToCart(true);
    
    // Preparar datos del libro para el carrito
    const bookForCart = {
      _id: book.id,
      titulo: book.title,
      autor_nombre_completo: book.author,
      precio: book.price,
      stock: book.stock,
      imagenes: book.imageUrl ? [{ url: book.imageUrl }] : []
    };
    
    // Agregar al carrito usando la utilidad
    const result = addToCart(bookForCart, 1);
    
    if (result.success) {
      // Actualizar contador en el UserLayout
      if (updateCartCount) {
        updateCartCount(result.totalItems);
      }
      
      // Mostrar mensaje de éxito
      alert(`${book.title} agregado al carrito`);
    } else {
      // Mostrar mensaje de error
      alert(result.message);
    }
    
    // Ocultar indicador de carga después de un breve retraso
    setTimeout(() => {
      setAddingToCart(false);
    }, 500);
  };

  return (
    <div 
      className="book-card flex flex-col h-full border bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={goToBookDetails}
    >
      {/* Imagen del libro */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        {book.imageUrl ? (
          <img 
            src={book.imageUrl} 
            alt={book.title} 
            className="w-full h-full object-contain" 
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/placeholder-book.png';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">
            <span className="material-icons-outlined text-6xl">book</span>
          </div>
        )}
        
        {/* Etiqueta de preventa si aplica */}
        {book.isPreorder && (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
            PREVENTA
          </div>
        )}
        
        {/* Etiqueta de descuento si aplica */}
        {book.discount > 0 && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
            {book.discount}% DCTO
          </div>
        )}
      </div>
      
      {/* Información del libro */}
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="font-bold text-sm line-clamp-2 mb-1">{book.title}</h3>
        <p className="text-gray-600 text-sm mb-2">{book.author}</p>
        
        {/* Estrellas de calificación si están disponibles */}
        {book.rating && (
          <div className="flex mb-1">
            {renderStars(book.rating)}
            {book.reviews && (
              <span className="text-xs text-gray-500 ml-1">({book.reviews})</span>
            )}
          </div>
        )}
        
        {/* Editorial e información de edición */}
        {book.publisher && (
          <p className="text-xs text-gray-500 mb-3">{book.publisher}, {book.edition}</p>
        )}
        
        {/* Disponibilidad */}
        <p className="text-xs text-green-600 mb-2">
          {book.stock > 0 
            ? `Quedan ${book.stock} ${book.stock === 1 ? 'unidad' : 'unidades'}`
            : 'Agotado'}
        </p>
        
        {/* Precio */}
        <div className="mt-auto">
          {book.discount > 0 ? (
            <div>
              <span className="text-xs line-through text-gray-500">
                ${book.originalPrice.toLocaleString('es-CO')}
              </span>
              <div className="text-lg font-bold text-red-600">
                ${book.price.toLocaleString('es-CO')}
              </div>
            </div>
          ) : (
            <div className="text-lg font-bold">
              ${book.price.toLocaleString('es-CO')}
            </div>
          )}
        </div>
        
        {/* Botón "Agregar al carrito" - Nuevo */}
        <div className="mt-2 flex">
          <button 
            className={`flex items-center justify-center px-3 py-1 rounded-full text-sm w-full ${
              addingToCart ? 'bg-gray-400 text-white cursor-wait' : 
              book.stock > 0 ? 'bg-red-600 text-white hover:bg-red-700 transition-colors' : 
              'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={handleAddToCart}
            disabled={book.stock <= 0 || addingToCart}
          >
            {addingToCart ? (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Agregando...
              </span>
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
        
        {/* Botón Rápido para compra - Mantenemos el botón original */}
        {book.isPromotion && (
          <div className="mt-2 flex">
            <button 
              className="flex items-center justify-center bg-red-600 text-white px-3 py-1 rounded-full text-sm hover:bg-red-700 transition-colors w-full"
              onClick={(e) => {
                e.stopPropagation();
                // Aquí iría la lógica para compra rápida
                alert(`Compra rápida: ${book.title}`);
              }}
            >
              <span className="material-icons-outlined text-sm mr-1">flash_on</span>
              Rápido
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookCard;