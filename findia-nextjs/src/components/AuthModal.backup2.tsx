'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react'
import { signIn } from 'next-auth/react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

interface LoginFormData {
  email: string
  password: string
}

interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
}

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  
  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: ''
  })
  
  const [registerData, setRegisterData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  
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

  // Sync mode with initialMode
  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  // Reset form when modal closes or mode changes
  useEffect(() => {
    if (!isOpen) {
      setLoginData({ email: '', password: '' })
      setRegisterData({ name: '', email: '', password: '', confirmPassword: '' })
      setFieldErrors({})
      setTouched({ name: false, email: false, password: false, confirmPassword: false })
      setMessage(null)
      setShowPassword(false)
      setShowConfirmPassword(false)
    }
  }, [isOpen])

  useEffect(() => {
    setFieldErrors({})
    setTouched({ name: false, email: false, password: false, confirmPassword: false })
    setMessage(null)
    setMode(initialMode)
  }, [mode, initialMode])

  // Validation functions
  const validateName = (name: string): string | undefined => {
    if (!name.trim()) return 'El nombre es requerido'
    if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres'
    return undefined
  }

  const validateEmail = (email: string): string | undefined => {
    if (!email) return 'El email es requerido'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Formato de email inválido'
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

  // Validate fields when they change
  useEffect(() => {
    const errors: FieldErrors = {}
    const currentData = mode === 'login' ? loginData : registerData

    if (mode === 'register' && touched.name && registerData.name) {
      const nameError = validateName(registerData.name)
      if (nameError) errors.name = nameError
    }

    if (touched.email && currentData.email) {
      const emailError = validateEmail(currentData.email)
      if (emailError) errors.email = emailError
    }

    if (touched.password && currentData.password) {
      const passwordError = validatePassword(currentData.password)
      if (passwordError) errors.password = passwordError
    }

    if (mode === 'register' && touched.confirmPassword && registerData.confirmPassword) {
      const confirmPasswordError = validateConfirmPassword(registerData.password, registerData.confirmPassword)
      if (confirmPasswordError) errors.confirmPassword = confirmPasswordError
    }

    setFieldErrors(errors)
  }, [loginData, registerData, touched, mode])

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      await signIn('google', { 
        callbackUrl: '/dashboard',
        redirect: true
      })
    } catch (err) {
      console.error('Error signing in:', err)
      setMessage({ type: 'error', text: 'Error al conectar con Google' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    
    // Mark all fields as touched
    setTouched({ ...touched, email: true, password: true })
    
    // Validate all fields
    const emailError = validateEmail(loginData.email)
    const passwordError = validatePassword(loginData.password)
    
    if (emailError || passwordError) {
      setFieldErrors({
        email: emailError,
        password: passwordError
      })
      setMessage({ type: 'error', text: 'Por favor corrige los errores en el formulario' })
      return
    }

    setIsLoading(true)
    try {
      const result = await signIn('credentials', {
        email: loginData.email,
        password: loginData.password,
        redirect: false
      })

      if (result?.error) {
        setMessage({ type: 'error', text: 'Credenciales incorrectas' })
      } else {
        setMessage({ type: 'success', text: 'Iniciando sesión...' })
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1000)
      }
    } catch (err) {
      console.error('Login error:', err)
      setMessage({ type: 'error', text: 'Error al iniciar sesión' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    
    // Mark all fields as touched
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true
    })
    
    // Validate all fields
    const nameError = validateName(registerData.name)
    const emailError = validateEmail(registerData.email)
    const passwordError = validatePassword(registerData.password)
    const confirmPasswordError = validateConfirmPassword(registerData.password, registerData.confirmPassword)
    
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

    setIsLoading(true)
    try {
      // Here you would typically register the user via API
      // For now, we'll simulate success and redirect to login
      setMessage({ type: 'success', text: 'Cuenta creada exitosamente. Iniciando sesión...' })
      setTimeout(() => {
        setMode('login')
        setMessage(null)
      }, 2000)
    } catch (err) {
      console.error('Registration error:', err)
      setMessage({ type: 'error', text: 'Error al crear la cuenta' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (mode === 'login') {
      setLoginData(prev => ({ ...prev, [name]: value }))
    } else {
      setRegisterData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const handleFocus = () => {
    setMessage(null)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      
      const loginFieldOrder = ['email', 'password']
      const registerFieldOrder = ['name', 'email', 'password', 'confirmPassword']
      const fieldOrder = mode === 'login' ? loginFieldOrder : registerFieldOrder
      
      const currentIndex = fieldOrder.indexOf(field)
      const nextField = fieldOrder[currentIndex + 1]
      
      if (nextField) {
        const nextInput = document.querySelector(`input[name="${nextField}"]`) as HTMLInputElement
        nextInput?.focus()
      } else {
        // Submit form if on last field and no errors
        const hasErrors = Object.values(fieldErrors).some(error => error)
        const currentData = mode === 'login' ? loginData : registerData
        const allFieldsFilled = Object.values(currentData).every(value => value.toString().trim())
        
        if (!hasErrors && allFieldsFilled) {
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

  const passwordStrength = mode === 'register' ? getPasswordStrength(registerData.password) : null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Navigation Tabs */}
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMode('login')
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMode('register')
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  mode === 'register'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Registrarse
              </button>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {mode === 'login' ? '¡Bienvenido de vuelta! 👋' : '¡Únete a FindIA! 🚀'}
              </h2>
              <p className="text-gray-600">
                {mode === 'login' 
                  ? 'Inicia sesión para continuar tu camino hacia la libertad financiera'
                  : 'Crea tu cuenta y comienza tu camino hacia la libertad financiera'
                }
              </p>
              <p className="text-xs text-red-500 mt-2">DEBUG: Current mode = {mode}</p>
            </div>

            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                  message.type === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {message.text}
              </motion.div>
            )}

            <form onSubmit={mode === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={registerData.name}
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
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={mode === 'login' ? loginData.email : registerData.email}
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
                    tabIndex={mode === 'login' ? 1 : 2}
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
                    value={mode === 'login' ? loginData.password : registerData.password}
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
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    tabIndex={mode === 'login' ? 2 : 3}
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
                ) : mode === 'register' && registerData.password && passwordStrength && (
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

              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={registerData.confirmPassword}
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
                  ) : registerData.confirmPassword && (
                    <div className="mt-1 flex items-center space-x-1">
                      {registerData.password === registerData.confirmPassword ? (
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
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:ring-blue-500'
                    : 'bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 focus:ring-green-500'
                } text-white focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {mode === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...'}
                  </>
                ) : (
                  mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'
                )}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">o</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {mode === 'login' ? 'Continuar con Google' : 'Regístrate con Google'}
            </button>

            <p className="text-xs text-gray-500 text-center mt-6">
              Al continuar, aceptas nuestros{' '}
              <a href="#" className="text-blue-600 hover:underline">
                Términos de Servicio
              </a>{' '}
              y{' '}
              <a href="#" className="text-blue-600 hover:underline">
                Política de Privacidad
              </a>
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default AuthModal