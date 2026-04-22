import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CachedImage from '../CachedImage';
import UserModal from './UserModal';
import CreateAdminModal from './CreateAdminModal';

const ManageUsers = () => {
  // State declarations
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view', 'edit', 'delete'
  const [filterType, setFilterType] = useState('all'); // 'all', 'cliente', 'administrador', 'root'
  const [pagination, setPagination] = useState({
    total: 0,
    pagina: 1,
    limite: 10,
    totalPaginas: 0
  });
  const [editFormData, setEditFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const [currentUserType, setCurrentUserType] = useState(null);
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
  const [isMessageVisible, setIsMessageVisible] = useState(true);

  // Constants
  const API_BASE_URL = `${process.env.REACT_APP_API_URL}`;
  const DEFAULT_PROFILE_PIC = `${API_BASE_URL}/uploads/profiles/default.jpg`;

  useEffect(() => {
    if (actionMessage.text && !isModalOpen) {
      const timer = setTimeout(() => {
        setIsMessageVisible(false);  // Hide the message after 5 seconds
      }, 5000);

      return () => clearTimeout(timer);  // Clean up the timeout if the component unmounts or the actionMessage changes
    }
  }, [actionMessage.text, isModalOpen]);
  // Utility - Get cookie
  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  // Utility - Get auth token from cookie
  const getAuthToken = useCallback(() => {
    const dataCookie = getCookie("data");
    if (!dataCookie) return '';
    
    try {
      const parsedData = JSON.parse(dataCookie);
      return parsedData.authToken || '';
    } catch (e) {
      console.error('Error parsing auth token:', e);
      return '';
    }
  }, []);

  // Get current user type
  const getCurrentUserType = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/auth/verify-token`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 200 && response.data.user) {
        setCurrentUserType(response.data.user.tipo_usuario);
      }
    } catch (error) {
      console.error('Error fetching current user type:', error);
    }
  }, [API_BASE_URL, getAuthToken]);

  // Initial data loading
  useEffect(() => {
    getCurrentUserType();
    fetchUsers();
  }, [pagination.pagina, filterType, searchTerm]);

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Base URL with pagination and filter
      let url = `${API_BASE_URL}/api/v1/users?page=1&limit=100`; // Get more records for client-side filtering
      
      // Add filter type if not 'all'
      if (filterType !== 'all') {
        url += `&tipo=${filterType}`;
      }
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.data.status === 'success') {
        let filteredUsers = response.data.data;
        
        // Apply client-side search if search term exists
        if (searchTerm.trim()) {
          const term = searchTerm.trim().toLowerCase();
          filteredUsers = filteredUsers.filter(user => 
            (user.usuario && user.usuario.toLowerCase().includes(term)) || 
            (user.email && user.email.toLowerCase().includes(term)) ||
            (user.nombres && user.nombres.toLowerCase().includes(term)) ||
            (user.apellidos && user.apellidos.toLowerCase().includes(term))
          );
        }
        
        // Update total count for pagination
        const totalCount = filteredUsers.length;
        const pageSize = pagination.limite;
        const currentPage = pagination.pagina;
        
        // Calculate slice of data for current page
        const startIndex = (currentPage - 1) * pageSize;
        const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);
        
        // Set users and update pagination
        setUsers(paginatedUsers);
        setPagination({
          ...pagination,
          total: totalCount,
          totalPaginas: Math.ceil(totalCount / pageSize)
        });
      } else {
        throw new Error('Error al obtener usuarios');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setActionMessage({
        type: 'error',
        text: 'Error al cargar usuarios. Por favor, inténtelo de nuevo.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL, filterType, getAuthToken, pagination.limite, pagination.pagina, searchTerm]);

  // Fetch user details
  const fetchUserDetails = useCallback(async (userId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.data.status === 'success') {
        return response.data.data;
      } else {
        throw new Error('Error al obtener detalles del usuario');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      setActionMessage({
        type: 'error',
        text: 'Error al cargar detalles del usuario.'
      });
      return null;
    }
  }, [API_BASE_URL, getAuthToken]);

  // Handle search action
  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPaginas) {
      setPagination(prev => ({ ...prev, pagina: newPage }));
    }
  };

  // Determine profile image source
  const getProfileImageSrc = useCallback((user) => {
    if (!user) return DEFAULT_PROFILE_PIC;
    
    if (user.foto_perfil) {
      // Check if the URL is already absolute
      return user.foto_perfil.startsWith('http') 
        ? user.foto_perfil 
        : `${API_BASE_URL}${user.foto_perfil.startsWith('/') ? '' : '/'}${user.foto_perfil}`;
    }
    
    return DEFAULT_PROFILE_PIC;
  }, [API_BASE_URL, DEFAULT_PROFILE_PIC]);

  // Prepare user for editing
  const prepareUserForEdit = useCallback((user) => {
    if (!user) return;
    
    setEditFormData({
      nombres: user.nombres || '',
      apellidos: user.apellidos || '',
      DNI: user.DNI || '',
      telefono: user.telefono || '',
      email: user.email || '',
      activo: user.activo || false,
      cargo: user.cargo || '',
    });
  }, []);

  // Handle profile picture upload
  const uploadProfilePic = useCallback(async (file) => {
    if (!file || !selectedUser) return;
    
    setIsUploadingProfilePic(true);
    setActionMessage({ type: '', text: '' });
    
    try {
      const formData = new FormData();
      formData.append('foto_perfil', file);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/users/${selectedUser._id}/foto`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.data.status === 'success') {
        setActionMessage({
          type: 'success',
          text: 'Foto de perfil actualizada correctamente'
        });
        
        const newProfilePic = response.data.data.foto_perfil;
        
        // Update the user in the list
        setUsers(prev => prev.map(user => 
          user._id === selectedUser._id 
            ? { ...user, foto_perfil: newProfilePic } 
            : user
        ));
        
        // Update selected user
        setSelectedUser(prev => ({
          ...prev,
          foto_perfil: newProfilePic
        }));
      } else {
        throw new Error('Error al actualizar la foto de perfil');
      }
    } catch (error) {
      console.error('Error uploading profile pic:', error);
      setActionMessage({
        type: 'error',
        text: 'Error al subir la foto de perfil: ' + 
          (error.response?.data?.message || error.message || 'Error desconocido')
      });
    } finally {
      setIsUploadingProfilePic(false);
    }
  }, [API_BASE_URL, getAuthToken, selectedUser]);

  // Handle profile picture input change
  const handleProfilePicChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser) return;
    
    uploadProfilePic(file);
  }, [selectedUser, uploadProfilePic]);

  // Handle profile picture deletion
  const handleDeleteProfilePic = useCallback(async () => {
    if (!selectedUser) return;
    
    if (!window.confirm('¿Está seguro que desea eliminar la foto de perfil?')) {
      return;
    }
    
    setIsUploadingProfilePic(true);
    setActionMessage({ type: '', text: '' });
    
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/api/v1/users/${selectedUser._id}/foto`,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.data.status === 'success') {
        setActionMessage({
          type: 'success',
          text: 'Foto de perfil eliminada correctamente'
        });
        
        const defaultPic = response.data.data.foto_perfil || 'default.jpg';
        
        // Update the user in the list and selected user
        setUsers(prev => prev.map(user => 
          user._id === selectedUser._id 
            ? { ...user, foto_perfil: defaultPic } 
            : user
        ));
        
        setSelectedUser(prev => ({
          ...prev,
          foto_perfil: defaultPic
        }));
      } else {
        throw new Error('Error al eliminar la foto de perfil');
      }
    } catch (error) {
      console.error('Error deleting profile pic:', error);
      setActionMessage({
        type: 'error',
        text: 'Error al eliminar la foto de perfil: ' + 
          (error.response?.data?.message || error.message || 'Error desconocido')
      });
    } finally {
      setIsUploadingProfilePic(false);
    }
  }, [API_BASE_URL, getAuthToken, selectedUser]);

  // Format date
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  }, []);

  // Get user type label
  const getUserTypeLabel = useCallback((type) => {
    switch(type) {
      case 'cliente':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Cliente</span>;
      case 'administrador':
        return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">Administrador</span>;
      case 'root':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Root</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">{type}</span>;
    }
  }, []);

  // Check if user can be modified
  const canModifyUser = useCallback((user) => {
    // Root users can modify both clients and administrators, but not other root users
    if (currentUserType === 'root') {
      return user && (user.tipo_usuario === 'cliente' || user.tipo_usuario === 'administrador');
    }
    
    // Administrators can only modify clients
    return user && user.tipo_usuario === 'cliente';
  }, [currentUserType]);

  // Open user modal
  const openModal = useCallback(async (mode, user = null) => {
    if (user) {
      if (mode === 'view' || mode === 'edit' || mode === 'delete') {
        setIsLoading(true);
        const userDetails = await fetchUserDetails(user._id);
        setSelectedUser(userDetails);
        
        if (mode === 'edit') {
          prepareUserForEdit(userDetails);
        }
        
        setIsLoading(false);
      } else {
        setSelectedUser(user);
      }
    }
    
    setModalMode(mode);
    setIsModalOpen(true);
  }, [fetchUserDetails, prepareUserForEdit]);

  // Handle form input change
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});
    
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/v1/users/${selectedUser._id}`,
        editFormData,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.status === 'success') {
        setActionMessage({
          type: 'success',
          text: 'Usuario actualizado correctamente'
        });
        
        // Update the user in the list
        setUsers(prev => prev.map(user => 
          user._id === selectedUser._id ? { ...user, ...editFormData } : user
        ));
        
        // Close modal after a short delay
        setTimeout(() => {
          setIsModalOpen(false);
          fetchUsers(); // Refresh the list
        }, 1500);
      } else {
        throw new Error('Error al actualizar usuario');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setFormErrors({ general: 'Error al actualizar el usuario. Por favor, inténtelo de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [API_BASE_URL, editFormData, fetchUsers, getAuthToken, selectedUser]);

  // Handle user activation/deactivation
  const handleToggleUserStatus = useCallback(async () => {
    setIsSubmitting(true);
    
    try {
      if (selectedUser.activo) {
        // Deactivate user
        const response = await axios.delete(
          `${API_BASE_URL}/api/v1/users/${selectedUser._id}`,
          {
            headers: {
              'Authorization': `Bearer ${getAuthToken()}`,
              'Accept': 'application/json'
            }
          }
        );
        
        if (response.data.status === 'success') {
          setActionMessage({
            type: 'success',
            text: 'Usuario desactivado correctamente'
          });
          
          // Update user status in the list
          setUsers(prev => prev.map(user => 
            user._id === selectedUser._id ? { ...user, activo: false } : user
          ));
        } else {
          throw new Error('Error al desactivar usuario');
        }
      } else {
        // Activate user
        const response = await axios.put(
          `${API_BASE_URL}/api/v1/users/${selectedUser._id}`,
          { activo: true },
          {
            headers: {
              'Authorization': `Bearer ${getAuthToken()}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data.status === 'success') {
          setActionMessage({
            type: 'success',
            text: 'Usuario activado correctamente'
          });
          
          // Update user status in the list
          setUsers(prev => prev.map(user => 
            user._id === selectedUser._id ? { ...user, activo: true } : user
          ));
        } else {
          throw new Error('Error al activar usuario');
        }
      }
      
      // Close modal after a short delay
      setTimeout(() => {
        setIsModalOpen(false);
        fetchUsers(); // Refresh the list
      }, 1500);
    } catch (error) {
      console.error('Error toggling user status:', error);
      setActionMessage({
        type: 'error',
        text: `Error al ${selectedUser.activo ? 'desactivar' : 'activar'} al usuario.`
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [API_BASE_URL, fetchUsers, getAuthToken, selectedUser]);

  // Handle Create Admin Modal
  const handleCreateAdminModal = (shouldRefresh = false) => {
    setIsCreateAdminModalOpen(false);
    if (shouldRefresh) {
      fetchUsers();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
      {/* Header with Create Admin button */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800">Gestionar Usuarios</h1>
          {/* Show Create Admin button only for root users */}
          {currentUserType === 'root' && (
            <button
              onClick={() => setIsCreateAdminModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Crear Administrador
            </button>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          {/* Filtros de tipo de usuario */}
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-sm ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('cliente')}
              className={`px-3 py-1 text-sm ${filterType === 'cliente' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Clientes
            </button>
            <button
              onClick={() => setFilterType('administrador')}
              className={`px-3 py-1 text-sm ${filterType === 'administrador' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Administradores
            </button>
            <button
              onClick={() => setFilterType('root')}
              className={`px-3 py-1 text-sm ${filterType === 'root' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Root
            </button>
          </div>
          
          {/* Búsqueda */}
          <form onSubmit={handleSearch} className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Buscar por usuario o email"
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-3 top-2.5 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <button 
              type="submit" 
              className="absolute right-2 top-2 text-blue-600 hover:text-blue-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Status Messages */}
      {isMessageVisible && actionMessage.text && !isModalOpen && (
        <div className={`p-4 mb-6 rounded ${
          actionMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700">Cargando usuarios...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-600">No se encontraron usuarios que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha de registro
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                          <CachedImage 
                            src={getProfileImageSrc(user)}
                            alt={user.usuario || 'Usuario'} 
                            className="w-full h-full object-cover"
                            fallbackSrc={DEFAULT_PROFILE_PIC}
                            fallbackComponent={
                              <div className="w-full h-full flex items-center justify-center bg-yellow-200">
                                <span className="text-lg font-bold text-yellow-500">
                                  {user.nombres ? user.nombres.charAt(0) : user.usuario?.charAt(0).toUpperCase() || 'U'}
                                </span>
                              </div>
                            }
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.usuario}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getUserTypeLabel(user.tipo_usuario)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.fecha_registro)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.activo ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openModal('view', user)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Ver
                      </button>
                      {canModifyUser(user) && (
                        <>
                          <button
                            onClick={() => openModal('edit', user)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => openModal('delete', user)}
                            className="text-red-600 hover:text-red-900"
                          >
                            {user.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {!isLoading && pagination.totalPaginas > 1 && (
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-600">
            Mostrando {(pagination.pagina - 1) * pagination.limite + 1} - {Math.min(pagination.pagina * pagination.limite, pagination.total)} de {pagination.total} resultados
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.pagina - 1)}
              disabled={pagination.pagina === 1}
              className={`px-3 py-1 rounded ${
                pagination.pagina === 1 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-white text-blue-600 hover:bg-blue-50 border border-gray-300'
              }`}
            >
              Anterior
            </button>
            
            {Array.from({ length: Math.min(5, pagination.totalPaginas) }, (_, i) => {
              // Logic for showing 5 pages around the current page
              const totalPages = pagination.totalPaginas;
              const currentPage = pagination.pagina;
              
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-1 rounded ${
                    pageNum === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-50 border border-gray-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => handlePageChange(pagination.pagina + 1)}
              disabled={pagination.pagina === pagination.totalPaginas}
              className={`px-3 py-1 rounded ${
                pagination.pagina === pagination.totalPaginas
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-blue-600 hover:bg-blue-50 border border-gray-300'
              }`}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
      
      {/* User Modal */}
      {isModalOpen && (
        <UserModal
          modalMode={modalMode}
          selectedUser={selectedUser}
          editFormData={editFormData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          setIsModalOpen={setIsModalOpen}
          isSubmitting={isSubmitting}
          formErrors={formErrors}
          actionMessage={actionMessage}
          handleToggleUserStatus={handleToggleUserStatus}
          getProfileImageSrc={getProfileImageSrc}
          formatDate={formatDate}
          getUserTypeLabel={getUserTypeLabel}
          DEFAULT_PROFILE_PIC={DEFAULT_PROFILE_PIC}
          handleProfilePicChange={handleProfilePicChange}
          handleDeleteProfilePic={handleDeleteProfilePic}
          isUploadingProfilePic={isUploadingProfilePic}
          setModalMode={setModalMode}
          prepareUserForEdit={prepareUserForEdit}
        />
      )}
      
      {/* Create Admin Modal */}
      {isCreateAdminModalOpen && (
        <CreateAdminModal
          isOpen={isCreateAdminModalOpen}
          onClose={handleCreateAdminModal}
          getAuthToken={getAuthToken}
          API_BASE_URL={API_BASE_URL}
        />
      )}
    </div>
  );
};

export default ManageUsers;