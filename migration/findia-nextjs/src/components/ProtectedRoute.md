# ProtectedRoute Components

Este módulo proporciona componentes y utilidades para proteger rutas en Next.js usando NextAuth.js.

## Componentes Principales

### `ProtectedRoute`
Protege contenido que solo debe ser accesible por usuarios autenticados.

```tsx
import { ProtectedRoute } from '@/components/ProtectedRoute'

function MyProtectedPage() {
  return (
    <ProtectedRoute>
      <div>Este contenido solo lo ven usuarios autenticados</div>
    </ProtectedRoute>
  )
}
```

**Props:**
- `children`: ReactNode - Contenido a proteger
- `fallback?`: ReactNode - Componente a mostrar durante carga (opcional)
- `redirectTo?`: string - Ruta de redirección si no autenticado (default: "/")

### `PublicRoute`
Para páginas públicas que redirigen usuarios ya autenticados.

```tsx
import { PublicRoute } from '@/components/ProtectedRoute'

function LoginPage() {
  return (
    <PublicRoute>
      <div>Página de login - redirige si ya está autenticado</div>
    </PublicRoute>
  )
}
```

**Props:**
- `children`: ReactNode - Contenido público
- `fallback?`: ReactNode - Componente a mostrar durante carga (opcional)
- `redirectTo?`: string - Ruta de redirección si ya autenticado (default: "/dashboard")

## Higher-Order Components (HOCs)

### `withAuth`
HOC para proteger páginas completas.

```tsx
import { withAuth } from '@/components/ProtectedRoute'

const MyPage = () => <div>Contenido protegido</div>

export default withAuth(MyPage, {
  redirectTo: '/login',
  fallback: <div>Cargando...</div>
})
```

### `withPublicRoute`
HOC para páginas públicas.

```tsx
import { withPublicRoute } from '@/components/ProtectedRoute'

const LoginPage = () => <div>Login</div>

export default withPublicRoute(LoginPage, {
  redirectTo: '/dashboard'
})
```

## Middleware de Next.js

El archivo `middleware.ts` en la raíz del proyecto proporciona protección a nivel de servidor:

```typescript
// middleware.ts
import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Lógica personalizada de middleware
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Lógica de autorización
        return !!token
      },
    },
  }
)
```

### Rutas Configuradas

- **Públicas**: `/`, `/demo`, `/api/auth/*`
- **Protegidas**: `/dashboard/*`, `/debt/*`
- **Auto-redirección**: Los usuarios autenticados en `/` van a `/dashboard`

## Estados de Autenticación

### Loading State
Muestra spinner animado con Framer Motion mientras se verifica la sesión.

### Unauthenticated
Redirige automáticamente a la ruta especificada (default: "/").

### Authenticated
Renderiza el contenido protegido normalmente.

## Ejemplos de Uso

### Página Protegida Simple
```tsx
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <h1>Dashboard Privado</h1>
      <p>Solo usuarios autenticados pueden ver esto</p>
    </ProtectedRoute>
  )
}
```

### Página Pública con Redirección
```tsx
import { PublicRoute } from '@/components/ProtectedRoute'

export default function Home() {
  return (
    <PublicRoute redirectTo="/dashboard">
      <h1>Página de Inicio</h1>
      <p>Los usuarios autenticados serán redirigidos al dashboard</p>
    </PublicRoute>
  )
}
```

### Loading Personalizado
```tsx
import { ProtectedRoute } from '@/components/ProtectedRoute'

const CustomLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div>Cargando tu cuenta...</div>
  </div>
)

export default function SecurePage() {
  return (
    <ProtectedRoute fallback={<CustomLoader />}>
      <div>Contenido seguro</div>
    </ProtectedRoute>
  )
}
```

## Características

- ✅ **Integración con NextAuth.js**: Usa `useSession` para estado de autenticación
- ✅ **Animaciones**: Loading states con Framer Motion
- ✅ **TypeScript**: Completamente tipado
- ✅ **Flexible**: Props opcionales para personalización
- ✅ **Middleware**: Protección a nivel de servidor
- ✅ **HOCs**: Patrones de composición reutilizables
- ✅ **Redirecciones Automáticas**: Manejo inteligente de navegación

## Testing

Para probar los componentes:

1. Visita `/protected` sin autenticarte - deberías ser redirigido a `/`
2. Auténticate y visita `/protected` - deberías ver el contenido
3. Estando autenticado, visita `/` - deberías ser redirigido a `/dashboard`