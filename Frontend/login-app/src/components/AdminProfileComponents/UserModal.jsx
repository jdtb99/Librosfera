import React, { useCallback } from 'react';
import CachedImage from '../CachedImage';

const UserModal = React.memo(({ 
    modalMode, 
    selectedUser, 
    editFormData, 
    handleInputChange,
    handleSubmit, 
    setIsModalOpen, 
    isSubmitting, 
    formErrors, 
    actionMessage,
    handleToggleUserStatus,
    getProfileImageSrc,
    formatDate,
    getUserTypeLabel,
    DEFAULT_PROFILE_PIC,
    handleProfilePicChange,
    handleDeleteProfilePic,
    isUploadingProfilePic,
    setModalMode,
    // Add this new prop
    prepareUserForEdit
  }) => {
  
  // Esta función local mejora la estabilidad del evento onClick
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, [setIsModalOpen]);

  if (!selectedUser) return null;

  const isRestrictedUser = selectedUser.tipo_usuario === 'administrador' || selectedUser.tipo_usuario === 'root';

  // View User Details Modal
  if (modalMode === 'view') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-3xl p-6 relative max-h-[90vh] overflow-y-auto">
          <button 
            onClick={closeModal}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
            
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            Detalles del Usuario
            <div className="ml-3">
              {getUserTypeLabel(selectedUser.tipo_usuario)}
            </div>
            <div className="ml-auto">
              {selectedUser.activo ? (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">Activo</span>
              ) : (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">Inactivo</span>
              )}
            </div>
          </h2>
            
          <div className="flex items-center mb-6">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-200 mr-4">
              <CachedImage 
                src={getProfileImageSrc(selectedUser)}
                alt={selectedUser.usuario || 'Usuario'} 
                className="w-full h-full object-cover"
                fallbackSrc={DEFAULT_PROFILE_PIC}
                fallbackComponent={
                  <div className="w-full h-full flex items-center justify-center bg-yellow-200">
                    <span className="text-2xl font-bold text-yellow-500">
                      {selectedUser.usuario?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                }
              />
            </div>
            <div>
              <h3 className="text-xl font-semibold">{selectedUser.usuario}</h3>
              <p className="text-gray-600">{selectedUser.email}</p>
            </div>
          </div>
            
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">INFORMACIÓN BÁSICA</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre completo</p>
                  <p className="font-medium">{selectedUser.nombres} {selectedUser.apellidos}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">DNI</p>
                  <p className="font-medium">{selectedUser.DNI || 'No disponible'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="font-medium">{selectedUser.telefono || 'No disponible'}</p>
                </div>
                {selectedUser.telefono_alternativo && (
                  <div>
                    <p className="text-sm text-gray-500">Teléfono alternativo</p>
                    <p className="font-medium">{selectedUser.telefono_alternativo}</p>
                  </div>
                )}
                {selectedUser.cargo && (
                  <div>
                    <p className="text-sm text-gray-500">Cargo</p>
                    <p className="font-medium">{selectedUser.cargo}</p>
                  </div>
                )}
              </div>
            </div>
              
            <div>
              {selectedUser.direcciones && selectedUser.direcciones.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">DIRECCIÓN</h3>
                  <div className="space-y-3">
                    {selectedUser.direcciones.map((dir, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium">{dir.tipo || 'Principal'}</p>
                        <p className="text-sm">{dir.calle}</p>
                        <p className="text-sm">{dir.codigo_postal}, {dir.ciudad}</p>
                        <p className="text-sm">{dir.pais}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
                
              <h3 className="text-sm font-semibold text-gray-500 mt-6 mb-2">INFORMACIÓN DE CUENTA</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Fecha de registro</p>
                  <p className="font-medium">{formatDate(selectedUser.fecha_registro)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última actualización</p>
                  <p className="font-medium">{formatDate(selectedUser.fecha_actualizacion)}</p>
                </div>
              </div>
                
              {selectedUser.preferencias && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">PREFERENCIAS</h3>
                  <div className="bg-gray-50 p-3 rounded-md">
                    {selectedUser.preferencias.temas && selectedUser.preferencias.temas.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm text-gray-500">Temas de interés</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedUser.preferencias.temas.map((tema, idx) => (
                            <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              {tema}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                      
                    {selectedUser.preferencias.autores && selectedUser.preferencias.autores.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500">Autores favoritos</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedUser.preferencias.autores.map((autor, idx) => (
                            <span key={idx} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              {autor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
            
          <div className="mt-8 flex justify-end space-x-3">
            {!isRestrictedUser && (
              <>
                <button
                onClick={() => {
                    // We need to ensure the form data is populated before opening the edit modal
                    closeModal();
                    
                    // We need to pass the user data back to the parent component to set editFormData
                    // This requires adding a new prop called 'prepareUserForEdit'
                    setTimeout(() => {
                    prepareUserForEdit(selectedUser);
                    setModalMode('edit');
                    setIsModalOpen(true);
                    }, 100);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                Editar Usuario
                </button>
                <button
                onClick={() => {
                    closeModal();
                    setTimeout(() => {
                    setModalMode('delete');
                    setIsModalOpen(true);
                    }, 100);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded"
                >
                {selectedUser.activo ? 'Desactivar' : 'Activar'} Usuario
                </button>
              </>
            )}
            <button
              onClick={closeModal}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }
    
  // Edit User Form Modal
  if (modalMode === 'edit') {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              disabled={isSubmitting}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Editar Usuario
            </h2>
            
            {actionMessage.text && (
              <div className={`p-4 mb-4 rounded ${
                actionMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {actionMessage.text}
              </div>
            )}
            
            {/* Profile Picture Section - New addition */}
            <div className="mb-6 flex flex-col items-center">
              <div className="relative h-24 w-24 rounded-full overflow-hidden mb-4 border-2 border-blue-400">
                <CachedImage 
                  src={getProfileImageSrc(selectedUser)}
                  alt={selectedUser.usuario || 'Usuario'} 
                  className="w-full h-full object-cover"
                  fallbackSrc={DEFAULT_PROFILE_PIC}
                  fallbackComponent={
                    <div className="w-full h-full flex items-center justify-center bg-yellow-200">
                      <span className="text-lg font-bold text-yellow-500">
                        {selectedUser.nombres ? selectedUser.nombres.charAt(0) : selectedUser.usuario.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  }
                />
                {selectedUser.foto_perfil && selectedUser.foto_perfil !== DEFAULT_PROFILE_PIC && (
                  <button 
                    type="button"
                    onClick={handleDeleteProfilePic}
                    disabled={isUploadingProfilePic}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                    title="Eliminar foto"
                  >
                    ×
                  </button>
                )}
              </div>
              
              <div className="flex space-x-2">
                <label className="cursor-pointer bg-blue-600 text-white px-3 py-1 rounded text-sm">
                  Cambiar foto
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleProfilePicChange}
                    disabled={isUploadingProfilePic}
                  />
                </label>
                {selectedUser.foto_perfil && selectedUser.foto_perfil !== DEFAULT_PROFILE_PIC && (
                  <button
                    type="button"
                    onClick={handleDeleteProfilePic}
                    disabled={isUploadingProfilePic}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Eliminar foto
                  </button>
                )}
              </div>
              {isUploadingProfilePic && (
                <div className="mt-2 text-sm text-blue-600 flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando imagen...
                </div>
              )}
            </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombres
                </label>
                <input
                  type="text"
                  name="nombres"
                  value={editFormData.nombres || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellidos
                </label>
                <input
                  type="text"
                  name="apellidos"
                  value={editFormData.apellidos || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DNI
                </label>
                <input
                  type="text"
                  name="DNI"
                  value={editFormData.DNI || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  name="telefono"
                  value={editFormData.telefono || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo / Rol
                </label>
                <input
                  type="text"
                  name="cargo"
                  value={editFormData.cargo || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="activo"
                    checked={editFormData.activo || false}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">Usuario activo</span>
                </label>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña (Dejar en blanco para mantener la actual)
                </label>
                <input
                  type="password"
                  name="password"
                  //value={editFormData.password || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="Nueva contraseña"
                />
              </div>
            </div>
            
            {formErrors.general && (
              <div className="text-red-600 text-sm">
                {formErrors.general}
              </div>
            )}
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded flex items-center"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
    
  // Delete/Deactivate User Confirmation Modal
  if (modalMode === 'delete') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-lg p-6 relative">
          <button 
            onClick={closeModal}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            disabled={isSubmitting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="text-center py-4">
            <div className="h-20 w-20 mx-auto mb-4 rounded-full overflow-hidden">
              <CachedImage 
                src={getProfileImageSrc(selectedUser)}
                alt={selectedUser.usuario || 'Usuario'} 
                className="w-full h-full object-cover"
                fallbackSrc={DEFAULT_PROFILE_PIC}
                fallbackComponent={
                  <div className="w-full h-full flex items-center justify-center bg-yellow-200">
                    <span className="text-4xl font-bold text-yellow-500">
                      {selectedUser.usuario?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                }
              />
            </div>
            
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {selectedUser.activo ? 'Desactivar' : 'Activar'} Usuario
            </h2>
            
            {actionMessage.text && (
              <div className={`p-4 mb-4 rounded ${
                actionMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {actionMessage.text}
              </div>
            )}
            
            <p className="text-gray-600 mb-8">
              ¿Está seguro que desea {selectedUser.activo ? 'desactivar' : 'activar'} al usuario <strong>{selectedUser.usuario}</strong>?
              {selectedUser.activo && (
                <span className="block mt-2 text-sm text-gray-500">
                  El usuario perderá acceso a la plataforma pero sus datos se conservarán.
                </span>
              )}
            </p>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleUserStatus}
                className={`px-4 py-2 ${
                  selectedUser.activo ? 'bg-red-600' : 'bg-green-600'
                } text-white rounded flex items-center justify-center`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Procesando...
                  </>
                ) : (
                  selectedUser.activo ? 'Sí, desactivar' : 'Sí, activar'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
    
  return null;
});

export default UserModal;