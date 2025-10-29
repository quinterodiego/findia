'use client';

import { useState, useEffect } from 'react';
import { X, Download, CheckCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Función mejorada para detectar si la PWA está instalada
function isPWAInstalled(): boolean {
  // Método 1: Verificar display-mode standalone
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Método 2: Verificar si está en modo standalone por window.navigator
  if ((window.navigator as any).standalone === true) {
    return true;
  }

  // Método 3: Verificar referrer (en iOS, cuando está instalado, no hay referrer)
  if (document.referrer.includes('android-app://')) {
    return true;
  }

  // Método 4: Verificar localStorage para instalación confirmada
  const installAccepted = localStorage.getItem('pwa-install-accepted');
  if (installAccepted === 'true') {
    return true;
  }

  return false;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalado
    const installed = isPWAInstalled();
    setIsInstalled(installed);
    
    // Si está instalado, no mostrar el banner
    if (installed) {
      setShowBanner(false);
      return;
    }

    // Verificar si el usuario desestimó el banner recientemente (últimas 24 horas)
    const dismissedTimestamp = localStorage.getItem('pwa-banner-dismissed-timestamp');
    if (dismissedTimestamp) {
      const dismissedDate = new Date(dismissedTimestamp);
      const now = new Date();
      const hoursSinceDismiss = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60);
      
      // Si se desestimó hace menos de 24 horas, no mostrar
      if (hoursSinceDismiss < 24) {
        setShowBanner(false);
        return;
      }
    }

    // Verificar si el usuario desestimó permanentemente
    const permanentlyDismissed = localStorage.getItem('pwa-banner-dismissed');
    if (permanentlyDismissed === 'true') {
      setShowBanner(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Solo mostrar si no está instalado y no se desestimó recientemente
      if (!installed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Para iOS (Safari o Chrome), mostrar banner después de un delay solo si no está instalado
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isIOSChrome = isIOS && /Chrome/.test(navigator.userAgent);
    
    if ((isIOS && isSafari) || isIOSChrome) {
      if (!installed && !permanentlyDismissed && !dismissedTimestamp) {
        setTimeout(() => {
          // Verificar nuevamente antes de mostrar (el usuario pudo haber instalado)
          if (!isPWAInstalled()) {
            setShowBanner(true);
          }
        }, 3000); // Show after 3 seconds
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Si no hay deferredPrompt (iOS), solo cerrar el banner
      handleDismiss();
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        // Marcar como instalado aceptado
        localStorage.setItem('pwa-install-accepted', 'true');
        localStorage.setItem('pwa-banner-dismissed', 'true'); // No mostrar más
        console.log('PWA instalada exitosamente');
        
        // Esperar un momento y verificar si realmente se instaló
        setTimeout(() => {
          if (isPWAInstalled()) {
            setIsInstalled(true);
          }
        }, 1000);
      }
      
      setDeferredPrompt(null);
      setShowBanner(false);
    } catch (error) {
      console.error('Error durante la instalación:', error);
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Guardar timestamp para no mostrar en las próximas 24 horas
    localStorage.setItem('pwa-banner-dismissed-timestamp', new Date().toISOString());
  };

  const handleDismissPermanently = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
    localStorage.setItem('pwa-banner-dismissed-timestamp', new Date().toISOString());
  };

  // No mostrar si está instalado o si el banner está deshabilitado
  if (isInstalled || !showBanner) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isIOSChrome = isIOS && /Chrome/.test(navigator.userAgent);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm mx-auto animate-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {isIOSChrome ? "💡 Mejor Experiencia" : "Instalar FindIA"}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
            {isIOSChrome 
              ? "Para instalar la app, abre esta página en Safari y usa 'Agregar a pantalla de inicio'"
              : isIOS && isSafari 
                ? "Toca el botón Compartir (📤) y selecciona 'Agregar a pantalla de inicio'"
                : "Instala la app para acceso rápido y funcionalidad offline"
            }
          </p>
          <div className="flex gap-2 items-center">
            {isIOSChrome ? (
              <button
                onClick={() => {
                  // Intentar abrir en Safari
                  const url = window.location.href;
                  const safariUrl = url.replace(/^https?:\/\//, 'x-web-search://');
                  window.open(safariUrl, '_blank');
                }}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded-md transition-colors"
              >
                🌐 Abrir en Safari
              </button>
            ) : !isIOS && deferredPrompt ? (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-md transition-colors"
              >
                <Download size={14} />
                Instalar
              </button>
            ) : null}
            
            {/* Botón para desestimar por 24 horas */}
            {!isIOS && (
              <button
                onClick={handleDismiss}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded transition-colors"
              >
                Ahora no
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 ml-2">
          <button
            onClick={handleDismissPermanently}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="No mostrar más"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
