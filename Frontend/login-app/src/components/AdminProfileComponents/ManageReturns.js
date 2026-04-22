import React, { useState, useEffect, useRef } from 'react';

const ManageReturns = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    estado: '',
    cliente: '',
    codigo: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionData, setActionData] = useState({});
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [communicationData, setCommunicationData] = useState({
    tipo: 'email',
    asunto: '',
    mensaje: ''
  });

  // Estados de devolución con sus traducciones y colores
  const estadosDevolucion = {
    'solicitada': { label: 'Solicitada', color: 'bg-yellow-100 text-yellow-800', actions: ['aprobar', 'rechazar'] },
    'aprobada': { label: 'Aprobada', color: 'bg-green-100 text-green-800', actions: ['recibir'] },
    'rechazada': { label: 'Rechazada', color: 'bg-red-100 text-red-800', actions: [] },
    'esperando_envio': { label: 'Esperando Envío', color: 'bg-blue-100 text-blue-800', actions: ['recibir'] },
    'en_transito': { label: 'En Tránsito', color: 'bg-purple-100 text-purple-800', actions: ['recibir'] },
    'recibida': { label: 'Recibida', color: 'bg-indigo-100 text-indigo-800', actions: ['inspeccionar'] },
    'en_inspeccion': { label: 'En Inspección', color: 'bg-orange-100 text-orange-800', actions: ['inspeccionar'] },
    'reembolso_aprobado': { label: 'Reembolso Aprobado', color: 'bg-emerald-100 text-emerald-800', actions: ['reembolsar'] },
    'reembolso_procesando': { label: 'Procesando Reembolso', color: 'bg-cyan-100 text-cyan-800', actions: [] },
    'reembolso_completado': { label: 'Reembolso Completado', color: 'bg-green-100 text-green-800', actions: [] },
    'cerrada': { label: 'Cerrada', color: 'bg-gray-100 text-gray-800', actions: [] },
    'cancelada': { label: 'Cancelada', color: 'bg-red-100 text-red-800', actions: [] }
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
      return parsedData.authToken;
    } catch (error) {
      console.error('Error parsing cookie:', error);
      return null;
    }
  };

  // Función para cargar devoluciones
  const loadReturns = async (page = 1, currentFilters = {}) => {
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
        ordenar: '-fecha_solicitud',
        ...currentFilters
      });

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/admin/todas?${queryParams}`,
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
        setPagination(prev => ({
          ...prev,
          page,
          total: data.paginacion?.total || 0,
          totalPages: data.paginacion?.totalPaginas || 0
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

  // Función para cargar estadísticas
  const loadStatistics = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/estadisticas`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setStatistics(data.data);
        }
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  // Función para obtener detalles de una devolución
  const loadReturnDetails = async (codigo) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/${codigo}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setSelectedReturn(data.data);
        }
      }
    } catch (error) {
      console.error('Error loading return details:', error);
    }
  };

  // Función para ejecutar acciones administrativas
  const executeAction = async (action, codigo, data = {}) => {
    setActionLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return false;

      let url = '';
      let method = 'PATCH';
      let body = JSON.stringify(data);

      switch (action) {
        case 'aprobar':
          url = `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/${codigo}/aprobar`;
          break;
        case 'rechazar':
          url = `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/${codigo}/rechazar`;
          break;
        case 'recibir':
          url = `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/${codigo}/recibir`;
          break;
        case 'reembolsar':
          url = `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/${codigo}/reembolsar`;
          break;
        case 'cancelar':
          url = `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/${codigo}`;
          method = 'DELETE';
          break;
        case 'inspeccionar':
          url = `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/${codigo}/items/${data.idItem}/inspeccionar`;
          break;
        default:
          throw new Error('Acción no válida');
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: body
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          await loadReturns(pagination.page, filters);
          if (selectedReturn) {
            await loadReturnDetails(selectedReturn.devolucion?.codigo_devolucion);
          }
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Función para agregar comunicación
  const addCommunication = async (codigo, commData) => {
    try {
      const token = getAuthToken();
      if (!token) return false;

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/devoluciones/${codigo}/comunicaciones`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(commData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.status === 'success';
      }
      return false;
    } catch (error) {
      console.error('Error adding communication:', error);
      return false;
    }
  };

  // Cargar datos al inicio
  useEffect(() => {
    loadReturns(1, filters);
    loadStatistics();
  }, []);

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

  // Función para formatear tiempo de procesamiento
  const formatProcessingTime = (milliseconds) => {
    if (!milliseconds) return '-';
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    return `${days} días`;
  };

  // Componente de estado
  const StatusBadge = ({ estado }) => {
    const estadoInfo = estadosDevolucion[estado] || { label: estado, color: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoInfo.color}`}>
        {estadoInfo.label}
      </span>
    );
  };

  // Modal de acciones
  const ActionModal = () => {
    const [inputData, setInputData] = useState(actionData);

    const handleSubmit = async () => {
      let success = false;
      
      switch (actionType) {
        case 'aprobar':
          success = await executeAction('aprobar', selectedReturn.devolucion.codigo_devolucion, {
            notas: inputData.notas || ''
          });
          break;
        case 'rechazar':
          success = await executeAction('rechazar', selectedReturn.devolucion.codigo_devolucion, {
            motivo: inputData.motivo || ''
          });
          break;
        case 'recibir':
          success = await executeAction('recibir', selectedReturn.devolucion.codigo_devolucion, {
            notas: inputData.notas || ''
          });
          break;
        case 'reembolsar':
          success = await executeAction('reembolsar', selectedReturn.devolucion.codigo_devolucion);
          break;
        case 'cancelar':
          success = await executeAction('cancelar', selectedReturn.devolucion.codigo_devolucion, {
            motivo: inputData.motivo || ''
          });
          break;
        case 'inspeccionar':
          success = await executeAction('inspeccionar', selectedReturn.devolucion.codigo_devolucion, {
            idItem: inputData.idItem,
            resultado: inputData.resultado,
            notas: inputData.notas || '',
            porcentajeReembolso: inputData.porcentajeReembolso
          });
          break;
      }

      if (success) {
        alert('Acción ejecutada exitosamente');
        setShowActionModal(false);
      } else {
        alert('Error al ejecutar la acción');
      }
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <h3 className="text-lg font-bold text-gray-900 mb-4 capitalize">
              {actionType} Devolución
            </h3>
            
            {(actionType === 'rechazar' || actionType === 'cancelar') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo *
                </label>
                <textarea
                  value={inputData.motivo || ''}
                  onChange={(e) => setInputData({...inputData, motivo: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>
            )}

            {(actionType === 'aprobar' || actionType === 'recibir') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={inputData.notas || ''}
                  onChange={(e) => setInputData({...inputData, notas: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            )}

            {actionType === 'inspeccionar' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resultado *
                  </label>
                  <select
                    value={inputData.resultado || ''}
                    onChange={(e) => setInputData({...inputData, resultado: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar resultado</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                    <option value="aprobado_parcial">Aprobado Parcial</option>
                  </select>
                </div>

                {inputData.resultado === 'aprobado_parcial' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Porcentaje de Reembolso (0-100) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={inputData.porcentajeReembolso || ''}
                      onChange={(e) => setInputData({...inputData, porcentajeReembolso: parseInt(e.target.value)})}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas de Inspección
                  </label>
                  <textarea
                    value={inputData.notas || ''}
                    onChange={(e) => setInputData({...inputData, notas: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </div>
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
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Gestión de Devoluciones</h1>
        <p className="text-gray-600">Administra y procesa las devoluciones del sistema</p>
      </div>

      {/* Estadísticas */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total por Estado</p>
                <div className="text-xs text-gray-400 mt-1">
                  {statistics.por_estado?.map((estado, index) => (
                    <div key={index}>
                      {estadosDevolucion[estado._id]?.label || estado._id}: {estado.cantidad}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Motivos Frecuentes</p>
                <div className="text-xs text-gray-400 mt-1">
                  {statistics.motivos_frecuentes?.slice(0, 2).map((motivo, index) => (
                    <div key={index}>
                      {motivo._id}: {motivo.cantidad}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Tiempo Promedio</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statistics.tiempos_procesamiento?.tiempo_promedio || 0} días
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Rango de Tiempo</p>
                <p className="text-xs text-gray-600">
                  Min: {statistics.tiempos_procesamiento?.tiempo_minimo || 0} días
                </p>
                <p className="text-xs text-gray-600">
                  Max: {statistics.tiempos_procesamiento?.tiempo_maximo || 0} días
                </p>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
            </svg>
            <span>Filtros</span>
            <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {showFilters && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input
                  type="text"
                  value={filters.codigo}
                  onChange={(e) => handleFilterChange({ ...filters, codigo: e.target.value })}
                  placeholder="Código de devolución..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <input
                  type="text"
                  value={filters.cliente}
                  onChange={(e) => handleFilterChange({ ...filters, cliente: e.target.value })}
                  placeholder="ID del cliente..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
                <input
                  type="date"
                  value={filters.fecha_desde}
                  onChange={(e) => handleFilterChange({ ...filters, fecha_desde: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Hasta</label>
                <input
                  type="date"
                  value={filters.fecha_hasta}
                  onChange={(e) => handleFilterChange({ ...filters, fecha_hasta: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de devoluciones */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {returns.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay devoluciones</h3>
            <p className="text-gray-500">No se encontraron devoluciones con los filtros aplicados.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código / Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items / Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Venta Original
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
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
                        {devolucion.id_cliente && (
                          <div className="text-sm text-gray-500">
                            {devolucion.id_cliente.nombres} {devolucion.id_cliente.apellidos}
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
                        <div className="text-sm text-gray-500">
                          {formatCurrency(devolucion.totales?.monto_items_devolucion || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {devolucion.id_venta ? (
                          <div className="text-sm">
                            <div className="text-gray-900">{devolucion.id_venta.numero_venta}</div>
                            <div className="text-gray-500">{formatCurrency(devolucion.id_venta.totales?.total_final || 0)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(devolucion.fecha_solicitud)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedReturn({ devolucion });
                            setShowDetails(true);
                            loadReturnDetails(devolucion.codigo_devolucion);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Ver detalles
                        </button>
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
                        {[...Array(Math.min(pagination.totalPages, 10))].map((_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pagination.page === pageNum
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
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

      {/* Modal de detalles */}
      {showDetails && selectedReturn && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Gestión de Devolución - {selectedReturn.devolucion?.codigo_devolucion}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {selectedReturn.devolucion ? (
                <div className="space-y-6">
                  {/* Estado y acciones disponibles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Estado Actual</h4>
                      <StatusBadge estado={selectedReturn.devolucion.estado} />
                      
                      {/* Acciones disponibles */}
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Acciones Disponibles:</h5>
                        <div className="flex flex-wrap gap-2">
                          {estadosDevolucion[selectedReturn.devolucion.estado]?.actions?.map((action) => (
                            <button
                              key={action}
                              onClick={() => {
                                if (action === 'inspeccionar') {
                                  if (selectedReturn.devolucion.items?.[0]) {
                                    setActionType(action);
                                    setActionData({ idItem: selectedReturn.devolucion.items[0]._id });
                                    setShowActionModal(true);
                                  }
                                } else {
                                  setActionType(action);
                                  setActionData({});
                                  setShowActionModal(true);
                                }
                              }}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 capitalize"
                            >
                              {action}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              setActionType('cancelar');
                              setActionData({});
                              setShowActionModal(true);
                            }}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => {
                              setCommunicationData({ tipo: 'email', asunto: '', mensaje: '' });
                              setShowCommunicationModal(true);
                            }}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Agregar Comunicación
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Información del Cliente</h4>
                      {selectedReturn.venta_info && (
                        <div className="text-sm text-gray-600">
                          <p>Venta: {selectedReturn.venta_info.numero_venta}</p>
                          <p>Fecha: {formatDate(selectedReturn.venta_info.fecha_creacion)}</p>
                          <p>Total: {formatCurrency(selectedReturn.venta_info.totales?.total_final || 0)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Items de la Devolución</h4>
                    <div className="space-y-3">
                      {selectedReturn.devolucion.items?.map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900">{item.info_libro?.titulo}</h5>
                              <p className="text-sm text-gray-600">Autor: {item.info_libro?.autor}</p>
                              <p className="text-sm text-gray-600">
                                Cantidad: {item.cantidad_a_devolver} de {item.cantidad_comprada}
                              </p>
                              <p className="text-sm text-gray-600">Motivo: {item.motivo}</p>
                              {item.descripcion_problema && (
                                <p className="text-sm text-gray-600">Descripción: {item.descripcion_problema}</p>
                              )}
                              {item.inspeccion && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                  <p><strong>Inspección:</strong> {item.inspeccion.resultado}</p>
                                  <p><strong>Notas:</strong> {item.inspeccion.notas}</p>
                                  <p><strong>Fecha:</strong> {formatDate(item.inspeccion.fecha)}</p>
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">
                                {formatCurrency(item.info_libro.precio_pagado || 0)}
                              </p>
                              <StatusBadge estado={item.estado_item} />
                              {!item.inspeccion && selectedReturn.devolucion.estado === 'en_inspeccion' && (
                                <button
                                  onClick={() => {
                                    setActionType('inspeccionar');
                                    setActionData({ idItem: item._id });
                                    setShowActionModal(true);
                                  }}
                                  className="mt-2 px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                                >
                                  Inspeccionar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Historial */}
                  {selectedReturn.devolucion.historial && selectedReturn.devolucion.historial.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Historial</h4>
                      <div className="space-y-2">
                        {selectedReturn.devolucion.historial.map((evento, index) => (
                          <div key={index} className="flex items-start space-x-3 text-sm">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                              <p className="text-gray-900">{evento.descripcion}</p>
                              <p className="text-gray-500">{formatDate(evento.fecha)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documentos */}
                  {selectedReturn.devolucion.documentos && selectedReturn.devolucion.documentos.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Documentos</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {selectedReturn.devolucion.documentos.map((doc, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center mb-2">
                              <svg className="w-4 h-4 text-gray-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-gray-600">{doc.tipo}</span>
                            </div>
                            <a 
                              href={doc.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Ver documento
                            </a>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(doc.fecha_subida)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando detalles...</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de acciones */}
      {showActionModal && <ActionModal />}

      {/* Modal de comunicación */}
      {showCommunicationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Agregar Comunicación
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={communicationData.tipo}
                  onChange={(e) => setCommunicationData({...communicationData, tipo: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="llamada">Llamada</option>
                  <option value="nota_interna">Nota Interna</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asunto *
                </label>
                <input
                  type="text"
                  value={communicationData.asunto}
                  onChange={(e) => setCommunicationData({...communicationData, asunto: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensaje *
                </label>
                <textarea
                  value={communicationData.mensaje}
                  onChange={(e) => setCommunicationData({...communicationData, mensaje: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCommunicationModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (communicationData.asunto && communicationData.mensaje) {
                      const success = await addCommunication(
                        selectedReturn.devolucion.codigo_devolucion,
                        communicationData
                      );
                      if (success) {
                        alert('Comunicación agregada exitosamente');
                        setShowCommunicationModal(false);
                        loadReturnDetails(selectedReturn.devolucion.codigo_devolucion);
                      } else {
                        alert('Error al agregar comunicación');
                      }
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageReturns;