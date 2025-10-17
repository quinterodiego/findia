import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Star, Zap, Target, Trophy, RefreshCw, Sparkles } from 'lucide-react'

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
  },
  {
    message: "Cada día sin deudas nuevas es una victoria 🏆",
    emoji: "🏆",
    color: "from-yellow-500 to-orange-600"
  },
  {
    message: "Tu disciplina de hoy es tu libertad de mañana 🦋",
    emoji: "🦋",
    color: "from-cyan-500 to-blue-600"
  }
]

const quickTips = [
  "💡 Tip: Configura pagos automáticos para no olvidar ninguna cuota",
  "🎯 Estrategia: Paga primero las deudas con mayor interés",
  "📱 Recordatorio: Revisa tus gastos semanalmente",
  "🏆 Meta: Celebra cada pequeño logro en tu camino",
  "💰 Consejo: Destina cualquier dinero extra al pago de deudas",
  "📊 Análisis: Mantén un registro detallado de todos tus pagos",
  "✂️ Ahorro: Corta gastos innecesarios y redirige ese dinero a deudas",
  "🎪 Motivación: Visualiza tu vida sin deudas todos los días",
  "📅 Planificación: Establece fechas específicas para tus objetivos",
  "🚀 Impulso: Usa el efecto bola de nieve para acelerar tu progreso"
]

const encouragingQuotes = [
  "El primer paso hacia el éxito es la decisión de no quedarse donde estás.",
  "No se trata de cuánto debes, sino de cuánto estás dispuesto a cambiar.",
  "Cada pago es una inversión en tu paz mental.",
  "La libertad financiera comienza con una decisión valiente.",
  "Tu futuro está siendo construido por las decisiones de hoy."
]

export default function MotivationalMessages() {
  const [currentMessage, setCurrentMessage] = useState(0)
  const [currentTip, setCurrentTip] = useState(0)
  const [currentQuote, setCurrentQuote] = useState(0)
  const [showHearts, setShowHearts] = useState(false)
  const [showSparkles, setShowSparkles] = useState(false)

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % motivationalMessages.length)
    }, 6000)

    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % quickTips.length)
    }, 8000)

    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % encouragingQuotes.length)
    }, 10000)

    return () => {
      clearInterval(messageInterval)
      clearInterval(tipInterval)
      clearInterval(quoteInterval)
    }
  }, [])

  const triggerHearts = () => {
    setShowHearts(true)
    setTimeout(() => setShowHearts(false), 2000)
  }

  const triggerSparkles = () => {
    setShowSparkles(true)
    setTimeout(() => setShowSparkles(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Mensaje Motivacional Principal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-100 overflow-hidden">
          <div className="relative z-10">
            <div className="text-center mb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMessage}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.1, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-4"
                >
                  <motion.div 
                    className="text-6xl mb-4"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0] 
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {motivationalMessages[currentMessage].emoji}
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-900 leading-relaxed">
                    {motivationalMessages[currentMessage].message}
                  </h3>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <motion.button
                onClick={triggerHearts}
                className="bg-gradient-to-r from-pink-500 to-red-500 text-white px-6 py-3 rounded-full font-semibold hover:from-pink-600 hover:to-red-600 transition-all duration-200 flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Heart className="h-5 w-5" />
                <span>¡Me encanta!</span>
              </motion.button>

              <motion.button
                onClick={triggerSparkles}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-3 rounded-full font-semibold hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Sparkles className="h-5 w-5" />
                <span>¡Motivador!</span>
              </motion.button>

              <motion.button
                onClick={() => setCurrentMessage((prev) => (prev + 1) % motivationalMessages.length)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw className="h-5 w-5" />
                <span>Otro mensaje</span>
              </motion.button>
            </div>
          </div>

          {/* Decoración de fondo */}
          <div className={`absolute inset-0 bg-gradient-to-br ${motivationalMessages[currentMessage].color} opacity-5`} />
          
          {/* Efectos de partículas */}
          <div className="absolute top-4 left-4">
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Star className="h-6 w-6 text-yellow-400" />
            </motion.div>
          </div>
          <div className="absolute top-8 right-8">
            <motion.div
              animate={{ y: [-5, 5, -5], rotate: [0, 180, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Zap className="h-5 w-5 text-blue-400" />
            </motion.div>
          </div>
          <div className="absolute bottom-4 left-8">
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Target className="h-5 w-5 text-green-400" />
            </motion.div>
          </div>
          <div className="absolute bottom-8 right-4">
            <motion.div
              animate={{ 
                rotate: [0, 15, -15, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Trophy className="h-6 w-6 text-purple-400" />
            </motion.div>
          </div>
        </div>

        {/* Efectos de corazones flotantes */}
        <AnimatePresence>
          {showHearts && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    opacity: 1, 
                    y: 20, 
                    x: Math.random() * 100 + '%',
                    scale: 0.5 + Math.random() * 0.5
                  }}
                  animate={{ 
                    opacity: 0, 
                    y: -200, 
                    rotate: 360,
                    x: Math.random() * 100 + '%'
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    duration: 2, 
                    delay: i * 0.1,
                    ease: "easeOut"
                  }}
                  className="absolute text-pink-500"
                >
                  <Heart className="h-8 w-8 fill-current" />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Efectos de destellos */}
        <AnimatePresence>
          {showSparkles && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    opacity: 1, 
                    y: Math.random() * 100 + '%',
                    x: Math.random() * 100 + '%',
                    scale: 0.3 + Math.random() * 0.7
                  }}
                  animate={{ 
                    opacity: 0, 
                    scale: 1.5,
                    rotate: 180
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    duration: 1.5, 
                    delay: i * 0.1,
                    ease: "easeOut"
                  }}
                  className="absolute text-yellow-400"
                >
                  <Sparkles className="h-6 w-6 fill-current" />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Tips Rotativos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 shadow-lg"
      >
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-100 p-3 rounded-full">
            <Zap className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-800 mb-2">💡 Consejo del Momento</h4>
            <AnimatePresence mode="wait">
              <motion.p
                key={currentTip}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-yellow-800 font-medium"
              >
                {quickTips[currentTip]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Cita Inspiradora */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200 shadow-lg"
      >
        <div className="text-center">
          <div className="text-4xl mb-3">💭</div>
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={currentQuote}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="text-lg font-medium text-purple-800 italic leading-relaxed"
            >
              "{encouragingQuotes[currentQuote]}"
            </motion.blockquote>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Grid de Estadísticas Motivacionales */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <motion.div 
          className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-green-100 text-center"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="text-3xl mb-2"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            🎯
          </motion.div>
          <h4 className="font-semibold text-gray-900 mb-1">Enfoque</h4>
          <p className="text-sm text-gray-600">Un paso a la vez hacia tu meta</p>
        </motion.div>

        <motion.div 
          className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-blue-100 text-center"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="text-3xl mb-2"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            💪
          </motion.div>
          <h4 className="font-semibold text-gray-900 mb-1">Constancia</h4>
          <p className="text-sm text-gray-600">Cada día cuenta para tu éxito</p>
        </motion.div>

        <motion.div 
          className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-purple-100 text-center"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="text-3xl mb-2"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            🌟
          </motion.div>
          <h4 className="font-semibold text-gray-900 mb-1">Progreso</h4>
          <p className="text-sm text-gray-600">Celebra cada logro alcanzado</p>
        </motion.div>
      </motion.div>
    </div>
  )
}