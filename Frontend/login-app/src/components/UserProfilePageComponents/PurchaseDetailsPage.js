import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAuthToken } from './authUtils';
import CachedImage from '../CachedImage';

// Componentes auxiliares para diferentes tipos de seguimiento
import DeliveryTracking from './DeliveryTracking';
import StorePickupTracking from './StorePickupTracking';

const PurchaseDetailsPage = () => {
  const { purchaseId } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPurchaseDetails();
  }, [purchaseId]);

  const fetchPurchaseDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("Details id:", purchaseId);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/ventas/${purchaseId}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      console.log("response:", response.data);

      if (response.data.status === 'success') {
        setPurchase(response.data.data.venta);
      }
    } catch (err) {
      console.error('Error fetching purchase details:', err);
      const mockData = generateMockPurchaseData(purchaseId);
      setPurchase(mockData);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockPurchaseData = (id) => {
    const isDelivery = Math.random() > 0.5;
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - 3);
    
    const processingDate = new Date(orderDate);
    processingDate.setHours(orderDate.getHours() + 2);
    
    const shippingDate = new Date(processingDate);
    shippingDate.setDate(processingDate.getDate() + 1);
    
    const deliveryDate = new Date(shippingDate);
    deliveryDate.setDate(shippingDate.getDate() + 1);
    
    const possibleStates = ['EN PREPARACION', 'ENVIADO', 'ENTREGADO'];
    const randomStateIndex = Math.floor(Math.random() * 3);
    const currentState = possibleStates[randomStateIndex];
    
    let stateHistory = [
      {
        estado_anterior: null,
        estado_nuevo: 'EN PREPARACION',
        fecha: processingDate.toISOString(),
        descripcion: 'Pedido recibido y en preparación'
      }
    ];
    
    if (randomStateIndex >= 1) {
      stateHistory.push({
        estado_anterior: 'EN PREPARACION',
        estado_nuevo: 'ENVIADO',
        fecha: shippingDate.toISOString(),
        descripcion: 'Pedido enviado al destino'
      });
    }
    
    if (randomStateIndex >= 2) {
      stateHistory.push({
        estado_anterior: 'ENVIADO',
        estado_nuevo: 'ENTREGADO',
        fecha: deliveryDate.toISOString(),
        descripcion: 'Pedido entregado satisfactoriamente'
      });
    }
    
    return {
      _id: id,
      numero_venta: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
      fecha_creacion: orderDate.toISOString(),
      estado: currentState === 'ENTREGADO' ? 'entregado' : 
              currentState === 'ENVIADO' ? 'enviado' : 'procesando',
      items: [
        {
          snapshot: {
            titulo: 'Cien años de soledad',
            autor: 'Gabriel García Márquez',
            editorial: 'Editorial Sudamericana',
            isbn: '9780307474728',
            imagen_portada: `${process.env.REACT_APP_API_URL}/uploads/libros/cien-anios-soledad.jpg`
          },
          cantidad: 1,
          precio_unitario: 35000
        },
        {
          snapshot: {
            titulo: 'El amor en los tiempos del cólera',
            autor: 'Gabriel García Márquez',
            editorial: 'Editorial Oveja Negra',
            isbn: '9780307387264',
            imagen_portada: `${process.env.REACT_APP_API_URL}/uploads/libros/amor-tiempos-colera.jpg`
          },
          cantidad: 1,
          precio_unitario: 32000
        }
      ],
      totales: {
        subtotal: 67000,
        descuentos: 0,
        impuestos: 12730,
        envio: isDelivery ? 7000 : 0,
        total_final: isDelivery ? 86730 : 79730
      },
      envio: {
        tipo: isDelivery ? 'domicilio' : 'tienda',
        direccion: isDelivery ? {
          calle: 'Carrera 7 #156-68',
          ciudad: 'Pereira',
          estado_provincia: 'Risaralda',
          codigo_postal: '660001',
          pais: 'Colombia'
        } : null,
        tienda: !isDelivery ? {
          id: 3,
          nombre: 'Centro Comercial Victoria',
          direccion: 'C.C. Victoria Plaza Local 235',
          ciudad: 'Pereira',
          telefono: '3332223',
          horario: 'Lu a Do: 10 a 20 hs.',
          coordenadas: { lat: 4.8156, lng: -75.6936 }
        } : null,
        estado_envio: currentState,
        costo_envio: isDelivery ? 7000 : 0,
        codigo_seguimiento: isDelivery && randomStateIndex >= 1 ? 'SER' + Math.floor(1000000000 + Math.random() * 9000000000) : null,
        empresa_transporte: isDelivery && randomStateIndex >= 1 ? 'servientrega' : null,
        fechas: {
          creacion: orderDate.toISOString(),
          preparacion_completada: randomStateIndex >= 1 ? processingDate.toISOString() : null,
          salida: randomStateIndex >= 1 ? shippingDate.toISOString() : null,
          entrega_estimada: isDelivery ? deliveryDate.toISOString() : shippingDate.toISOString(),
          entrega_real: randomStateIndex >= 2 ? deliveryDate.toISOString() : null
        },
        historial_estados: stateHistory
      },
      pago: {
        metodo: 'tarjeta_credito',
        estado: 'completado',
        ultimos_digitos: '4242'
      }
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible';
    
    try {
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Mexico_City'
      };
      return new Date(dateString).toLocaleDateString('es-MX', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Fecha inválida';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getPaymentMethodText = (metodo) => {
    switch (metodo) {
      case 'tarjeta_debito':
        return 'Tarjeta de Débito';
      case 'tarjeta_credito':
        return 'Tarjeta de Crédito';
      case 'efectivo':
        return 'Efectivo';
      case 'transferencia':
        return 'Transferencia';
      default:
        return metodo;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ENTREGADO':
      case 'entregado':
        return 'bg-green-100 text-green-800';
      case 'ENVIADO':
      case 'enviado':
        return 'bg-blue-100 text-blue-800';
      case 'EN PREPARACION':
      case 'procesando':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELADO':
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'ENTREGADO':
      case 'entregado':
        return 'Entregado';
      case 'ENVIADO':
      case 'enviado':
        return 'Enviado';
      case 'EN PREPARACION':
      case 'procesando':
        return 'En preparación';
      case 'CANCELADO':
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="w-full p-6">
        <div className="mb-6">
          <button 
            onClick={() => navigate('/profile/purchases')}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-2"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Volver</span>
          </button>
          <h2 className="text-2xl font-bold">Cargando detalles...</h2>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-6 bg-gray-200 rounded col-span-1"></div>
                <div className="h-6 bg-gray-200 rounded col-span-2"></div>
              </div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6">
        <div className="mb-6">
          <button 
            onClick={() => navigate('/profile/purchases')}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-2"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Volver</span>
          </button>
          <h2 className="text-2xl font-bold">Detalles de la compra</h2>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchPurchaseDetails}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Verificación adicional para prevenir errores de estructura de datos
  if (!purchase || !purchase.envio) {
    return (
      <div className="w-full p-6">
        <div className="mb-6">
          <button 
            onClick={() => navigate('/profile/purchases')}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-2"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Volver</span>
          </button>
          <h2 className="text-2xl font-bold">Detalles de la compra</h2>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Datos de la compra incompletos</p>
            <button
              onClick={fetchPurchaseDetails}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-gray-50">
      {/* Encabezado con botón de regreso */}
      <div className="mb-6">
        <button 
          onClick={() => navigate('/profile')}
          className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-2"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Volver a mis compras</span>
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Seguimiento de Compra #{purchase.numero_venta}</h2>
      </div>
      
      {/* Información general del pedido */}
      <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-4">
            <div>
              <div className="flex items-center">
                <h3 className="text-xl font-bold text-gray-800">Orden #{purchase.numero_venta}</h3>
                <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.envio.estado_envio)}`}>
                  {getStatusText(purchase.envio.estado_envio)}
                </span>
              </div>
              <p className="text-gray-600 mt-1">Realizada el {formatDate(purchase.fecha_creacion)}</p>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {purchase.envio.tipo === 'domicilio' ? 'Envío a Domicilio' : 'Recogida en Tienda'}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Información de pago */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Método de pago
              </h4>
              <p className="text-sm text-gray-600">
                {getPaymentMethodText(purchase.pago?.metodo)}
                {purchase.pago?.ultimos_digitos && ` ****${purchase.pago.ultimos_digitos}`}
              </p>
            </div>
            
            {/* Dirección de envío o tienda de recogida */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {purchase.envio.tipo === 'domicilio' ? 'Dirección de envío' : 'Tienda de recogida'}
              </h4>
              {purchase.envio.tipo === 'domicilio' ? (
                <p className="text-sm text-gray-600">
                  {purchase.envio.direccion ? 
                    `${purchase.envio.direccion.calle}, ${purchase.envio.direccion.ciudad}, ${purchase.envio.direccion.estado_provincia}` :
                    'Dirección no disponible'
                  }
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  {purchase.envio.tienda ? 
                    `${purchase.envio.tienda.nombre}, ${purchase.envio.tienda.direccion}` :
                    'Información de tienda no disponible'
                  }
                </p>
              )}
            </div>
            
            {/* Fecha estimada */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {purchase.envio.estado_envio === 'ENTREGADO' 
                  ? 'Entregado el' 
                  : 'Fecha estimada de entrega'}
              </h4>
              <p className="text-sm text-gray-600">
                {purchase.envio.estado_envio === 'ENTREGADO' 
                  ? formatDate(purchase.envio.fechas?.entrega_real)
                  : formatDate(purchase.envio.fechas?.entrega_estimada)}
              </p>
            </div>
          </div>
        </div>
        
        {/* Productos en el pedido */}
        <div className="p-6">
          <h4 className="font-medium text-gray-700 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Productos en tu pedido
          </h4>
          <div className="space-y-4">
            {purchase.items?.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-start mb-3 sm:mb-0">
                  {/* Imagen del libro con CachedImage similar a CartPage */}
                  <div className="w-24 h-32 flex-shrink-0 bg-gray-100 rounded overflow-hidden mr-4">
                    {item.snapshot?.imagen_portada ? (
                      <CachedImage 
                        src={item.snapshot.imagen_portada} 
                        alt={item.snapshot.titulo || "Libro"} 
                        className="w-full h-full object-contain"
                        fallbackSrc={`${process.env.REACT_APP_API_URL}/uploads/libros/Default.png`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{item.snapshot?.titulo || 'Título no disponible'}</p>
                    <p className="text-sm text-gray-600 mb-1">por {item.snapshot?.autor || 'Autor no disponible'}</p>
                    {item.snapshot?.editorial && (
                      <p className="text-xs text-gray-500 mb-1">
                        Editorial: {item.snapshot.editorial}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">ISBN: {item.snapshot?.isbn || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex justify-between sm:flex-col sm:items-end">
                  <p className="text-sm text-gray-600 sm:mb-1">Cantidad: {item.cantidad || 0}</p>
                  <p className="font-medium text-gray-800">{formatCurrency((item.precio_unitario || 0) * (item.cantidad || 0))}</p>
                </div>
              </div>
            )) || <p className="text-gray-500">No hay productos disponibles</p>}
          </div>
          
          {/* Resumen de costos */}
          {purchase.totales && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(purchase.totales.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Impuestos</span>
                <span>{formatCurrency(purchase.totales.impuestos || 0)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Envío</span>
                {(purchase.totales.envio || 0) > 0 ? (
                  <span>{formatCurrency(purchase.totales.envio)}</span>
                ) : (
                  <span className="text-green-600">Gratis</span>
                )}
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-bold text-blue-600 text-lg">{formatCurrency(purchase.totales.total_final || 0)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Componente de seguimiento según tipo de envío */}
      {purchase.envio.tipo === 'domicilio' ? (
        <DeliveryTracking envio={purchase.envio} />
      ) : (
        <StorePickupTracking envio={purchase.envio} />
      )}
      
      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
        {/* Mostrar botón de devolución solo si el pedido está entregado y tiene menos de 8 días */}
        {purchase.envio.estado_envio === 'ENTREGADO' && 
          purchase.envio.fechas?.entrega_real &&
          new Date() - new Date(purchase.envio.fechas.entrega_real) < 8 * 24 * 60 * 60 * 1000 && (
          <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-md transition-colors shadow-sm font-medium">
            Solicitar Devolución
          </button>
        )}
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors shadow-sm font-medium">
          Contactar Soporte
        </button>
      </div>
    </div>
  );
};

export default PurchaseDetailsPage;
