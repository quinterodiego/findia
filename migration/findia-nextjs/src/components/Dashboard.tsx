"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Target, Sparkles, Trophy, DollarSign, LogOut, User, Settings, Calendar, BarChart3 } from 'lucide-react'
import DebtTracker from './DebtTracker'
import MotivationalMessages from './MotivationalMessages'
import ProgressCelebration from './ProgressCelebration'
import AiSuggestions from './AiSuggestions'
import SheetSetupPanel from './SheetSetupPanel'
import { useDebtManager } from '@/lib/hooks'
import { useSession, signOut } from 'next-auth/react'

interface UserProfile {
  name: string
  email: string
  debtFreeGoal: string
  totalDebtGoal: number
  monthlyIncomeGoal: number
  emergencyFund: number
  achievements: string[]
}

export default function Dashboard() {
  const { data: session } = useSession()
  const [showCelebration, setShowCelebration] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [celebrationMilestone, setCelebrationMilestone] = useState(0)
  const [showUserProfile, setShowUserProfile] = useState(false)
  
  // Use our custom hooks
  const {
    debts,
    addDebt,
    deleteDebt,
    makePayment,
    totalDebt,
    debtFreeProgress,
    monthlyPayment,
    totalPaid = 0
  } = useDebtManager()

  const user = session?.user || { name: 'Usuario Demo', email: 'demo@findia.com' }

  const userProfile: UserProfile = {
    name: user?.name || 'Usuario Demo',
    email: user?.email || 'demo@findia.com',
    debtFreeGoal: '2025',
    totalDebtGoal: 50000,
    monthlyIncomeGoal: 25000,
    emergencyFund: 5000,
    achievements: ['Primer pago realizado', 'Meta del 25% alcanzada']
  }

  // Navigation tabs
  const navigationTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'tracker', label: 'Seguimiento', icon: Target },
    { id: 'setup', label: 'Configuración', icon: Settings }
  ]

  // Achievement system
  const achievements = [
    {
      id: 'first_payment',
      title: 'Primer Pago',
      description: 'Has registrado tu primer pago',
      icon: DollarSign,
      completed: totalPaid > 0,
      progress: totalPaid > 0 ? 100 : 0
    },
    {
      id: 'debt_destroyer',
      title: 'Destructor de Deudas',
      description: 'Paga el 25% de tus deudas totales',
      icon: Target,
      completed: (debtFreeProgress || 0) >= 25,
      progress: Math.min((debtFreeProgress || 0), 25) * 4
    },
    {
      id: 'halfway_hero',
      title: 'Héroe a Medio Camino',
      description: 'Paga el 50% de tus deudas totales',
      icon: TrendingUp,
      completed: (debtFreeProgress || 0) >= 50,
      progress: Math.min(Math.max((debtFreeProgress || 0) - 25, 0), 25) * 4
    },
    {
      id: 'freedom_fighter',
      title: 'Luchador por la Libertad',
      description: 'Paga el 75% de tus deudas totales',
      icon: Sparkles,
      completed: (debtFreeProgress || 0) >= 75,
      progress: Math.min(Math.max((debtFreeProgress || 0) - 50, 0), 25) * 4
    },
    {
      id: 'debt_free_champion',
      title: 'Campeón Libre de Deudas',
      description: '¡Paga todas tus deudas!',
      icon: Trophy,
      completed: (debtFreeProgress || 0) >= 100,
      progress: Math.min(Math.max((debtFreeProgress || 0) - 75, 0), 25) * 4
    }
  ]

  const handleLogout = () => {
    signOut()
  }

  const renderDashboardContent = () => {
    if (activeTab === 'setup') {
      return <SheetSetupPanel />
    }

    if (activeTab === 'tracker') {
      return (
        <DebtTracker 
          debts={debts}
          onAddDebt={addDebt}
          onDeleteDebt={deleteDebt}
          onMakePayment={makePayment}
        />
      )
    }

    return (
      <div className="space-y-8">
        {/* Dashboard Overview - Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden"
        >
          <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-3xl p-8 text-white">
            <div className="relative z-10">
              {/* Hero Section con Progreso */}
              <div className="text-center space-y-6">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <h2 className="text-4xl font-bold text-white mb-2">
                    ¡Hola, {user?.name}! ¿Listo para tu libertad financiera? 🚀
                  </h2>
                  <p className="text-xl text-blue-100">
                    Has pagado <span className="font-bold text-yellow-300">${totalPaid.toLocaleString()}</span> de <span className="font-bold">${totalDebt.toLocaleString()}</span>
                  </p>
                </motion.div>

                {/* Barra de Progreso Principal */}
                <motion.div
                  className="max-w-2xl mx-auto"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                >
                  <div className="bg-white/20 rounded-full p-1 mb-4">
                    <motion.div 
                      className="bg-gradient-to-r from-yellow-400 to-green-400 rounded-full h-6 flex items-center justify-center"
                      initial={{ width: 0 }}
                      animate={{ width: `${debtFreeProgress || 0}%` }}
                      transition={{ delay: 0.6, duration: 1.2 }}
                    >
                      <span className="text-sm font-bold text-gray-800">
                        {(debtFreeProgress || 0).toFixed(1)}%
                      </span>
                    </motion.div>
                  </div>
                  <p className="text-blue-100 text-lg">
                    🎯 {(debtFreeProgress || 0) < 100 ? 'En camino hacia la libertad financiera' : '¡Felicidades! Eres libre de deudas 🎉'}
                  </p>
                </motion.div>

                {/* Estadísticas Rápidas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-blue-100">
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-100 p-3 rounded-full">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Pagado</p>
                        <p className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-blue-100">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 p-3 rounded-full">
                        <Target className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Restante</p>
                        <p className="text-2xl font-bold text-blue-600">${(totalDebt - totalPaid).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-purple-100">
                    <div className="flex items-center space-x-3">
                      <div className="bg-purple-100 p-3 rounded-full">
                        <Calendar className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Pago Mensual</p>
                        <p className="text-2xl font-bold text-purple-600">${monthlyPayment.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Partículas decorativas */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-white/30 rounded-full"
                    initial={{
                      x: Math.random() * 400,
                      y: Math.random() * 400,
                      scale: 0
                    }}
                    animate={{
                      y: Math.random() * 400,
                      scale: [0, 1, 0],
                    }}
                    transition={{
                      duration: Math.random() * 3 + 2,
                      repeat: Infinity,
                      delay: Math.random() * 2
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Achievements Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Trophy className="h-6 w-6 mr-3 text-yellow-500" />
            Logros y Metas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {achievements.map((achievement, index) => {
              const IconComponent = achievement.icon
              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    achievement.completed 
                      ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 shadow-lg' 
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                      achievement.completed ? 'bg-yellow-200' : 'bg-gray-200'
                    }`}>
                      <IconComponent className={`h-6 w-6 ${
                        achievement.completed ? 'text-yellow-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{achievement.title}</h4>
                    <p className="text-xs text-gray-600 mb-3">{achievement.description}</p>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div 
                        className={`h-2 rounded-full ${
                          achievement.completed ? 'bg-yellow-400' : 'bg-blue-400'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${achievement.progress}%` }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Motivational Messages */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <MotivationalMessages 
              progress={debtFreeProgress || 0}
              totalPaid={totalPaid}
              remainingDebt={totalDebt - totalPaid}
            />
          </motion.div>

          {/* AI Suggestions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <AiSuggestions 
              debts={debts}
              totalDebt={totalDebt}
              monthlyPayment={monthlyPayment}
            />
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <Sparkles className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FindIA
                </span>
              </div>
              
              <nav className="hidden md:flex space-x-1">
                {navigationTabs.map((tab) => {
                  const IconComponent = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700 shadow-md'
                          : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowUserProfile(!showUserProfile)}
                className="flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
              >
                <User className="h-5 w-5" />
                <span className="font-medium">{user?.name || 'Usuario'}</span>
              </button>

              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white/80 backdrop-blur-sm border-b border-blue-100">
        <div className="px-4 py-2">
          <div className="flex space-x-1 overflow-x-auto">
            {navigationTabs.map((tab) => {
              const IconComponent = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <IconComponent className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* User Profile Sidebar */}
      <AnimatePresence>
        {showUserProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowUserProfile(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Perfil de Usuario</h2>
                  <button
                    onClick={() => setShowUserProfile(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="h-10 w-10 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{userProfile.name}</h3>
                  <p className="text-gray-600">{userProfile.email}</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Meta de Libertad Financiera</p>
                    <p className="text-lg font-bold text-blue-600">{userProfile.debtFreeGoal}</p>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Meta Total de Deuda</p>
                    <p className="text-lg font-bold text-green-600">${userProfile.totalDebtGoal.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Ingreso Mensual Objetivo</p>
                    <p className="text-lg font-bold text-purple-600">${userProfile.monthlyIncomeGoal.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Fondo de Emergencia</p>
                    <p className="text-lg font-bold text-orange-600">${userProfile.emergencyFund.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Logros Recientes</h4>
                  <div className="space-y-2">
                    {userProfile.achievements.map((achievement: string, index: number) => (
                      <div key={index} className="flex items-center space-x-3 p-2 bg-yellow-50 rounded">
                        <Trophy className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-gray-700">{achievement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderDashboardContent()}
      </main>

      {/* Progress Celebration */}
      <ProgressCelebration 
        isVisible={showCelebration}
        onClose={() => setShowCelebration(false)}
        milestone={celebrationMilestone}
      />
    </div>
  )
}