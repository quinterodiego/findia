import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bot, 
  Lightbulb, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Target, 
  Zap,
  BookOpen,
  PiggyBank,
  CreditCard,
  BarChart3,
  Sparkles
} from 'lucide-react'

interface AiSuggestionsProps {
  totalDebt: number
  paidAmount: number
  progress: number
}

interface Suggestion {
  id: string
  type: 'strategy' | 'motivation' | 'financial' | 'planning'
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
  icon: any
  color: string
}

export default function AiSuggestions({ totalDebt, paidAmount, progress }: AiSuggestionsProps) {
  const [currentSuggestion, setCurrentSuggestion] = useState(0)
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false)
  const [isThinking, setIsThinking] = useState(false)

  const remainingDebt = totalDebt - paidAmount
  // const monthlyPaymentEstimate = remainingDebt / 12 // Estimación básica

  const generateSuggestions = (): Suggestion[] => {
    const suggestions: Suggestion[] = []

    // Sugerencias basadas en el progreso
    if (progress < 25) {
      suggestions.push({
        id: '1',
        type: 'strategy',
        title: 'Método Avalancha de Deudas',
        description: 'Enfócate en pagar primero las deudas con mayor tasa de interés para minimizar el costo total.',
        action: 'Organizar deudas por tasa de interés',
        priority: 'high',
        icon: TrendingUp,
        color: 'from-red-500 to-orange-500'
      })

      suggestions.push({
        id: '2',
        type: 'financial',
        title: 'Presupuesto 50/30/20',
        description: 'Asigna 50% a necesidades, 30% a deseos y 20% al pago de deudas para acelerar tu progreso.',
        action: 'Crear presupuesto detallado',
        priority: 'high',
        icon: PiggyBank,
        color: 'from-green-500 to-teal-500'
      })
    } else if (progress < 50) {
      suggestions.push({
        id: '3',
        type: 'motivation',
        title: '¡Mantén el Momentum!',
        description: 'Has pagado más del 25%. Cada peso adicional que pagues tendrá un impacto exponencial.',
        action: 'Aumentar pago mensual en $500',
        priority: 'medium',
        icon: Zap,
        color: 'from-blue-500 to-purple-500'
      })

      suggestions.push({
        id: '4',
        type: 'planning',
        title: 'Consolidación de Deudas',
        description: 'Considera consolidar tus deudas en un solo pago con menor tasa de interés.',
        action: 'Explorar opciones de consolidación',
        priority: 'medium',
        icon: CreditCard,
        color: 'from-purple-500 to-pink-500'
      })
    } else if (progress < 75) {
      suggestions.push({
        id: '5',
        type: 'strategy',
        title: 'Estrategia Final Sprint',
        description: 'Estás en la recta final. Considera usar bonificaciones o ingresos extra para acelerar.',
        action: 'Aplicar ingresos extra a deudas',
        priority: 'high',
        icon: Target,
        color: 'from-orange-500 to-red-500'
      })
    } else {
      suggestions.push({
        id: '6',
        type: 'planning',
        title: 'Preparación Post-Deudas',
        description: '¡Casi libre! Planifica cómo invertir el dinero que destinabas a deudas.',
        action: 'Planificar inversiones futuras',
        priority: 'medium',
        icon: BarChart3,
        color: 'from-green-500 to-blue-500'
      })
    }

    // Sugerencias adicionales generales
    suggestions.push({
      id: '7',
      type: 'financial',
      title: 'Fondo de Emergencia Mini',
      description: 'Mantén $1,000 como fondo de emergencia para evitar nuevas deudas.',
      action: 'Crear fondo de emergencia',
      priority: 'medium',
      icon: PiggyBank,
      color: 'from-teal-500 to-cyan-500'
    })

    suggestions.push({
      id: '8',
      type: 'motivation',
      title: 'Celebra los Pequeños Logros',
      description: 'Recompénsate (sin gastar mucho) cada vez que alcances una meta intermedia.',
      action: 'Planificar recompensas económicas',
      priority: 'low',
      icon: Sparkles,
      color: 'from-yellow-500 to-orange-500'
    })

    return suggestions
  }

  const [suggestions] = useState(generateSuggestions())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSuggestion((prev) => (prev + 1) % suggestions.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [suggestions.length])

  const handleAiAnalysis = () => {
    setIsThinking(true)
    setTimeout(() => {
      setIsThinking(false)
      setShowDetailedAnalysis(true)
    }, 2000)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const currentSug = suggestions[currentSuggestion]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex justify-center items-center space-x-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full"
          >
            <Bot className="h-8 w-8 text-white" />
          </motion.div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              IA Coach Financiero 🤖
            </h2>
            <p className="text-gray-600">Estrategias personalizadas para acelerar tu progreso</p>
          </div>
        </div>
      </motion.div>

      {/* Sugerencia Principal Rotativa */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-100"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSuggestion}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="flex items-start space-x-4">
              <motion.div
                className={`bg-gradient-to-r ${currentSug.color} p-3 rounded-xl shadow-lg`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <currentSug.icon className="h-6 w-6 text-white" />
              </motion.div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h3 className="text-xl font-bold text-gray-900">{currentSug.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(currentSug.priority)}`}>
                    {currentSug.priority === 'high' ? 'Alta Prioridad' : 
                     currentSug.priority === 'medium' ? 'Prioridad Media' : 'Baja Prioridad'}
                  </span>
                </div>
                
                <p className="text-gray-600 leading-relaxed mb-4">
                  {currentSug.description}
                </p>
                
                <motion.button
                  className={`bg-gradient-to-r ${currentSug.color} text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center space-x-2`}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Lightbulb className="h-5 w-5" />
                  <span>{currentSug.action}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Indicadores de progreso */}
        <div className="flex justify-center space-x-2 mt-6">
          {suggestions.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => setCurrentSuggestion(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentSuggestion 
                  ? 'bg-blue-500 scale-125' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            />
          ))}
        </div>
      </motion.div>

      {/* Análisis Detallado */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
            Análisis Personalizado de IA
          </h3>
          
          <motion.button
            onClick={handleAiAnalysis}
            disabled={isThinking}
            className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-600 hover:to-pink-700 transition-all duration-200 flex items-center space-x-2 disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isThinking ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Bot className="h-4 w-4" />
                </motion.div>
                <span>Analizando...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generar Análisis</span>
              </>
            )}
          </motion.button>
        </div>

        <AnimatePresence>
          {showDetailedAnalysis && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Proyección Temporal
                  </h4>
                  <p className="text-blue-700 text-sm">
                    Al ritmo actual, podrías estar libre de deudas en aproximadamente{' '}
                    <span className="font-bold">{Math.ceil(remainingDebt / (paidAmount / 12)) || 12} meses</span>.
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-2 flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Optimización de Pagos
                  </h4>
                  <p className="text-green-700 text-sm">
                    Aumentando tu pago mensual en solo $500, podrías reducir el tiempo{' '}
                    <span className="font-bold">en 3-4 meses</span>.
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                  <h4 className="font-semibold text-yellow-900 mb-2 flex items-center">
                    <Target className="h-4 w-4 mr-2" />
                    Próxima Meta
                  </h4>
                  <p className="text-yellow-700 text-sm">
                    Te faltan <span className="font-bold">${((Math.ceil(progress / 25) * 25 / 100) * totalDebt - paidAmount).toLocaleString()}</span>{' '}
                    para alcanzar el {Math.ceil(progress / 25) * 25}% de progreso.
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                  <h4 className="font-semibold text-purple-900 mb-2 flex items-center">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Recomendación IA
                  </h4>
                  <p className="text-purple-700 text-sm">
                    Basado en tu progreso del {progress.toFixed(1)}%, te recomiendo la{' '}
                    <span className="font-bold">estrategia avalancha</span> para maximizar ahorros.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-200 mt-6">
                <h4 className="font-semibold text-indigo-900 mb-3 flex items-center">
                  🎯 Plan de Acción Personalizado
                </h4>
                <div className="space-y-2 text-indigo-700 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span>Semana 1-2: Reorganiza tus deudas por tasa de interés</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span>Semana 3-4: Implementa el presupuesto 50/30/20</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span>Mes 2: Busca oportunidades de ingresos adicionales</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span>Mes 3+: Mantén momentum y celebra cada hito</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showDetailedAnalysis && (
          <div className="text-center py-8 text-gray-500">
            <Bot className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>Haz clic en "Generar Análisis" para obtener un plan personalizado basado en tu progreso actual.</p>
          </div>
        )}
      </motion.div>

      {/* Grid de Consejos Rápidos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {[
          { icon: PiggyBank, title: "Automatiza", desc: "Configura pagos automáticos", color: "from-green-400 to-teal-500" },
          { icon: CreditCard, title: "Negocia", desc: "Habla con tus acreedores", color: "from-blue-400 to-purple-500" },
          { icon: BarChart3, title: "Monitorea", desc: "Revisa tu progreso semanalmente", color: "from-orange-400 to-red-500" },
          { icon: Target, title: "Enfócate", desc: "Una deuda a la vez", color: "from-purple-400 to-pink-500" },
          { icon: Zap, title: "Acelera", desc: "Usa ingresos extra sabiamente", color: "from-yellow-400 to-orange-500" },
          { icon: BookOpen, title: "Edúcate", desc: "Aprende sobre finanzas", color: "from-cyan-400 to-blue-500" }
        ].map((tip, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2 }}
            className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-100"
          >
            <div className={`bg-gradient-to-r ${tip.color} p-2 rounded-lg w-fit mb-3`}>
              <tip.icon className="h-5 w-5 text-white" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">{tip.title}</h4>
            <p className="text-sm text-gray-600">{tip.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}