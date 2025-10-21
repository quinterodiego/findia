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
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode)

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md"
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
                    />
                    
                    {/* Toggle to Register */}
                    <div className="mt-6 text-center bg-white rounded-b-2xl pb-6">
                      <p className="text-gray-600">
                        ¿No tienes cuenta?{' '}
                        <button
                          onClick={() => setMode('register')}
                          className="text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                        >
                          Regístrate gratis
                        </button>
                      </p>
                    </div>
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
                    <RegisterForm onClose={onClose} />
                    
                    {/* Toggle to Login */}
                    <div className="mt-6 text-center bg-white rounded-b-2xl pb-6">
                      <p className="text-gray-600">
                        ¿Ya tienes cuenta?{' '}
                        <button
                          onClick={() => setMode('login')}
                          className="text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                        >
                          Inicia sesión
                        </button>
                      </p>
                    </div>
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
                    <div className="bg-white rounded-2xl shadow-2xl p-8">
                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Recuperar Contraseña 🔐
                        </h2>
                        <p className="text-gray-600">
                          Te enviaremos un enlace para restablecer tu contraseña
                        </p>
                      </div>
                      
                      <form className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Correo Electrónico
                          </label>
                          <input
                            type="email"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="tu@email.com"
                          />
                        </div>
                        
                        <button
                          type="submit"
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200"
                        >
                          Enviar Enlace
                        </button>
                      </form>
                      
                      <button
                        onClick={() => setMode('login')}
                        className="mt-4 w-full text-center text-blue-600 hover:text-blue-800 transition-colors"
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
