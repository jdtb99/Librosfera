import React from 'react';

const DeliveryTracking = ({ envio }) => {
  // Estado actual del envío
  const currentState = envio.estado_envio;
  
  // Función para formatear fechas
  const formatDate = (dateString) => {
    if (!dateString) return 'Pendiente';
    
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Mexico_City'
    };
    return new Date(dateString).toLocaleDateString('es-MX', options);
  };
  
  // Crear URL de seguimiento según la empresa de transporte
  const getTrackingUrl = () => {
    if (!envio.codigo_seguimiento) return null;
    
    const urlBase = {
      'servientrega': 'https://www.servientrega.com/tracking?guia=',
      'coordinadora': 'https://www.coordinadora.com/portafolio-de-servicios/servicios-en-linea/rastrear-guias/?guia=',
      'deprisa': 'https://www.deprisa.com/Tracking/index.html?trackings=',
      'inter_rapidisimo': 'https://www.interrapidisimo.com/sigue-tu-envio/?guia=',
      'default': 'https://www.libreria.com/seguimiento?codigo='
    };
    
    const baseUrl = urlBase[envio.empresa_transporte?.toLowerCase()] || urlBase.default;
    return `${baseUrl}${envio.codigo_seguimiento}`;
  };
  
  // Definir pasos de seguimiento
  const steps = [
    {
      id: 'processing',
      label: 'En preparación',
      description: 'Tu pedido está siendo preparado',
      //date: envio.fechas.creacion,
      completed: currentState === 'EN PREPARACION' || currentState === 'ENVIADO' || currentState === 'ENTREGADO',
      current: currentState === 'EN PREPARACION'
    },
    {
      id: 'shipped',
      label: 'Enviado',
      description: 'Tu pedido está en camino',
      //date: envio.fechas.salida,
      completed: currentState === 'ENVIADO' || currentState === 'ENTREGADO',
      current: currentState === 'ENVIADO'
    },
    {
      id: 'delivered',
      label: 'Entregado',
      description: 'Tu pedido ha sido entregado',
      //date: envio.fechas.entrega_real,
      completed: currentState === 'ENTREGADO',
      current: currentState === 'ENTREGADO'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">Seguimiento de Envío</h3>
        <p className="text-gray-600">
          Tu pedido está {
            currentState === 'EN PREPARACION' ? 'siendo preparado' :
            currentState === 'ENVIADO' ? 'en camino' :
            currentState === 'ENTREGADO' ? 'entregado' : 'en proceso'
          }
        </p>
        
        {/* Información de seguimiento si existe */}
        {envio.codigo_seguimiento && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <p className="font-medium">Empresa de transporte: {envio.empresa_transporte}</p>
                <p className="text-gray-600">Número de seguimiento: {envio.codigo_seguimiento}</p>
              </div>
              {getTrackingUrl() && (
                <a 
                  href={getTrackingUrl()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-3 sm:mt-0 inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition-colors"
                >
                  Seguimiento externo
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Timeline de seguimiento */}
      <div className="p-6">
        <div className="relative">
          {/* Línea vertical conectora */}
          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-200"></div>
          
          {/* Pasos de la línea de tiempo */}
          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={step.id} className="relative">
                <div className="flex items-start">
                  {/* Indicador del paso */}
                  <div className={`z-10 flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 ${
                    step.completed 
                      ? step.current 
                        ? 'bg-green-500 ring-4 ring-green-100' 
                        : 'bg-green-500'
                      : 'bg-gray-200'
                  }`}>
                    {step.completed ? (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-gray-600">{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Contenido del paso */}
                  <div className="ml-4">
                    <h4 className={`font-bold ${step.current ? 'text-green-600' : 'text-gray-800'}`}>
                      {step.label}
                    </h4>
                    <p className="text-gray-600">{step.description}</p>
                    <p className={`text-sm mt-1 ${step.completed ? 'text-green-600' : 'text-gray-500'}`}>
                      {step.completed ? formatDate(step.date) : 'Pendiente'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Detalles específicos del envío */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="font-bold text-gray-800 mb-4">Historial detallado</h4>
          <div className="space-y-4">
            {envio.historial_estados.map((evento, index) => (
              <div key={index} className="flex">
                <div className="w-20 flex-shrink-0 text-sm text-gray-500">
                  {new Date(evento.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="flex-grow">
                  <p className="font-medium">{
                    evento.estado_nuevo === 'EN PREPARACION' ? 'Pedido en preparación' :
                    evento.estado_nuevo === 'ENVIADO' ? 'Pedido enviado' :
                    evento.estado_nuevo === 'ENTREGADO' ? 'Pedido entregado' : evento.estado_nuevo
                  }</p>
                  <p className="text-sm text-gray-600">{evento.descripcion}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(evento.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryTracking;