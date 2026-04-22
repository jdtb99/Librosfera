import React from 'react';

const StorePickupTracking = ({ envio }) => {
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
  
  // Definir pasos de seguimiento (diferentes para recogida en tienda)
  const steps = [
    {
      id: 'processing',
      label: 'En preparación',
      description: 'Tu pedido está siendo preparado',
      date: envio.fechas.creacion,
      completed: currentState === 'EN PREPARACION' || currentState === 'ENVIADO' || currentState === 'ENTREGADO',
      current: currentState === 'EN PREPARACION'
    },
    {
      id: 'ready',
      label: 'Listo para recoger',
      description: 'Tu pedido está listo para recoger en tienda',
      date: envio.fechas.salida,
      completed: currentState === 'ENVIADO' || currentState === 'ENTREGADO',
      current: currentState === 'ENVIADO'
    },
    {
      id: 'delivered',
      label: 'Recogido',
      description: 'Has recogido tu pedido',
      date: envio.fechas.entrega_real,
      completed: currentState === 'ENTREGADO',
      current: currentState === 'ENTREGADO'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">Recogida en Tienda</h3>
        <p className="text-gray-600">
          Tu pedido {
            currentState === 'EN PREPARACION' ? 'está siendo preparado' :
            currentState === 'ENVIADO' ? 'está listo para recoger en la tienda' :
            currentState === 'ENTREGADO' ? 'ha sido recogido' : 'está en proceso'
          }
        </p>
        
        {/* Información de la tienda */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex flex-col md:flex-row justify-between">
            <div>
              <h4 className="font-medium">{envio.tienda.nombre}</h4>
              <p className="text-gray-600">{envio.tienda.direccion}</p>
              <p className="text-sm text-gray-500 mt-1">{envio.tienda.horario}</p>
              <p className="text-sm text-gray-500">Teléfono: {envio.tienda.telefono}</p>
            </div>
            
            {/* Información de recogida */}
            <div className="mt-4 md:mt-0 md:text-right">
              {currentState === 'ENVIADO' && (
                <div className="mb-4">
                  <p className="font-medium text-green-600">Listo para recoger</p>
                  <p className="text-sm text-gray-600">Disponible hasta: {
                    // Fecha límite: 3 días después de estar listo
                    formatDate(new Date(new Date(envio.fechas.salida).getTime() + 3 * 24 * 60 * 60 * 1000))
                  }</p>
                </div>
              )}
              
              {/* QR de recogida simulado */}
              {currentState === 'ENVIADO' && (
                <div className="flex justify-center md:justify-end">
                  <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                    <div className="text-xs text-gray-500 text-center">Código QR<br/>de recogida</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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
        
        {/* Mapa de ubicación de la tienda */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="font-bold text-gray-800 mb-4">Ubicación de la tienda</h4>
          
          {/* Mapa simulado */}
          <div className="h-64 bg-gray-200 rounded-lg relative">
            <div className="absolute inset-0 flex items-center justify-center bg-gray-300">
              <div className="text-center text-gray-600">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p>{envio.tienda.nombre}</p>
                <p className="text-sm">{envio.tienda.direccion}</p>
                <p className="text-xs mt-2">(Integración con Google Maps en implementación final)</p>
              </div>
            </div>
            
            {/* Botones de control del mapa */}
            <div className="absolute right-4 bottom-4 flex flex-col bg-white rounded-md shadow">
              <button className="p-2 hover:bg-gray-100 border-b">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Instrucciones de recogida */}
          <div className="mt-6">
            <h5 className="font-medium text-gray-800 mb-2">Instrucciones para recoger tu pedido</h5>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Dirígete a la tienda seleccionada durante el horario de atención</li>
              <li>Presenta tu código QR o número de pedido en el mostrador de atención al cliente</li>
              <li>Un representante verificará tu identidad y te entregará tu pedido</li>
              <li>Revisa que todos los productos estén en buen estado antes de retirarte</li>
            </ul>
          </div>
          
          {/* Información adicional */}
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
            <p className="font-medium">Importante:</p>
            <p>Tu pedido estará disponible para recoger durante 3 días a partir de la fecha de disponibilidad. Si no puedes recogerlo en ese tiempo, contacta con servicio al cliente.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorePickupTracking;