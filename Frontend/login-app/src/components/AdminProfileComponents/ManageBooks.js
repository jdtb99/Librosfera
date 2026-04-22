import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BookEditor from './BookEditor';
import CachedImage from '../CachedImage';

const ManageBooks = () => {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [Bookid, setSelectedBookid] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', 'delete'
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState('add'); // 'add', 'edit'
  const [pagination, setPagination] = useState({
    total: 0,
    pagina: 1,
    limite: 10,
    totalPaginas: 0
  });

  // Obtener todos los libros de la API sin paginación
  const fetchBooks = async (page = 1) => {
    setIsLoading(true);
    try {
      // Solicitar todos los libros sin ningún parámetro de paginación
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/libros?page=${page}`);
      
      if (response.data && response.data.status === 'success') {

        setPagination({
          total: response.data.paginacion.total,
          pagina: response.data.paginacion.pagina,
          limite: response.data.paginacion.limite,
          totalPaginas: response.data.paginacion.totalPaginas
        });
        
        // Formatear los datos para mantener la estructura original
        const formattedBooks = response.data.data.map(book => {
          // Determinar la URL de la imagen
          let imageUrl = null;
          
          // Verificar si hay imágenes en el formato nuevo
          if (book.imagenes && book.imagenes.length > 0) {
            // Buscar la imagen de tipo "portada"
            const portada = book.imagenes.find(img => img.orden === 0);
            if (portada) {
              imageUrl = portada.url;
            } else {
              // Si no hay tipo "portada", usar la primera imagen
              imageUrl = book.imagenes[0].url;
            }
          } 
          // Si no hay imágenes en el formato nuevo, verificar el formato legacy
          else if (book.imagenes_legacy && book.imagenes_legacy.portada) {
            imageUrl = book.imagenes_legacy.portada;
          }
          
          // Determinar el descuento si existe
          let discount = 0;
          if (book.precio_info && book.precio_info.descuentos && book.precio_info.descuentos.length > 0) {
            // Tomar el primer descuento disponible
            discount = book.precio_info.descuentos[0].valor || 0;
          }
          
          return {
            id: book._id,
            title: book.titulo || 'Sin título',
            author: book.autor_nombre_completo || 'Autor desconocido',
            genre: book.genero || 'Sin categoría',
            price: book.precio || 0,
            stock: book.stock || 0,
            discount: discount,
            image: imageUrl,
            // Guardamos los datos originales para edición
            originalData: book
          };
        });
        
        setBooks(formattedBooks);
      } else {
        console.error('Error en la respuesta de la API:', response.data);
      }
    } catch (error) {
      console.error('Error al cargar libros:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks(pagination.pagina);
  }, [pagination.pagina]);

  // Manejar el cambio de página
  const handlePageChange = (newPage) => {
    console.log(`Cambiando a página ${newPage}`);
    if (newPage >= 1 && newPage <= pagination.totalPaginas) {
      // Actualizar el estado de la página actual
      setPagination(prevPag => ({
        ...prevPag,
        pagina: newPage
      }));
      
      // Restablece la búsqueda al cambiar de página
      if (searchTerm) {
        setSearchTerm('');
      }
      
      // No es necesario llamar a fetchBooks aquí ya que el useEffect
      // reaccionará al cambio de pagination.pagina
    }
  };

  const handleSearch = async (term) => {
    setSearchTerm(term);
    
    // If searching, fetch all books
    if (term) {
      setIsLoading(true);
      try {
        // Request all books without pagination when searching
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/libros?limite=100`);
        
        if (response.data && response.data.status === 'success') {
          const formattedBooks = response.data.data.map(book => {
            // Reuse your existing formatting code from fetchBooks
            let imageUrl = null;
            
            if (book.imagenes && book.imagenes.length > 0) {
              const portada = book.imagenes.find(img => img.orden === 0);
              if (portada) {
                imageUrl = portada.url;
              } else {
                imageUrl = book.imagenes[0].url;
              }
            } 
            else if (book.imagenes_legacy && book.imagenes_legacy.portada) {
              imageUrl = book.imagenes_legacy.portada;
            }
            
            let discount = 0;
            if (book.precio_info && book.precio_info.descuentos && book.precio_info.descuentos.length > 0) {
              discount = book.precio_info.descuentos[0].valor || 0;
            }
            
            return {
              id: book._id,
              title: book.titulo || 'Sin título',
              author: book.autor_nombre_completo || 'Autor desconocido',
              genre: book.genero || 'Sin categoría',
              price: book.precio || 0,
              stock: book.stock || 0,
              discount: discount,
              image: imageUrl,
              originalData: book
            };
          });
          
          setBooks(formattedBooks);
        } 
      } catch (error) {
        console.error('Error al buscar libros:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // If search is cleared, go back to paginated results
      fetchBooks(1);
    }
  };

  // Filtrar libros por búsqueda
  const filteredBooks = searchTerm 
    ? books.filter(book => 
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.genre.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : books;

  // Manejar apertura del modal
  const openModal = (mode, book = null) => {
    setModalMode(mode);
    setSelectedBook(book);
    setIsModalOpen(true);
  };

  // Manejar apertura del editor
  const openEditor = (mode, book = null) => {
    setEditorMode(mode);
    setSelectedBook(book);
    setSelectedBookid(book ? book.id : null);
    setShowEditor(true);
  };

  // Manejar cierre del editor
  const closeEditor = () => {
    setShowEditor(false);
    setSelectedBook(null);
    // Refrescar la lista de libros después de cerrar el editor
    fetchBooks(pagination.pagina);
  };

  // Guardar cambios del libro (esta función será pasada al componente BookEditor)
  const saveBook = (bookData) => {
    // La lógica de guardar se maneja en el BookEditor
    // Simplemente cerramos el editor y refrescamos la lista
    closeEditor();
  };

  // Eliminar libro
  const deleteBook = async (bookId) => {
    try {
      // Obtener el token de autenticación
      const dataCookie = document.cookie.match(new RegExp('(^| )data=([^;]+)'));
      if (!dataCookie) {
        alert('No se encontró la sesión. Por favor inicie sesión nuevamente.');
        return;
      }
      
      const parsedData = JSON.parse(decodeURIComponent(dataCookie[2]));
      const token = parsedData.authToken;
      
      // Llamada a la API para eliminar el libro
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/v1/libros/${bookId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Actualizar la lista de libros
      fetchBooks(pagination.pagina);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error al eliminar el libro:', error);
      alert('Error al eliminar el libro. Por favor intente nuevamente.');
    }
  };

  // Componente Modal para confirmar eliminación
  const DeleteConfirmationModal = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-md p-6 relative">
          <button 
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <span className="material-icons-outlined">close</span>
          </button>
          
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            Eliminar Libro
          </h2>
          
          <p className="mb-6 text-gray-600">
            ¿Está seguro que desea eliminar el libro "{selectedBook?.title}"? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end space-x-4">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button 
              onClick={() => deleteBook(selectedBook?.id)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Función para obtener el color de la barra de descuento
  const getDiscountColor = (discount) => {
    if (discount >= 50) return 'bg-green-400';
    if (discount > 0) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  // Función para mostrar el ícono de libro predeterminado
  const getBookIcon = (id) => {
    const icons = [
      <div key={1} className="text-indigo-500">
        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5zM16 12h-7m0-4h7m-7 8h7"></path>
        </svg>
      </div>,
      <div key={2} className="text-gray-500">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
      </div>,
      <div key={3} className="text-gray-700">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
        </svg>
      </div>,
      <div key={4} className="text-cyan-500">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
      </div>
    ];
    
    // Calculamos un hash a partir del ID para obtener un ícono consistente
    const idString = id.toString();
    let hash = 0;
    for (let i = 0; i < idString.length; i++) {
      hash += idString.charCodeAt(i);
    }
    
    return icons[hash % icons.length];
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
      {/* Si el editor está abierto, mostrar el editor de libros */}
      {showEditor ? (
        <BookEditor 
          book={selectedBook ? {
            title: selectedBook.title,
            author: selectedBook.author,
            editorial: selectedBook.originalData?.editorial,
            year: selectedBook.originalData?.anio_publicacion,
            genre: selectedBook.genre,
            pages: selectedBook.originalData?.numero_paginas,
            issn: selectedBook.originalData?.ISBN,
            language: selectedBook.originalData?.idioma,
            publicationDate: selectedBook.originalData?.fecha_publicacion,
            condition: selectedBook.originalData?.estado,
            price: selectedBook.originalData.precio_info.precio_base,
            image: selectedBook.image,
            description: selectedBook.originalData?.descripcion,
            stock: selectedBook.stock,
            id: selectedBook.id
          } : null}
          mode={editorMode}
          id={selectedBook?.id}
          onSave={saveBook}
          onCancel={closeEditor}
        />
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Administrar Libros</h1>
            
            <div className="flex space-x-4">
              {/* Botón para añadir nuevo libro */}
              <button
                onClick={() => openEditor('add')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
              >
                Añadir Libro
                
              </button>
              
              {/* Caja de búsqueda */}
              <div className="relative">
              <input
                type="text"
                placeholder="Buscar Libro"
                className="px-4 py-2 pr-10 border border-gray-300 rounded"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
                <button className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Table header */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="grid grid-cols-6 bg-gray-100 p-4 font-medium text-gray-700 border-b">
              <div className="col-span-1 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                </svg>
                Nombre
              </div>
              <div className="text-center">Unidades Disponibles</div>
              <div className="text-center">Precio</div>
              <div className="text-center">Género</div>
              <div className="text-center">Descuento</div>
              <div className="text-center">Acciones</div>
            </div>

            {isLoading ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-700">Cargando libros...</p>
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-600">No se encontraron libros que coincidan con la búsqueda.</p>
              </div>
            ) : (
              <div>
                {filteredBooks.map((book) => (
                  <div key={book.id} className="grid grid-cols-6 p-4 items-center border-b hover:bg-gray-50">
                    <div className="col-span-1 flex items-center">
                      <div className="w-10 h-10 flex-shrink-0 mr-3 overflow-hidden rounded border border-gray-200 flex items-center justify-center bg-white">
                        {book.image ? (
                          <CachedImage 
                            src={book.image} 
                            alt={book.title}
                            className="max-w-full max-h-full object-contain"
                            fallbackSrc="/placeholder-book.png"
                          />
                        ) : (
                          getBookIcon(book.id)
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{book.title}</p>
                        <p className="text-xs text-gray-500">{book.author}</p>
                      </div>
                    </div>
                    <div className="text-center">
                      {book.stock}
                    </div>
                    <div className="text-center">
                      $ {book.price.toLocaleString('es-CO')}
                    </div>
                    <div className="text-center">
                      {book.genre}
                    </div>
                    <div className="flex justify-center items-center">
                      <div className="w-24 h-6 bg-gray-200 rounded-full overflow-hidden relative">
                        {/* This div shows the colored portion based on discount percentage */}
                        <div 
                          className={`h-full ${getDiscountColor(book.discount)}`}
                          style={{ width: `${book.discount}%` }}
                        >
                        </div>
                        {/* This div is positioned absolutely to always show the text in the center */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-800 drop-shadow-sm">
                            {book.discount}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <button 
                        onClick={() => openEditor('edit', book)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <span className="material-icons-outlined">Editar</span>
                      </button>
                      <button 
                        onClick={() => openModal('delete', book)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <span className="material-icons-outlined">Eliminar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {!searchTerm && books.length > 0 && (
            <div className="text-sm text-gray-600 text-center mt-4">
              Mostrando {books.length} de {pagination.total} libros (Página {pagination.pagina} de {pagination.totalPaginas})
            </div>
          )}

          {/* Show total when filtering */}
          {searchTerm && filteredBooks.length > 0 && (
            <div className="text-sm text-gray-600 text-center mt-4">
              Mostrando {filteredBooks.length} libros que coinciden con "{searchTerm}"
            </div>
          )}
                    
                    {/* Pagination controls */}
          {!searchTerm && books.length > 0 && (
            <div className="flex justify-center mt-6">
              <nav className="flex items-center space-x-2">
                <button 
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.pagina === 1}
                  className={`px-3 py-1 rounded ${pagination.pagina === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  «
                </button>
                <button 
                  onClick={() => handlePageChange(pagination.pagina - 1)}
                  disabled={pagination.pagina === 1}
                  className={`px-3 py-1 rounded ${pagination.pagina === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  ‹
                </button>
                
                {/* Page number buttons */}
                {[...Array(pagination.totalPaginas).keys()].map(i => {
                  const pageNum = i + 1;
                  // Show current page and a few pages before/after
                  if (
                    pageNum === 1 || 
                    pageNum === pagination.totalPaginas || 
                    (pageNum >= pagination.pagina - 1 && pageNum <= pagination.pagina + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 rounded ${
                          pagination.pagina === pageNum 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  
                  // Show ellipsis for gaps
                  if (
                    (pageNum === pagination.pagina - 2 && pageNum > 2) || 
                    (pageNum === pagination.pagina + 2 && pageNum < pagination.totalPaginas - 1)
                  ) {
                    return <span key={pageNum} className="px-1">...</span>;
                  }
                  
                  return null;
                })}
                
                <button 
                  onClick={() => handlePageChange(pagination.pagina + 1)}
                  disabled={pagination.pagina === pagination.totalPaginas}
                  className={`px-3 py-1 rounded ${pagination.pagina === pagination.totalPaginas ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  ›
                </button>
                <button 
                  onClick={() => handlePageChange(pagination.totalPaginas)}
                  disabled={pagination.pagina === pagination.totalPaginas}
                  className={`px-3 py-1 rounded ${pagination.pagina === pagination.totalPaginas ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  »
                </button>
              </nav>
            </div>
          )}
          {/* Modal de confirmación de eliminación */}
          {isModalOpen && modalMode === 'delete' && <DeleteConfirmationModal />}
        </>
      )}
    </div>
  );
};

export default ManageBooks;