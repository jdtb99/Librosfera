import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, FileText, Clock, CheckCircle, XCircle, AlertCircle, Package } from 'lucide-react';

const ReturnsPage = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ estado: '', search: '' });
  const [showFilters, setShowFilters] = useState(false);

  // Estados de devolución con sus traducciones y colores
  const estadosDevolucion = {
    'solicitada': { label: 'Solicitada', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    'aprobada': { label: 'Aprobada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    'rechazada': { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: XCircle },
    'esperando_envio': { label: 'Esperando Envío', color: 'bg-blue-100 text-blue-800', icon: Package },
    'en_transito': { label: 'En Tránsito', color: 'bg-purple-100 text-purple-800', icon: Package },
    'recibida': { label: 'Recibida', color: 'bg-indigo-100 text-indigo-800', icon: Package },
    'en_inspeccion': { label: 'En Inspección', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
    'reembolso_aprobado': { label: 'Reembolso Aprobado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
    'reembolso_procesando': { label: 'Procesando Reembolso', color: 'bg-cyan-100 text-cyan-800', icon: Clock },
    'reembolso_completado': { label: 'Reembolso Completado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    'cerrada': { label: 'Cerrada', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
    'cancelada': { label: 'Cancelada', color: 'bg-red-100 text-red-800', icon: XCircle }
  };

  // Función para obtener cookie
  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  // Función para obtener token de autorización
  const getAuthToken = () => {
    const dataCookie = getCookie('data');
    if (!dataCookie) return null;
    try {
      const parsedData = JSON.parse(dataCookie);
      return parsedData.authToken || parsedData.token || (parsedData.Data && parsedData.Data.token);
    } catch (error) {
      console.error('Error parsing cookie:', error);
      return null;
    }
  };

  // Función para cargar devoluciones
  const loadReturns = async (page = 1, filters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        incluir_venta: 'true',
        ...filters
      });

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/mis-devoluciones?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setReturns(data.data || []);
        setStatistics(data.estadisticas);
        setPagination(prev => ({
          ...prev,
          page,
          total: data.estadisticas?.total_devoluciones || 0,
          totalPages: Math.ceil((data.estadisticas?.total_devoluciones || 0) / prev.limit)
        }));
      } else {
        throw new Error(data.message || 'Error al cargar devoluciones');
      }
    } catch (error) {
      console.error('Error loading returns:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar devoluciones al inicio
  useEffect(() => {
    const initialFilters = { estado: '', search: '' };
    setFilters(initialFilters);
    loadReturns(1, initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo al montar el componente

  // Función para manejar cambio de filtros
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    loadReturns(1, newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Función para manejar cambio de página
  const handlePageChange = (newPage) => {
    loadReturns(newPage, filters);
  };

  // Función para formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para formatear moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Componente de estado
  const StatusBadge = ({ estado }) => {
    const estadoInfo = estadosDevolucion[estado] || { label: estado, color: 'bg-gray-100 text-gray-800', icon: AlertCircle };
    const Icon = estadoInfo.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoInfo.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {estadoInfo.label}
      </span>
    );
  };

  if (loading && returns.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando devoluciones...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Mis Devoluciones</h1>
        <p className="text-gray-600">Gestiona y rastrea el estado de tus devoluciones</p>
      </div>

      {/* Estadísticas */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Devoluciones</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total_devoluciones}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-yellow-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.devoluciones_pendientes}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Completadas</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.devoluciones_completadas}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <span className="w-8 h-8 text-green-600 text-2xl font-bold">$</span>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Monto Devuelto</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.monto_total_devuelto)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
          >
            <Filter className="w-5 h-5" />
            <span>Filtros</span>
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        {showFilters && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={filters.estado}
                  onChange={(e) => handleFilterChange({ ...filters, estado: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(estadosDevolucion).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <div className="relative">
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
                    placeholder="Código de devolución..."
                    className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de devoluciones */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {returns.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay devoluciones</h3>
            <p className="text-gray-500">No tienes devoluciones registradas en este momento.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {returns.map((devolucion) => (
                    <tr key={devolucion._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {devolucion.codigo_devolucion}
                        </div>
                        {devolucion.id_venta?.numero_venta && (
                          <div className="text-sm text-gray-500">
                            Venta: {devolucion.id_venta.numero_venta}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge estado={devolucion.estado} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {devolucion.items?.length || 0} item(s)
                        </div>
                        {devolucion.items?.[0]?.info_libro?.titulo && (
                          <div className="text-sm text-gray-500 truncate max-w-32">
                            {devolucion.items[0].info_libro.titulo}
                            {devolucion.items.length > 1 && ` y ${devolucion.items.length - 1} más`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(devolucion.totales?.monto_items_devolucion || 0)}
                        </div>
                        {devolucion.totales?.monto_reembolsado > 0 && (
                          <div className="text-sm text-green-600">
                            Reembolsado: {formatCurrency(devolucion.totales.monto_reembolsado)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(devolucion.fecha_solicitud)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Mostrando <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> a{' '}
                        <span className="font-medium">
                          {Math.min(pagination.page * pagination.limit, pagination.total)}
                        </span> de{' '}
                        <span className="font-medium">{pagination.total}</span> resultados
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        {[...Array(pagination.totalPages)].map((_, i) => (
                          <button
                            key={i + 1}
                            onClick={() => handlePageChange(i + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pagination.page === i + 1
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page === pagination.totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Siguiente
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReturnsPage;