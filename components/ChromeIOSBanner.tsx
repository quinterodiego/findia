'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

export default function ChromeIOSBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalado
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true ||
                        localStorage.getItem('pwa-install-accepted') === 'true';
    
    if (isInstalled) {
      setShowBanner(false);
      return;
    }

    const isIOSChrome = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);
    
    if (isIOSChrome) {
      const dismissed = localStorage.getItem('chrome-ios-banner-dismissed');
      const dismissedTimestamp = localStorage.getItem('chrome-ios-banner-dismissed-timestamp');
      
      // Verificar si se desestimó hace menos de 24 horas
      if (dismissedTimestamp) {
        const dismissedDate = new Date(dismissedTimestamp);
        const now = new Date();
        const hoursSinceDismiss = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceDismiss < 24) {
          setShowBanner(false);
          return;
        }
      }
      
      if (dismissed !== 'true') {
        setTimeout(() => {
          // Verificar nuevamente antes de mostrar
          const stillInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                                 (window.navigator as any).standalone === true;
          if (!stillInstalled) {
            setShowBanner(true);
          }
        }, 2000); // Show after 2 seconds
      }
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('chrome-ios-banner-dismissed-timestamp', new Date().toISOString());
  };

  const handleDismissPermanently = () => {
    setShowBanner(false);
    localStorage.setItem('chrome-ios-banner-dismissed', 'true');
    localStorage.setItem('chrome-ios-banner-dismissed-timestamp', new Date().toISOString());
  };

  const handleOpenInSafari = () => {
    // Crear un enlace que abra en Safari
    const url = window.location.href;
    const safariUrl = `x-safari-https://${url.replace(/^https?:\/\//, '')}`;
    
    // Intentar abrir en Safari
    window.location.href = safariUrl;
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 bg-gradient-to-r from-[#FF3A5F]/10 to-[#FF007A]/10 dark:from-[#FF3A5F]/20 dark:to-[#FF007A]/20 border border-[#FF3A5F]/20 dark:border-[#FF3A5F]/30 rounded-lg shadow-lg p-4 max-w-sm mx-auto">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">💡</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Mejor Experiencia Disponible
            </h3>
          </div>
          <p className="text-xs text-gray-700 dark:text-gray-300 mb-3">
            Para instalar FindIA como app y disfrutar de funcionalidad offline, 
            abre esta página en Safari y usa "Agregar a pantalla de inicio".
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleOpenInSafari}
              className="flex items-center gap-2 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:from-[#FF3A5F] hover:to-[#FF007A] hover:opacity-90 text-white text-xs px-3 py-2 rounded-md transition-colors"
            >
              <ExternalLink size={12} />
              Abrir en Safari
            </button>
            <button
              onClick={handleDismiss}
              className="text-[#FF3A5F] hover:text-[#FF007A] dark:text-[#FF3A5F] dark:hover:text-[#FF007A] text-xs px-3 py-2 rounded-md transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button
          onClick={handleDismissPermanently}
          className="text-gray-400 hover:text-[#FF3A5F] dark:hover:text-[#FF007A] ml-2 transition-colors"
          title="No mostrar más"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
