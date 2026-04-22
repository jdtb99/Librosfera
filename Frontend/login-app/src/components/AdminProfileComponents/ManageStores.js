import React, { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getAuthToken } from '../UserProfilePageComponents/authUtils';
import axios from 'axios'

const ManageStores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [mapCenter, setMapCenter] = useState([19.432608, -99.133209]);
  const [newMarkerPosition, setNewMarkerPosition] = useState(null);
  
  // Pagination and filters
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    estado: '',
    ciudad: '',
    departamento: '',
    nombre: '',
    busqueda: ''
  });

  // Store inventory and pickups
  const [storeInventory, setStoreInventory] = useState([]);
  const [storePickups, setStorePickups] = useState([]);
  const [storeStatistics, setStoreStatistics] = useState(null);
  const [storeNotes, setStoreNotes] = useState([]);

  // Form states
  const [storeForm, setStoreForm] = useState({
    nombre: '',
    codigo: '',
    direccion: {
      direccion_completa: '',
      ciudad: '',
      departamento: '',
      codigo_postal: '',
      pais: 'Colombia'
    },
    coordenadas: {
      latitud: null,
      longitud: null
    },
    telefono_principal: '',
    telefono_secundario: '',
    email: '',
    responsable: {
      nombre: '',
      telefono: '',
      email: ''
    },
    horarios: {},
    servicios: {
      venta_presencial: true,
      recogida_productos: true,
      devoluciones: true,
      eventos: false,
      consulta_libreria: true,
      transferencias_tiendas: true
    },
    capacidad: {
      max_recogidas_dia: 50,
      max_transferencias_dia: 20,
      espacio_almacen_m2: 100,
      capacidad_maxima_libros: 5000
    },
    descripcion: '',
    estado: 'activa'
  });

  const [noteForm, setNoteForm] = useState({
    nota: '',
    categoria: 'otra'
  });

  const [stateChangeForm, setStateChangeForm] = useState({
    estado: '',
    motivo: ''
  });

  // Referencias
  const searchInputRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const storeMarkersRef = useRef([]);
  const newMarkerRef = useRef(null);
  const L = useRef(null);
  // Refs para que el listener del mapa siempre lea el estado actual (evita stale closure)
  const isEditingRef = useRef(false);
  const isAddingRef = useRef(false);

  // API Configuration
  const API_BASE_URL = `${process.env.REACT_APP_API_URL}/api/v1`;


  // Axios-like implementation (In real app, use: import axios from 'axios')
  // const axios = {
  //   create: (config) => {
  //     const instance = {
  //       defaults: {
  //         baseURL: config.baseURL || '',
  //         headers: config.headers || {}
  //       },
        
  //       async request(config) {
  //         const url = `${this.defaults.baseURL}${config.url || ''}`;
  //         const method = config.method?.toUpperCase() || 'GET';
          
  //         const headers = {
  //           ...this.defaults.headers,
  //           ...config.headers,
  //           'Authorization': `Bearer ${getAuthToken()}`,
  //           'Content-Type': 'application/json',
  //           'Accept': 'application/json',
  //           'User-Agent': 'Mozilla/5.0',
  //           'Cache-Control': 'no-cache'
  //         };

  //         const fetchOptions = {
  //           method,
  //           headers
  //         };

  //         if (config.data && method !== 'GET') {
  //           fetchOptions.body = typeof config.data === 'string' 
  //             ? config.data 
  //             : JSON.stringify(config.data);
  //         }

  //         try {
  //           const response = await fetch(url, fetchOptions);
            
  //           if (!response.ok) {
  //             const errorData = await response.json().catch(() => ({}));
  //             throw {
  //               response: {
  //                 status: response.status,
  //                 statusText: response.statusText,
  //                 data: errorData
  //               },
  //               message: errorData.message || `HTTP error! status: ${response.status}`
  //             };
  //           }
            
  //           const data = await response.json();
  //           return { data, status: response.status, statusText: response.statusText };
  //         } catch (error) {
  //           console.error('Axios request failed:', error);
  //           throw error;
  //         }
  //       },

  //       async get(url, config = {}) {
  //         return this.request({ ...config, method: 'GET', url });
  //       },

  //       async post(url, data, config = {}) {
  //         return this.request({ ...config, method: 'POST', url, data });
  //       },

  //       async put(url, data, config = {}) {
  //         return this.request({ ...config, method: 'PUT', url, data });
  //       },

  //       async patch(url, data, config = {}) {
  //         return this.request({ ...config, method: 'PATCH', url, data });
  //       },

  //       async delete(url, config = {}) {
  //         return this.request({ ...config, method: 'DELETE', url });
  //       }
  //     };
      
  //     return instance;
  //   }
  // };

  // Create axios instance
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Initialize Leaflet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        L.current = require('leaflet');
        initMap();
      } catch (err) {
        console.error("Error loading Leaflet:", err);
      }
    }
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    loadStores();
  }, [pagination.page, filters]);

  // Mantener refs sincronizados con el estado para el listener del mapa
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    isAddingRef.current = isAdding;
  }, [isAdding]);

  // Initialize map
  const initMap = () => {
    if (!L.current || !mapRef.current || mapInstanceRef.current) return;
    
    try {
      const iconRetinaUrl = require('leaflet/dist/images/marker-icon-2x.png');
      const iconUrl = require('leaflet/dist/images/marker-icon.png');
      const shadowUrl = require('leaflet/dist/images/marker-shadow.png');
      
      delete L.current.Icon.Default.prototype._getIconUrl;
      
      L.current.Icon.Default.mergeOptions({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      
      mapInstanceRef.current = L.current.map(mapRef.current).setView(mapCenter, 13);
      
      L.current.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
      
      mapInstanceRef.current.on('click', function(e) {
        if (isEditingRef.current || isAddingRef.current) {
          handleMapClick(e.latlng.lat, e.latlng.lng);
        }
      });
      
    } catch (err) {
      console.error("Error in map initialization:", err);
    }
  };

  // API Calls
  const loadStores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });

      const response = await axios.get(`${API_BASE_URL}/tiendas/admin/todas?${params}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`, // You'll need to get the token from your auth context/store
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Cache-Control': 'no-cache'
        },
        timeout: 10000, // 10 seconds timeout (equivalent to --connect-timeout 10)
      });

      if (response.data.status === 'success') {
        setStores(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.paginacion.total,
          totalPages: response.data.paginacion.totalPaginas
        }));
        updateStoreMarkers();
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      toast.error(error.response?.data?.message || 'Error al cargar las tiendas');
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  const createStore = async (storeData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/tiendas/admin`, storeData, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.status === 'success') {
        toast.success('Tienda creada exitosamente');
        loadStores();
        resetForm();
        return response.data.data;
      }
    } catch (error) {
      console.error('Error creating store:', error);
      toast.error(error.response?.data?.message || 'Error al crear la tienda');
    }
  };

  const updateStore = async (storeId, storeData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/tiendas/admin/${storeId}`, storeData, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`, // You'll need to get the token from your auth context/store
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000, // 30 seconds timeout (equivalent to --max-time 30)
    });

    if (response.data.status === 'success') {
      toast.success('Tienda actualizada exitosamente');
      loadStores();
      resetForm();
      return response.data.data;
    }
  } catch (error) {
    console.error('Error updating store:', error);
    toast.error(error.response?.data?.message || 'Error al actualizar la tienda');
  }
};

  const getStoreDetails = async (storeId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/tiendas/admin/${storeId}?incluir_estadisticas=true`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000, // 30 seconds timeout (equivalent to --max-time 30)
    });

    if (response.data.status === 'success') {
      setSelectedStore(response.data.data);
      return response.data.data;
    }
  } catch (error) {
    console.error('Error getting store details:', error);
    toast.error(error.response?.data?.message || 'Error al obtener detalles de la tienda');
   
    // Fallback to existing store data
    const store = stores.find(s => s._id === storeId);
    if (store) {
      setSelectedStore({
        ...store,
        notas_internas: [
          {
            fecha: new Date().toISOString(),
            nota: 'Tienda en funcionamiento normal',
            categoria: 'operativa'
          }
        ]
      });
    }
  }
};

 const changeStoreState = async (storeId, estado, motivo) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/tiendas/admin/${storeId}/estado`, 
        { estado, motivo }, 
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            'Cache-Control': 'no-cache'
          },
          timeout: 30000,
        }
      );

      if (response.data.status === 'success') {
        toast.success(`Estado cambiado a ${estado}`);
        loadStores();
        if (selectedStore && selectedStore._id === storeId) {
          getStoreDetails(storeId);
        }
      }
    } catch (error) {
      console.error('Error changing store state:', error);
      toast.error(error.response?.data?.message || 'Error al cambiar estado');
    
      // Mock success for demo
      setStores(prev => prev.map(store =>
        store._id === storeId ? { ...store, estado } : store
      ));
      if (selectedStore && selectedStore._id === storeId) {
        setSelectedStore(prev => ({ ...prev, estado }));
      }
      toast.success(`Estado cambiado a ${estado} (demo)`);
    }
  };

  const getStoreInventory = async (storeId, inventoryFilters = {}) => {
  try {
    const params = new URLSearchParams({
      page: '1',
      limit: '50',
      ...inventoryFilters
    });
    const response = await axios.get(`${API_BASE_URL}/tiendas/admin/${storeId}/inventario?${params}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000,
    });
    
    if (response.data.status === 'success') {
      setStoreInventory(response.data.data);
      return response.data;
    }
  } catch (error) {
    console.error('Error getting store inventory:', error);
    toast.error(error.response?.data?.message || 'Error al obtener inventario');
  }
};

  const getStorePickups = async (storeId, pickupFilters = {}) => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        ...pickupFilters
      });

      const response = await api.get(`${API_BASE_URL}/tiendas/admin/${storeId}/recogidas?${params}`);

      if (response.data.status === 'success') {
        setStorePickups(response.data.data);
        return response.data;
      }
    } catch (error) {
      console.error('Error getting store pickups:', error);
      toast.error(error.response?.data?.message || 'Error al obtener recogidas');
      
      // Mock pickups data
      const mockPickups = [
        {
          _id: '1',
          codigo_recogida: 'REC-ABC123456',
          id_cliente: {
            nombres: 'Juan Carlos',
            apellidos: 'Pérez González',
            telefono: '+57 301 234-5678'
          },
          estado: 'LISTO_PARA_RECOGER',
          valor_total: 50000,
          fecha_limite_recogida: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          _id: '2',
          codigo_recogida: 'REC-DEF789012',
          id_cliente: {
            nombres: 'María',
            apellidos: 'González López',
            telefono: '+57 301 987-6543'
          },
          estado: 'PENDIENTE',
          valor_total: 35000,
          fecha_limite_recogida: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      setStorePickups(mockPickups);
      toast.success('Recogidas cargadas (demo)');
    }
  };

  const processPickup = async (pickupId, action, data = {}) => {
    try {
      const response = await api.patch(`${API_BASE_URL}/tiendas/admin/recogidas/${pickupId}`, { 
        accion: action, 
        datos: data 
      });

      if (response.data.status === 'success') {
        toast.success(`Recogida ${action} procesada exitosamente`);
        if (selectedStore) {
          getStorePickups(selectedStore._id);
        }
      }
    } catch (error) {
      console.error('Error processing pickup:', error);
      toast.error(error.response?.data?.message || 'Error al procesar recogida');
      
      // Mock success for demo
      const actionMap = {
        'marcar_preparado': 'LISTO_PARA_RECOGER',
        'completar_recogida': 'RECOGIDO',
        'cancelar': 'CANCELADO'
      };
      
      setStorePickups(prev => prev.map(pickup => 
        pickup._id === pickupId 
          ? { ...pickup, estado: actionMap[action] || pickup.estado }
          : pickup
      ));
      toast.success(`Recogida ${action} procesada exitosamente (demo)`);
    }
  };

  const getStoreStatistics = async (storeId = null, dateRange = {}) => {
    try {
      const params = new URLSearchParams({
        ...(storeId && { tienda_id: storeId }),
        ...dateRange
      });

      const response = await api.get(`${API_BASE_URL}/tiendas/admin/estadisticas?${params}`);

      if (response.data.status === 'success') {
        setStoreStatistics(response.data.data);
        return response.data.data;
      }
    } catch (error) {
      console.error('Error getting statistics:', error);
      toast.error(error.response?.data?.message || 'Error al obtener estadísticas');
      
      // Mock statistics
      const mockStats = {
        tiendas: {
          total_tiendas: stores.length,
          tiendas_activas: stores.filter(s => s.estado === 'activa').length
        },
        recogidas: {
          total_recogidas: 150,
          recogidas_completadas: 130,
          recogidas_canceladas: 15,
          tasa_completacion: 86.7
        }
      };
      setStoreStatistics(mockStats);
      toast.success('Estadísticas cargadas (demo)');
    }
  };

  const addStoreNote = async (storeId, noteData) => {
    try {
      const response = await api.post(`${API_BASE_URL}/tiendas/admin/${storeId}/notas`, noteData);

      if (response.data.status === 'success') {
        toast.success('Nota agregada exitosamente');
        if (selectedStore) {
          getStoreDetails(storeId);
        }
        setNoteForm({ nota: '', categoria: 'otra' });
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error(error.response?.data?.message || 'Error al agregar nota');
      
      // Mock success for demo
      const newNote = {
        fecha: new Date().toISOString(),
        nota: noteData.nota,
        categoria: noteData.categoria
      };
      
      setSelectedStore(prev => ({
        ...prev,
        notas_internas: [...(prev.notas_internas || []), newNote]
      }));
      setNoteForm({ nota: '', categoria: 'otra' });
      toast.success('Nota agregada exitosamente (demo)');
    }
  };

  // Map functions
  const updateStoreMarkers = () => {
    if (!L.current || !mapInstanceRef.current) return;
    
    storeMarkersRef.current.forEach(marker => marker.remove());
    storeMarkersRef.current = [];
    
    stores.forEach(store => {
      if (store.coordenadas) {
        try {
          const marker = L.current.marker([store.coordenadas.latitud, store.coordenadas.longitud])
            .addTo(mapInstanceRef.current);
          
          const popupContent = document.createElement('div');
          popupContent.innerHTML = `
            <div style="text-align: center;">
              <h3 style="font-weight: bold; font-size: 16px;">${store.nombre}</h3>
              <p style="font-size: 14px; margin-top: 4px;">${store.direccion.direccion_completa}</p>
              <p style="font-size: 12px; color: #666;">Estado: ${store.estado}</p>
              <div style="margin-top: 8px; display: flex; justify-content: center; gap: 8px;">
                <button id="view-store-${store._id}" style="font-size: 12px; background-color: #dbeafe; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;">
                  Ver Detalles
                </button>
                <button id="edit-store-${store._id}" style="font-size: 12px; background-color: #f0f9ff; color: #0369a1; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;">
                  Editar
                </button>
              </div>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          
          marker.on('popupopen', () => {
            setTimeout(() => {
              const viewBtn = document.getElementById(`view-store-${store._id}`);
              const editBtn = document.getElementById(`edit-store-${store._id}`);
              
              if (viewBtn) {
                viewBtn.addEventListener('click', () => {
                  handleViewDetails(store);
                  marker.closePopup();
                });
              }
              
              if (editBtn) {
                editBtn.addEventListener('click', () => {
                  handleEdit(store);
                  marker.closePopup();
                });
              }
            }, 100);
          });
          
          storeMarkersRef.current.push(marker);
        } catch (err) {
          console.error("Error creating marker:", err);
        }
      }
    });
  };

  const handleMapClick = (lat, lng) => {
    if (!isEditingRef.current && !isAddingRef.current) return;

    setNewMarkerPosition([lat, lng]);
    setStoreForm(prev => ({
      ...prev,
      coordenadas: {
        latitud: lat,
        longitud: lng
      }
    }));

    toast.info('Posición seleccionada');
  };

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setStoreForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setStoreForm(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!storeForm.nombre || !storeForm.codigo || !storeForm.coordenadas.latitud) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }
    
    setLoading(true);
    
    try {
      if (isEditing && selectedStore) {
        await updateStore(selectedStore._id, storeForm);
      } else {
        await createStore(storeForm);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (store) => {
    await getStoreDetails(store._id || store.id);
    setActiveTab('general');
  };

  const handleEdit = (store) => {
    setSelectedStore(store);
    setStoreForm({
      nombre: store.nombre,
      codigo: store.codigo,
      direccion: store.direccion || {
        direccion_completa: store.address || '',
        ciudad: '',
        departamento: '',
        codigo_postal: '',
        pais: 'Colombia'
      },
      coordenadas: store.coordenadas || {
        latitud: store.lat,
        longitud: store.lng
      },
      telefono_principal: store.telefono_principal || store.phone || '',
      telefono_secundario: store.telefono_secundario || '',
      email: store.email || '',
      responsable: store.responsable || { nombre: '', telefono: '', email: '' },
      servicios: store.servicios || {
        venta_presencial: true,
        recogida_productos: true,
        devoluciones: true,
        eventos: false,
        consulta_libreria: true,
        transferencias_tiendas: true
      },
      capacidad: store.capacidad || {
        max_recogidas_dia: 50,
        max_transferencias_dia: 20,
        espacio_almacen_m2: 100,
        capacidad_maxima_libros: 5000
      },
      descripcion: store.descripcion || store.description || '',
      estado: store.estado || 'activa'
    });
    
    setIsEditing(true);
    setIsAdding(false);
    
    const lat = store.coordenadas?.latitud || store.lat;
    const lng = store.coordenadas?.longitud || store.lng;
    if (lat && lng) {
      setMapCenter([lat, lng]);
      setNewMarkerPosition([lat, lng]);
    }
  };

  const handleAddNew = () => {
    resetForm();
    setIsAdding(true);
    setIsEditing(false);
    setActiveTab('general');
  };

  const resetForm = () => {
    setStoreForm({
      nombre: '',
      codigo: '',
      direccion: {
        direccion_completa: '',
        ciudad: '',
        departamento: '',
        codigo_postal: '',
        pais: 'Colombia'
      },
      coordenadas: {
        latitud: null,
        longitud: null
      },
      telefono_principal: '',
      telefono_secundario: '',
      email: '',
      responsable: {
        nombre: '',
        telefono: '',
        email: ''
      },
      horarios: {},
      servicios: {
        venta_presencial: true,
        recogida_productos: true,
        devoluciones: true,
        eventos: false,
        consulta_libreria: true,
        transferencias_tiendas: true
      },
      capacidad: {
        max_recogidas_dia: 50,
        max_transferencias_dia: 20,
        espacio_almacen_m2: 100,
        capacidad_maxima_libros: 5000
      },
      descripcion: '',
      estado: 'activa'
    });
    
    setSelectedStore(null);
    setIsEditing(false);
    setIsAdding(false);
    setNewMarkerPosition(null);
    setActiveTab('general');
    
    if (newMarkerRef.current) {
      newMarkerRef.current.remove();
      newMarkerRef.current = null;
    }
  };

  const handleStateChange = async (e) => {
    e.preventDefault();
    if (!selectedStore || !stateChangeForm.estado || !stateChangeForm.motivo) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    
    await changeStoreState(selectedStore._id, stateChangeForm.estado, stateChangeForm.motivo);
    setStateChangeForm({ estado: '', motivo: '' });
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!selectedStore || !noteForm.nota.trim()) {
      toast.error('Ingrese una nota válida');
      return;
    }
    
    await addStoreNote(selectedStore._id, noteForm);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Tab content renderers
  const renderGeneralTab = () => (
    <div className="space-y-6">
      {selectedStore && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Información General</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>Nombre:</strong> {selectedStore.nombre}</p>
              <p><strong>Código:</strong> {selectedStore.codigo}</p>
              <p><strong>Estado:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  selectedStore.estado === 'activa' ? 'bg-green-100 text-green-800' :
                  selectedStore.estado === 'mantenimiento' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {selectedStore.estado}
                </span>
              </p>
              <p><strong>Email:</strong> {selectedStore.email}</p>
            </div>
            <div>
              <p><strong>Teléfono:</strong> {selectedStore.telefono_principal}</p>
              <p><strong>Dirección:</strong> {selectedStore.direccion?.direccion_completa}</p>
              <p><strong>Ciudad:</strong> {selectedStore.direccion?.ciudad}</p>
              <p><strong>Responsable:</strong> {selectedStore.responsable?.nombre}</p>
            </div>
          </div>
        </div>
      )}

      {/* State Change Section */}
      <div className="bg-white p-4 border rounded-lg">
        <h4 className="font-semibold mb-3">Cambiar Estado de Tienda</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <select
              value={stateChangeForm.estado}
              onChange={(e) => setStateChangeForm(prev => ({ ...prev, estado: e.target.value }))}
              className="border rounded px-3 py-2"
            >
              <option value="">Seleccionar estado</option>
              <option value="activa">Activa</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="cerrada_temporal">Cerrada Temporal</option>
              <option value="cerrada_permanente">Cerrada Permanente</option>
            </select>
            <input
              type="text"
              placeholder="Motivo del cambio"
              value={stateChangeForm.motivo}
              onChange={(e) => setStateChangeForm(prev => ({ ...prev, motivo: e.target.value }))}
              className="border rounded px-3 py-2"
            />
          </div>
          <button
            onClick={handleStateChange}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
            disabled={!selectedStore}
          >
            Cambiar Estado
          </button>
        </div>
      </div>

      {/* Add Note Section */}
      <div className="bg-white p-4 border rounded-lg">
        <h4 className="font-semibold mb-3">Agregar Nota Interna</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <select
              value={noteForm.categoria}
              onChange={(e) => setNoteForm(prev => ({ ...prev, categoria: e.target.value }))}
              className="border rounded px-3 py-2"
            >
              <option value="otra">Otra</option>
              <option value="operativa">Operativa</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="incidencia">Incidencia</option>
              <option value="mejora">Mejora</option>
            </select>
            <textarea
              placeholder="Escribir nota..."
              value={noteForm.nota}
              onChange={(e) => setNoteForm(prev => ({ ...prev, nota: e.target.value }))}
              className="border rounded px-3 py-2 col-span-2"
              rows="2"
            />
          </div>
          <button
            onClick={handleAddNote}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            disabled={!selectedStore}
          >
            Agregar Nota
          </button>
        </div>
      </div>

      {/* Notes History */}
      {selectedStore?.notas_internas && (
        <div className="bg-white p-4 border rounded-lg">
          <h4 className="font-semibold mb-3">Historial de Notas</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedStore.notas_internas.map((note, idx) => (
              <div key={idx} className="border-l-4 border-blue-200 pl-3 py-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm">{note.nota}</p>
                  <span className="text-xs text-gray-500 ml-2">{note.categoria}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(note.fecha).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderInventoryTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Inventario de Tienda</h3>
        <button
          onClick={() => selectedStore && getStoreInventory(selectedStore._id)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          disabled={!selectedStore}
        >
          Cargar Inventario
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 border text-left">Libro</th>
              <th className="px-4 py-2 border text-left">Stock Total</th>
              <th className="px-4 py-2 border text-left">Disponible</th>
              <th className="px-4 py-2 border text-left">Reservado</th>
              <th className="px-4 py-2 border text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {storeInventory.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">
                  <div>
                    <p className="font-medium">{item.id_libro?.titulo}</p>
                    <p className="text-sm text-gray-500">{item.id_libro?.autor_nombre_completo}</p>
                  </div>
                </td>
                <td className="px-4 py-2 border">{item.stock_total}</td>
                <td className="px-4 py-2 border">{item.stock_disponible}</td>
                <td className="px-4 py-2 border">{item.stock_reservado}</td>
                <td className="px-4 py-2 border">
                  <span className={`px-2 py-1 rounded text-sm ${
                    item.estado === 'disponible' ? 'bg-green-100 text-green-800' :
                    item.necesita_restock ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPickupsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Recogidas de Tienda</h3>
        <button
          onClick={() => selectedStore && getStorePickups(selectedStore._id)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          disabled={!selectedStore}
        >
          Cargar Recogidas
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 border text-left">Código</th>
              <th className="px-4 py-2 border text-left">Cliente</th>
              <th className="px-4 py-2 border text-left">Estado</th>
              <th className="px-4 py-2 border text-left">Valor</th>
              <th className="px-4 py-2 border text-left">Fecha Límite</th>
              <th className="px-4 py-2 border text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {storePickups.map((pickup, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{pickup.codigo_recogida}</td>
                <td className="px-4 py-2 border">
                  {pickup.id_cliente?.nombres} {pickup.id_cliente?.apellidos}
                </td>
                <td className="px-4 py-2 border">
                  <span className={`px-2 py-1 rounded text-sm ${
                    pickup.estado === 'RECOGIDO' ? 'bg-green-100 text-green-800' :
                    pickup.estado === 'LISTO_PARA_RECOGER' ? 'bg-blue-100 text-blue-800' :
                    pickup.estado === 'CANCELADO' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pickup.estado}
                  </span>
                </td>
                <td className="px-4 py-2 border">${pickup.valor_total?.toLocaleString()}</td>
                <td className="px-4 py-2 border">
                  {new Date(pickup.fecha_limite_recogida).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 border">
                  <div className="space-x-2">
                    {pickup.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => processPickup(pickup._id, 'marcar_preparado')}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
                      >
                        Preparar
                      </button>
                    )}
                    {pickup.estado === 'LISTO_PARA_RECOGER' && (
                      <button
                        onClick={() => processPickup(pickup._id, 'completar_recogida', {
                          documento_presentado: 'CC123456789',
                          nombre_empleado: 'Sistema'
                        })}
                        className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                      >
                        Completar
                      </button>
                    )}
                    <button
                      onClick={() => processPickup(pickup._id, 'cancelar', {
                        motivo: 'Cancelado desde administración'
                      })}
                      className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStatsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Estadísticas</h3>
        <button
          onClick={() => getStoreStatistics(selectedStore?._id)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Cargar Estadísticas
        </button>
      </div>

      {storeStatistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800">Total Tiendas</h4>
            <p className="text-2xl font-bold text-blue-600">
              {storeStatistics.tiendas?.total_tiendas || 0}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800">Tiendas Activas</h4>
            <p className="text-2xl font-bold text-green-600">
              {storeStatistics.tiendas?.tiendas_activas || 0}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="font-semibold text-orange-800">Total Recogidas</h4>
            <p className="text-2xl font-bold text-orange-600">
              {storeStatistics.recogidas?.total_recogidas || 0}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-800">Tasa Completación</h4>
            <p className="text-2xl font-bold text-purple-600">
              {storeStatistics.recogidas?.tasa_completacion || 0}%
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 bg-gray-100 p-6 overflow-y-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Administrar Tiendas Físicas
          </h1>
          
          {!isEditing && !isAdding && (
            <button
              onClick={handleAddNew}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Nueva Tienda
            </button>
          )}
        </div>

        {/* Filters */}
        {!isEditing && !isAdding && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-3">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                name="estado"
                value={filters.estado}
                onChange={handleFilterChange}
                className="border rounded px-3 py-2"
              >
                <option value="">Todos los estados</option>
                <option value="activa">Activa</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="cerrada_temporal">Cerrada Temporal</option>
                <option value="cerrada_permanente">Cerrada Permanente</option>
              </select>
              
              <input
                type="text"
                name="ciudad"
                placeholder="Ciudad"
                value={filters.ciudad}
                onChange={handleFilterChange}
                className="border rounded px-3 py-2"
              />
              
              <input
                type="text"
                name="departamento"
                placeholder="Departamento"
                value={filters.departamento}
                onChange={handleFilterChange}
                className="border rounded px-3 py-2"
              />
              
              <input
                type="text"
                name="nombre"
                placeholder="Nombre tienda"
                value={filters.nombre}
                onChange={handleFilterChange}
                className="border rounded px-3 py-2"
              />
              
              <input
                type="text"
                name="busqueda"
                placeholder="Búsqueda general"
                value={filters.busqueda}
                onChange={handleFilterChange}
                className="border rounded px-3 py-2"
              />
            </div>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Store List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-700">
                Tiendas Registradas ({stores.length})
              </h2>
            </div>
            
            <div className="max-h-[calc(100vh-350px)] overflow-y-auto">
              {loading && stores.length === 0 ? (
                <div className="flex justify-center items-center p-8">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : stores.length === 0 ? (
                <div className="text-center py-8 px-4 text-gray-500">
                  <p>No hay tiendas registradas</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {stores.map(store => (
                    <li 
                      key={store._id || store.id} 
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        selectedStore?._id === store._id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex justify-between">
                        <div onClick={() => handleViewDetails(store)} className="flex-1">
                          <h3 className="font-medium text-gray-900">{store.nombre}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {store.direccion?.direccion_completa || store.address}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-400">{store.codigo}</p>
                            <span className={`px-2 py-1 rounded text-xs ${
                              store.estado === 'activa' ? 'bg-green-100 text-green-800' :
                              store.estado === 'mantenimiento' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {store.estado}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 ml-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(store);
                            }}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="p-4 border-t flex justify-between items-center">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-600">
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Map and Details */}
        <div className="lg:col-span-2">
          {/* Map */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700">
                Mapa de Ubicaciones
                {(isEditing || isAdding) && (
                  <span className="text-sm text-blue-600 ml-2">
                    (Haz clic en el mapa para seleccionar ubicación)
                  </span>
                )}
              </h3>
            </div>
            <div 
              ref={mapRef} 
              id="map-container" 
              className="h-[400px] md:h-[500px]"
            ></div>
          </div>
          
          {/* Store Form */}
          {(isEditing || isAdding) && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                {isEditing ? 'Editar Tienda' : 'Agregar Nueva Tienda'}
              </h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de la Tienda *
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={storeForm.nombre}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código *
                    </label>
                    <input
                      type="text"
                      name="codigo"
                      value={storeForm.codigo}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección Completa *
                    </label>
                    <input
                      type="text"
                      name="direccion.direccion_completa"
                      value={storeForm.direccion.direccion_completa}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ciudad *
                    </label>
                    <input
                      type="text"
                      name="direccion.ciudad"
                      value={storeForm.direccion.ciudad}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departamento *
                    </label>
                    <input
                      type="text"
                      name="direccion.departamento"
                      value={storeForm.direccion.departamento}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono Principal *
                    </label>
                    <input
                      type="text"
                      name="telefono_principal"
                      value={storeForm.telefono_principal}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={storeForm.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Responsable - Nombre *
                    </label>
                    <input
                      type="text"
                      name="responsable.nombre"
                      value={storeForm.responsable.nombre}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Responsable - Teléfono *
                    </label>
                    <input
                      type="text"
                      name="responsable.telefono"
                      value={storeForm.responsable.telefono}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latitud *
                    </label>
                    <input
                      type="number"
                      value={storeForm.coordenadas.latitud || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      step="0.000001"
                      readOnly
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longitud *
                    </label>
                    <input
                      type="number"
                      value={storeForm.coordenadas.longitud || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      step="0.000001"
                      readOnly
                    />
                  </div>
                </div>

                {/* Services */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Servicios</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.keys(storeForm.servicios).map(service => (
                      <label key={service} className="flex items-center">
                        <input
                          type="checkbox"
                          name={`servicios.${service}`}
                          checked={storeForm.servicios[service]}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-sm capitalize">{service.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Capacity */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Capacidad</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Recogidas/Día
                      </label>
                      <input
                        type="number"
                        name="capacidad.max_recogidas_dia"
                        value={storeForm.capacidad.max_recogidas_dia}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Transferencias/Día
                      </label>
                      <input
                        type="number"
                        name="capacidad.max_transferencias_dia"
                        value={storeForm.capacidad.max_transferencias_dia}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Espacio Almacén (m²)
                      </label>
                      <input
                        type="number"
                        name="capacidad.espacio_almacen_m2"
                        value={storeForm.capacidad.espacio_almacen_m2}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Capacidad Max Libros
                      </label>
                      <input
                        type="number"
                        name="capacidad.capacidad_maxima_libros"
                        value={storeForm.capacidad.capacidad_maxima_libros}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    name="descripcion"
                    value={storeForm.descripcion}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  />
                </div>
                
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
                  >
                    Cancelar
                  </button>
                  
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md flex items-center"
                    disabled={loading || !storeForm.coordenadas.latitud}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>{isEditing ? 'Actualizar Tienda' : 'Guardar Tienda'}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Store Details Tabs */}
          {selectedStore && !isEditing && !isAdding && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6 py-3">
                  {[
                    { id: 'general', name: 'General' },
                    { id: 'inventory', name: 'Inventario' },
                    { id: 'pickups', name: 'Recogidas' },
                    { id: 'stats', name: 'Estadísticas' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </div>
              
              <div className="p-6">
                {activeTab === 'general' && renderGeneralTab()}
                {activeTab === 'inventory' && renderInventoryTab()}
                {activeTab === 'pickups' && renderPickupsTab()}
                {activeTab === 'stats' && renderStatsTab()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageStores;