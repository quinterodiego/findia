# FindIA 🚀

¡Tu compañero inteligente para liberarte de las deudas económicas!

> **🎯 Misión**: Ayudarte a alcanzar la libertad financiera de forma inteligente, motivacional y completamente personalizada.

## ✨ Características Principales

### 💳 Gestión Completa de Deudas
- 📊 **Seguimiento en tiempo real** de tus deudas y pagos
- 💰 **Cálculos automáticos** de intereses y proyecciones
- 📈 **Análisis predictivo** de tu progreso hacia la libertad financiera
- 🔄 **Sincronización automática** con Google Sheets

### 🤖 Inteligencia Artificial Integrada  
- 🎯 **Coach financiero IA** con sugerencias personalizadas
- 💡 **Recomendaciones inteligentes** basadas en tu situación
- 📋 **Estrategias optimizadas** para pagar deudas más rápido

### 🎉 Gamificación y Motivación
- 🏆 **Celebraciones automáticas** cuando alcanzas hitos
- 💪 **Mensajes motivacionales** personalizados
- 🎖️ **Sistema de logros** y reconocimientos
- � **Visualización del progreso** en tiempo real

### 🔐 Autenticación y Seguridad
- 🚀 **Google OAuth 2.0** para acceso seguro
- � **Perfiles personalizados** para cada usuario
- 🛡️ **Datos seguros** almacenados en Google Sheets
- 🔄 **Modo demo** sin necesidad de registro

## 🛠️ Stack Tecnológico

### Frontend
- ⚛️ **React 18** + **TypeScript** - Framework moderno y tipado fuerte
- ⚡ **Vite** - Build tool ultrarrápido
- 🎨 **Tailwind CSS** - Estilos utility-first responsivos
- ✨ **Framer Motion** - Animaciones fluidas y profesionales
- 🎯 **Lucide React** - Iconografía consistente

### Backend & Database  
- 📊 **Google Sheets API** - Base de datos en la nube gratuita
- 🔐 **Google Identity Services** - Autenticación OAuth 2.0
- ☁️ **Sincronización automática** - Datos persistentes y seguros

### Arquitectura
- 🏗️ **Arquitectura modular** con hooks personalizados
- 📱 **Mobile-first responsive** design
- 🚀 **Progressive Web App** ready
- 🔄 **Estado global** con Context API

## 🚀 Inicio Rápido

### Opción 1: Modo Demo (Sin configuración)
```bash
# Clona e instala
git clone https://github.com/quinterodiego/findia.git
cd findia
npm install

# Ejecuta inmediatamente
npm run dev
```
**✅ Listo!** Abre `http://localhost:5173` y usa el modo demo con datos de ejemplo.

### Opción 2: Con Persistencia (Google Sheets)
```bash
# 1. Configuración inicial
git clone https://github.com/quinterodiego/findia.git
cd findia
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de Google Sheets

# 3. Ejecutar con base de datos real
npm run dev
```

📚 **Guía detallada**: [Configuración de Google Sheets](./docs/GOOGLE_SHEETS_SETUP.md)

## 📋 Comandos Disponibles

```bash
# Desarrollo
npm run dev          # Servidor de desarrollo con hot reload
npm run build        # Build optimizado para producción
npm run preview      # Preview de la build de producción
npm run lint         # Análisis de código con ESLint

# Utilidades adicionales
npm run type-check   # Verificación de tipos TypeScript (si disponible)
```

## 🎯 Guía de Funcionalidades

### 🏠 Dashboard Principal
```typescript
// Estadísticas en tiempo real
- 💰 Deuda total vs pagado
- 📈 Porcentaje de progreso  
- ⏱️ Tiempo estimado para libertad financiera
- 🎯 Próximas metas a alcanzar
```

### 💳 Gestión de Deudas
```typescript
// Funciones disponibles
- ➕ Agregar nuevas deudas
- ✏️ Editar deudas existentes
- 💵 Registrar pagos realizados
- 📊 Ver historial de pagos
- 🗑️ Eliminar deudas saldadas
```

### 🤖 IA Coach Financiero
```typescript
// Sugerencias inteligentes
- 🎯 Estrategias de pago optimizadas
- 💡 Consejos personalizados
- 📈 Proyecciones de mejora
- ⚡ Recomendaciones automáticas
```

### 🔐 Sistema de Usuarios
```typescript
// Autenticación segura
- 🚀 Login con Google OAuth 2.0
- 👤 Perfiles personalizados
- 📊 Datos sincronizados con Google Sheets
- 🛡️ Privacidad y seguridad garantizada
```

### IA Coach
- Sugerencias personalizadas basadas en tu progreso
- Análisis predictivo de tiempo para libertad financiera
- Estrategias optimizadas para pago de deudas

### 🎉 Sistema de Celebraciones
```typescript
// Gamificación integrada
- 🏆 Logros automáticos al 25%, 50%, 75% y 100%
- 🎊 Animaciones especiales de celebración
- 💪 Mensajes motivacionales rotativos
- 🎯 Reconocimientos por constancia
```

## 🔄 Modos de Funcionamiento

### 🧪 Modo Demo (Por Defecto)
```bash
✅ Funciona inmediatamente sin configuración
✅ Datos de ejemplo preconfigurados 
✅ Todas las funcionalidades disponibles
❌ Los datos no persisten entre sesiones
❌ Se pierden al recargar la página
```

**Ideal para**: Probar la aplicación, demostraciones, testing

### 💾 Modo Producción (Con Google Sheets)
```bash
✅ Datos persistentes en la nube
✅ Sincronización automática
✅ Múltiples usuarios independientes
✅ Backup automático en Google Drive
✅ Acceso desde cualquier dispositivo
⚙️ Requiere configuración inicial (5 minutos)
```

**Ideal para**: Uso personal real, datos importantes

### � Sistema de Usuarios y Administradores

FindIA incluye un sistema completo de gestión de usuarios:

```typescript
// Roles de usuario
👤 Usuario Regular: Gestiona sus propias deudas
👑 Administrador: Acceso completo + panel de configuración

// Administradores predeterminados
✅ coderflixarg@gmail.com
✅ d86webs@gmail.com
```

**Registro automático**: Los usuarios se registran automáticamente al hacer login con Google OAuth.

### �🔄 Detección Automática
FindIA detecta automáticamente qué modo usar:

```typescript
// Lógica de detección
if (hasGoogleSheetsCredentials) {
  mode = 'production'  // 📊 Datos reales
} else {
  mode = 'demo'        // 🧪 Datos de ejemplo
}
```

## 🤖 Integración con IA

FindIA utiliza algoritmos inteligentes para:
- Analizar patrones de pago
- Sugerir estrategias óptimas (avalancha vs. bola de nieve)
- Predecir tiempos de libertad financiera
- Generar planes de acción personalizados

## 🎨 Diseño

La aplicación cuenta con:
- Interfaz moderna y responsive
- Animaciones fluidas con Framer Motion
- Esquema de colores motivacional
- Efectos visuales de celebración
- Diseño centrado en la experiencia del usuario

## 📱 Responsive Design

FindIA está optimizado para:
- 📱 Móviles
- 📱 Tablets
- 💻 Desktop
- 🖥️ Pantallas grandes

## 🔮 Próximas Características

- [ ] Integración completa con Google Sheets
- [ ] Notificaciones push para recordatorios de pago
- [ ] Gráficos avanzados de progreso
- [ ] Exportación de reportes en PDF
- [ ] Sistema de metas personalizables
- [ ] Integración con bancos (Open Banking)
- [ ] Modo oscuro
- [ ] PWA (Progressive Web App)

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si tienes ideas para mejorar FindIA:

1. Fork el proyecto
2. Crea tu rama de feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 💙 Agradecimientos

- Gracias a todos los que luchan día a día por su libertad financiera
- Inspirado en las mejores prácticas de finanzas personales
- Construido con amor y código ❤️

---

**¡Recuerda: Cada peso que pagas es un paso hacia tu libertad! 🚀**