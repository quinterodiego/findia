'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Target, Sparkles, Trophy, DollarSign, Plus, Heart } from 'lucide-react'

// Mock components para el DEMO - componentes simplificados que replican el comportamiento visual
const MockDebtTracker = () => (
  <div className="space-y-6">
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-blue-100">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">Seguimiento de Deudas</h3>
      
      {/* Lista de deudas demo */}
      <div className="space-y-4">
        {[
          { name: 'Tarjeta de Crédito Visa', amount: 15000, paid: 5000, payment: 800 },
          { name: 'Préstamo Personal', amount: 25000, paid: 8000, payment: 1200 },
          { name: 'Tarjeta MasterCard', amount: 8000, paid: 3000, payment: 500 }
        ].map((debt, index) => (
          <motion.div
            key={index}
            className="bg-white/50 rounded-xl p-4 border border-gray-200"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold text-gray-900">{debt.name}</h4>
              <span className="text-lg font-bold text-blue-600">${(debt.amount - debt.paid).toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
                style={{ width: `${(debt.paid / debt.amount) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Pagado: ${debt.paid.toLocaleString()}</span>
              <span>Pago mensual: ${debt.payment.toLocaleString()}</span>
            </div>
          </motion.div>
        ))}
      </div>
      
      <motion.button
        className="w-full mt-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        + Agregar Nueva Deuda
      </motion.button>
    </div>
  </div>
)

const MockMotivationalMessages = () => {
  const motivationalMessages = [
    {
      message: "¡Cada peso que pagas es un paso hacia tu libertad! 🚀",
      emoji: "💪",
      color: "from-blue-500 to-purple-600"
    },
    {
      message: "Tu futuro yo te agradecerá cada esfuerzo de hoy ✨",
      emoji: "🌟",
      color: "from-green-500 to-teal-600"
    },
    {
      message: "Las deudas son temporales, tu determinación es permanente 💎",
      emoji: "💎",
      color: "from-purple-500 to-pink-600"
    },
    {
      message: "Cada pago te acerca más a tus sueños 🎯",
      emoji: "🎯",
      color: "from-orange-500 to-red-600"
    },
    {
      message: "Eres más fuerte de lo que crees. ¡Sigue adelante! 🦾",
      emoji: "🦾",
      color: "from-indigo-500 to-blue-600"
    },
    {
      message: "La libertad financiera no es un sueño, es tu destino 🌈",
      emoji: "🌈",
      color: "from-pink-500 to-rose-600"
    }
  ]
  
  const quickTips = [
    "💡 Tip: Configura pagos automáticos para no olvidar ninguna cuota",
    "🎯 Estrategia: Paga primero las deudas con mayor interés",
    "📱 Recordatorio: Revisa tus gastos semanalmente",
    "🏦 Consejo: Negocia tasas de interés más bajas con tus bancos"
  ]
  
  const [currentMessage, setCurrentMessage] = useState(0)
  const [currentTip, setCurrentTip] = useState(0)
  
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % motivationalMessages.length)
    }, 5000)
    
    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % quickTips.length)
    }, 7000)
    
    return () => {
      clearInterval(messageInterval)
      clearInterval(tipInterval)
    }
  }, [])

  const currentMsg = motivationalMessages[currentMessage]

  return (
    <div className="space-y-6">
      {/* Mensaje Motivacional Principal */}
      <motion.div
        className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-blue-100 overflow-hidden relative"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Fondo animado */}
        <div className={`absolute inset-0 bg-gradient-to-r ${currentMsg.color} opacity-5 animate-pulse`}></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <motion.div
                className={`bg-gradient-to-r ${currentMsg.color} p-3 rounded-full shadow-lg`}
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Heart className="h-6 w-6 text-white" />
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900">Mensaje del Día</h3>
            </div>
            <motion.span 
              className="text-4xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              {currentMsg.emoji}
            </motion.span>
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMessage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <p className="text-xl text-gray-800 font-medium leading-relaxed">
                {currentMsg.message}
              </p>
            </motion.div>
          </AnimatePresence>
          
          {/* Indicador de progreso */}
          <div className="flex justify-center mt-6 space-x-2">
            {motivationalMessages.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  index === currentMessage 
                    ? `bg-gradient-to-r ${currentMsg.color}` 
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tip Rápido */}
      <motion.div
        className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200 shadow-lg"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="flex items-start space-x-3">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-2 rounded-full mt-1 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-amber-900 mb-1">Consejo Inteligente</h4>
            <AnimatePresence mode="wait">
              <motion.p
                key={currentTip}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-amber-800"
              >
                {quickTips[currentTip]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

const MockAiSuggestions = ({ totalDebt, paidAmount, progress }: { totalDebt: number, paidAmount: number, progress: number }) => (
  <div className="space-y-6">
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-purple-100">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-full">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">IA Coach Financiero</h3>
      </div>
      
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
          <h4 className="font-semibold text-purple-900 mb-2">🎯 Estrategia Recomendada</h4>
          <p className="text-purple-800">
            Basado en tu progreso del {progress.toFixed(1)}%, te recomiendo enfocar el 60% de tus pagos extra 
            en la deuda con mayor interés para optimizar tu ahorro.
          </p>
        </div>
        
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">💡 Consejo Inteligente</h4>
          <p className="text-blue-800">
            Si aumentas tu pago mensual en solo $200, podrías reducir tu tiempo de pago en 6 meses 
            y ahorrar $3,400 en intereses.
          </p>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
          <h4 className="font-semibold text-green-900 mb-2">🚀 Próximo Hito</h4>
          <p className="text-green-800">
            Estás a solo $2,000 de alcanzar el 40% de progreso. ¡Mantén el ritmo y llegarás 
            en aproximadamente 2.5 meses!
          </p>
        </div>
      </div>
    </div>
  </div>
)

export const DemoDashboard = () => {
  const [showCelebration, setShowCelebration] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [, setCelebrationMilestone] = useState(0)

  // Datos demo que replican exactamente los del proyecto original
  const stats = {
    totalDebt: 48000,
    totalPaid: 16000,
    progressPercentage: 33.3
  }

  const { totalDebt, totalPaid, progressPercentage } = stats

  useEffect(() => {
    // Detectar cuando se alcanza un nuevo milestone - lógica exacta del original
    const currentMilestone = Math.floor(progressPercentage / 25) * 25
    
    if (currentMilestone > 0 && currentMilestone <= 100) {
      // Simular unlock milestone para demo
      setCelebrationMilestone(currentMilestone)
      // No mostrar celebración automáticamente en demo para no interferir
    }
  }, [progressPercentage])

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
                <p className="text-sm text-gray-600">Tu compañero para la libertad financiera</p>
              </div>
            </motion.div>
            
            <nav className="flex space-x-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
                { id: 'tracker', label: 'Seguimiento', icon: Target },
                { id: 'ai', label: 'IA Coach', icon: Sparkles },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
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
              {/* Hero Section con Progreso - contenido exacto del original */}
              <div className="text-center space-y-6">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <h2 className="text-4xl font-bold text-gray-900 mb-2">
                    ¡Hola! ¿Listo para tu libertad financiera? 🚀
                  </h2>
                  <p className="text-xl text-gray-600">
                    Has pagado <span className="font-bold text-green-600">${totalPaid.toLocaleString()}</span> de <span className="font-bold">${totalDebt.toLocaleString()}</span>
                  </p>
                </motion.div>

                {/* Barra de Progreso Principal - estilos exactos */}
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

                {/* Estadísticas Rápidas - contenido exacto */}
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

              <MockMotivationalMessages />
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
              <MockDebtTracker />
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
              <MockAiSuggestions 
                totalDebt={totalDebt}
                paidAmount={totalPaid}
                progress={progressPercentage}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button - exacto al original */}
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