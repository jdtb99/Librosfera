import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const BookItemsList = () => {
  const { id } = useParams(); // id del libro
  const [book, setBook] = useState(null);
  const [ejemplares, setEjemplares] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tiendas, setTiendas] = useState({});
  const [filtros, setFiltros] = useState({
    estado: '',
    tienda: '',
    disponibilidad: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Obtener el token de autenticación
        const dataCookie = document.cookie.match(new RegExp('(^| )data=([^;]+)'));
        if (!dataCookie) {
          throw new Error('No se encontró la sesión. Por favor inicie sesión nuevamente.');
        }
        
        const parsedData = JSON.parse(decodeURIComponent(dataCookie[2]));
        const token = parsedData.authToken;
        
        // Obtener información del libro
        const bookResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/libros/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (bookResponse.data && bookResponse.data.status === 'success') {
          const bookData = bookResponse.data.data;
          
          // Formatear datos del libro
          let imageUrl = null;
          
          if (bookData.imagenes && bookData.imagenes.length > 0) {
            const portada = bookData.imagenes.find(img => img.orden === 0);
            if (portada) {
              imageUrl = portada.url;
            } else {
              imageUrl = bookData.imagenes[0].url;
            }
          } 
          else if (bookData.imagenes_legacy && bookData.imagenes_legacy.portada) {
            imageUrl = bookData.imagenes_legacy.portada;
          }
          
          setBook({
            id: bookData._id,
            titulo: bookData.titulo || 'Sin título',
            autor: bookData.autor_nombre_completo || 'Autor desconocido',
            isbn: bookData.ISBN || 'N/A',
            imagen: imageUrl,
            originalData: bookData
          });

          // DATOS MOCK para ejemplares mientras se implementa el endpoint
          const mockEjemplares = [
            {
              id_ejemplar: `${id}_001`,
              codigo_ejemplar: `${bookData.titulo?.substring(0, 3).toUpperCase() || 'LIB'}-${id.slice(-5)}-001`,
              estado: 'nuevo',
              disponible: true,
              precio_venta_especifico: null,
              fecha_adquisicion: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
              id_tienda: 'tienda_001'
            },
            {
              id_ejemplar: `${id}_002`,
              codigo_ejemplar: `${bookData.titulo?.substring(0, 3).toUpperCase() || 'LIB'}-${id.slice(-5)}-002`,
              estado: 'excelente',
              disponible: true,
              precio_venta_especifico: null,
              fecha_adquisicion: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
              id_tienda: 'tienda_002'
            },
            {
              id_ejemplar: `${id}_003`,
              codigo_ejemplar: `${bookData.titulo?.substring(0, 3).toUpperCase() || 'LIB'}-${id.slice(-5)}-003`,
              estado: 'bueno',
              disponible: false,
              precio_venta_especifico: bookData.precio * 0.9,
              fecha_adquisicion: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
              id_tienda: 'tienda_001'
            },
            {
              id_ejemplar: `${id}_004`,
              codigo_ejemplar: `${bookData.titulo?.substring(0, 3).toUpperCase() || 'LIB'}-${id.slice(-5)}-004`,
              estado: 'nuevo',
              disponible: true,
              precio_venta_especifico: null,
              fecha_adquisicion: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
              id_tienda: 'tienda_003'
            },
            {
              id_ejemplar: `${id}_005`,
              codigo_ejemplar: `${bookData.titulo?.substring(0, 3).toUpperCase() || 'LIB'}-${id.slice(-5)}-005`,
              estado: 'aceptable',
              disponible: true,
              precio_venta_especifico: bookData.precio * 0.8,
              fecha_adquisicion: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
              id_tienda: 'tienda_002'
            }
          ];

          setEjemplares(mockEjemplares);

          // DATOS MOCK para tiendas
          const mockTiendas = {
            'tienda_001': {
              nombre: 'Sede Principal - Centro',
              direccion: 'Carrera 8 #23-45',
              ciudad: 'Pereira'
            },
            'tienda_002': {
              nombre: 'Sede Circunvalar',
              direccion: 'Av. Circunvalar #9-42',
              ciudad: 'Pereira'
            },
            'tienda_003': {
              nombre: 'Centro Comercial Victoria',
              direccion: 'C.C. Victoria Plaza Local 235',
              ciudad: 'Pereira'
            }
          };

          setTiendas(mockTiendas);
        }
        
        // COMENTADO: Llamadas reales a la API que fallan con 404
        /*
        // Obtener ejemplares del libro
        const ejemplaresResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/ejemplares?idLibro=${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (ejemplaresResponse.data && ejemplaresResponse.data.status === 'success') {
          setEjemplares(ejemplaresResponse.data.data);
          
          // Extraer IDs de tiendas únicas para obtener información
          const tiendaIds = [...new Set(ejemplaresResponse.data.data.map(ej => ej.id_tienda))];
          
          // Obtener información de tiendas en paralelo
          const tiendasPromises = tiendaIds.map(tiendaId => 
            axios.get(`${process.env.REACT_APP_API_URL}/api/v1/tiendas/${tiendaId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
          
          const tiendasResponses = await Promise.all(tiendasPromises);
          
          // Construir un objeto con la información de las tiendas
          const tiendasData = {};
          tiendasResponses.forEach(response => {
            if (response.data && response.data.status === 'success') {
              const tienda = response.data.data;
              tiendasData[tienda._id] = {
                nombre: tienda.nombre,
                direccion: tienda.direccion,
                ciudad: tienda.ciudad
              };
            }
          });
          
          setTiendas(tiendasData);
        }
        */
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError(err.message || 'Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  // Filtrar ejemplares basado en los filtros seleccionados
  const ejemplaresFiltrados = ejemplares.filter(ejemplar => {
    // Filtro de estado
    if (filtros.estado && ejemplar.estado !== filtros.estado) {
      return false;
    }
    
    // Filtro de tienda
    if (filtros.tienda && ejemplar.id_tienda !== filtros.tienda) {
      return false;
    }
    
    // Filtro de disponibilidad
    if (filtros.disponibilidad === 'disponible' && !ejemplar.disponible) {
      return false;
    }
    if (filtros.disponibilidad === 'no-disponible' && ejemplar.disponible) {
      return false;
    }
    
    return true;
  });
  
  // Actualizar filtros
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Resetear filtros
  const resetFiltros = () => {
    setFiltros({
      estado: '',
      tienda: '',
      disponibilidad: ''
    });
  };
  
  // Traducir estado de ejemplar a formato legible y aplicar clases CSS
  const formatearEstado = (estado) => {
    const estados = {
      'nuevo': { text: 'Nuevo', class: 'bg-green-100 text-green-800' },
      'excelente': { text: 'Excelente', class: 'bg-blue-100 text-blue-800' },
      'bueno': { text: 'Bueno', class: 'bg-indigo-100 text-indigo-800' },
      'aceptable': { text: 'Aceptable', class: 'bg-yellow-100 text-yellow-800' },
      'deteriorado': { text: 'Deteriorado', class: 'bg-red-100 text-red-800' }
    };
    
    return estados[estado] || { text: estado, class: 'bg-gray-100 text-gray-800' };
  };
  
  // Formatear fecha
  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="ml-4 text-gray-700">Cargando ejemplares...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <div className="mt-4">
            <p className="text-sm">
              <strong>Nota:</strong> Parece que el endpoint de ejemplares no está implementado en el backend. 
              Por ahora mostrando datos de ejemplo.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!book) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Atención: </strong>
          <span className="block sm:inline">No se encontró información del libro.</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
      {/* Mensaje informativo sobre datos mock */}
      <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4" role="alert">
        <strong className="font-bold">Información: </strong>
        <span className="block sm:inline">Mostrando datos de ejemplo. Los endpoints de ejemplares y tiendas aún no están implementados en el backend.</span>
      </div>

      {/* Header con información del libro y botón de volver */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link to="/AdminProfile" className="mr-4 text-blue-600 hover:text-blue-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Ejemplares del libro</h1>
        </div>
        <button
          onClick={() => window.history.back()}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
        >
          Volver
        </button>
      </div>
      
      {/* Información del libro */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-6 flex">
          <div className="w-24 h-32 flex-shrink-0 mr-6 overflow-hidden rounded border border-gray-200 flex items-center justify-center bg-gray-100">
            {book.imagen ? (
              <img 
                src={book.imagen} 
                alt={book.titulo}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/placeholder-book.png";
                }}
              />
            ) : (
              <div className="text-gray-500">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">{book.titulo}</h2>
            <p className="text-gray-600 mb-2">{book.autor}</p>
            <p className="text-sm text-gray-500">ISBN: {book.isbn}</p>
            <div className="mt-3">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                {ejemplares.length} ejemplares en total
              </span>
              <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium ml-2">
                {ejemplares.filter(ej => ej.disponible).length} disponibles
              </span>
              <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium ml-2">
                {ejemplares.filter(ej => !ej.disponible).length} no disponibles
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-700">Filtros</h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              name="estado"
              value={filtros.estado}
              onChange={handleFilterChange}
              className="block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="nuevo">Nuevo</option>
              <option value="excelente">Excelente</option>
              <option value="bueno">Bueno</option>
              <option value="aceptable">Aceptable</option>
              <option value="deteriorado">Deteriorado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tienda</label>
            <select
              name="tienda"
              value={filtros.tienda}
              onChange={handleFilterChange}
              className="block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas las tiendas</option>
              {Object.entries(tiendas).map(([id, tienda]) => (
                <option key={id} value={id}>{tienda.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilidad</label>
            <select
              name="disponibilidad"
              value={filtros.disponibilidad}
              onChange={handleFilterChange}
              className="block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              <option value="disponible">Disponibles</option>
              <option value="no-disponible">No disponibles</option>
            </select>
          </div>
        </div>
        <div className="px-4 pb-4 flex justify-end">
          <button
            onClick={resetFiltros}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Limpiar filtros
          </button>
        </div>
      </div>
      
      {/* Tabla de ejemplares */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-100 p-4 font-medium text-gray-700 border-b">
          <div>Código</div>
          <div>Estado</div>
          <div>Ubicación</div>
          <div>Precio Venta</div>
          <div>Disponibilidad</div>
          <div>Fecha Adquisición</div>
          <div className="text-center">Acciones</div>
        </div>
        
        {ejemplaresFiltrados.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-600">No se encontraron ejemplares que coincidan con los filtros.</p>
          </div>
        ) : (
          <div>
            {ejemplaresFiltrados.map((ejemplar) => {
              const estadoFormateado = formatearEstado(ejemplar.estado);
              const tienda = tiendas[ejemplar.id_tienda] || { nombre: 'Tienda desconocida', ciudad: '' };
              
              return (
                <div key={ejemplar.id_ejemplar} className="grid grid-cols-7 p-4 items-center border-b hover:bg-gray-50">
                  <div className="text-sm font-medium">{ejemplar.codigo_ejemplar}</div>
                  <div>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${estadoFormateado.class}`}>
                      {estadoFormateado.text}
                    </span>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{tienda.nombre}</p>
                    <p className="text-gray-500 text-xs">{tienda.ciudad}</p>
                  </div>
                  <div className="text-sm">
                    {ejemplar.precio_venta_especifico ? (
                      `$ ${ejemplar.precio_venta_especifico.toLocaleString('es-CO')}`
                    ) : (
                      <span className="text-gray-500">Precio general</span>
                    )}
                  </div>
                  <div>
                    {ejemplar.disponible ? (
                      <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        Disponible
                      </span>
                    ) : (
                      <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                        No disponible
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    {formatearFecha(ejemplar.fecha_adquisicion)}
                  </div>
                  <div className="flex justify-center space-x-2">
                    <button 
                      className="text-blue-600 hover:text-blue-900"
                      title="Editar ejemplar"
                    >
                      Editar
                    </button>
                    <button 
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver historial"
                    >
                      Historial
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Botón flotante para añadir ejemplares */}
      <div className="fixed bottom-8 right-8">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg flex items-center justify-center"
          title="Añadir ejemplares"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BookItemsList;