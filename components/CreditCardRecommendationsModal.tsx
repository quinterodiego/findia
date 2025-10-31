'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, TrendingUp, TrendingDown, Target, DollarSign, CreditCard, Calculator, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { formatCurrency } from '@/lib/formatNumber'

interface CreditCardRecommendation {
  id: string
  cardId?: string
  cardName?: string
  type: 'payment_strategy' | 'debt_consolidation' | 'utilization_optimization' | 'interest_reduction' | 'credit_score' | 'spending_pattern'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  savings?: number
  timeframe: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: 'financial' | 'behavioral' | 'strategic'
  isApplied: boolean
  createdAt: string
}

interface CreditCardRecommendationsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: any
  consumptions?: any[]
  payments?: any[]
}

export default function CreditCardRecommendationsModal({ 
  isOpen, 
  onClose, 
  selectedCard,
  consumptions = [],
  payments = []
}: CreditCardRecommendationsModalProps) {
  const [recommendations, setRecommendations] = useState<CreditCardRecommendation[]>([])
  const [filteredRecommendations, setFilteredRecommendations] = useState<CreditCardRecommendation[]>([])
  const [filter, setFilter] = useState<'all' | 'high_impact' | 'easy' | 'financial'>('all')
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Cargar recomendaciones existentes
  useEffect(() => {
    if (isOpen) {
      loadRecommendations()
    }
  }, [isOpen])

  // Filtrar recomendaciones
  useEffect(() => {
    let filtered = recommendations

    switch (filter) {
      case 'high_impact':
        filtered = recommendations.filter(rec => rec.impact === 'high')
        break
      case 'easy':
        filtered = recommendations.filter(rec => rec.difficulty === 'easy')
        break
      case 'financial':
        filtered = recommendations.filter(rec => rec.category === 'financial')
        break
      default:
        filtered = recommendations
    }

    setFilteredRecommendations(filtered)
  }, [recommendations, filter])

  const loadRecommendations = async () => {
    try {
      setLoading(true)
      // Generar recomendaciones inteligentes basadas en datos simulados
      const mockRecommendations: CreditCardRecommendation[] = [
        {
          id: '1',
          cardId: '1',
          cardName: 'Visa Platinum',
          type: 'payment_strategy',
          title: 'Pagar más del mínimo',
          description: 'Tu utilización actual es del 85%. Pagar $50,000 adicionales reduciría significativamente los intereses.',
          impact: 'high',
          savings: 150000,
          timeframe: 'Inmediato',
          difficulty: 'easy',
          category: 'financial',
          isApplied: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          type: 'debt_consolidation',
          title: 'Consolidar deudas',
          description: 'Tienes múltiples tarjetas con altas tasas. Considera un préstamo personal para consolidar y reducir intereses.',
          impact: 'high',
          savings: 300000,
          timeframe: '1-2 semanas',
          difficulty: 'medium',
          category: 'strategic',
          isApplied: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          cardId: '1',
          cardName: 'Visa Platinum',
          type: 'utilization_optimization',
          title: 'Reducir utilización de crédito',
          description: 'Mantén tu utilización por debajo del 30% para mejorar tu score crediticio.',
          impact: 'medium',
          savings: 50000,
          timeframe: '2-3 meses',
          difficulty: 'medium',
          category: 'behavioral',
          isApplied: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '4',
          type: 'interest_reduction',
          title: 'Negociar tasa de interés',
          description: 'Contacta a tu banco para negociar una tasa más baja. Clientes con buen historial pueden obtener reducciones.',
          impact: 'high',
          savings: 200000,
          timeframe: '1 semana',
          difficulty: 'easy',
          category: 'financial',
          isApplied: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '5',
          type: 'spending_pattern',
          title: 'Optimizar patrones de gasto',
          description: 'Evita gastos grandes cerca de la fecha de corte para mantener baja la utilización reportada.',
          impact: 'medium',
          savings: 75000,
          timeframe: 'Ongoing',
          difficulty: 'easy',
          category: 'behavioral',
          isApplied: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '6',
          type: 'credit_score',
          title: 'Mejorar score crediticio',
          description: 'Pagar a tiempo y mantener baja utilización mejorará tu score, permitiendo mejores condiciones.',
          impact: 'high',
          savings: 400000,
          timeframe: '3-6 meses',
          difficulty: 'medium',
          category: 'strategic',
          isApplied: false,
          createdAt: new Date().toISOString()
        }
      ]
      setRecommendations(mockRecommendations)
    } catch (err) {
      error('Error al cargar recomendaciones')
    } finally {
      setLoading(false)
    }
  }

  const applyRecommendation = (recommendationId: string) => {
    setRecommendations(prev => prev.map(rec => 
      rec.id === recommendationId ? { ...rec, isApplied: true } : rec
    ))
    success('Recomendación aplicada exitosamente')
  }

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'payment_strategy': return <DollarSign className="w-5 h-5 text-green-500" />
      case 'debt_consolidation': return <CreditCard className="w-5 h-5 text-blue-500" />
      case 'utilization_optimization': return <TrendingDown className="w-5 h-5 text-orange-500" />
      case 'interest_reduction': return <Calculator className="w-5 h-5 text-purple-500" />
      case 'credit_score': return <Target className="w-5 h-5 text-indigo-500" />
      case 'spending_pattern': return <TrendingUp className="w-5 h-5 text-pink-500" />
      default: return <Lightbulb className="w-5 h-5 text-gray-500" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'low': return 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      default: return 'bg-gray-100 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
  }

  const getImpactText = (impact: string) => {
    switch (impact) {
      case 'high': return 'Alto Impacto'
      case 'medium': return 'Impacto Medio'
      case 'low': return 'Bajo Impacto'
      default: return 'Impacto Normal'
    }
  }

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Fácil'
      case 'medium': return 'Medio'
      case 'hard': return 'Difícil'
      default: return 'Normal'
    }
  }

  const getCategoryText = (category: string) => {
    switch (category) {
      case 'financial': return 'Financiero'
      case 'behavioral': return 'Comportamental'
      case 'strategic': return 'Estratégico'
      default: return 'General'
    }
  }

  const getTotalSavings = () => {
    return recommendations.reduce((sum, rec) => sum + (rec.savings || 0), 0)
  }

  const getAppliedCount = () => {
    return recommendations.filter(rec => rec.isApplied).length
  }

  const getHighImpactCount = () => {
    return recommendations.filter(rec => rec.impact === 'high').length
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Recomendaciones Inteligentes
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCard ? `Optimización para ${selectedCard.name}` : 'Mejora tu gestión de tarjetas de crédito'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Ahorro Potencial</span>
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(getTotalSavings())}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Alto Impacto</span>
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {getHighImpactCount()}
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Aplicadas</span>
                </div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {getAppliedCount()}
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Total Recomendaciones</span>
                </div>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {recommendations.length}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar:</span>
              {[
                { value: 'all', label: 'Todas', count: recommendations.length },
                { value: 'high_impact', label: 'Alto Impacto', count: getHighImpactCount() },
                { value: 'easy', label: 'Fáciles', count: recommendations.filter(r => r.difficulty === 'easy').length },
                { value: 'financial', label: 'Financieras', count: recommendations.filter(r => r.category === 'financial').length }
              ].map(filterOption => (
                <button
                  key={filterOption.value}
                  onClick={() => setFilter(filterOption.value as any)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    filter === filterOption.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {filterOption.label} ({filterOption.count})
                </button>
              ))}
            </div>

            {/* Recommendations List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Cargando recomendaciones...</p>
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No hay recomendaciones
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {filter === 'all' ? 'No hay recomendaciones disponibles' : `No hay recomendaciones ${filter === 'high_impact' ? 'de alto impacto' : filter === 'easy' ? 'fáciles' : 'financieras'}`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecommendations.map((recommendation, index) => (
                  <motion.div
                    key={recommendation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`p-6 rounded-xl border transition-all duration-200 ${getImpactColor(recommendation.impact)} ${
                      recommendation.isApplied ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getRecommendationIcon(recommendation.type)}
                          <h5 className="font-semibold text-gray-900 dark:text-white text-lg">
                            {recommendation.title}
                          </h5>
                          {recommendation.isApplied && (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {recommendation.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {getImpactText(recommendation.impact)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {recommendation.timeframe}
                          </span>
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {getDifficultyText(recommendation.difficulty)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            {getCategoryText(recommendation.category)}
                          </span>
                          {recommendation.cardName && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {recommendation.cardName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        {recommendation.savings && (
                          <div className="text-lg font-bold text-green-600 dark:text-green-400 mb-1">
                            {formatCurrency(recommendation.savings)}
                          </div>
                        )}
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Ahorro estimado
                        </div>
                      </div>
                    </div>

                    {!recommendation.isApplied && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => applyRecommendation(recommendation.id)}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer flex items-center gap-2"
                        >
                          Aplicar Recomendación
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-semibold cursor-pointer"
                        >
                          Más Detalles
                        </button>
                      </div>
                    )}

                    {recommendation.isApplied && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-semibold">
                          Recomendación aplicada exitosamente
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
