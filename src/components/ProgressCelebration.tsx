import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Star, Sparkles, X, Target, Heart, Zap } from 'lucide-react'

interface ProgressCelebrationProps {
  isVisible: boolean
  milestone: number
  onClose: () => void
}

export default function ProgressCelebration({ isVisible, milestone, onClose }: ProgressCelebrationProps) {
  useEffect(() => {
    if (isVisible) {
      // Auto-cerrar después de 6 segundos
      const timer = setTimeout(() => {
        onClose()
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  const getCelebrationMessage = (milestone: number) => {
    switch (milestone) {
      case 25:
        return {
          title: "¡Primer Cuarto Completado! 🎉",
          message: "¡Increíble! Has pagado el 25% de tu deuda. ¡El momentum está de tu lado!",
          emoji: "🚀",
          color: "from-green-400 to-blue-500",
          celebration: "¡Estás en fuego! 🔥"
        }
      case 50:
        return {
          title: "¡Mitad del Camino! 🎯",
          message: "¡Fantástico! Ya vas por la mitad. ¡La libertad financiera está cada vez más cerca!",
          emoji: "🎯",
          color: "from-blue-400 to-purple-500",
          celebration: "¡Imparable! 💪"
        }
      case 75:
        return {
          title: "¡Tres Cuartos Completados! 🏆",
          message: "¡Extraordinario! Solo queda el último tramo. ¡Eres una máquina de pagar deudas!",
          emoji: "🏆",
          color: "from-purple-400 to-pink-500",
          celebration: "¡Casi libre! 🦋"
        }
      case 100:
        return {
          title: "¡LIBERTAD FINANCIERA TOTAL! 🎊",
          message: "¡LO LOGRASTE! Has eliminado completamente tu deuda. ¡Eres oficialmente libre! 🎉🎉🎉",
          emoji: "🎊",
          color: "from-yellow-400 to-orange-500",
          celebration: "¡CAMPEÓN! 👑"
        }
      default:
        return {
          title: "¡Gran Progreso! ⭐",
          message: "¡Excelente trabajo! Cada paso cuenta hacia tu libertad financiera.",
          emoji: "⭐",
          color: "from-indigo-400 to-purple-500",
          celebration: "¡Sigue así! 💫"
        }
    }
  }

  const celebration = getCelebrationMessage(milestone)

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: 100, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.3, opacity: 0, y: 100, rotate: 10 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 25,
              duration: 0.8 
            }}
            className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4 relative overflow-hidden shadow-2xl border-4 border-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón de cerrar con estilo */}
            <motion.button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 z-20"
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="h-5 w-5 text-gray-600" />
            </motion.button>

            {/* Fondo decorativo animado */}
            <motion.div 
              className={`absolute inset-0 bg-gradient-to-br ${celebration.color} opacity-10`}
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Confetti animado mejorado */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    opacity: 1,
                    y: -50,
                    x: Math.random() * 100 + '%',
                    rotate: 0,
                    scale: Math.random() * 0.8 + 0.4
                  }}
                  animate={{ 
                    opacity: 0,
                    y: 600,
                    rotate: 720,
                    transition: {
                      duration: Math.random() * 2 + 3,
                      delay: Math.random() * 3,
                      ease: "easeOut"
                    }
                  }}
                  className="absolute"
                >
                  {i % 4 === 0 && <div className="w-3 h-3 bg-yellow-400 rounded-full" />}
                  {i % 4 === 1 && <div className="w-2 h-4 bg-pink-500 transform rotate-45" />}
                  {i % 4 === 2 && <div className="w-3 h-3 bg-blue-500 transform rotate-45" />}
                  {i % 4 === 3 && <div className="w-2 h-2 bg-purple-500 rounded-full" />}
                </motion.div>
              ))}
            </div>

            {/* Contenido principal */}
            <div className="relative z-10 text-center space-y-6">
              {/* Emoji principal con animación especial */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  delay: 0.3, 
                  type: "spring", 
                  stiffness: 500, 
                  damping: 15 
                }}
                className="relative"
              >
                <motion.div
                  className="text-9xl"
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
                  {celebration.emoji}
                </motion.div>
                
                {/* Aura brillante alrededor del emoji */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-white opacity-30"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 0.6, 0.3]
                  }}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>

              {/* Título con efecto de escritura */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-3xl font-bold text-gray-900 leading-tight"
              >
                {celebration.title}
              </motion.h2>

              {/* Mensaje principal */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-lg text-gray-600 leading-relaxed px-4"
              >
                {celebration.message}
              </motion.p>

              {/* Badge de celebración */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0 }}
                className="inline-block"
              >
                <div className={`bg-gradient-to-r ${celebration.color} text-white px-8 py-4 rounded-full font-bold text-xl shadow-2xl`}>
                  <div className="flex items-center space-x-3">
                    <Trophy className="h-6 w-6" />
                    <span>{milestone}% Completado</span>
                    <Trophy className="h-6 w-6" />
                  </div>
                </div>
              </motion.div>

              {/* Mensaje de celebración adicional */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 }}
                className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500"
              >
                {celebration.celebration}
              </motion.div>

              {/* Elementos decorativos animados */}
              <div className="flex justify-center space-x-6 mt-8">
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Star className="h-8 w-8 text-yellow-500" />
                </motion.div>
                
                <motion.div
                  animate={{ 
                    y: [0, -15, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5
                  }}
                >
                  <Sparkles className="h-8 w-8 text-purple-500" />
                </motion.div>

                <motion.div
                  animate={{ 
                    rotate: -360,
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1
                  }}
                >
                  <Heart className="h-8 w-8 text-pink-500 fill-current" />
                </motion.div>

                <motion.div
                  animate={{ 
                    x: [0, 10, -10, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ 
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1.5
                  }}
                >
                  <Zap className="h-8 w-8 text-blue-500" />
                </motion.div>
              </div>

              {/* Botón de acción principal */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
                onClick={onClose}
                className={`w-full bg-gradient-to-r ${celebration.color} text-white py-4 px-6 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-3 mt-6`}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Target className="h-6 w-6" />
                <span>¡Continuar hacia la libertad total!</span>
                <Target className="h-6 w-6" />
              </motion.button>

              {/* Mensaje motivacional extra */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
                className="text-sm text-gray-500 italic mt-4"
              >
                "El éxito es la suma de pequeños esfuerzos repetidos día tras día"
              </motion.p>
            </div>

            {/* Efectos de brillo en los bordes */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-white to-transparent"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
              className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-white to-transparent"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}