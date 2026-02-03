import { useState, useEffect } from 'react';
import { checkVersion } from '../services/versionChecker';

export function VersionCheckModal() {
  const [showModal, setShowModal] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const performVersionCheck = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const shouldReload = await checkVersion();
      if (shouldReload) {
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error checking version:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Verificar al montar
    performVersionCheck();

    // Verificar cuando el usuario regresa a la pestaña
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performVersionCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  if (!showModal) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-black-asphalt border-2 border-orange-primary rounded-lg shadow-2xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <svg 
            className="h-6 w-6 text-orange-primary" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
          <h2 className="text-xl font-bold text-white-pure">
            Nueva versión disponible
          </h2>
        </div>
        
        <p className="text-white-pure/80 mb-6 leading-relaxed">
          Hay una nueva versión de la aplicación disponible. 
          Por favor, recarga la página para obtener la última versión.
        </p>
        
        <div className="flex justify-center">
          <button
            onClick={handleReload}
            className="bg-orange-primary hover:bg-orange-primary/90 text-white-pure font-semibold px-6 py-3 rounded-lg transition-colors w-full sm:w-auto"
          >
            Recargar ahora
          </button>
        </div>
      </div>
    </div>
  );
}
