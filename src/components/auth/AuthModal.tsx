import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, ArrowLeft } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  initialMode = 'login' 
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login')
  const [isAnimating, setIsAnimating] = useState(false)

  // Resetear al modo inicial cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
    }
  }, [isOpen]) // Solo depende de isOpen, no de initialMode

  // Función para cambiar modo sin animación compleja
  const switchMode = (newMode: 'login' | 'register' | 'forgot-password') => {
    if (isAnimating) return // Prevenir múltiples clics
    
    setIsAnimating(true)
    setMode(newMode)
    
    // Breve delay para prevenir clics múltiples
    setTimeout(() => {
      setIsAnimating(false)
    }, 100)
  }

  // Cerrar modal con escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ 
          duration: 0.3,
          ease: [0.16, 1, 0.3, 1] // Custom easing for smoother animation
        }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md"
      >
        {/* Header with navigation */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          <div className="flex items-center space-x-2">
            {mode === 'forgot-password' ? (
              <button
                onClick={() => switchMode('login')}
                disabled={isAnimating}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="text-sm font-medium">Volver</span>
              </button>
            ) : (
              /* Mode indicator */
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => switchMode('login')}
                  disabled={isAnimating}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                    mode === 'login'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={() => switchMode('register')}
                  disabled={isAnimating}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                    mode === 'register'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Registrarse
                </button>
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-all duration-200 hover:scale-105"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content - sin AnimatePresence para evitar el parpadeo */}
        <div className="relative">
          {mode === 'login' && (
            <LoginForm
              onForgotPassword={() => switchMode('forgot-password')}
              onClose={onClose}
            />
          )}
          {mode === 'register' && (
            <RegisterForm
              onClose={onClose}
            />
          )}
          {mode === 'forgot-password' && (
            <ForgotPasswordForm
              onBack={() => switchMode('login')}
              onClose={onClose}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}