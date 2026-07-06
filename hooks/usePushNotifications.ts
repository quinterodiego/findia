'use client';
import { useState, useEffect, useCallback } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setSupported(ok);
    if (!ok) return;

    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await res.json();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setIsSubscribed(true);
      setPermission('granted');
    } catch (err) {
      console.error('Error suscribiendo a push:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supported, isLoading]);

  const unsubscribe = useCallback(async () => {
    if (!supported || isLoading) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Error desuscribiendo push:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supported, isLoading]);

  const requestPermission = useCallback(async () => {
    if (!supported) return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') await subscribe();
    return result;
  }, [supported, subscribe]);

  return { permission, isSubscribed, isLoading, supported, subscribe, unsubscribe, requestPermission };
}
