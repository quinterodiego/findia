'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Target, Sparkles, Trophy, DollarSign, Plus, LogOut, BarChart3, Wallet } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  // Cargar tema guardado al iniciar
  useEffect(() => {
    const savedTheme = localStorage.getItem('findia-theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      signOut({ callbackUrl: '/' })
    }
  }

  const toggleDarkMode = () => {
    const html = document.documentElement
    if (html.classList.contains('dark')) {
      html.classList.remove('dark')
      localStorage.setItem('findia-theme', 'light')
      setIsDarkMode(false)
    } else {
      html.classList.add('dark')
      localStorage.setItem('findia-theme', 'dark')
      setIsDarkMode(true)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const user = session.user

  // Demo data - estos valores se reemplazarán con datos reales de Google Sheets
  const totalDebt = 0
  const totalPaid = 0
  const monthlyPayment = 0
  const progressPercentage = 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      {/* HEADER */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-xl">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">FindIA</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">¡Hola, {user?.name}!</p>
              </div>
            </div>
            
            {/* Botones lado derecho */}
            <div className="flex items-center space-x-4">
              {/* User Avatar */}
              {user?.image && (
                <Image
                  src={user.image}
                  alt={user.name || 'User'}
                  width={40}
                  height={40}
                  className="rounded-full border-2 border-gray-200 dark:border-gray-600"
                />
              )}
              
              {/* BOTÓN DARK MODE */}
              <button 
                onClick={toggleDarkMode}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold cursor-pointer hover:bg-purple-600 transition-colors"
              >
                {isDarkMode ? '☀️ LIGHT' : '🌙 DARK'}
              </button>

              {/* Botón Logout */}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg cursor-pointer hover:bg-red-600 transition-colors flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Cerrar</span>
              </button>
            </div>
          </div>
          
          {/* Navigation tabs */}
          <div className="flex space-x-2 pb-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
              { id: 'tracker', label: 'Seguimiento', icon: Target },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'ai', label: 'IA Coach', icon: Sparkles },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[
                    { label: 'Deuda Total', value: formatCurrency(totalDebt), icon: DollarSign, color: 'red' },
                    { label: 'Total Pagado', value: formatCurrency(totalPaid), icon: TrendingUp, color: 'green' },
                    { label: 'Pago Mensual', value: formatCurrency(monthlyPayment), icon: Target, color: 'blue' },
                    { label: 'Progreso', value: `${progressPercentage}%`, icon: Trophy, color: 'purple' },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-full ${stat.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' : stat.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' : stat.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                          <stat.icon className={`h-6 w-6 ${stat.color === 'red' ? 'text-red-600 dark:text-red-400' : stat.color === 'green' ? 'text-green-600 dark:text-green-400' : stat.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Progreso General</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{progressPercentage}% completado</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <motion.div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Empty State */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Wallet className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      ¡Comienza tu viaje hacia la libertad financiera!
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                      Aún no tienes deudas registradas. Comienza agregando tu primera deuda para ver 
                      tu progreso y recibir recomendaciones personalizadas de IA.
                    </p>
                    <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
                      <Plus className="h-5 w-5 inline mr-2" />
                      Agregar Primera Deuda
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tracker' && (
            <motion.div
              key="tracker"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Seguimiento de Deudas</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Esta sección estará disponible próximamente. Aquí podrás ver y gestionar todas tus deudas.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Analytics</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Esta sección estará disponible próximamente. Aquí verás gráficos y estadísticas detalladas.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-6">
                {/* Motivational Message */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-8 text-white shadow-lg">
                  <div className="flex items-center space-x-3 mb-4">
                    <Sparkles className="h-8 w-8" />
                    <h2 className="text-2xl font-bold">Tu Coach IA</h2>
                  </div>
                  <p className="text-lg mb-4">
                    ¡Bienvenido a FindIA! Estamos aquí para ayudarte en tu viaje hacia la libertad financiera.
                  </p>
                  <p className="text-purple-100">
                    Comienza agregando tus deudas y recibirás sugerencias personalizadas para optimizar tus pagos.
                  </p>
                </div>

                {/* AI Suggestions Placeholder */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Sugerencias Inteligentes</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Una vez que agregues tus deudas, la IA analizará tu situación y te brindará recomendaciones 
                    personalizadas para pagar tus deudas de la manera más eficiente.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
