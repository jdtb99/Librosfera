// CachedImage.js
import React, { useState, useEffect } from 'react';
import imageCacheService from './ImageCacheService';

const CachedImage = ({ 
  src, 
  alt, 
  className, 
  fallbackSrc = `${process.env.REACT_APP_API_URL}/uploads/libros/Default.png`,
  onClick 
}) => {
  // Always use the default fallback if none provided explicitly
  const defaultFallback = `${process.env.REACT_APP_API_URL}/uploads/libros/Default.png`;
  const actualFallbackSrc = fallbackSrc || defaultFallback;
  
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (!src) {
      setError(true);
      setLoading(false);
      return;
    }

    let mounted = true;
    const loadCachedImage = async () => {
      try {
        // If we're already using the fallback, don't try to load again
        if (usingFallback) return;
        
        // Determine which URL to use (original or fallback)
        const urlToLoad = error ? defaultFallback : src;
        
        console.log("Attempting to load image:", urlToLoad);
        
        // Intenta cargar la imagen desde el servicio de caché
        const cachedImageUrl = await imageCacheService.loadImage(urlToLoad);
        
        if (mounted) {
          if (cachedImageUrl) {
            setImageSrc(cachedImageUrl);
            setLoading(false);
            if (urlToLoad === defaultFallback) {
              setUsingFallback(true);
            }
          } else {
            // Si no se pudo cargar desde la caché, intentamos con el fallback
            if (urlToLoad !== defaultFallback && !usingFallback) {
              console.log("Original image failed, trying default fallback:", defaultFallback);
              setError(true);
              // We'll let the effect run again with error=true
            } else {
              // Even the fallback failed
              console.error("Both original and fallback images failed to load");
              setError(true);
              setLoading(false);
              setUsingFallback(true); // Prevent further retries
            }
          }
        }
      } catch (err) {
        console.error('Error loading cached image:', err);
        if (mounted) {
          if (!usingFallback && src !== defaultFallback) {
            console.log("Error with original image, trying default fallback:", defaultFallback);
            setError(true);
            // Let the effect run again with error=true
          } else {
            // Even the fallback failed or we were already using fallback
            console.error("Failed to load fallback image too");
            setError(true);
            setLoading(false);
            setUsingFallback(true); // Prevent further retries
          }
        }
      }
    };

    loadCachedImage();

    // Limpieza al desmontar
    return () => {
      mounted = false;
      // Revocar URL de objeto si existe para evitar fugas de memoria
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src, error, defaultFallback, usingFallback]);

  // If we're loading, show loading indicator
  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="animate-pulse w-8 h-8 border-4 border-blue-300 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If no image is available despite all retries, render the fallback directly
  if ((error || !imageSrc) && !usingFallback) {
    // For direct rendering of fallback without going through the cache
    return (
      <img 
        src={defaultFallback} 
        alt={alt || 'Image not available'} 
        className={className}
        onClick={onClick}
      />
    );
  }

  // Otherwise, render the successfully loaded image
  return (
    <img 
      src={imageSrc} 
      alt={alt} 
      className={className} 
      onClick={onClick}
      onError={(e) => {
        console.error(`Error displaying cached image: ${src}`);
        if (!usingFallback) {
          setError(true); // This will trigger the effect to run again with the fallback
        } else {
          // If we're already using the fallback and still got an error,
          // there's not much more we can do
          console.error("Even fallback image failed to display");
        }
        
        // Limpiar el URL del objeto si es un blob
        if (imageSrc && imageSrc.startsWith('blob:')) {
          URL.revokeObjectURL(imageSrc);
        }
      }}
    />
  );
};

export default CachedImage;