import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react'
import { LoginFormData } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { FeedbackMessage, ButtonWithLoading } from './FeedbackComponents'
import { GoogleLoginButton, AuthSeparator } from './GoogleAuth'
import { useGoogleAuth } from './useGoogleAuth'

interface LoginFormProps {
  onForgotPassword?: () => void
  onClose?: () => void
}

interface FieldErrors {
  email?: string
  password?: string
}

export const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword, onClose }) => {
  const { login, isLoading } = useAuth()
  const { 
    isLoading: isGoogleLoading, 
    error: googleError, 
    loginWithGoogle, 
    clearError: clearGoogleError 
  } = useGoogleAuth()
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false
  })

  // Función para validar email
  const validateEmail = (email: string): string | undefined => {
    if (!email) return 'El email es requerido'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Formato de email inválido'
    return undefined
  }

  // Función para validar password
  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'La contraseña es requerida'
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    return undefined
  }

  // Validar campos cuando cambian
  useEffect(() => {
    const errors: FieldErrors = {}
    
    if (touched.email && formData.email) {
      const emailError = validateEmail(formData.email)
      if (emailError) errors.email = emailError
    }
    
    if (touched.password && formData.password) {
      const passwordError = validatePassword(formData.password)
      if (passwordError) errors.password = passwordError
    }
    
    setFieldErrors(errors)
  }, [formData, touched])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    // Marcar todos los campos como tocados para mostrar errores
    setTouched({ email: true, password: true })

    // Validar todos los campos
    const emailError = validateEmail(formData.email)
    const passwordError = validatePassword(formData.password)

    if (emailError || passwordError) {
      setFieldErrors({
        email: emailError,
        password: passwordError
      })
      setMessage({ type: 'error', text: 'Por favor corrige los errores en el formulario' })
      return
    }

    const result = await login(formData.email, formData.password)
    
    if (result.success) {
      setMessage({ type: 'success', text: result.message })
      setTimeout(() => {
        onClose?.()
      }, 1500)
    } else {
      setMessage({ type: 'error', text: result.message })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }))
  }

  const handleFocus = () => {
    setMessage(null) // Limpiar mensajes cuando el usuario empiece a escribir
    clearGoogleError() // También limpiar errores de Google
  }

  const handleGoogleSuccess = async () => {
    try {
      await loginWithGoogle()
      setMessage({ type: 'success', text: '¡Inicio de sesión exitoso con Google!' })
      setTimeout(() => {
        onClose?.()
      }, 1500)
    } catch (error) {
      // El error ya se maneja en el hook
    }
  }

  const handleGoogleError = (error: string) => {
    setMessage({ type: 'error', text: error })
  }

  // Navegación por teclado
  const handleKeyDown = (e: React.KeyboardEvent, field: 'email' | 'password') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      
      if (field === 'email' && formData.email) {
        // Si estamos en el campo email y hay texto, ir al siguiente campo (password)
        const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement
        passwordInput?.focus()
      } else if (field === 'password' && formData.password) {
        // Si estamos en el campo password y hay texto, enviar el formulario
        if (!fieldErrors.email && !fieldErrors.password) {
          const form = document.querySelector('form') as HTMLFormElement
          form?.requestSubmit()
        }
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 pt-16">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Bienvenido de vuelta! 👋
          </h2>
          <p className="text-gray-600">
            Inicia sesión para continuar tu camino hacia la libertad financiera
          </p>
        </div>

        {(message || googleError) && (
          <FeedbackMessage
            type={(message?.type === 'error' || googleError) ? 'error' : 'success'}
            message={googleError || message?.text || ''}
            className="mb-4"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={() => handleBlur('email')}
                onFocus={handleFocus}
                onKeyDown={(e) => handleKeyDown(e, 'email')}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 ${
                  fieldErrors.email 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                tabIndex={1}
              />
            </div>
            {fieldErrors.email && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-sm text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="h-4 w-4" />
                {fieldErrors.email}
              </motion.p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={() => handleBlur('password')}
                onFocus={handleFocus}
                onKeyDown={(e) => handleKeyDown(e, 'password')}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 ${
                  fieldErrors.password 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                tabIndex={2}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {fieldErrors.password && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-sm text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="h-4 w-4" />
                {fieldErrors.password}
              </motion.p>
            )}
          </div>

          <ButtonWithLoading
            type="submit"
            isLoading={isLoading || isGoogleLoading}
            loadingText="Iniciando sesión..."
            disabled={isLoading || isGoogleLoading}
          >
            Iniciar Sesión
          </ButtonWithLoading>
        </form>

        <AuthSeparator />

        <GoogleLoginButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          text="Continúa con Google"
          disabled={isLoading || isGoogleLoading}
        />

        <div className="mt-6 text-center">
          <button 
            onClick={onForgotPassword}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>
    </motion.div>
  )
}