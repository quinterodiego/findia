"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { motion } from 'framer-motion'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
  redirectTo?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback,
  redirectTo = "/" 
}) => {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(redirectTo)
    }
  }, [status, router, redirectTo])

  // Show loading while checking authentication
  if (status === "loading") {
    return fallback || (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          />
          <motion.p 
            className="text-gray-600 text-lg font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Verificando autenticación...
          </motion.p>
          <motion.div
            className="mt-2 text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Conectando con FindIA
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // Redirect if not authenticated (handled by useEffect)
  if (status === "unauthenticated") {
    return null
  }

  // Render protected content
  return <>{children}</>
}

interface PublicRouteProps {
  children: ReactNode
  fallback?: ReactNode
  redirectTo?: string
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ 
  children, 
  fallback,
  redirectTo = "/dashboard" 
}) => {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") {
      router.push(redirectTo)
    }
  }, [status, router, redirectTo])

  // Show loading while checking authentication
  if (status === "loading") {
    return fallback || (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          />
          <motion.p 
            className="text-gray-600 text-lg font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Cargando FindIA...
          </motion.p>
          <motion.div
            className="mt-2 text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Preparando tu experiencia financiera
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // Redirect if already authenticated (handled by useEffect)
  if (status === "authenticated") {
    return null
  }

  // Render public content
  return <>{children}</>
}

// Higher-order component for protecting pages
export function withAuth<T extends object>(
  Component: React.ComponentType<T>,
  options?: {
    fallback?: ReactNode
    redirectTo?: string
  }
) {
  const AuthenticatedComponent = (props: T) => {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    )
  }

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`
  
  return AuthenticatedComponent
}

// Higher-order component for public pages that redirect if authenticated
export function withPublicRoute<T extends object>(
  Component: React.ComponentType<T>,
  options?: {
    fallback?: ReactNode
    redirectTo?: string
  }
) {
  const PublicComponent = (props: T) => {
    return (
      <PublicRoute {...options}>
        <Component {...props} />
      </PublicRoute>
    )
  }

  PublicComponent.displayName = `withPublicRoute(${Component.displayName || Component.name})`
  
  return PublicComponent
}

export default ProtectedRoute