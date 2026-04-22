import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, 
  Send, 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Filter,
  User,
  AlertCircle,
  Settings,
  Search,
  Calendar,
  ChevronDown,
  UserCheck,
  X
} from 'lucide-react';

import { getAuthToken } from '../UserProfilePageComponents/authUtils';

const AdminMessagesPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showConversationActions, setShowConversationActions] = useState(false);
  
  // Admin list state - now fetched from API
  const [adminList, setAdminList] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  
  // Real-time polling refs
  const messagesEndRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const lastMessageTimestampRef = useRef(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    estado: '',
    categoria: '',
    prioridad: '',
    admin_asignado: '',
    no_leidas: '',
    buscar: '',
    fecha_desde: '',
    fecha_hasta: '',
    ordenar_por: 'fecha_actualizacion',
    orden_desc: true
  });

  const [pagination, setPagination] = useState({
    total: 0,
    pagina: 1,
    limite: 20,
    totalPaginas: 1
  });

  // Fetch administrators from API
  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/users?tipo_usuario=administrador&activo=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log("response:", response.data);
        setAdminList(data.data || data.users || data); // Handle different possible response structures
        
      } else {
        console.error('Error fetching admins:', response.statusText);
        // Fallback to empty array
        setAdminList([]);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
      // Fallback to empty array
      setAdminList([]);
    } finally {
      setLoadingAdmins(false);
    }
  };

  // Fetch conversations with filters
  const fetchConversations = async () => {
    setLoading(true);
    const token = getAuthToken();
    if (!token) return;

    try {
      // Build query parameters
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value);
        }
      });

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversaciones || []);
        setPagination(data.paginacion || {});
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // Mock data for demo
      setConversations([
        {
          _id: '60d85e3a9f15d71f5019e123',
          id_conversacion: 'CONV1687851323456ABCD',
          cliente_info: {
            id_cliente: 'CLI12345678',
            nombres: 'Juan Carlos',
            apellidos: 'Pérez López',
            email: 'juan.perez@email.com'
          },
          asunto: 'Consulta sobre devolución de libro',
          categoria: 'devolucion',
          prioridad: 'media',
          estado: 'en_progreso',
          ultimo_mensaje: {
            contenido: 'Hemos revisado su solicitud y procederemos con la devolución...',
            fecha: '2023-06-27T14:30:15.789Z',
            enviado_por: 'administrador'
          },
          admin_asignado: {
            _id: '60d85e3a9f15d71f5019e126',
            nombres: 'María',
            apellidos: 'González',
            usuario: 'admin_soporte'
          },
          leido_por_cliente: false,
          leido_por_admin: true,
          total_mensajes: 3,
          fecha_creacion: '2023-06-27T10:15:23.456Z',
          fecha_actualizacion: '2023-06-27T14:30:15.789Z'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId, silent = false) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const newMessages = data.data.mensajes || [];
        
        // If this is a background check, only update if there are actually new messages
        if (silent && messages.length > 0) {
          const lastCurrentMessageTime = messages[messages.length - 1]?.fecha_envio;
          const hasNewMessages = newMessages.some(msg => 
            new Date(msg.fecha_envio) > new Date(lastCurrentMessageTime)
          );
          
          if (hasNewMessages) {
            setMessages(newMessages);
            // Update last message timestamp for polling
            if (newMessages.length > 0) {
              lastMessageTimestampRef.current = newMessages[newMessages.length - 1].fecha_envio;
            }
          }
        } else {
          setMessages(newMessages);
          if (newMessages.length > 0) {
            lastMessageTimestampRef.current = newMessages[newMessages.length - 1].fecha_envio;
          }
        }
        
        // Mark as read (only on initial load, not during polling)
        if (!silent) {
          await fetch(`${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones/${conversationId}/leer`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Mock messages for demo
      if (!silent) {
        setMessages([
          {
            _id: '60d85e3a9f15d71f5019e125',
            contenido: 'Hola, necesito devolver un libro que compré la semana pasada porque llegó en mal estado.',
            remitente_info: {
              tipo: 'cliente',
              nombre: 'Juan Carlos Pérez López',
              email: 'juan.perez@email.com'
            },
            fecha_envio: '2023-06-27T10:15:23.456Z',
            estado: 'leido'
          },
          {
            _id: '60d85e3a9f15d71f5019e127',
            contenido: 'Hola Juan Carlos, lamento escuchar sobre el problema con su libro. Vamos a procesar su devolución inmediatamente.',
            remitente_info: {
              tipo: 'administrador',
              nombre: 'admin_soporte',
              email: 'maria.gonzalez@libreria.com'
            },
            fecha_envio: '2023-06-27T11:25:15.789Z',
            estado: 'leido'
          }
        ]);
      }
    }
  };

  // Optimized polling function that only fetches new messages
  const checkForNewMessages = useCallback(async (conversationId) => {
    const token = getAuthToken();
    if (!token || !conversationId) return;

    try {
      // If we have a timestamp, we can ask the server for messages after that timestamp
      // This is more efficient than fetching all messages every time
      let url = `${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones/${conversationId}`;
      
      // If your API supports filtering by timestamp, uncomment this:
      // if (lastMessageTimestampRef.current) {
      //   url += `?after=${encodeURIComponent(lastMessageTimestampRef.current)}`;
      // }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const serverMessages = data.data.mensajes || [];
        
        // Compare with current messages to see if there are new ones
        if (serverMessages.length > messages.length) {
          const newMessagesOnly = serverMessages.slice(messages.length);
          setMessages(prev => [...prev, ...newMessagesOnly]);
          
          // Update timestamp
          if (newMessagesOnly.length > 0) {
            lastMessageTimestampRef.current = newMessagesOnly[newMessagesOnly.length - 1].fecha_envio;
          }
          
          // Optionally update conversations list to show new unread status
          fetchConversations();
        }
      }
    } catch (error) {
      console.error('Error checking for new messages:', error);
    }
  }, [messages.length]);

  // Start polling for new messages
  const startPolling = useCallback((conversationId) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Set up new polling interval (check every 3 seconds)
    pollingIntervalRef.current = setInterval(() => {
      checkForNewMessages(conversationId);
    }, 3000);
  }, [checkForNewMessages]);

  // Stop polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append('contenido', newMessage);
      formData.append('tipo', 'mensaje');

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones/${selectedConversation._id}/mensajes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.data]);
        setNewMessage('');
        
        // Update timestamp for polling
        lastMessageTimestampRef.current = data.data.fecha_envio;
        
        fetchConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Change conversation status
  const changeConversationStatus = async (status) => {
    if (!selectedConversation) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones/${selectedConversation._id}/estado`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ estado: status })
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data.data);
        fetchConversations();
        setShowConversationActions(false);
      }
    } catch (error) {
      console.error('Error changing status:', error);
    }
  };

  // Assign admin to conversation
  const assignAdmin = async (adminId) => {
    if (!selectedConversation) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones/${selectedConversation._id}/asignar`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ admin_id: adminId })
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data.data);
        fetchConversations();
        setShowConversationActions(false);
      }
    } catch (error) {
      console.error('Error assigning admin:', error);
    }
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      estado: '',
      categoria: '',
      prioridad: '',
      admin_asignado: '',
      no_leidas: '',
      buscar: '',
      fecha_desde: '',
      fecha_hasta: '',
      ordenar_por: 'fecha_actualizacion',
      orden_desc: true
    });
  };

  // Handle conversation selection with polling
  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation._id);
    // Start polling for this conversation
    startPolling(conversation._id);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set up polling when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      startPolling(selectedConversation._id);
    } else {
      stopPolling();
    }

    // Cleanup on unmount or conversation change
    return () => {
      stopPolling();
    };
  }, [selectedConversation, startPolling]);

  // Fetch conversations when filters change
  useEffect(() => {
    fetchConversations();
  }, [filters]);

  // Fetch admin list on component mount
  useEffect(() => {
    fetchAdmins();
    console.log("Admins", adminList);
    
    // Cleanup on component unmount
    return () => {
      stopPolling();
    };
  }, []);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('es-ES', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }
  };

  // Get status color
  const getStatusColor = (estado) => {
    switch (estado) {
      case 'abierta': return 'text-green-600 bg-green-100';
      case 'en_progreso': return 'text-blue-600 bg-blue-100';
      case 'esperando_cliente': return 'text-yellow-600 bg-yellow-100';
      case 'cerrada': return 'text-gray-600 bg-gray-100';
      case 'archivada': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get priority color
  const getPriorityColor = (prioridad) => {
    switch (prioridad) {
      case 'urgente': return 'text-red-600 bg-red-100';
      case 'alta': return 'text-orange-600 bg-orange-100';
      case 'media': return 'text-blue-600 bg-blue-100';
      case 'baja': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white">
      {/* Conversations List - Now 33% width to match second code */}
      <div className={`${selectedConversation ? 'hidden lg:block' : 'block'} w-full lg:w-1/3 border-r border-gray-200 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <MessageCircle className="w-6 h-6 mr-2" />
              Gestión de Mensajes
              {pollingIntervalRef.current && (
                <div className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Actualizando en tiempo real" />
              )}
            </h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
              title="Filtros"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Quick search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              value={filters.buscar}
              onChange={(e) => handleFilterChange('buscar', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={filters.estado}
                onChange={(e) => handleFilterChange('estado', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todos los estados</option>
                <option value="abierta">Abierta</option>
                <option value="en_progreso">En Progreso</option>
                <option value="esperando_cliente">Esperando Cliente</option>
                <option value="cerrada">Cerrada</option>
                <option value="archivada">Archivada</option>
              </select>

              <select
                value={filters.categoria}
                onChange={(e) => handleFilterChange('categoria', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todas las categorías</option>
                <option value="consulta_general">Consulta General</option>
                <option value="problema_tecnico">Problema Técnico</option>
                <option value="consulta_producto">Consulta Producto</option>
                <option value="devolucion">Devolución</option>
                <option value="facturacion">Facturación</option>
                <option value="sugerencia">Sugerencia</option>
                <option value="queja">Queja</option>
                <option value="otro">Otro</option>
              </select>

              <select
                value={filters.prioridad}
                onChange={(e) => handleFilterChange('prioridad', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todas las prioridades</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>

              <select
                value={filters.no_leidas}
                onChange={(e) => handleFilterChange('no_leidas', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todas</option>
                <option value="true">Solo no leídas</option>
                <option value="false">Solo leídas</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={filters.fecha_desde}
                onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Fecha desde"
              />
              <input
                type="date"
                value={filters.fecha_hasta}
                onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Fecha hasta"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={clearFilters}
                className="flex-1 px-3 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Limpiar
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No hay conversaciones</p>
              <p className="text-sm">No se encontraron conversaciones con los filtros aplicados</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation._id}
                onClick={() => selectConversation(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConversation?._id === conversation._id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 truncate flex-1 mr-2">
                    {conversation.asunto}
                  </h3>
                  <div className="flex items-center space-x-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(conversation.prioridad)}`}>
                      {conversation.prioridad}
                    </span>
                    {!conversation.leido_por_admin && (
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {conversation.cliente_info?.nombres} {conversation.cliente_info?.apellidos}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(conversation.estado)}`}>
                    {conversation.estado.replace('_', ' ')}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {conversation.ultimo_mensaje?.contenido || 'Sin mensajes'}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(conversation.fecha_actualizacion)}
                  </span>
                  <div className="flex items-center space-x-2">
                    {conversation.admin_asignado && (
                      <span className="flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        {conversation.admin_asignado.usuario}
                      </span>
                    )}
                    <span>{conversation.total_mensajes} msgs</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPaginas > 1 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                {pagination.total} conversaciones
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleFilterChange('page', Math.max(1, filters.page - 1))}
                  disabled={filters.page === 1}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="px-3 py-1">
                  {pagination.pagina} de {pagination.totalPaginas}
                </span>
                <button
                  onClick={() => handleFilterChange('page', Math.min(pagination.totalPaginas, filters.page + 1))}
                  disabled={filters.page === pagination.totalPaginas}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Area - Now flex-1 (about 67% width) to match second code */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    stopPolling();
                  }}
                  className="lg:hidden mr-3 p-1 hover:bg-gray-200 rounded"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{selectedConversation.asunto}</h3>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedConversation.estado)}`}>
                      {selectedConversation.estado.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedConversation.prioridad)}`}>
                      {selectedConversation.prioridad}
                    </span>
                    <span className="text-xs text-gray-500">
                      Cliente: {selectedConversation.cliente_info?.nombres} {selectedConversation.cliente_info?.apellidos}
                    </span>
                    {pollingIntervalRef.current && (
                      <span className="text-xs text-green-600 flex items-center">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse" />
                        En vivo
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <button
                  onClick={() => setShowConversationActions(!showConversationActions)}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <Settings className="w-5 h-5" />
                </button>
                
                {showConversationActions && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <div className="p-3">
                      <h4 className="font-medium text-gray-900 mb-3">Acciones de Conversación</h4>
                      
                      {/* Status Change */}
                      <div className="mb-3">
                        <label className="block text-sm text-gray-700 mb-1">Cambiar Estado</label>
                        <select
                          onChange={(e) => e.target.value && changeConversationStatus(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          defaultValue=""
                        >
                          <option value="">Seleccionar estado</option>
                          <option value="abierta">Abierta</option>
                          <option value="en_progreso">En Progreso</option>
                          <option value="esperando_cliente">Esperando Cliente</option>
                          <option value="cerrada">Cerrada</option>
                          <option value="archivada">Archivada</option>
                        </select>
                      </div>
                      
                      {/* Admin Assignment */}
                      <div className="mb-3">
                        <label className="block text-sm text-gray-700 mb-1">Asignar Admin</label>
                        {loadingAdmins ? (
                          <div className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-500">
                            Cargando administradores...
                          </div>
                        ) : (
                          <select
                            onChange={(e) => e.target.value && assignAdmin(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            defaultValue=""
                          >
                            <option value="">Seleccionar admin</option>
                            {adminList.map(admin => (
                              <option key={admin._id} value={admin._id}>
                                {admin.nombres} {admin.apellidos} ({admin.usuario})
                              </option>
                            ))}
                          </select>
                        )}
                        {adminList.length === 0 && !loadingAdmins && (
                          <div className="text-xs text-gray-500 mt-1">
                            No hay administradores disponibles
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => setShowConversationActions(false)}
                        className="w-full px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
              const isClientMessage = message.remitente_info?.tipo === 'cliente';
              return (
                <div
                  key={message._id}
                  className={`flex ${isClientMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isClientMessage
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-900 rounded-bl-none'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${
                        isClientMessage ? 'text-blue-100' : 'text-gray-600'
                      }`}>
                        {message.remitente_info?.nombre}
                      </span>
                    </div>
                    <p className="text-sm">{message.contenido}</p>
                    <div className={`flex items-center justify-end mt-1 space-x-1 text-xs ${
                      isClientMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      <span>{formatDate(message.fecha_envio)}</span>
                      {isClientMessage && (
                        message.estado === 'leido' ? 
                          <CheckCircle2 className="w-3 h-3" /> : 
                          <Circle className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Escribir respuesta como administrador..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-lg transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center text-gray-500">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Selecciona una conversación</p>
            <p className="text-sm">Elige una conversación de la lista para ver los mensajes y gestionar</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMessagesPage;