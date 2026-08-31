'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import LoginForm from './auth/LoginForm'
import RegisterForm from './auth/RegisterForm'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
  /** Propagado tal cual a LoginForm/RegisterForm. Opcional — si no se pasa,
   * ambos formularios mantienen su default de '/dashboard' sin ningún
   * cambio de comportamiento. */
  callbackUrl?: string
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login', callbackUrl }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loginIsProcessing, setLoginIsProcessing] = useState(false)

  // Escuchar eventos personalizados para cambiar de modo
  useEffect(() => {
    const handleSwitchToLogin = () => setMode('login')
    const handleSwitchToRegister = () => setMode('register')

    window.addEventListener('switchToLogin', handleSwitchToLogin)
    window.addEventListener('switchToRegister', handleSwitchToRegister)

    return () => {
      window.removeEventListener('switchToLogin', handleSwitchToLogin)
      window.removeEventListener('switchToRegister', handleSwitchToRegister)
    }
  }, [])
  
  const handleRegisterStateChange = (isLoading: boolean, showSuccess: boolean, isRedirecting: boolean) => {
    setIsProcessing(isLoading || showSuccess || isRedirecting)
  }
  
  const handleLoginStateChange = (isLoading: boolean, showSuccess: boolean, isRedirecting: boolean) => {
    setLoginIsProcessing(isLoading || showSuccess || isRedirecting)
  }

  // Actualizar el modo cuando cambie initialMode
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
    }
  }, [initialMode, isOpen])

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Manejar cierre con tecla ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto py-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>

              {/* Content */}
              <AnimatePresence mode="wait">
                {mode === 'login' && (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LoginForm
                      onForgotPassword={() => setMode('forgot')}
                      onClose={onClose}
                      onStateChange={handleLoginStateChange}
                      onSwitchToRegister={() => setMode('register')}
                      callbackUrl={callbackUrl}
                    />
                  </motion.div>
                )}

                {mode === 'register' && (
                  <motion.div
                    key="register"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RegisterForm onClose={onClose} onStateChange={handleRegisterStateChange} callbackUrl={callbackUrl} />
                  </motion.div>
                )}

                {mode === 'forgot' && (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 pt-10 sm:pt-14">
                      <div className="text-center mb-5">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Recuperar contraseña
                        </h2>
                        <p className="text-gray-600">
                          Te enviaremos un enlace para restablecer tu contraseña.
                        </p>
                      </div>

                      <form className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Correo Electrónico
                          </label>
                          <input
                            type="email"
                            className="w-full px-4 py-3 bg-white text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF3A5F]/20 focus:border-[#FF3A5F] transition-colors duration-200"
                            placeholder="tu@email.com"
                          />
                        </div>

                        <motion.button
                          type="submit"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 text-white py-3 px-4 rounded-xl font-medium transition-all duration-300 cursor-pointer"
                        >
                          Enviar enlace
                        </motion.button>
                      </form>

                      <button
                        onClick={() => setMode('login')}
                        className="mt-4 w-full text-center text-sm text-gray-500 hover:text-[#FF3A5F] transition-colors duration-200 cursor-pointer"
                      >
                        ← Volver al inicio de sesión
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
