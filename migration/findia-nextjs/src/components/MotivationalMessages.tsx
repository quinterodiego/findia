"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Lightbulb, TrendingUp, DollarSign, Calendar } from 'lucide-react'

interface MotivationalMessagesProps {
  className?: string
}

export default function MotivationalMessages({ className = '' }: MotivationalMessagesProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const messages = [
    {
      icon: Lightbulb,
      title: "Consejo del día",
      message: "Considera hacer pagos adicionales al capital de tu deuda con mayor tasa de interés. Esto reducirá significativamente el tiempo total de pago.",
      color: "from-yellow-400 to-orange-500"
    },
    {
      icon: TrendingUp,
      title: "Progreso destacado",
      message: "¡Excelente! Mantén este ritmo y podrías liberarte de deudas 6 meses antes de lo planeado.",
      color: "from-green-400 to-emerald-500"
    },
    {
      icon: DollarSign,
      title: "Oportunidad de ahorro",
      message: "Si destinas $50 adicionales este mes, podrías ahorrar $200 en intereses totales.",
      color: "from-blue-400 to-cyan-500"
    },
    {
      icon: Calendar,
      title: "Recordatorio importante",
      message: "Tu próximo pago vence en 5 días. ¡No olvides mantener tu progreso al día!",
      color: "from-purple-400 to-pink-500"
    }
  ]

  return (
    <div className={`bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 ${className}`}>
      <div
        className="p-6 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-full">
              <Lightbulb className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Mensajes Motivacionales y Consejos
            </h3>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="px-6 pb-6"
        >
          <div className="grid gap-4">
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-4 shadow-md border border-gray-100"
              >
                <div className="flex items-start space-x-3">
                  <div className={`bg-gradient-to-r ${msg.color} p-2 rounded-lg`}>
                    <msg.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{msg.title}</h4>
                    <p className="text-gray-600 text-sm">{msg.message}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}