# 🎯 Tour Guiado de FindIA

## ¿Qué es el Tour Guiado?

El Tour Guiado es una funcionalidad que ayuda a los usuarios nuevos a entender cómo usar FindIA de manera efectiva. Es especialmente útil para personas que no saben de finanzas y necesitan orientación.

## 🚀 Características Principales

### 1. **Tour Automático para Nuevos Usuarios**
- Se activa automáticamente cuando un usuario ingresa por primera vez
- Solo se muestra si no tiene deudas registradas
- Se puede saltar en cualquier momento

### 2. **Tour Manual**
- Botón de "?" en el header para iniciar el tour cuando se desee
- Disponible en cualquier momento para repasar funcionalidades

### 3. **Tours Adaptativos**
- **Tour para Nuevos Usuarios**: Enfocado en agregar la primera deuda
- **Tour para Usuarios Existentes**: Enfocado en gestión y optimización

## 📋 Pasos del Tour

### Para Nuevos Usuarios:
1. **Bienvenida** - Introducción a FindIA
2. **Panel de Estadísticas** - Explicación de las métricas
3. **Barra de Progreso** - Visualización del avance
4. **Agregar Deudas** - Cómo registrar deudas
5. **Lista de Deudas** - Donde aparecerán las deudas
6. **Personalización** - Cambio de tema
7. **Llamada a la Acción** - Invitación a agregar primera deuda

### Para Usuarios Existentes:
1. **Bienvenida** - Introducción al tour
2. **Resumen Financiero** - Estado actual
3. **Progreso** - Visualización del avance
4. **Gestión de Deudas** - Manejo de deudas existentes
5. **Agregar Más Deudas** - Expansión del registro
6. **Personalización** - Opciones de tema
7. **Motivación** - Recordatorio de consistencia

## 🎨 Características UX

### Visual
- **Overlay semitransparente** con highlight del elemento activo
- **Tooltips posicionados inteligentemente** (arriba, abajo, izquierda, derecha)
- **Borde azul brillante** alrededor del elemento destacado
- **Animaciones suaves** con Framer Motion

### Navegación
- **Indicadores de progreso** (dots)
- **Botones de navegación** (Anterior/Siguiente)
- **Opción de saltar** en cualquier momento
- **Cierre con X** o ESC

### Persistencia
- Se guarda en `localStorage` si el usuario completó el tour
- No se vuelve a mostrar automáticamente después de completarlo

## 🔧 Implementación Técnica

### Atributos data-tour
Los elementos importantes tienen atributos `data-tour` para el targeting:

```tsx
<div data-tour="stats">...</div>
<div data-tour="progress">...</div>
<button data-tour="add-debt">...</button>
<div data-tour="debt-list">...</div>
<button data-tour="theme-toggle">...</button>
```

### Componente TourGuide
```tsx
<TourGuide
  isVisible={showTour}
  onComplete={handleTourComplete}
  onSkip={handleTourSkip}
  hasDebts={debts.length > 0}
/>
```

### Lógica de Activación
```tsx
// Auto-mostrar para nuevos usuarios
useEffect(() => {
  const hasSeenTour = localStorage.getItem('findia-tour-completed');
  if (!hasSeenTour && debts.length === 0 && !loading) {
    setShowTour(true);
  }
}, [debts, loading]);
```

## 🎯 Beneficios para el Usuario

### Para Principiantes en Finanzas:
- **Reduce la curva de aprendizaje**
- **Explica conceptos financieros básicos**
- **Guía paso a paso para el primer uso**
- **Aumenta la confianza del usuario**

### Para Todos los Usuarios:
- **Descubrimiento de funcionalidades**
- **Recordatorio de mejores prácticas**
- **Optimización del uso de la aplicación**
- **Reducción de confusión inicial**

## 🎨 Personalización

El tour es completamente personalizable:

- **Textos**: Fácil modificación en los arrays de steps
- **Posicionamiento**: Ajustable por elemento (top, bottom, left, right)
- **Styling**: CSS personalizable con Tailwind
- **Comportamiento**: Lógica adaptable según estado del usuario

## 🚀 Expansión Futura

Posibles mejoras:
- **Tours contextuales** para nuevas funcionalidades
- **Tips progresivos** basados en uso
- **Onboarding multi-página**
- **Tours de funcionalidades avanzadas**
- **Integración con analytics** para mejorar la experiencia

## 📱 Responsividad

El tour está optimizado para:
- **Desktop**: Tooltips posicionados optimalmente
- **Mobile**: Tooltips adaptados a pantallas pequeñas
- **Tablet**: Experiencia intermedia fluida

---

**💡 Tip**: El tour se ha diseñado pensando en usuarios que nunca han usado una app de finanzas, usando lenguaje simple y explicaciones claras.