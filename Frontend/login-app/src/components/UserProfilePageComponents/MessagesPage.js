import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Plus, Send, ArrowLeft, Clock, CheckCircle2, Circle } from 'lucide-react';

// Mock auth function for demo
import { getAuthToken } from './authUtils';

const MessagesPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationData, setNewConversationData] = useState({
    asunto: '',
    mensaje_inicial: '',
    categoria: 'consulta_general',
    prioridad: 'media'
  });
  
  const messagesEndRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const lastMessageTimestampRef = useRef(null);

  // Fetch conversations
  const fetchConversations = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversaciones || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
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
        
        // Mark conversation as read (only on initial load, not during polling)
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
        
        fetchConversations(); // Refresh conversation list
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Create new conversation
  const createConversation = async () => {
    if (!newConversationData.asunto.trim() || !newConversationData.mensaje_inicial.trim()) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append('asunto', newConversationData.asunto);
      formData.append('mensaje_inicial', newConversationData.mensaje_inicial);
      formData.append('categoria', newConversationData.categoria);
      formData.append('prioridad', newConversationData.prioridad);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/mensajeria/conversaciones`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setShowNewConversation(false);
        setNewConversationData({
          asunto: '',
          mensaje_inicial: '',
          categoria: 'consulta_general',
          prioridad: 'media'
        });
        fetchConversations();
        // Select the new conversation
        setSelectedConversation(data.data.conversacion);
        fetchMessages(data.data.conversacion._id);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  // Handle conversation selection
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

  // Initial load
  useEffect(() => {
    fetchConversations();
    
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
    } else if (diffInHours < 168) { // 7 days
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
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status text
  const getStatusText = (estado) => {
    switch (estado) {
      case 'abierta': return 'Abierta';
      case 'en_progreso': return 'En Progreso';
      case 'esperando_cliente': return 'Esperando Respuesta';
      case 'cerrada': return 'Cerrada';
      default: return estado;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-white">
      {/* Conversations List */}
      <div className={`${selectedConversation ? 'hidden lg:block' : 'block'} w-full lg:w-1/3 border-r border-gray-200 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <MessageCircle className="w-6 h-6 mr-2" />
              Mis Conversaciones
              {pollingIntervalRef.current && (
                <div className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Actualizando en tiempo real" />
              )}
            </h2>
            <button
              onClick={() => setShowNewConversation(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
              title="Nueva conversación"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No tienes conversaciones</p>
              <p className="text-sm">Inicia una nueva conversación con nuestro equipo de soporte</p>
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
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(conversation.estado)}`}>
                      {getStatusText(conversation.estado)}
                    </span>
                    {!conversation.leido_por_cliente && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {conversation.ultimo_mensaje?.contenido || 'Sin mensajes'}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(conversation.fecha_actualizacion)}
                  </span>
                  <span className="capitalize">{conversation.categoria.replace('_', ' ')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
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
                    {getStatusText(selectedConversation.estado)}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    {selectedConversation.categoria.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500">
                    ID: {selectedConversation.id_conversacion}
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
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
              const isClientMessage = message.remitente_info?.tipo === 'cliente';
              const senderName = message.remitente_info?.nombre || 'Usuario';
              
              return (
                <div
                  key={message._id}
                  className={`flex ${isClientMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md ${isClientMessage ? 'text-right' : 'text-left'}`}>
                    {/* Sender name */}
                    <p className={`text-xs text-gray-500 mb-1 px-1 ${isClientMessage ? 'text-right' : 'text-left'}`}>
                      {senderName}
                    </p>
                    
                    {/* Message bubble */}
                    <div className={`px-4 py-2 rounded-lg ${
                      isClientMessage
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-200 text-gray-900 rounded-bl-none'
                    }`}>
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
                placeholder="Escribe tu mensaje..."
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
            <p className="text-sm">Elige una conversación de la lista para ver los mensajes</p>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Nueva Conversación</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asunto *
                  </label>
                  <input
                    type="text"
                    value={newConversationData.asunto}
                    onChange={(e) => setNewConversationData(prev => ({ ...prev, asunto: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe brevemente tu consulta"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={newConversationData.categoria}
                    onChange={(e) => setNewConversationData(prev => ({ ...prev, categoria: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="consulta_general">Consulta General</option>
                    <option value="problema_tecnico">Problema Técnico</option>
                    <option value="consulta_producto">Consulta de Producto</option>
                    <option value="devolucion">Devolución</option>
                    <option value="facturacion">Facturación</option>
                    <option value="sugerencia">Sugerencia</option>
                    <option value="queja">Queja</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={newConversationData.prioridad}
                    onChange={(e) => setNewConversationData(prev => ({ ...prev, prioridad: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mensaje *
                  </label>
                  <textarea
                    value={newConversationData.mensaje_inicial}
                    onChange={(e) => setNewConversationData(prev => ({ ...prev, mensaje_inicial: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Describe tu consulta en detalle..."
                    maxLength={5000}
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowNewConversation(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={createConversation}
                  disabled={!newConversationData.asunto.trim() || !newConversationData.mensaje_inicial.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  Crear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;