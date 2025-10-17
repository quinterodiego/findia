import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Target, Sparkles, Trophy, DollarSign, Plus, LogOut, User } from 'lucide-react'
import DebtTracker from '@/components/DebtTracker'
import MotivationalMessages from '@/components/MotivationalMessages'
import ProgressCelebration from '@/components/ProgressCelebration'
import AiSuggestions from '@/components/AiSuggestions'
import { useDebtManager, useCelebrations } from '@/lib/hooks'
import { useAuth } from '@/contexts/AuthContext'

export const Dashboard = () => {
  const [showCelebration, setShowCelebration] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [, setCelebrationMilestone] = useState(0)

  // Usar los hooks personalizados
  const { stats } = useDebtManager()
  const { unlockMilestone } = useCelebrations()
  const { user, logout } = useAuth()

  const { totalDebt, totalPaid, progressPercentage } = stats

  useEffect(() => {
    // Detectar cuando se alcanza un nuevo milestone
    const currentMilestone = Math.floor(progressPercentage / 25) * 25
    
    if (currentMilestone > 0 && currentMilestone <= 100) {
      const isNewMilestone = unlockMilestone(currentMilestone)
      
      if (isNewMilestone) {
        setCelebrationMilestone(currentMilestone)
        setShowCelebration(true)
      }
    }
  }, [progressPercentage, unlockMilestone])

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-blue-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-xl shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FindIA
                </h1>
                <p className="text-sm text-gray-600">¡Hola, {user?.name}!</p>
              </div>
            </motion.div>
            
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-1">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
                  { id: 'tracker', label: 'Seguimiento', icon: Target },
                  { id: 'ai', label: 'IA Coach', icon: Sparkles },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>
              
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span>{user?.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Hero Section con Progreso */}
              <div className="text-center space-y-6">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <h2 className="text-4xl font-bold text-gray-900 mb-2">
                    ¡Hola, {user?.name}! ¿Listo para tu libertad financiera? 🚀
                  </h2>
                  <p className="text-xl text-gray-600">
                    Has pagado <span className="font-bold text-green-600">${totalPaid.toLocaleString()}</span> de <span className="font-bold">${totalDebt.toLocaleString()}</span>
                  </p>
                </motion.div>

                {/* Barra de Progreso Principal */}
                <motion.div
                  className="max-w-2xl mx-auto"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                >
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-blue-100">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-medium text-gray-700">Progreso de Pago</span>
                      <span className="text-2xl font-bold text-blue-600">{progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 rounded-full relative"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </motion.div>
                    </div>
                    <div className="flex justify-between mt-2 text-sm text-gray-600">
                      <span>$0</span>
                      <span>${totalDebt.toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Estadísticas Rápidas */}
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                >
                  <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-green-100">
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
                        <Trophy className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Próxima Meta</p>
                        <p className="text-2xl font-bold text-purple-600">{Math.ceil(progressPercentage / 25) * 25}%</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              <MotivationalMessages />
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
              <DebtTracker />
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
              <AiSuggestions 
                totalDebt={totalDebt}
                paidAmount={totalPaid}
                progress={progressPercentage}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Componente de Celebración */}
      <ProgressCelebration 
        isVisible={showCelebration}
        milestone={Math.floor(progressPercentage / 25) * 25}
        onClose={() => setShowCelebration(false)}
      />

      {/* Floating Action Button */}
      <motion.button
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setActiveTab('tracker')}
      >
        <Plus className="h-6 w-6" />
      </motion.button>
    </div>
  )
}