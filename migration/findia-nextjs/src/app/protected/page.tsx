"use client"

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { motion } from 'framer-motion'
import { Shield, CheckCircle, Lock, Users } from 'lucide-react'

function ProtectedContent() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-8"
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Shield className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Contenido Protegido!
          </h1>
          <p className="text-gray-600 text-lg">
            Esta página solo es accesible para usuarios autenticados
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow-md p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h2 className="text-xl font-semibold">Funcionalidades de Seguridad</h2>
            </div>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Autenticación con NextAuth.js
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Middleware de protección de rutas
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Componentes ProtectedRoute/PublicRoute
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                HOCs withAuth/withPublicRoute
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-lg shadow-md p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-semibold">Estados de Autenticación</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <div>
                  <div className="font-medium text-green-800">Autenticado</div>
                  <div className="text-sm text-green-600">Acceso completo al dashboard</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                <div>
                  <div className="font-medium text-yellow-800">Verificando</div>
                  <div className="text-sm text-yellow-600">Cargando estado de sesión</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div>
                  <div className="font-medium text-red-800">No autenticado</div>
                  <div className="text-sm text-red-600">Redirección automática</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-semibold">Información de Usuario</h2>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-purple-800">
              Si puedes ver este contenido, significa que estás correctamente autenticado 
              y el sistema de protección de rutas está funcionando perfectamente.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default function ProtectedPage() {
  return (
    <ProtectedRoute>
      <ProtectedContent />
    </ProtectedRoute>
  )
}