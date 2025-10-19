"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Star, X, Sparkles } from 'lucide-react'

interface ProgressCelebrationProps {
  isVisible: boolean
  milestone: number
  onClose: () => void
}

export default function ProgressCelebration({ isVisible, milestone, onClose }: ProgressCelebrationProps) {
  const getMilestoneMessage = (milestone: number) => {
    switch (milestone) {
      case 25:
        return {
          title: "¡Primer Gran Paso! 🎉",
          message: "Has completado el 25% de tu camino hacia la libertad financiera. ¡Sigue así!",
          emoji: "🚀"
        }
      case 50:
        return {
          title: "¡A Mitad de Camino! 🌟",
          message: "¡Increíble! Ya has pagado la mitad de tus deudas. La meta está cada vez más cerca.",
          emoji: "⭐"
        }
      case 75:
        return {
          title: "¡Casi en la Meta! 🔥",
          message: "Solo te falta un 25% para alcanzar tu libertad financiera completa. ¡Imparable!",
          emoji: "🔥"
        }
      case 100:
        return {
          title: "¡LIBERTAD FINANCIERA! 🎊",
          message: "¡Lo lograste! Has pagado todas tus deudas. ¡Felicidades por este increíble logro!",
          emoji: "🎊"
        }
      default:
        return {
          title: "¡Gran Progreso! 🎯",
          message: `Has alcanzado el ${milestone}% de tu meta. ¡Cada paso cuenta!`,
          emoji: "🎯"
        }
    }
  }

  const { title, message, emoji } = getMilestoneMessage(milestone)

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            {/* Confetti Background Effect */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full"
                  initial={{
                    x: Math.random() * 400,
                    y: -10,
                    rotate: 0,
                  }}
                  animate={{
                    y: 400,
                    rotate: 360,
                  }}
                  transition={{
                    duration: 3,
                    delay: Math.random() * 2,
                    repeat: Infinity,
                  }}
                />
              ))}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Content */}
            <div className="text-center relative z-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mb-6"
              >
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4">
                  <Trophy className="h-10 w-10 text-white" />
                </div>
                <div className="text-6xl mb-2">{emoji}</div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-gray-900 mb-4"
              >
                {title}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-gray-600 mb-6 leading-relaxed"
              >
                {message}
              </motion.p>

              {/* Progress Circle */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="relative w-24 h-24 mx-auto mb-6"
              >
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: milestone / 100 }}
                    transition={{ delay: 0.6, duration: 1.5 }}
                    style={{
                      strokeDasharray: '283',
                      strokeDashoffset: 0,
                    }}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{milestone}%</span>
                </div>
              </motion.div>

              {/* Stars */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex justify-center space-x-1 mb-6"
              >
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                  >
                    <Star className="h-6 w-6 text-yellow-400 fill-current" />
                  </motion.div>
                ))}
              </motion.div>

              {/* Continue Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                onClick={onClose}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-2 mx-auto"
              >
                <Sparkles className="h-5 w-5" />
                <span>¡Continuar el Progreso!</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}