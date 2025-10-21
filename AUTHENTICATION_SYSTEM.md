# Sistema de Autenticación FindIA

## 📁 Estructura de Archivos

```
components/
├── AuthModal.tsx              # Modal principal que envuelve los formularios
├── AuthModalExample.tsx       # Ejemplo de uso del AuthModal
├── Providers.tsx              # SessionProvider de NextAuth
├── index.ts                   # Exports principales
└── auth/
    ├── LoginForm.tsx          # Formulario de inicio de sesión
    ├── RegisterForm.tsx       # Formulario de registro
    ├── ForgotPasswordForm.tsx # Formulario de recuperación de contraseña
    ├── LoginFormDemo.tsx      # Demo del login (si existe)
    └── index.ts               # Exports de auth
```

## ✅ Componentes Implementados

### 1. **AuthModal** (`components/AuthModal.tsx`)
Modal completo con transiciones suaves que incluye:
- ✅ Integración con Framer Motion para animaciones
- ✅ Soporte para modo login/register/forgot
- ✅ Cierre con tecla ESC
- ✅ Prevención de scroll cuando está abierto
- ✅ Backdrop con blur
- ✅ Navegación fluida entre modos

### 2. **LoginForm** (`components/auth/LoginForm.tsx`)
Formulario de login con:
- ✅ Validación en tiempo real
- ✅ Manejo de errores por campo
- ✅ Toggle de visibilidad de contraseña
- ✅ Integración con NextAuth (Google OAuth)
- ✅ Navegación por teclado (Tab, Enter)
- ✅ Estados de carga
- ✅ Checkbox "Recordarme"
- ✅ Link a recuperación de contraseña

### 3. **RegisterForm** (`components/auth/RegisterForm.tsx`)
Formulario de registro con:
- ✅ Validación de nombre, email, contraseña
- ✅ Confirmación de contraseña
- ✅ Indicador de fortaleza de contraseña
- ✅ Integración con NextAuth (Google OAuth)
- ✅ Estados de carga
- ✅ Manejo de errores detallado

## 🔧 Configuración NextAuth

El sistema está configurado para usar **Google OAuth** como proveedor principal:

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // ... más configuración
}
```

## 🚀 Cómo Usar

### Opción 1: Login directo con Google (Actual)
La landing page usa directamente `signIn('google')`:

```tsx
import { signIn } from 'next-auth/react'

const handleLogin = () => {
  signIn('google', { callbackUrl: '/dashboard' })
}
```

### Opción 2: Con Modal (Futuro - Email/Password)
Si quieres agregar autenticación con email/password:

```tsx
import { useState } from 'react'
import AuthModal from '@/components/AuthModal'

export default function Page() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  return (
    <>
      <button onClick={() => {
        setAuthMode('login')
        setShowAuthModal(true)
      }}>
        Iniciar Sesión
      </button>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
  )
}
```

## 🎨 Características de UI/UX

1. **Validación en Tiempo Real**: Los campos se validan mientras escribes
2. **Mensajes de Error Claros**: Cada campo muestra su propio error
3. **Animaciones Suaves**: Transiciones fluidas entre estados
4. **Responsive**: Funciona en móvil y desktop
5. **Accesibilidad**: Navegación por teclado completa
6. **Estados de Carga**: Feedback visual durante operaciones asíncronas

## 📝 Variables de Entorno Requeridas

```env
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu_secret_aleatorio
```

## 🔜 Próximos Pasos

Para habilitar autenticación con email/password:

1. Agregar provider de Credentials a NextAuth
2. Crear API route para registro de usuarios
3. Configurar base de datos (Prisma o similar)
4. Actualizar los formularios para enviar datos al backend
5. Agregar verificación de email

## 💡 Notas Importantes

- **Actualmente** solo Google OAuth está activo
- Los formularios están listos pero necesitan backend para email/password
- El sistema es modular y fácil de extender
- Toda la validación es del lado del cliente por ahora

## 🐛 Testing

Para probar los componentes:
1. Inicia el servidor: `npm run dev`
2. Navega a la landing page
3. Haz clic en "Iniciar Sesión" o "Empezar Gratis"
4. Verifica el flujo de Google OAuth

---

**Estado**: ✅ Implementado y funcionando
**Versión**: 1.0
**Última actualización**: 21 de octubre, 2025
