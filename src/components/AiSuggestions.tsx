"use client"

import { motion } from 'framer-motion'
import { LightbulbIcon, Target, TrendingUp, DollarSign, Calendar, AlertCircle } from 'lucide-react'
import type { Debt } from '@/types'

interface AiSuggestionsProps {
  debts: Debt[]
  totalDebt: number
  monthlyPayment: number
}

export default function AiSuggestions({ debts, totalDebt, monthlyPayment }: AiSuggestionsProps) {
  const generateSuggestions = () => {
    const suggestions = []
    
    // High interest rate suggestion
    const highInterestDebt = debts.find(debt => debt.interestRate > 15)
    if (highInterestDebt) {
      suggestions.push({
        type: 'priority',
        icon: AlertCircle,
        title: 'Prioriza deudas de alto interés',
        description: `Tu ${highInterestDebt.name} tiene una tasa del ${highInterestDebt.interestRate}%. Considera pagarlo primero para ahorrar en intereses.`,
        action: 'Incrementar pago mínimo',
        color: 'red'
      })
    }

    // Snowball vs Avalanche suggestion
    const smallestDebt = debts.reduce((prev, curr) => prev.currentAmount < curr.currentAmount ? prev : curr)
    if (smallestDebt && smallestDebt.currentAmount < totalDebt * 0.1) {
      suggestions.push({
        type: 'strategy',
        icon: Target,
        title: 'Método Bola de Nieve',
        description: `Podrías eliminar tu ${smallestDebt.name} rápidamente para ganar impulso psicológico.`,
        action: 'Aplicar método',
        color: 'blue'
      })
    }

    // Budget optimization
    if (monthlyPayment < totalDebt * 0.05) {
      suggestions.push({
        type: 'budget',
        icon: TrendingUp,
        title: 'Incrementa tu pago mensual',
        description: `Aumentar tu pago en $100 mensuales podría reducir el tiempo de pago significativamente.`,
        action: 'Revisar presupuesto',
        color: 'green'
      })
    }

    // Consolidation suggestion
    if (debts.length > 3) {
      suggestions.push({
        type: 'consolidation',
        icon: DollarSign,
        title: 'Considera consolidar deudas',
        description: 'Con múltiples deudas, la consolidación podría simplificar pagos y reducir tasas.',
        action: 'Explorar opciones',
        color: 'purple'
      })
    }

    // Emergency fund suggestion
    suggestions.push({
      type: 'emergency',
      icon: Calendar,
      title: 'Construye un fondo de emergencia',
      description: 'Mantén $1,000 como colchón para evitar nuevas deudas durante el proceso.',
      action: 'Crear fondo',
      color: 'yellow'
    })

    return suggestions.slice(0, 3) // Return top 3 suggestions
  }

  const suggestions = generateSuggestions()

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'red':
        return 'border-red-200 bg-red-50 text-red-700'
      case 'blue':
        return 'border-blue-200 bg-blue-50 text-blue-700'
      case 'green':
        return 'border-green-200 bg-green-50 text-green-700'
      case 'purple':
        return 'border-purple-200 bg-purple-50 text-purple-700'
      case 'yellow':
        return 'border-yellow-200 bg-yellow-50 text-yellow-700'
      default:
        return 'border-gray-200 bg-gray-50 text-gray-700'
    }
  }

  const getIconColorClasses = (color: string) => {
    switch (color) {
      case 'red':
        return 'text-red-500'
      case 'blue':
        return 'text-blue-500'
      case 'green':
        return 'text-green-500'
      case 'purple':
        return 'text-purple-500'
      case 'yellow':
        return 'text-yellow-500'
      default:
        return 'text-gray-500'
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <LightbulbIcon className="h-6 w-6 text-yellow-500" />
          <h2 className="text-xl font-semibold text-gray-900">Sugerencias Inteligentes</h2>
        </div>
        <p className="text-gray-600">¡Excelente trabajo! Continúa con tu plan actual.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <LightbulbIcon className="h-6 w-6 text-yellow-500" />
        <h2 className="text-xl font-semibold text-gray-900">Sugerencias Inteligentes</h2>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion, index) => {
          const IconComponent = suggestion.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`border-l-4 p-4 rounded-r-lg ${getColorClasses(suggestion.color)}`}
            >
              <div className="flex items-start space-x-3">
                <IconComponent className={`h-6 w-6 mt-0.5 ${getIconColorClasses(suggestion.color)}`} />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">{suggestion.title}</h3>
                  <p className="text-sm opacity-90 mb-3">{suggestion.description}</p>
                  <button 
                    className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors hover:bg-white/50 ${
                      suggestion.color === 'red' ? 'border-red-300 text-red-700' :
                      suggestion.color === 'blue' ? 'border-blue-300 text-blue-700' :
                      suggestion.color === 'green' ? 'border-green-300 text-green-700' :
                      suggestion.color === 'purple' ? 'border-purple-300 text-purple-700' :
                      suggestion.color === 'yellow' ? 'border-yellow-300 text-yellow-700' :
                      'border-gray-300 text-gray-700'
                    }`}
                  >
                    {suggestion.action}
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700">Consejo del día</span>
        </div>
        <p className="text-sm text-gray-600">
          La consistencia es clave en el pago de deudas. Incluso pequeños pagos adicionales pueden marcar una gran diferencia a largo plazo.
        </p>
      </div>
    </div>
  )
}