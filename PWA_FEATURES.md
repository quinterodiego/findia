# FindIA PWA - Progressive Web App

## 🚀 Características de la PWA

FindIA ahora es una **Progressive Web App (PWA)** completa que ofrece una experiencia de aplicación nativa en dispositivos móviles y de escritorio.

### ✨ Funcionalidades Implementadas

#### 📱 Instalación
- **Instalable en dispositivos móviles y de escritorio**
- Banner de instalación automático que aparece cuando el navegador detecta que la app es instalable
- **Banner específico para Chrome iOS** con instrucciones para usar Safari
- Iconos optimizados para diferentes tamaños de pantalla
- Soporte completo para iOS Safari, Android Chrome y Windows Edge

#### 🔄 Funcionalidad Offline
- **Service Worker** configurado con estrategias de caché inteligentes
- Cache de recursos estáticos (CSS, JS, imágenes, fuentes)
- Cache de APIs con estrategia NetworkFirst (fallback a cache si no hay conexión)
- Cache de imágenes de Google (perfiles de usuario)

#### 🎨 Experiencia Nativa
- **Modo standalone** - se ejecuta como una aplicación nativa
- **Tema personalizado** con colores de marca (#3b82f6)
- **Orientación optimizada** para móviles (portrait-primary)
- **Meta tags completos** para todas las plataformas

#### ⚡ Rendimiento
- **Carga rápida** con estrategias de caché optimizadas
- **Lazy loading** de recursos
- **Compresión** automática de assets
- **Precaching** de recursos críticos

### 🛠️ Configuración Técnica

#### Archivos Generados Automáticamente
- `public/sw.js` - Service Worker principal
- `public/workbox-*.js` - Librería Workbox para gestión de caché
- `public/manifest.json` - Manifest de la PWA
- `public/icons/` - Iconos en diferentes tamaños

#### Estrategias de Caché Implementadas
1. **CacheFirst**: Fuentes de Google, recursos estáticos
2. **StaleWhileRevalidate**: Imágenes, CSS, JS
3. **NetworkFirst**: APIs, contenido dinámico

#### Compatibilidad
- ✅ **Chrome/Edge** (Android, Windows, macOS)
- ✅ **Safari** (iOS, macOS) - Soporte completo
- ✅ **Firefox** (Android, Windows, macOS)
- ✅ **Samsung Internet**
- ⚠️ **Chrome iOS** - Banner informativo para usar Safari

### 📋 Cómo Probar la PWA

#### En Desarrollo
```bash
npm run build
npm run start
```

#### En Producción
1. Despliega la aplicación en un servidor HTTPS
2. Abre la aplicación en un navegador compatible
3. Busca el ícono de instalación en la barra de direcciones
4. O espera a que aparezca el banner de instalación automático

#### Verificar Funcionalidad
- **Lighthouse PWA Audit**: Usa las herramientas de desarrollador de Chrome
- **Modo Offline**: Desactiva la conexión a internet y verifica que la app sigue funcionando
- **Instalación**: Instala la app y verifica que aparece en el escritorio/aplicaciones

### 🔧 Personalización

#### Cambiar Colores del Tema
Edita en `app/layout.tsx`:
```typescript
export const viewport = {
  themeColor: "#tu-color-aqui",
};
```

Y en `public/manifest.json`:
```json
{
  "theme_color": "#tu-color-aqui",
  "background_color": "#tu-color-fondo"
}
```

#### Modificar Estrategias de Caché
Edita en `next.config.ts` la sección `runtimeCaching` para personalizar las estrategias de caché según tus necesidades.

### 📱 Características Específicas por Plataforma

#### iOS Safari
- Soporte completo para instalación en pantalla de inicio
- Meta tags específicos para iOS
- Iconos optimizados para diferentes dispositivos
- Banner automático con instrucciones específicas

#### Chrome iOS (Limitación de Apple)
- **No soporta PWA** debido a restricciones de Apple
- Banner informativo que sugiere usar Safari
- Botón para abrir automáticamente en Safari
- Experiencia web normal sin funcionalidad PWA

#### Android Chrome
- Instalación automática sugerida
- Notificaciones push (preparado para futuras implementaciones)
- Modo standalone completo

#### Windows Edge
- Soporte para tiles de Windows
- Integración con el sistema operativo
- Archivo browserconfig.xml incluido

### 🚀 Próximas Mejoras Sugeridas

1. **Notificaciones Push**: Implementar notificaciones para recordatorios financieros
2. **Sincronización en Background**: Sincronizar datos cuando la app vuelve a estar online
3. **Modo Offline Avanzado**: Permitir crear/editar transacciones sin conexión
4. **Shortcuts Dinámicos**: Crear accesos directos dinámicos basados en el uso del usuario

---

**¡FindIA ahora es una PWA completa y lista para producción!** 🎉
