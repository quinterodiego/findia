import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Mail, Calendar, Shield, Settings, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface UserProfileProps {
  isOpen: boolean
  onClose: () => void
}

export const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'info' | 'settings'>('info')

  // Debug del usuario
  React.useEffect(() => {
    if (user && isOpen) {
      console.log('👤 Datos del usuario en perfil:', user)
    }
  }, [user, isOpen])

  if (!user) return null

  const adminEmails = ['coderflixarg@gmail.com', 'd86webs@gmail.com']
  const isAdmin = adminEmails.includes(user.email)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="
              fixed top-20 right-4 sm:right-6
              bg-white rounded-xl shadow-2xl z-50
              w-full max-w-sm sm:max-w-md max-h-[80vh] overflow-hidden
              origin-top-right
            "
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Mi Perfil</h2>
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Avatar y info básica */}
              <div className="flex items-center gap-4 mt-4">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-16 h-16 rounded-full border-2 border-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                    <User className="h-8 w-8 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{user.name}</h3>
                  <p className="text-blue-100 text-sm">{user.email}</p>
                  {user.provider && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-400 text-blue-900 text-xs font-medium mt-1">
                      Cuenta {user.provider === 'google' ? 'Google' : user.provider}
                    </span>
                  )}
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-400 text-yellow-900 text-xs font-medium mt-1 ml-1">
                      <Shield className="h-3 w-3" />
                      Administrador
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('info')}
                className={`
                  flex-1 px-4 py-3 text-sm font-medium transition-colors
                  ${activeTab === 'info'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                Información
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`
                  flex-1 px-4 py-3 text-sm font-medium transition-colors
                  ${activeTab === 'settings'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                Configuración
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {activeTab === 'info' && (
                <div className="space-y-4">
                  {/* Información personal */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Información Personal</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">Nombre completo</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          <div className="text-xs text-gray-500">Correo electrónico</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(user.createdAt)}
                          </div>
                          <div className="text-xs text-gray-500">Miembro desde</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información de la cuenta */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Información de la Cuenta</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">ID de Usuario</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {user.id.substring(0, 8)}...
                        </code>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Proveedor</span>
                        <span className="text-sm font-medium capitalize">
                          {user.provider || 'Email'}
                        </span>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Rol</span>
                          <span className="text-sm font-medium text-yellow-600">
                            Administrador
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Configuración de la Cuenta</h4>
                    <div className="space-y-3">
                      
                      {/* Gestión de sesión */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-2">Sesión</h5>
                        <p className="text-sm text-gray-600 mb-3">
                          Gestiona tu sesión actual y cierra sesión cuando sea necesario.
                        </p>
                        <button
                          onClick={() => {
                            logout()
                            onClose()
                          }}
                          className="
                            w-full px-4 py-2 bg-red-600 text-white rounded-md
                            hover:bg-red-700 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1
                          "
                        >
                          Cerrar Sesión
                        </button>
                      </div>

                      {/* Información de desarrollo */}
                      {import.meta.env.DEV && (
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Modo Desarrollo
                          </h5>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>• Funciones de debug habilitadas</div>
                            <div>• Panel de administrador disponible</div>
                            <div>• Logs detallados en consola</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default UserProfile