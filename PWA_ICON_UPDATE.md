# 🎨 Cómo Actualizar el Ícono de la PWA Instalada

## Problema
Cuando una PWA está instalada, el navegador cachea el manifest.json y los iconos. Esto puede hacer que los cambios de iconos no se reflejen inmediatamente.

## Soluciones Implementadas

### 1. Cache Busting en el Manifest
- Se agregó `?v=2` a todas las URLs de iconos en `manifest.json`
- Se agregó `?v=2` a la URL del manifest en `app/layout.tsx`
- Cuando actualices los iconos, incrementa el número de versión (v=3, v=4, etc.)

### 2. Service Worker Configurado
- El manifest.json ahora usa estrategia `NetworkFirst` con `maxAgeSeconds: 0`
- Esto fuerza al service worker a siempre obtener la versión más reciente del manifest

## 📋 Pasos para Actualizar el Ícono

### Paso 1: Reemplazar los Archivos de Iconos
1. Reemplaza los iconos en:
   - `/public/icons/icon-192x192.png`
   - `/public/icons/icon-512x512.png`
   - `/public/logo.ico`

### Paso 2: Incrementar la Versión
1. Edita `public/manifest.json` y cambia `?v=2` a `?v=3` en todas las URLs de iconos
2. Edita `app/layout.tsx` y cambia `?v=2` a `?v=3` en la URL del manifest

### Paso 3: Deploy
1. Haz commit y push de los cambios
2. Despliega a producción con `vercel --prod`

### Paso 4: Forzar Actualización en la PWA Instalada

**Opción A: Actualizar Automáticamente**
- El banner de "Actualización Disponible" aparecerá cuando detecte cambios
- Click en "Actualizar ahora" para aplicar los cambios

**Opción B: Actualización Manual**
1. **Chrome/Edge (Desktop/Android):**
   - Abre la PWA instalada
   - Cierra completamente la aplicación
   - Vuelve a abrirla
   - O desinstala y reinstala desde el navegador

2. **iOS Safari:**
   - Elimina el ícono de la pantalla de inicio
   - Vuelve a agregar a pantalla de inicio desde Safari

3. **Forzar Actualización del Service Worker:**
   - Abre la PWA
   - Presiona `Ctrl+Shift+R` (Windows) o `Cmd+Shift+R` (Mac) para hard refresh
   - O abre DevTools (F12) → Application → Service Workers → Click en "Update"

### Paso 5: Verificar
- Los nuevos iconos deberían aparecer en la barra de tareas/escritorio
- Puede tomar unos minutos en algunos navegadores

## ⚠️ Limitaciones

- **iOS Safari**: Puede tomar hasta 24 horas para actualizar el ícono debido al cache agresivo de Apple
- **Android Chrome**: Generalmente actualiza en minutos después del deploy
- **Desktop**: Puede requerir reiniciar la aplicación o el navegador

## 🔄 Automatización Futura

Para automatizar esto en el futuro, podríamos:
- Usar un timestamp en lugar de versión manual
- Agregar un endpoint que genere el manifest dinámicamente
- Implementar un sistema de notificación push cuando hay actualizaciones

## 📝 Notas

- Siempre incrementa el número de versión cuando cambies los iconos
- Los iconos deben cumplir con los estándares PWA (192x192 y 512x512 mínimo)
- El icono maskable debe tener padding adecuado alrededor del contenido

