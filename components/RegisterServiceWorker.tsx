'use client';

import { useEffect } from 'react';

/**
 * Fase DB-8.1 — registro manual del Service Worker.
 *
 * `next-pwa` (next.config.ts, `register: true`) inyecta su propio script de
 * registro (`node_modules/next-pwa/register.js`) directo dentro del entry
 * `main.js` de webpack -- eso funcionaba con el Pages Router viejo, pero
 * Next.js 15 con App Router ya no tiene un entry literal `main.js` en el
 * objeto de entries que ese plugin chequea (`entries['main.js']`), así que
 * la condición `if (entries['main.js'] && ...)` nunca es cierta: el script
 * de registro nunca se agrega a ningún bundle, en ningún entorno, desde que
 * este proyecto migró a App Router. Confirmado inspeccionando directamente
 * los chunks generados (`main-app-*.js` existe, `main.js` no) -- ningún
 * bundle shippeado contiene el código de `next-pwa/register.js`.
 *
 * `next-pwa` sigue generando `public/sw.js` correctamente (el build no
 * cambia) -- solo falta este registro, que es exactamente lo que
 * `register.js` haría. No se duplica nada: la inyección de next-pwa nunca
 * llegó a ejecutarse.
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.error('Error registrando el service worker:', error);
    });
  }, []);

  return null;
}
