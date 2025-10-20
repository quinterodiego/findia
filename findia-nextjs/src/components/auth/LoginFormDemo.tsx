'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, AlertCircle, User } from 'lucide-react'
import { signIn } from 'next-auth/react'

interface LoginFormProps {
  onForgotPassword?: () => void
  onClose?: () => void
}

interface FieldErrors {
  email?: string
  password?: string
}

interface LoginFormData {
  email: string
  password: string
}

export default function LoginFormDemo({ onForgotPassword, onClose }: LoginFormProps) {
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
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsLoading(true)

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
      setIsLoading(false)
      return
    }

    try {
      // Simulación de login demo exitoso
      setMessage({ type: 'success', text: '¡Demo mode! Redirigiendo al dashboard...' })
      setTimeout(() => {
        window.location.href = '/dashboard'
        onClose?.()
      }, 1500)
    } catch (error) {
      console.error('Login error:', error)
      setMessage({ type: 'error', text: 'Error en modo demo. Intenta nuevamente.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true)
      setMessage({ type: 'error', text: 'Google OAuth no está configurado. Revisa GOOGLE_OAUTH_SETUP.md para configurarlo.' })
    } catch (err) {
      console.error('Error signing in:', err)
    } finally {
      setIsGoogleLoading(false)
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
    setMessage(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent, field: 'email' | 'password') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (field === 'email') {
        const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement
        passwordInput?.focus()
      } else if (field === 'password') {
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
      <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 pt-12 sm:pt-16">
        {/* Demo Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-800 font-medium">Modo Demo</p>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Google OAuth no configurado. Usa cualquier email/contraseña para probar.
          </p>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Bienvenido de vuelta! 👋
          </h2>
          <p className="text-gray-600">
            Inicia sesión para continuar tu camino hacia la libertad financiera
          </p>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 ${
            message.type === 'error' 
              ? 'bg-red-50 border border-red-200 text-red-800' 
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            <p className="text-sm font-medium">{message.text}</p>
          </div>
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
                placeholder="demo@findia.com"
                autoComplete="email"
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
                placeholder="demo123"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer"
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

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-600">Recordarme</span>
            </label>
            
            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión (Demo)'}
          </button>
        </form>

        {/* Separador */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500 bg-white">o continúa con</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Google Login Button - Disabled with explanation */}
        <button
          onClick={handleGoogleSignIn}
          disabled={true}
          className="w-full bg-gray-100 border border-gray-300 text-gray-500 py-3 px-4 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-3"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" className="opacity-50">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 16c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.53H1.83v2.07A8 8 0 0 0 8.98 16z"/>
            <path fill="#FBBC05" d="M4.5 9.49a4.8 4.8 0 0 1 0-3.07V4.35H1.83a8 8 0 0 0 0 7.17l2.67-2.03z"/>
            <path fill="#EA4335" d="M8.98 3.2c1.3 0 2.28.4 3.14 1.13L14.3 2.16A8 8 0 0 0 1.83 4.35l2.67 2.07A4.8 4.8 0 0 1 8.98 3.2z"/>
          </svg>
          Google OAuth (No configurado)
        </button>

        <p className="text-center text-xs text-gray-500 mt-3">
          Lee <code className="bg-gray-100 px-1 rounded">GOOGLE_OAUTH_SETUP.md</code> para configurar Google OAuth
        </p>
      </div>
    </motion.div>
  )
}