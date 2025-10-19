# AuthModal Component

Modal de autenticación moderno y elegante para FindIA, integrado con NextAuth.js.

## Características

- ✅ **Integración NextAuth.js**: Autenticación con Google OAuth
- ✅ **Animaciones fluidas**: Transiciones con Framer Motion
- ✅ **Modos duales**: Login y Registro con toggle
- ✅ **Acceso Demo**: Botón directo al modo demo
- ✅ **Manejo de errores**: Mensajes de error claros
- ✅ **Responsive**: Adaptable a mobile y desktop
- ✅ **Accesibilidad**: Cierre con Escape, focus management
- ✅ **UX optimizada**: Loading states y feedback visual

## Uso Básico

```tsx
import { useState } from 'react'
import AuthModal from '@/components/AuthModal'

function MyComponent() {
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  return (
    <>
      <button onClick={() => {
        setMode('login')
        setModalOpen(true)
      }}>
        Iniciar Sesión
      </button>

      <button onClick={() => {
        setMode('register')
        setModalOpen(true)
      }}>
        Registrarse
      </button>

      <AuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialMode={mode}
      />
    </>
  )
}
```

## Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `isOpen` | `boolean` | - | Controla si el modal está visible |
| `onClose` | `() => void` | - | Callback cuando se cierra el modal |
| `initialMode` | `'login' \| 'register'` | `'login'` | Modo inicial del modal |

## Funcionalidades

### Autenticación con Google
- Integración directa con NextAuth.js
- Redirección automática al dashboard tras login exitoso
- Manejo de errores de autenticación

### Acceso Demo
- Botón para acceder al modo demo sin autenticación
- Redirección a `/demo`

### Estados Visuales
- **Loading**: Spinner animado durante autenticación
- **Error**: Mensajes de error en caso de fallo
- **Success**: Cierre automático y redirección

### Navegación
- Toggle entre modos Login/Registro
- Cierre con botón X o tecla Escape
- Prevención de cierre accidental (click en backdrop)

## Ejemplos Avanzados

### Modal con modo específico
```tsx
// Abrir directamente en modo registro
<AuthModal
  isOpen={true}
  onClose={handleClose}
  initialMode="register"
/>
```

### Integración en landing page
```tsx
function LandingPage() {
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    mode: 'login' as 'login' | 'register'
  })

  const openLogin = () => setAuthModal({ isOpen: true, mode: 'login' })
  const openRegister = () => setAuthModal({ isOpen: true, mode: 'register' })
  const closeModal = () => setAuthModal(prev => ({ ...prev, isOpen: false }))

  return (
    <>
      {/* Botones CTA */}
      <button onClick={openRegister}>Comenzar Gratis</button>
      <button onClick={openLogin}>Iniciar Sesión</button>

      {/* Modal */}
      <AuthModal
        isOpen={authModal.isOpen}
        onClose={closeModal}
        initialMode={authModal.mode}
      />
    </>
  )
}
```

## Personalización

### Estilos
El modal utiliza Tailwind CSS y puede ser personalizado modificando las clases:

```tsx
// Personalizar colores del header
className="bg-gradient-to-br from-green-600 via-green-700 to-blue-700"

// Personalizar botones
className="bg-blue-600 hover:bg-blue-700"
```

### Callbacks
```tsx
<AuthModal
  isOpen={isOpen}
  onClose={() => {
    setModalOpen(false)
    // Lógica adicional al cerrar
    analytics.track('auth_modal_closed')
  }}
  initialMode="login"
/>
```

## Integración con NextAuth.js

El modal utiliza las siguientes funciones de NextAuth.js:

- `signIn('google', options)`: Para autenticación con Google
- `getSession()`: Para verificar sesión establecida
- `useRouter()`: Para redirecciones post-autenticación

### Configuración requerida

Asegúrate de tener configurado en tu `[...nextauth].ts`:

```typescript
export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      return session
    },
  },
})
```

## Arquitectura del Componente

```
AuthModal
├── Header (gradiente con logo)
├── Mode Toggle (Login/Register)
├── Google Auth Button
├── Demo Access Button
├── Error Display
├── Benefits List
└── Footer (términos)
```

## Flujo de Autenticación

1. **Usuario abre modal** → Estado inicial con modo seleccionado
2. **Click Google Auth** → Loading state activado
3. **NextAuth.js maneja OAuth** → Redirección a Google
4. **Google callback** → Vuelta a la app
5. **Sesión establecida** → Cierre modal + redirección dashboard
6. **Error handling** → Mensaje de error mostrado

## Consideraciones de UX

- **Feedback inmediato**: Loading states claros
- **Accesibilidad**: Navegación por teclado, ARIA labels
- **Mobile-first**: Diseño responsive
- **Prevención de errores**: Validación antes de submit
- **Recuperación**: Mensajes de error descriptivos