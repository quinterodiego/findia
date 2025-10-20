import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react'
import { RegisterFormData } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { ValidationUtils } from '@/lib/utils'
import { FeedbackMessage, ButtonWithLoading } from './FeedbackComponents'
import { GoogleLoginButton, AuthSeparator, useGoogleAuth } from './GoogleAuth'

interface RegisterFormProps {
  onClose?: () => void
}

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onClose }) => {
  const { register, isLoading, loginWithProvider } = useAuth()
  const { 
    isLoading: isGoogleLoading, 
    error: googleError
  } = useGoogleAuth()
  
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<{
    name: boolean
    email: boolean
    password: boolean
    confirmPassword: boolean
  }>({
    name: false,
    email: false,
    password: false,
    confirmPassword: false
  })

  // Funciones de validación individuales
  const validateName = (name: string): string | undefined => {
    if (!name.trim()) return 'El nombre es requerido'
    if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres'
    return undefined
  }

  const validateEmail = (email: string): string | undefined => {
    if (!email) return 'El email es requerido'
    if (!ValidationUtils.isValidEmail(email)) return 'Formato de email inválido'
    return undefined
  }

  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'La contraseña es requerida'
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    return undefined
  }

  const validateConfirmPassword = (password: string, confirmPassword: string): string | undefined => {
    if (!confirmPassword) return 'Confirma tu contraseña'
    if (password !== confirmPassword) return 'Las contraseñas no coinciden'
    return undefined
  }

  // Validar campos cuando cambian
  useEffect(() => {
    const errors: FieldErrors = {}
    
    if (touched.name && formData.name) {
      const nameError = validateName(formData.name)
      if (nameError) errors.name = nameError
    }
    
    if (touched.email && formData.email) {
      const emailError = validateEmail(formData.email)
      if (emailError) errors.email = emailError
    }
    
    if (touched.password && formData.password) {
      const passwordError = validatePassword(formData.password)
      if (passwordError) errors.password = passwordError
    }
    
    if (touched.confirmPassword && formData.confirmPassword) {
      const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword)
      if (confirmPasswordError) errors.confirmPassword = confirmPasswordError
    }
    
    setFieldErrors(errors)
  }, [formData, touched])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    // Marcar todos los campos como tocados
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true
    })

    // Validar todos los campos
    const nameError = validateName(formData.name)
    const emailError = validateEmail(formData.email)
    const passwordError = validatePassword(formData.password)
    const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword)

    if (nameError || emailError || passwordError || confirmPasswordError) {
      setFieldErrors({
        name: nameError,
        email: emailError,
        password: passwordError,
        confirmPassword: confirmPasswordError
      })
      setMessage({ type: 'error', text: 'Por favor corrige los errores en el formulario' })
      return
    }

    const result = await register(formData.name, formData.email, formData.password)
    
    if (result.success) {
      setMessage({ type: 'success', text: result.message })
      setTimeout(() => {
        onClose?.()
      }, 2000)
    } else {
      setMessage({ type: 'error', text: result.message })
    }
  }

  const handleGoogleSuccess = async (googleUser: any) => {
    try {
      const result = await loginWithProvider(googleUser)
      if (result.success) {
        setMessage({ type: 'success', text: 'Registro exitoso con Google' })
        setTimeout(() => {
          onClose?.()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al registrarse con Google' })
    }
  }

  const handleGoogleError = () => {
    setMessage({ type: 'error', text: 'Error al conectar con Google' })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }))
  }

  const handleFocus = () => {
    setMessage(null) // Limpiar mensajes cuando el usuario empiece a escribir
  }

  // Navegación por teclado
  const handleKeyDown = (e: React.KeyboardEvent, field: keyof typeof formData) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      
      const fieldOrder: (keyof typeof formData)[] = ['name', 'email', 'password', 'confirmPassword']
      const currentIndex = fieldOrder.indexOf(field)
      const nextField = fieldOrder[currentIndex + 1]
      
      if (nextField) {
        // Ir al siguiente campo
        const nextInput = document.querySelector(`input[name="${nextField}"]`) as HTMLInputElement
        nextInput?.focus()
      } else {
        // Estamos en el último campo, enviar formulario si es válido
        const hasErrors = Object.values(fieldErrors).some(error => error)
        if (!hasErrors && Object.values(formData).every(value => value.trim())) {
          const form = document.querySelector('form') as HTMLFormElement
          form?.requestSubmit()
        }
      }
    }
  }

  const getPasswordStrength = (password: string): { strength: number; color: string; text: string } => {
    if (password.length < 4) return { strength: 0, color: 'bg-red-500', text: 'Muy débil' }
    if (password.length < 6) return { strength: 25, color: 'bg-orange-500', text: 'Débil' }
    if (password.length < 8) return { strength: 50, color: 'bg-yellow-500', text: 'Regular' }
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { strength: 100, color: 'bg-green-500', text: 'Fuerte' }
    }
    return { strength: 75, color: 'bg-blue-500', text: 'Buena' }
  }

  const passwordStrength = getPasswordStrength(formData.password)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 pt-12 sm:pt-16">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Únete a FindIA! 🚀
          </h2>
          <p className="text-gray-600">
            Crea tu cuenta y comienza tu camino hacia la libertad financiera
          </p>
        </div>

        {(message || googleError) && (
          <FeedbackMessage
            type={message?.type === 'success' ? 'success' : 'error'}
            message={message?.text || googleError?.message || 'Error inesperado'}
            className="mb-4"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={() => handleBlur('name')}
                onFocus={handleFocus}
                onKeyDown={(e) => handleKeyDown(e, 'name')}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 ${
                  fieldErrors.name 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Tu nombre completo"
                required
                autoComplete="name"
                tabIndex={1}
              />
            </div>
            {fieldErrors.name && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-sm text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="h-4 w-4" />
                {fieldErrors.name}
              </motion.p>
            )}
          </div>

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
                tabIndex={2}
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
                autoComplete="new-password"
                tabIndex={3}
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
            
            {fieldErrors.password ? (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-sm text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="h-4 w-4" />
                {fieldErrors.password}
              </motion.p>
            ) : formData.password && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-600">Seguridad de contraseña:</span>
                  <span className={`text-xs font-medium ${passwordStrength.color.replace('bg-', 'text-')}`}>
                    {passwordStrength.text}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.strength}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={() => handleBlur('confirmPassword')}
                onFocus={handleFocus}
                onKeyDown={(e) => handleKeyDown(e, 'confirmPassword')}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 ${
                  fieldErrors.confirmPassword 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                tabIndex={4}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            
            {fieldErrors.confirmPassword ? (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-sm text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="h-4 w-4" />
                {fieldErrors.confirmPassword}
              </motion.p>
            ) : formData.confirmPassword && (
              <div className="mt-1 flex items-center space-x-1">
                {formData.password === formData.confirmPassword ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-600">Las contraseñas coinciden</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-red-600">Las contraseñas no coinciden</span>
                  </>
                )}
              </div>
            )}
          </div>

          <ButtonWithLoading
            type="submit"
            isLoading={isLoading || isGoogleLoading}
            loadingText="Creando cuenta..."
            disabled={isLoading || isGoogleLoading}
            variant="primary"
            className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 focus:ring-green-500"
          >
            Crear Cuenta
          </ButtonWithLoading>
        </form>

        <AuthSeparator />

        <GoogleLoginButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          text="Regístrate con Google"
          disabled={isLoading || isGoogleLoading}
        />

        <div className="mt-6 text-xs text-gray-500 text-center">
          Al crear una cuenta, aceptas nuestros{' '}
          <a href="#" className="text-blue-600 hover:underline">Términos de Servicio</a>
          {' '}y{' '}
          <a href="#" className="text-blue-600 hover:underline">Política de Privacidad</a>
        </div>
      </div>
    </motion.div>
  )
}