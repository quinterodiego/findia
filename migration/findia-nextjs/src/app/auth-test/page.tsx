"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { LogIn, UserPlus, Shield, Eye, Settings } from 'lucide-react'
import AuthModal from '@/components/AuthModal'

export default function AuthTestPage() {
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'login' as 'login' | 'register'
  })

  const openModal = (mode: 'login' | 'register') => {
    setModalState({ isOpen: true, mode })
  }

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }))
  }

  const testScenarios = [
    {
      id: 'login',
      title: 'Iniciar Sesión',
      description: 'Modal configurado para login de usuarios existentes',
      icon: LogIn,
      color: 'blue',
      action: () => openModal('login')
    },
    {
      id: 'register',
      title: 'Registro',
      description: 'Modal configurado para registro de nuevos usuarios',
      icon: UserPlus,
      color: 'green',
      action: () => openModal('register')
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AuthModal - Testing Page
          </h1>
          <p className="text-gray-600 text-lg">
            Prueba las diferentes configuraciones del modal de autenticación
          </p>
        </motion.div>

        {/* Test Scenarios */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {testScenarios.map((scenario, index) => {
            const Icon = scenario.icon
            return (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 bg-${scenario.color}-100 rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${scenario.color}-600`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {scenario.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {scenario.description}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={scenario.action}
                  className={`w-full py-3 px-4 bg-${scenario.color}-600 hover:bg-${scenario.color}-700 text-white font-medium rounded-lg transition-colors`}
                >
                  Abrir Modal de {scenario.title}
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* Features List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-md p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Características del AuthModal
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Funcionalidades</h4>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Integración con NextAuth.js
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Autenticación con Google OAuth
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Acceso al modo demo
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Toggle entre Login/Registro
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">UX/UI</h4>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Animaciones con Framer Motion
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Loading states visuales
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Manejo de errores
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Cierre con Escape
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-900">
              Instrucciones de Prueba
            </h3>
          </div>
          
          <div className="text-yellow-800 space-y-2">
            <p>
              <strong>1. Prueba los modos:</strong> Haz clic en los botones arriba para abrir el modal en modo Login o Registro.
            </p>
            <p>
              <strong>2. Navegación:</strong> Usa el toggle en el modal para cambiar entre modos.
            </p>
            <p>
              <strong>3. Demo:</strong> Prueba el botón &ldquo;Explorar Demo&rdquo; para ir al modo demo sin autenticación.
            </p>
            <p>
              <strong>4. Cierre:</strong> Usa el botón X, la tecla Escape, o haz clic fuera del modal para cerrarlo.
            </p>
            <p>
              <strong>5. Autenticación:</strong> Prueba el flujo completo con Google OAuth (requiere configuración).
            </p>
          </div>
        </motion.div>
      </div>

      {/* AuthModal */}
      <AuthModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        initialMode={modalState.mode}
      />
    </div>
  )
}