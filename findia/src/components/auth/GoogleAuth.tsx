import { useState } from 'react'
import { motion } from 'framer-motion'

interface GoogleLoginButtonProps {
  onSuccess: (googleUser: any) => void
  onError: (error: string) => void
  text?: string
  disabled?: boolean
  className?: string
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onError,
  text = "Continúa con Google",
  disabled = false,
  className = ""
}) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    
    try {
      // Usar el servicio real de Google OAuth (esto redirigirá a Google)
      const { GoogleAuthService } = await import('../../lib/googleAuth')
      const authService = GoogleAuthService.getInstance()
      
      // Realizar login real con Google (redirige a Google OAuth)
      await authService.signIn()
      
      // Si llegamos aquí sin redirección, significa que hubo un error
      console.log('Proceso de OAuth iniciado')
      
    } catch (error) {
      console.error('Error en autenticación con Google:', error)
      onError('Error al iniciar sesión con Google. Inténtalo de nuevo.')
      setIsLoading(false)
    }
    // Nota: setIsLoading(false) se omite intencionalmente aquí porque 
    // habrá una redirección a Google y el componente se desmontará
  }

  return (
    <motion.button
      type="button"
      onClick={handleGoogleLogin}
      disabled={disabled || isLoading}
      className={`w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${className}`}
      whileHover={!disabled && !isLoading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <GoogleIcon />
      )}
      
      <span className="text-sm font-medium">
        {isLoading ? 'Conectando...' : text}
      </span>
    </motion.button>
  )
}

// Componente del ícono de Google SVG
const GoogleIcon: React.FC = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    className="flex-shrink-0"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

// Componente separador "O continúa con"
interface AuthSeparatorProps {
  text?: string
}

export const AuthSeparator: React.FC<AuthSeparatorProps> = ({ 
  text = "O continúa con" 
}) => (
  <div className="relative my-6">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-gray-300" />
    </div>
    <div className="relative flex justify-center text-sm">
      <span className="px-4 bg-white text-gray-500 font-medium">
        {text}
      </span>
    </div>
  </div>
)

// Hook para manejar el estado de Google Auth
export const useGoogleAuth = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const login = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Importar dinámicamente el servicio de Google Auth
      const { GoogleAuthService } = await import('../../lib/googleAuth')
      const authService = GoogleAuthService.getInstance()
      
      // Realizar login con Google
      const googleUser = await authService.signIn()
      
      // Formatear los datos del usuario para consistencia
      const userData = {
        id: googleUser.sub || googleUser.id || 'google_' + Math.random().toString(36).substr(2, 9),
        name: googleUser.name || googleUser.given_name || 'Usuario de Google',
        email: googleUser.email || 'usuario@gmail.com',
        picture: googleUser.picture || 'https://lh3.googleusercontent.com/a/default-user=s96-c',
        provider: 'google'
      }

      console.log('useGoogleAuth - Datos del usuario:', userData)
      return userData
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error de autenticación con Google')
      setError(error)
      console.error('Error en useGoogleAuth:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return { isLoading, error, login }
}