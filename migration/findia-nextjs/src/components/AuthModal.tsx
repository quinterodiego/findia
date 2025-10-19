'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import LoginForm from './auth/LoginForm'
import RegisterForm from './auth/RegisterForm'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

function AuthModal({ 
  isOpen, 
  onClose, 
  initialMode = 'login' 
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [isAnimating, setIsAnimating] = useState(false)

  // Resetear al modo inicial cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
    }
  }, [isOpen, initialMode])

  // Función para cambiar modo sin animación compleja
  const switchMode = (newMode: 'login' | 'register') => {
    if (isAnimating) return
    setIsAnimating(true)
    setMode(newMode)
    setTimeout(() => setIsAnimating(false), 300)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md"
      >
        {/* Header con navegación y close */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          {/* Mode indicator/tabs */}
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
            <LoginForm onClose={onClose} />
          )}
          {mode === 'register' && (
            <RegisterForm onClose={onClose} />
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default AuthModal