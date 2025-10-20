"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Mail, Calendar, Shield, Settings, X } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'

interface UserProfileProps {
  isOpen: boolean
  onClose: () => void
}

export const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'info' | 'settings'>('info')
  const user = session?.user

  // Debug del usuario
  React.useEffect(() => {
    if (user && isOpen) {
      console.log('👤 Datos del usuario en perfil:', user)
    }
  }, [user, isOpen])

  if (!user) return null

  const adminEmails = ['coderflixarg@gmail.com', 'd86webs@gmail.com', 'dquintero@outlook.com']
  const isAdmin = adminEmails.includes(user.email || '')

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return 'Fecha no disponible'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' })
    onClose()
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
                  className="text-white hover:text-gray-200 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Avatar y info básica */}
              <div className="flex items-center gap-4 mt-4">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || 'Usuario'}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full border-2 border-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                    <User className="h-8 w-8 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{user.name || 'Usuario'}</h3>
                  <p className="text-blue-100 text-sm">{user.email}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-400 text-blue-900 text-xs font-medium mt-1">
                    Cuenta Google
                  </span>
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
                  flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer
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
                  flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer
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
                          <div className="text-sm font-medium text-gray-900">{user.name || 'Usuario'}</div>
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
                            {formatDate(new Date())}
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
                        <span className="text-sm text-gray-600">Proveedor</span>
                        <span className="text-sm font-medium">Google OAuth</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Estado</span>
                        <span className="text-sm font-medium text-green-600">Activo</span>
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

                  {/* Estadísticas de uso */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Estadísticas</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">5</div>
                        <div className="text-xs text-blue-600">Deudas Activas</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">68%</div>
                        <div className="text-xs text-green-600">Progreso Total</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Configuración de la Cuenta</h4>
                    <div className="space-y-3">

                      {/* Preferencias */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-2">Preferencias</h5>
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input type="checkbox" className="mr-2" defaultChecked />
                            <span className="text-sm text-gray-600">Notificaciones por email</span>
                          </label>
                          <label className="flex items-center">
                            <input type="checkbox" className="mr-2" defaultChecked />
                            <span className="text-sm text-gray-600">Recordatorios de pagos</span>
                          </label>
                          <label className="flex items-center">
                            <input type="checkbox" className="mr-2" />
                            <span className="text-sm text-gray-600">Actualizaciones del producto</span>
                          </label>
                        </div>
                      </div>

                      {/* Gestión de sesión */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-2">Sesión</h5>
                        <p className="text-sm text-gray-600 mb-3">
                          Gestiona tu sesión actual y cierra sesión cuando sea necesario.
                        </p>
                        <button
                          onClick={handleLogout}
                          className="
                            w-full px-4 py-2 bg-red-600 text-white rounded-md cursor-pointer
                            hover:bg-red-700 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1
                          "
                        >
                          Cerrar Sesión
                        </button>
                      </div>

                      {/* Información de desarrollo */}
                      {process.env.NODE_ENV === 'development' && (
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Modo Desarrollo
                          </h5>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>• Funciones de debug habilitadas</div>
                            <div>• Panel de administrador disponible</div>
                            <div>• Logs detallados en consola</div>
                            <div>• NextAuth.js integrado</div>
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