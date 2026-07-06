'use client';
import { Bell, BellOff } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NotificationBell() {
  const { permission, isSubscribed, isLoading, supported, requestPermission, unsubscribe } =
    usePushNotifications();

  if (!supported) return null;

  const handleClick = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      requestPermission();
    }
  };

  const label =
    permission === 'denied'
      ? 'Notificaciones bloqueadas — habilitá el permiso en Safari'
      : isSubscribed
      ? 'Desactivar recordatorios de pago'
      : 'Activar recordatorios de pago';

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || permission === 'denied'}
      title={label}
      aria-label={label}
      className={`p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        isSubscribed
          ? 'text-[#FF3A5F] bg-[#FF3A5F]/10 hover:bg-[#FF3A5F]/20'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isSubscribed ? (
        <Bell className="w-5 h-5" />
      ) : (
        <BellOff className="w-5 h-5" />
      )}
    </button>
  );
}
