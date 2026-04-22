import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CachedImage from '../CachedImage';

const BookEditor = ({ book, onSave, onCancel, id, mode = 'add' }) => {
  const isEditMode = mode === 'edit';
  
  const [formData, setFormData] = useState({
    titulo: '',
    autor_nombre: '',  // New field for author's first name
    autor_apellidos: '', // New field for author's last name
    editorial: '',
    año: '',
    genero: '',
    paginas: '',
    issn: '',
    idioma: '',
    fecha: '',
    estado: 'Nuevo',
    precio: '',
    imagen: '',
    descripcion: '',
    stock: 1
  });

  const [discountData, setDiscountData] = useState({
    tipo: "porcentaje",
    valor: '',
    fecha_inicio: "",
    fecha_fin: "",
    codigo_promocion: ''
  });

  const availableGenres = ['Ficción', 'No Ficción', 'Ciencia Ficción', 'Fantasía', 'Romance', 'Biografía', 'Historia', 'Ciencia', 'Filosofía', 'Arte', 'Tecnología'];
  
  
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: '', text: '' });
  const [bookImages, setBookImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [languageQuery, setLanguageQuery] = useState('');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [showDiscountDates, setShowDiscountDates] = useState(false);
  const [hasActiveStores, setHasActiveStores] = useState(null); // null = aún verificando
  const [checkingStores, setCheckingStores] = useState(false);

  // Get authentication token from cookies
  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  // Get auth token from cookie
  const getAuthToken = () => {
    const dataCookie = getCookie("data");
    if (!dataCookie) return '';
    
    try {
      const parsedData = JSON.parse(dataCookie);
      return parsedData.authToken || '';
    } catch (e) {
      console.error('Error parsing auth token:', e);
      return '';
    }
  };

  // Actualizar tipo de imagen en el servidor
  const updateImageType = async (imageId, newType) => {
    if (!isEditMode || !book || !book.id) return false;
    
    const token = getAuthToken();
    if (!token) {
      console.error('No se encontró el token de autenticación');
      return false;
    }
    
    try {
      // Llamar a la API para actualizar el tipo de imagen
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/v1/libros/${book.id}/imagenes/${imageId}`,
        { tipo: newType },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.data.status === 'success') {
        console.log(`Tipo de imagen actualizado a "${newType}" correctamente`);
        return true;
      } else {
        console.error('Error al actualizar tipo de imagen:', response.data);
        return false;
      }
    } catch (error) {
      console.error('Error al actualizar tipo de imagen:', error);
      if (error.response) {
        console.error('Detalles del error:', error.response.data);
      }
      return false;
    }
  };

  // Actualizar orden de imágenes en el servidor
  const updateImageOrder = async () => {
    if (!isEditMode || !book || !book.id) return false;
    
    // Solo actualizar el orden si hay imágenes existentes
    const existingImages = bookImages.filter(img => img.isExisting && img._id);
    if (existingImages.length < 2) return true; // No es necesario actualizar si hay 0 o 1 imagen
    
    const token = getAuthToken();
    if (!token) {
      console.error('No se encontró el token de autenticación');
      return false;
    }
    
    try {
      // Crear un array con el formato esperado por la API
      const ordenesNuevos = [];
      
      // Mapear cada imagen a su nuevo orden basado en su posición actual
      existingImages.forEach((img, idx) => {
        ordenesNuevos.push({
          id_imagen: img._id,
          orden_nuevo: idx
        });
      });
      
      // Datos de la solicitud según la documentación
      const requestData = { ordenesNuevos };
      
      console.log('Enviando actualización de orden:', JSON.stringify(requestData, null, 2));
      
      // Enviar la solicitud PATCH para actualizar el orden
      const response = await axios({
        method: 'PATCH',
        url: `${process.env.REACT_APP_API_URL}/api/v1/libros/${book.id}/imagenes/orden`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: requestData
      });
      
      console.log('Respuesta completa:', response);
      
      if (response.data && response.data.status === 'success') {
        console.log('Orden de imágenes actualizado correctamente:', response.data);
        return true;
      } else {
        console.error('Error al actualizar orden de imágenes:', response.data);
        return false;
      }
    } catch (error) {
      console.error('Error al actualizar orden de imágenes:', error);
      if (error.response) {
        console.error('Detalles del error:', error.response.data);
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
      }
      return false;
    }
  };

  // Función para obtener imágenes del servidor
  const fetchImagesFromServer = async () => {
    if (!isEditMode || !book || !book.id) return;
    
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/libros/${book.id}`);
      if (response.data.status === 'success' && response.data.data.imagenes) {
        const serverImages = response.data.data.imagenes.map(img => ({
          _id: img._id,
          url: img.url,
          file: null,
          type: img.tipo,
          orden: img.orden,
          alt: img.alt_text || book.title,
          isExisting: true
        }));
        
        // Ordenar por el campo orden actualizado
        serverImages.sort((a, b) => a.orden - b.orden);
        
        // Forzar que la primera imagen sea portada y las demás contenido 
        // independientemente de lo que esté almacenado en el servidor
        if (serverImages.length > 0) {
          serverImages[0].type = 'portada';
          for (let i = 1; i < serverImages.length; i++) {
            serverImages[i].type = 'contenido';
          }
        }
        
        // Mantener la imagen actual visible si es posible
        const currentImageUrl = bookImages[currentImageIndex]?.url;
        const newIndex = serverImages.findIndex(img => img.url === currentImageUrl);
        
        setBookImages(serverImages);
        if (newIndex >= 0) {
          setCurrentImageIndex(newIndex);
        } else if (serverImages.length > 0) {
          setCurrentImageIndex(0);
        }
      }
    } catch (error) {
      console.error('Error al cargar imágenes del servidor:', error);
    }
  };

  // Función para actualizar tipos de imágenes en el servidor después de reordenar
  const updateAllImageTypes = async () => {
    if (!isEditMode || !book || !book.id || bookImages.length === 0) return false;
    
    try {
      // Obtener token de autenticación
      const token = getAuthToken();
      if (!token) {
        console.error('No se encontró el token de autenticación');
        return false;
      }
      
      // Actualizar el tipo de todas las imágenes para asegurar que coincidan con su posición
      let success = true;
      
      // La primera imagen debe ser portada
      if (bookImages[0].isExisting && bookImages[0]._id) {
        console.log('Actualizando primera imagen a portada:', bookImages[0]._id);
        const result = await updateImageType(bookImages[0]._id, 'portada');
        if (!result) success = false;
      }
      
      // Las demás imágenes deben ser contenido
      for (let i = 1; i < bookImages.length; i++) {
        if (bookImages[i].isExisting && bookImages[i]._id) {
          console.log('Actualizando imagen a contenido:', bookImages[i]._id);
          const result = await updateImageType(bookImages[i]._id, 'contenido');
          if (!result) success = false;
        }
      }
      
      return success;
    } catch (error) {
      console.error('Error al actualizar tipos de imágenes:', error);
      return false;
    }
  };

  const formatDateTimeForInput = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16);
    } catch (e) {
      return '';
    }
  };

  // Add discount to a book
  const addDiscount = async (bookId) => {

    //console.log("Info to discont:", book);

    if (!discountData.valor || parseFloat(discountData.valor) <= 0) {
      return true; // No discount to add
    }

    const token = getAuthToken();
    if (!token) {
      console.error('No se encontró el token de autenticación');
      return false;
    }

    try {
      const discountPayload = {
        tipo: discountData.tipo,
        valor: parseFloat(discountData.valor),
        fecha_inicio: discountData.fecha_inicio || new Date().toISOString(),
        fecha_fin: discountData.fecha_fin || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
        codigo_promocion: discountData.codigo_promocion || ''
      };

      console.log('Enviando descuento:', JSON.stringify(discountPayload, null, 2));
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/v1/libros/${bookId}/descuentos`,
        discountPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.data.status === 'success') {
        console.log('Descuento agregado correctamente:', response.data);
        return true;
      } else {
        console.error('Error al agregar descuento:', response.data);
        return false;
      }
    } catch (error) {
      console.error('Error al agregar descuento:', error);
      if (error.response) {
        console.error('Detalles del error:', error.response.data);
      }
      return false;
    }
  };

  // Fetch book's discount data if in edit mode
  const fetchDiscountData = async () => {
    if (!isEditMode || !book || !book.id) return;
    
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/libros/${book.id}`);
      if (response.data.status === 'success' && 
          response.data.data.precio_info && 
          response.data.data.precio_info.descuentos && 
          response.data.data.precio_info.descuentos.length > 0) {
            
        const activeDiscount = response.data.data.precio_info.descuentos.find(d => d.activo);
        
        if (activeDiscount) {
          setDiscountData({
            tipo: activeDiscount.tipo || 'porcentaje',
            valor: activeDiscount.valor?.toString() || '',
            fecha_inicio: formatDateTimeForInput(activeDiscount.fecha_inicio) || '',
            fecha_fin: formatDateTimeForInput(activeDiscount.fecha_fin) || '',
            codigo_promocion: activeDiscount.codigo_promocion || ''
          });
          
          // If there's an active discount, show the date fields
          if (activeDiscount.valor > 0) {
            setShowDiscountDates(true);
          }
        }
      }
    } catch (error) {
      console.error('Error al cargar datos de descuento:', error);
    }
  };

  const handleDiscountChange = (e) => {
    const { name, value } = e.target;
    
    setDiscountData({
      ...discountData,
      [name]: value
    });
    
    // If valor field is being changed, we need to check if we should show date fields
    if (name === 'valor') {
      const numericValue = parseFloat(value);
      setShowDiscountDates(!isNaN(numericValue) && numericValue > 0 && numericValue <= 100);
    }
  };

  // Fetch languages from API
  useEffect(() => {
    const loadLanguages = () => {
      setIsLoadingLanguages(true);
      
      // Lista completa de idiomas en español
      const allLanguages = [
        'Afrikáans', 'Albanés', 'Amhárico', 'Árabe', 'Armenio', 'Azerbaiyano',
        'Vasco', 'Bielorruso', 'Bengalí', 'Bosnio', 'Búlgaro', 'Birmano',
        'Catalán', 'Cebuano', 'Chichewa', 'Chino (Simplificado)', 'Chino (Tradicional)',
        'Corso', 'Croata', 'Checo', 'Danés', 'Neerlandés', 'Inglés', 'Esperanto',
        'Estonio', 'Filipino', 'Finlandés', 'Francés', 'Frisón', 'Gallego', 'Georgiano',
        'Alemán', 'Griego', 'Gujarati', 'Criollo Haitiano', 'Hausa', 'Hawaiano', 'Hebreo',
        'Hindi', 'Hmong', 'Húngaro', 'Islandés', 'Igbo', 'Indonesio', 'Irlandés',
        'Italiano', 'Japonés', 'Javanés', 'Canarés', 'Kazajo', 'Jemer', 'Coreano',
        'Kurdo', 'Kirguís', 'Lao', 'Latín', 'Letón', 'Lituano', 'Luxemburgués',
        'Macedonio', 'Malgache', 'Malayo', 'Malayalam', 'Maltés', 'Maorí', 'Marathi',
        'Mongol', 'Nepalí', 'Noruego', 'Pastún', 'Persa', 'Polaco', 'Portugués',
        'Punjabí', 'Rumano', 'Ruso', 'Samoano', 'Gaélico Escocés', 'Serbio', 'Sesotho',
        'Shona', 'Sindhi', 'Cingalés', 'Eslovaco', 'Esloveno', 'Somalí', 'Español',
        'Sundanés', 'Suajili', 'Sueco', 'Tayiko', 'Tamil', 'Telugu', 'Tailandés', 'Turco',
        'Ucraniano', 'Urdu', 'Uzbeko', 'Vietnamita', 'Galés', 'Xhosa', 'Yidis',
        'Yoruba', 'Zulú'
      ];
      
      setLanguages(allLanguages);
      setIsLoadingLanguages(false);
    };
    
    loadLanguages();
  }, []);
  
  // Carga imágenes al montar el componente en modo edición
  useEffect(() => {
    if (isEditMode && book && book.id) {
      const loadBookImages = async () => {
        setIsLoadingImages(true);
        await fetchImagesFromServer();
        setIsLoadingImages(false);
      };
      loadBookImages();
    }
  }, [isEditMode, book?.id]);
  
  // Load book images if in edit mode
  useEffect(() => {
    const fetchBookImages = async () => {
      if (isEditMode && book && book.id) {
        // if (discountData.valor && parseFloat(discountData.valor) > 0) {
        //   console.log()
        //   await addDiscount(book.id);
        // }
        setIsLoadingImages(true);
        try {
          // Cargar todas las imágenes del libro
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/libros/${book.id}`);
          if (response.data.status === 'success' && response.data.data.imagenes) {
            // Mapear todas las imágenes desde la respuesta de la API
            const images = response.data.data.imagenes.map(img => ({
              _id: img._id,
              url: img.url,
              file: null,
              type: img.tipo,
              orden: img.orden,
              alt: img.alt_text || book.title,
              // Flag para distinguir imágenes existentes de las nuevas
              isExisting: true
            }));
            
            // Ordenar las imágenes por el campo "orden"
            images.sort((a, b) => a.orden - b.orden);
            
            // Asegurar que la primera imagen sea portada y las demás contenido
            if (images.length > 0) {
              images[0].type = 'portada';
              for (let i = 1; i < images.length; i++) {
                images[i].type = 'contenido';
              }
            }
            
            setBookImages(images);
          }
        } catch (error) {
          console.error('Error al cargar imágenes del libro:', error);
        } finally {
          setIsLoadingImages(false);
        }
      }
    };

    fetchBookImages();
  }, [isEditMode, book]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      // Check if the click is outside the dropdown area
      const dropdown = document.querySelector('.genres-dropdown');
      if (showGenreDropdown && dropdown && !dropdown.contains(event.target)) {
        setShowGenreDropdown(false);
      }
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGenreDropdown]);

  // Verificar que haya al menos una tienda activa antes de permitir crear libro
  useEffect(() => {
    if (isEditMode) return; // Solo aplica al crear, no al editar

    const checkActiveStores = async () => {
      setCheckingStores(true);
      try {
        const token = getAuthToken();
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/v1/tiendas/admin/todas?estado=activa&limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          }
        );
        const total = response.data?.paginacion?.total ?? response.data?.resultados ?? 0;
        setHasActiveStores(total > 0);
      } catch (error) {
        console.error('Error verificando tiendas activas:', error);
        setHasActiveStores(false);
      } finally {
        setCheckingStores(false);
      }
    };

    checkActiveStores();
  }, [isEditMode]);

  // Carga los datos del libro cuando estamos en modo edición
  useEffect(() => {
    if (isEditMode && book) {
      const bookGenres = book.genre ? book.genre.split(',').map(g => g.trim()) : [];
      
      // Split author into name and surname
      const authorParts = book.author ? book.author.split(' ') : ['', ''];
      const authorName = authorParts[0] || '';
      const authorSurname = authorParts.slice(1).join(' ') || '';
      
      setFormData({
        titulo: book.title || '',
        autor_nombre: authorName,
        autor_apellidos: authorSurname,
        editorial: book.editorial || '',
        año: book.year || '',
        genero: book.genre || '',
        paginas: book.pages || '',
        issn: book.issn || '',
        idioma: book.language || '',
        fecha: book.publicationDate ? formatDateForInput(book.publicationDate) : '',
        estado: book.condition || 'Nuevo',
        precio: book.price ? book.price.toString() : '',
        imagen: book.image || '',
        descripcion: book.description || '',
        stock: book.stock || 1
      });
      
      setSelectedGenres(bookGenres);
      setLanguageQuery(book.language || '');
      fetchDiscountData();
    }
  }, [isEditMode, book]);

  // Filter languages based on user input
  const filteredLanguages = languages.filter(lang => 
    lang.toLowerCase().includes(languageQuery.toLowerCase())
  );

  // Format date for the date input (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleChangeDiscount = (e) => {
    const { name, value } = e.target;
    setDiscountData({
      ...discountData,
      [name]: value
    });
  };

  const handleLanguageInputChange = (e) => {
    setLanguageQuery(e.target.value);
    setFormData({
      ...formData,
      idioma: e.target.value
    });
    setShowLanguageDropdown(true);
  };

  const selectLanguage = (language) => {
    setFormData({
      ...formData,
      idioma: language
    });
    setLanguageQuery(language);
    setShowLanguageDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isEditMode && hasActiveStores === false) {
      setFormMessage({
        type: 'error',
        text: 'Primero debes crear al menos una tienda activa antes de agregar libros.'
      });
      return;
    }

    setIsSubmitting(true);
    setFormMessage({ type: '', text: '' });

    try {
      const token = getAuthToken();
      if (!token) {
        alert('No se encontró la sesión. Por favor inicie sesión nuevamente.');
        setIsSubmitting(false);
        return;
      }
      
      // Format the data for API submission
      const apiData = {
        titulo: formData.titulo,
        autor: [{
          nombre: formData.autor_nombre || '',
        apellidos: formData.autor_apellidos || '',
          nacionalidad: 'd',
          biografia: 'f',
          fechas: {
            nacimiento: null,
            fallecimiento: null
          },
          referencias: {
            wikipedia: ''
          }
        }],
        editorial: formData.editorial,
        genero: selectedGenres.join(', '), 
        idioma: formData.idioma,
        fecha_publicacion: formData.fecha,
        anio_publicacion: parseInt(formData.año) || null,
        numero_paginas: parseInt(formData.paginas) || null,
        precio_info: {
          precio_base: parseFloat(formData.precio) || 0,
          moneda: 'COP',
          impuesto: {
            tipo: 'IVA',
            porcentaje: 19
          },
          envio_gratis: true
        },
        precio: parseFloat(formData.precio) || 0,
        estado: formData.estado.toLowerCase(),
        stock: parseInt(formData.stock) || 1,
        descripcion: formData.descripcion || '',
        tabla_contenido: '',
        palabras_clave: selectedGenres.map(g => g.toLowerCase()),
        ISBN: formData.issn || '',
        edicion: {
          numero: 1,
          descripcion: 'Primera edición'
        }
      };

      let response;
      let bookId;
      
      if (isEditMode) {
        response = await axios.put(`${process.env.REACT_APP_API_URL}/api/v1/libros/${book.id}`, apiData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        bookId = book.id;
        
        // En modo edición, también actualizamos el orden y los tipos de imágenes
        await updateAllImageTypes();
        await updateImageOrder();
      } else {
        response = await axios.post(`${process.env.REACT_APP_API_URL}/api/v1/libros`, apiData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        bookId = response.data.data._id;
      }

      if (response.data.status === 'success' && bookId) {
        
        if (discountData.valor && parseFloat(discountData.valor) > 0) {
          console.log("Will add discount: ", bookId);
          await addDiscount(bookId);
        }

        // Upload only new images (files)
        const newImages = bookImages.filter(img => img.file);
        
        for (let i = 0; i < newImages.length; i++) {
          const image = newImages[i];
          const formData = new FormData();
          formData.append('imagen', image.file);
          
          // Determinar el tipo basado en la posición
          // La primera imagen (si no hay imágenes existentes) es la portada
          const isFirstImage = !bookImages.some(img => img.isExisting) && i === 0;
          const imageType = isFirstImage ? 'portada' : 'contenido';
          
          formData.append('tipo', imageType);
          formData.append('orden', bookImages.indexOf(image)); // Mantener el orden actual
          formData.append('alt_text', image.alt || 'Imagen de libro');
          
          try {
            await axios.post(
              `${process.env.REACT_APP_API_URL}/api/v1/libros/${bookId}/imagenes`,
              formData,
              {
                headers: {
                  'Content-Type': 'multipart/form-data',
                  'Authorization': `Bearer ${token}`
                }
              }
            );
          } catch (uploadError) {
            console.error(`Error al subir imagen ${i}:`, uploadError);
            alert(`Error al subir imagen ${i+1}: ${uploadError.response?.data?.message || uploadError.message}`);
          }
        }
      }

      setFormMessage({ type: 'success', text: 'Libro guardado exitosamente.' });
      setTimeout(() => onCancel(), 1500); // Delay to show the success message

    } catch (error) {
      console.error('Error submitting book:', error);
      setFormMessage({ 
        type: 'error', 
        text: `${error.response?.data?.message?.replace(/Validation failed: [^:]+:/, '') || error.message}. Por favor intente nuevamente.` 
      });
      
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      // Create image objects for new uploaded files
      const newImages = files.map((file, idx) => {
        return {
          url: URL.createObjectURL(file),
          file: file,
          type: bookImages.length === 0 ? 'portada' : 'contenido',
          alt: formData.titulo || 'Libro',
          isExisting: false
        };
      });
      
      setBookImages([...bookImages, ...newImages]);
      setCurrentImageIndex(bookImages.length); // Set to view the first new image
    }
  };

  const handlePrevImage = () => {
    if (bookImages.length > 0) {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === 0 ? bookImages.length - 1 : prevIndex - 1
      );
    }
  };

  const handleNextImage = () => {
    if (bookImages.length > 0) {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === bookImages.length - 1 ? 0 : prevIndex + 1
      );
    }
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      // Check if we are moving the cover or trying to make another image the cover
      const isMovingCover = draggedIndex === 0;
      const isBecomingCover = index === 0;
      
      // Reorder the images
      const newImages = [...bookImages];
      const draggedImage = newImages[draggedIndex];
      
      // Remove the dragged item
      newImages.splice(draggedIndex, 1);
      
      // Insert at the new position
      newImages.splice(index, 0, draggedImage);
      
      // Update image types in the UI (first is always cover)
      if (newImages.length > 0) {
        // Marcar la primera imagen como portada
        newImages[0].type = 'portada';
        
        // Las demás imágenes son de tipo contenido
        for (let i = 1; i < newImages.length; i++) {
          newImages[i].type = 'contenido';
        }
      }
      
      // Update the order property for each image
      newImages.forEach((img, idx) => {
        img.orden = idx;
      });
      
      // Update the state
      setBookImages(newImages);
      setDraggedIndex(index);
      
      // Update the current image index if needed
      if (currentImageIndex === draggedIndex) {
        setCurrentImageIndex(index);
      } else if (currentImageIndex === index) {
        setCurrentImageIndex(draggedIndex);
      }
    }
  };

  const handleDragEnd = async () => {
    // Si estamos en modo edición y hay un cambio de orden, actualizar en el servidor
    if (isEditMode && draggedIndex !== null) {
      try {
        // 1. Primero, actualizar el estado local para reflejar que la primera imagen es portada
        const updatedImages = [...bookImages];
        for (let i = 0; i < updatedImages.length; i++) {
          updatedImages[i].type = i === 0 ? 'portada' : 'contenido';
        }
        setBookImages(updatedImages);
        
        // 2. Actualizar todos los tipos de imágenes en el servidor
        await updateAllImageTypes();
        
        // 3. Actualizar el orden de todas las imágenes
        const success = await updateImageOrder();
        
        // 4. Si todo fue exitoso, recargar las imágenes del servidor
        if (success) {
          console.log('Orden y tipos actualizados correctamente en el servidor');
          
          // Recargar las imágenes para asegurar consistencia
          await fetchImagesFromServer();
        } else {
          console.error('No se pudo actualizar el orden o tipos de las imágenes');
        }
      } catch (error) {
        console.error('Error al finalizar el arrastre:', error);
      }
    }
    
    setDraggedIndex(null);
  };

  const removeImage = async (index) => {
    const image = bookImages[index];
    const newImages = [...bookImages];
    
    // Si es una imagen existente, eliminarla del servidor primero
    if (image.isExisting && image._id) {
      const success = await deleteImageFromServer(image._id);
      if (!success) {
        alert('Error al eliminar la imagen del servidor. Intente nuevamente.');
        return;
      }
    }
    
    // Eliminar la imagen del array
    newImages.splice(index, 1);
    
    // If we removed all images, just clear the array
    if (newImages.length === 0) {
      setBookImages([]);
      setCurrentImageIndex(0);
      return;
    }
    
    // If we removed the cover image, make the first remaining image the new cover
    if (index === 0 && newImages.length > 0) {
      newImages[0].type = 'portada';
      
      // Si es una imagen existente, actualizar su tipo a portada en el servidor
      if (newImages[0].isExisting && newImages[0]._id) {
        await updateImageType(newImages[0]._id, 'portada');
      }
    }
    
    // Update the image order
    newImages.forEach((img, idx) => {
      img.orden = idx;
    });
    
    setBookImages(newImages);
    
    // Update current image index if needed
    if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(newImages.length - 1);
    } else if (currentImageIndex === index) {
      setCurrentImageIndex(Math.max(0, currentImageIndex - 1));
    }
    
    // Actualizar el orden en el servidor si quedan imágenes
    if (newImages.length > 1 && isEditMode) {
      await updateImageOrder();
    }
  };

  // Eliminar imagen del servidor
  const deleteImageFromServer = async (imageId) => {
    if (!isEditMode || !book || !book.id) return false;
    
    const token = getAuthToken();
    if (!token) {
      alert('No se encontró la sesión. Por favor inicie sesión nuevamente.');
      return false;
    }
    
    try {
      const response = await axios.delete(
        `${process.env.REACT_APP_API_URL}/api/v1/libros/${book.id}/imagenes/${imageId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.data.status === 'success') {
        return true;
      } else {
        console.error('Error al eliminar imagen:', response.data);
        return false;
      }
    } catch (error) {
      console.error('Error al eliminar imagen:', error);
      return false;
    }
  };

  // Display thumbnails - up to 3 unique images with correct labels
  const displayThumbnails = () => {
    // Mostrar hasta 3 miniaturas, pero no repetir imágenes
    // Si hay menos de 3 imágenes, algunas cajas quedarán vacías
    return Array(3).fill(null).map((_, index) => {
      // Solo mostrar una imagen si tenemos suficientes
      const hasImage = index < bookImages.length;
      const image = hasImage ? bookImages[index] : null;
      
      return (
        <div 
          key={index}
          className={`w-16 h-16 border rounded ${hasImage ? 'bg-white' : 'bg-gray-200'} flex items-center justify-center cursor-pointer ${draggedIndex === index ? 'opacity-50' : ''}`}
          onClick={() => {
            if (hasImage) {
              setCurrentImageIndex(index);
            }
          }}
          draggable={hasImage}
          onDragStart={() => hasImage && handleDragStart(index)}
          onDragOver={(e) => hasImage && handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
        >
          {hasImage ? (
            <div className="relative w-full h-full">
              <CachedImage 
                src={image.url} 
                alt={`Miniatura ${index + 1}`} 
                className="max-w-full max-h-full object-cover"
                fallbackSrc="/placeholder-book.png"
              />
              <button 
                type="button"
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
              >
                ×
              </button>
              
              {/* Indicador de tipo de imagen basado exclusivamente en la posición */}
              <span className="absolute bottom-0 left-0 right-0 text-xs text-center bg-black bg-opacity-50 text-white truncate">
                {index === 0 ? 'P' : 'C'}
              </span>
            </div>
          ) : (
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          )}
        </div>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
        {isEditMode ? 'Editar Libro' : 'Agregar Libro'}
      </h1>

      {!isEditMode && hasActiveStores === false && (
        <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
          <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-amber-800 font-semibold mb-1">Se requiere al menos una tienda activa</h3>
              <p className="text-amber-700 text-sm">
                No puedes agregar libros sin tener tiendas activas registradas. El stock del libro se distribuye automáticamente entre las tiendas activas.
              </p>
              <p className="text-amber-700 text-sm mt-2">
                <strong>Primero crea una tienda activa</strong> desde el panel <em>"Administrar Tiendas"</em> en el menú lateral.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        {/* Columna izquierda - Imagen del libro */}
        <div className="md:w-1/3">
  <div className="flex flex-col items-center">
    <label 
      className="w-full h-80 bg-gray-200 border rounded-lg flex items-center justify-center mb-4 relative overflow-hidden cursor-pointer"
      draggable={bookImages.length > 0}
      onDragStart={() => handleDragStart(currentImageIndex)}
      onDragOver={(e) => handleDragOver(e, currentImageIndex)}
      onDragEnd={handleDragEnd}
    >
      {isLoadingImages ? (
    <div className="text-center p-4">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600">Cargando imágenes...</p>
    </div>
  ) : bookImages.length > 0 ? (
    <div 
      className="flex transition-transform duration-300 ease-in-out h-full"
      style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
    >
      {bookImages.map((image, index) => (
        <div 
          key={index}
          className="min-w-full h-full flex-shrink-0 flex items-center justify-center"
          draggable={true}
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
        >
          <CachedImage 
            src={image.url} 
            alt={image.alt || "Imagen del libro"} 
            className="max-w-full max-h-full object-contain"
            fallbackSrc="/placeholder-book.png"
          />
          <button 
            type="button"
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              removeImage(index);
            }}
          >
            ×
          </button>
          
          {/* Indicador del tipo de imagen */}
          <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
            {index === 0 ? 'Portada' : 'Contenido'}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="text-center p-4">
      <div className="w-24 h-24 mx-auto border-2 border-gray-400 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
      <p className="mt-2 text-gray-500">Haga clic para agregar imagen</p>
    </div>
  )}
  
  {/* File input hidden but triggered when clicking the empty box */}
  {bookImages.length === 0 && (
    <input 
      type="file" 
      accept="image/*" 
      className="hidden" 
      onChange={handleImageUpload}
      multiple
    />
  )}
  
  {/* Botones de navegación */}
  {bookImages.length > 1 && (
    <>
      <button 
        type="button"
        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-gray-100"
        onClick={handlePrevImage}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button 
        type="button"
        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-gray-100"
        onClick={handleNextImage}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </>
  )}
    </label>
            
            {/* Miniaturas */}
            <div className="flex space-x-2 mb-4">
              {bookImages.length > 0 ? displayThumbnails() : (
                Array(3).fill(0).map((_, index) => (
                  <div 
                    key={index}
                    className="w-16 h-16 border rounded bg-gray-200 flex items-center justify-center"
                  >
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                ))
              )}
            </div>
            
            {/* Contador de imágenes */}
            {bookImages.length > 0 && (
              <div className="text-xs text-gray-600 mb-2">
                Imagen {currentImageIndex + 1} de {bookImages.length}
              </div>
            )}
            
            {/* Botones para gestionar imágenes */}
            <div className="flex justify-center space-x-2 w-full">
              <label className="cursor-pointer bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
                <span>Subir Imágenes</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                  multiple
                />
              </label>
              <button 
                type="button"
                onClick={() => {
                  if (window.confirm('¿Está seguro de eliminar todas las imágenes? Esta acción no se puede deshacer.')) {
                    // Para cada imagen existente, eliminarla del servidor
                    const deleteAll = async () => {
                      for (const img of bookImages) {
                        if (img.isExisting && img._id) {
                          await deleteImageFromServer(img._id);
                        }
                      }
                      setBookImages([]);
                      setCurrentImageIndex(0);
                    };
                    
                    deleteAll();
                  }
                }}
                className="bg-gray-200 text-gray-800 px-3 py-2 rounded hover:bg-gray-300"
                disabled={bookImages.length === 0}
              >
                Eliminar Todo
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Arrastre y suelte para reordenar las imágenes. La primera imagen será la portada principal.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Tipos de imagen: Portada (primera), Contenido (resto)
            </p>
          </div>
        </div>
        
        {/* Columna derecha - Formulario */}
        <div className="md:w-2/3">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">
            Datos del Libro
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  name="titulo"
                  placeholder="Escriba el título del libro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.titulo}
                  onChange={handleChange}
                  required
                />
              </div>
              
              {/* Replace the single author field with two fields */}
<div className="form-group">
  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Autor</label>
  <input
    type="text"
    name="autor_nombre"
    placeholder="Escriba el nombre"
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    value={formData.autor_nombre}
    onChange={handleChange}
    required
  />
</div>

<div className="form-group">
  <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos del Autor</label>
  <input
    type="text"
    name="autor_apellidos"
    placeholder="Escriba los apellidos"
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    value={formData.autor_apellidos}
    onChange={handleChange}
    required
  />
</div>
              
              {/* Nueva campo Editorial */}
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Editorial</label>
                <input
                  type="text"
                  name="editorial"
                  placeholder="Escriba la editorial"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.editorial}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                <input
                  type="number"
                  name="año"
                  placeholder="Escriba el año de publicación"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.año}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Géneros</label>
                <div className="relative">
                  <div 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-text min-h-[42px] flex flex-wrap gap-1"
                    onClick={() => setShowGenreDropdown(true)}
                  >
                    {selectedGenres.length > 0 ? (
                      selectedGenres.map((genre, idx) => (
                        <span 
                          key={idx} 
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm flex items-center"
                        >
                          {genre}
                          <button 
                            type="button"
                            className="ml-1 text-blue-600 hover:text-blue-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGenres(selectedGenres.filter(g => g !== genre));
                              setFormData({
                                ...formData,
                                genero: selectedGenres.filter(g => g !== genre).join(', ')
                              });
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500">Seleccione los géneros</span>
                    )}
                  </div>
                  
                  {showGenreDropdown && (
                      <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg genres-dropdown">                       <div className="sticky top-0 bg-white p-2 border-b">
                        <input 
                          type="text"
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                          placeholder="Buscar géneros..."
                          value={genreSearch}
                          onChange={(e) => setGenreSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                      
                      <div>
                      {availableGenres
  .filter(genre => genre.toLowerCase().includes(genreSearch.toLowerCase()))
  .map((genre, idx) => (
    <div
      key={idx}
      className={`px-3 py-2 cursor-pointer flex items-center ${
        selectedGenres.includes(genre) ? 'bg-blue-50' : 'hover:bg-gray-100'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        
        // Toggle selection
        let newSelected;
        if (selectedGenres.includes(genre)) {
          newSelected = selectedGenres.filter(g => g !== genre);
        } else {
          newSelected = [...selectedGenres, genre];
        }
        
        setSelectedGenres(newSelected);
        setFormData({
          ...formData,
          genero: newSelected.join(', ')
        });
      }}
    >
      <input 
        type="checkbox"
        checked={selectedGenres.includes(genre)}
        onChange={() => {}}
        className="mr-2"
      />
      {genre}
    </div>
  ))}
                        
                        {availableGenres.filter(genre => genre.toLowerCase().includes(genreSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-gray-500 text-center">
                            No se encontraron géneros
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Campo Páginas modificado */}
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de páginas</label>
                <input
                  type="number"
                  name="paginas"
                  placeholder="Escriba el número de páginas"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.paginas}
                  onChange={handleChange}
                  min="1"
                />
              </div>
              
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN/ISSN</label>
                <input
                  type="text"
                  name="issn"
                  placeholder="Escriba el código ISBN/ISSN del libro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.issn}
                  onChange={handleChange}
                />
              </div>
              
              {/* Campo Idioma mejorado con dropdown */}
              <div className="form-group relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                <input
                  type="text"
                  name="idioma"
                  placeholder="Escriba el idioma del libro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={languageQuery}
                  onChange={handleLanguageInputChange}
                  onFocus={() => setShowLanguageDropdown(true)}
                  autoComplete="off"
                />
                {showLanguageDropdown && (
                  <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg">
                    {isLoadingLanguages ? (
                      <div className="p-2 text-center text-gray-500">Cargando idiomas...</div>
                    ) : filteredLanguages.length > 0 ? (
                      filteredLanguages.map((lang, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-blue-100 cursor-pointer"
                          onClick={() => selectLanguage(lang)}
                        >
                          {lang}
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-center text-gray-500">No se encontraron resultados</div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Campo Fecha mejorado con formato de fecha */}
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de publicación</label>
                <input
                  type="date"
                  name="fecha"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.fecha}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  name="estado"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.estado}
                  onChange={handleChange}
                >
                  <option value="Nuevo">Nuevo</option>
                  <option value="Usado">Usado</option>
                  <option value="Deteriorado">Deteriorado</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                <input
                  type="number"
                  name="precio"
                  placeholder="Escriba el precio del libro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.precio}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                <input
                  type="number"
                  name="stock"
                  placeholder="Cantidad disponible"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.stock}
                  onChange={handleChange}
                  min="0"
                />
              </div>

              <div className="form-group">
  <label className="block text-sm font-medium text-gray-700 mb-1">Descuento (%)</label>
  <input
    type="number"
    name="valor"
    placeholder="Porcentaje descuento"
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    value={discountData.valor}
    onChange={(e) => {
      let value = e.target.value;

      // Allow empty string so user can clear the field
      if (value === '') {
        handleDiscountChange({
          target: { name: 'valor', value: '' }
        });
        return;
      }

      let numericValue = Number(value);

      if (isNaN(numericValue)) return;

      // Clamp to range 0-100
      if (numericValue < 0) numericValue = 0;
      if (numericValue > 100) numericValue = 100;

      // Update with the clamped value
      handleDiscountChange({
        target: { name: 'valor', value: numericValue.toString() }
      });
    }}
    min="0"
    max="100"
  />
</div>

{showDiscountDates && (
  <>
    <div className="form-group">
      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio descuento</label>
      <input
        type="datetime-local"
        name="fecha_inicio"
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={discountData.fecha_inicio}
        onChange={handleDiscountChange}
      />
    </div>
    
    <div className="form-group">
      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin descuento</label>
      <input
        type="datetime-local"
        name="fecha_fin"
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={discountData.fecha_fin}
        onChange={handleDiscountChange}
      />
    </div>
  </>
)}



            </div>
            
            {/* Campo Descripción (full width) */}
            <div className="form-group mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                name="descripcion"
                placeholder="Escriba una descripción del libro"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.descripcion}
                onChange={handleChange}
                rows="4"
              />
            </div>

            {formMessage.text && (
              <div className={`mt-3 p-3 rounded ${formMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {formMessage.text}
              </div>
            )}
            
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
              >
                Regresar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || (!isEditMode && (checkingStores || hasActiveStores === false))}
                title={!isEditMode && hasActiveStores === false ? 'Debes crear al menos una tienda activa primero' : ''}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  isEditMode ? 'Actualizar' : 'Agregar'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BookEditor;