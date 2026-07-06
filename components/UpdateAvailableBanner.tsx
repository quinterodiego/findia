'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export default function UpdateAvailableBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Solo funciona si hay un service worker registrado
    if ('serviceWorker' in navigator) {
      let refreshing = false;

      // Detectar cuando hay una nueva versión del service worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        // Recargar la página cuando se activa el nuevo service worker
        window.location.reload();
      });

      const checkForUpdates = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          
          // Verificar actualizaciones inmediatamente y luego periódicamente
          registration.update();
          
          // Escuchar cuando hay una nueva versión disponible
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing || registration.waiting;
            
            if (newWorker) {
              const stateChangeHandler = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Hay una nueva versión esperando
                  setUpdateAvailable(true);
                  newWorker.removeEventListener('statechange', stateChangeHandler);
                } else if (newWorker.state === 'activated') {
                  // El nuevo worker se activó, recargar
                  window.location.reload();
                }
              };
              
              // Si ya está instalado pero esperando, mostrar banner inmediatamente
              if (newWorker.state === 'installed') {
                setUpdateAvailable(true);
              } else {
                newWorker.addEventListener('statechange', stateChangeHandler);
              }
            }
          });
        } catch (error) {
        }
      };

      // Verificar actualizaciones al cargar
      checkForUpdates();

      // Verificar actualizaciones periódicamente (cada 60 segundos)
      const updateInterval = setInterval(checkForUpdates, 60 * 1000);

      // También verificar cuando la página vuelve a tener foco
      const handleFocus = () => {
        checkForUpdates();
      };
      
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(updateInterval);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        // Si hay un worker esperando, activarlo
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // Forzar actualización del service worker
        await registration.update();
        
        // Recargar la página después de un breve delay
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error('Error updating service worker:', error);
      // Si hay error, recargar de todas formas
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    // No mostrar de nuevo hasta la próxima actualización
    localStorage.setItem('update-banner-dismissed', Date.now().toString());
  };

  if (!updateAvailable) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-24 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:w-96"
      >
        <div className="bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] text-white rounded-xl shadow-2xl p-4 border border-[#FF3A5F]/20">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">
                Nueva versión disponible
              </h3>
              <p className="text-xs text-white/90 mb-3">
                Hay una actualización lista. Recarga para disfrutar de las nuevas características.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-[#FF3A5F] rounded-lg hover:bg-gray-50 transition-colors text-xs font-semibold disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isUpdating ? 'animate-spin' : ''}`} />
                  {isUpdating ? 'Actualizando...' : 'Actualizar ahora'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-xs font-medium"
                >
                  Después
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
