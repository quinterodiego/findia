declare const self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const { title, body, icon, url, tag } = data;

  event.waitUntil(
    self.registration.showNotification(title || 'FindIA', {
      body: body || '',
      icon: icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: tag || 'findia',
      data: { url: url || '/dashboard' },
      actions: [
        { action: 'open', title: 'Ver ahora' },
        { action: 'close', title: 'Ignorar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = (event.notification.data as { url?: string })?.url || '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
