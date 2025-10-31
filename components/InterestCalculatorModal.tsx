'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calculator, AlertCircle, TrendingUp, DollarSign, Calendar, Clock, Percent } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { formatCurrency } from '@/lib/formatNumber'

interface InterestCalculation {
  id: string
  cardId: string
  cardName: string
  consumptionId: string
  consumptionName: string
  originalAmount: number
  interestRate: number
  daysOverdue: number
  interestAmount: number
  totalAmount: number
  calculationDate: string
  status: 'calculated' | 'paid' | 'pending'
}

interface InterestCalculatorModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: any
  consumptions?: any[]
}

export default function InterestCalculatorModal({ 
  isOpen, 
  onClose, 
  selectedCard,
  consumptions = []
}: InterestCalculatorModalProps) {
  const [calculations, setCalculations] = useState<InterestCalculation[]>([])
  const [showCalculator, setShowCalculator] = useState(false)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Calculator form state
  const [calculatorData, setCalculatorData] = useState({
    consumptionId: '',
    consumptionName: '',
    originalAmount: '',
    interestRate: '',
    daysOverdue: '',
    paymentDate: ''
  })

  // Cargar cálculos existentes
  useEffect(() => {
    if (isOpen) {
      loadCalculations()
    }
  }, [isOpen])

  const loadCalculations = async () => {
    try {
      setLoading(true)
      // Por ahora simulamos datos, después conectaremos con la API
      const mockCalculations: InterestCalculation[] = [
        {
          id: '1',
          cardId: '1',
          cardName: 'Visa Platinum',
          consumptionId: '1',
          consumptionName: 'Amazon',
          originalAmount: 50000,
          interestRate: 2.5,
          daysOverdue: 15,
          interestAmount: 1875,
          totalAmount: 51875,
          calculationDate: '2024-01-30',
          status: 'calculated'
        },
        {
          id: '2',
          cardId: '1',
          cardName: 'Visa Platinum',
          consumptionId: '2',
          consumptionName: 'Supermercado',
          originalAmount: 85000,
          interestRate: 2.5,
          daysOverdue: 5,
          interestAmount: 1062.5,
          totalAmount: 86062.5,
          calculationDate: '2024-01-25',
          status: 'paid'
        }
      ]
      setCalculations(mockCalculations)
    } catch (err) {
      error('Error al cargar cálculos')
    } finally {
      setLoading(false)
    }
  }

  const calculateInterest = () => {
    if (!calculatorData.originalAmount || !calculatorData.interestRate || !calculatorData.daysOverdue) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    const originalAmount = parseFloat(calculatorData.originalAmount)
    const interestRate = parseFloat(calculatorData.interestRate)
    const daysOverdue = parseInt(calculatorData.daysOverdue)

    // Cálculo de interés simple: (Monto * Tasa * Días) / 365
    const interestAmount = (originalAmount * interestRate * daysOverdue) / 365
    const totalAmount = originalAmount + interestAmount

    const newCalculation: InterestCalculation = {
      id: Date.now().toString(),
      cardId: selectedCard?.id || '',
      cardName: selectedCard?.name || '',
      consumptionId: calculatorData.consumptionId,
      consumptionName: calculatorData.consumptionName,
      originalAmount: originalAmount,
      interestRate: interestRate,
      daysOverdue: daysOverdue,
      interestAmount: interestAmount,
      totalAmount: totalAmount,
      calculationDate: new Date().toISOString().split('T')[0],
      status: 'calculated'
    }

    setCalculations(prev => [...prev, newCalculation])
    success('Cálculo de interés realizado exitosamente')
    resetCalculator()
    setShowCalculator(false)
  }

  const resetCalculator = () => {
    setCalculatorData({
      consumptionId: '',
      consumptionName: '',
      originalAmount: '',
      interestRate: '',
      daysOverdue: '',
      paymentDate: ''
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'calculated': return <Calculator className="w-4 h-4 text-blue-500" />
      case 'paid': return <DollarSign className="w-4 h-4 text-green-500" />
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />
      default: return <Calculator className="w-4 h-4 text-blue-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'calculated': return 'Calculado'
      case 'paid': return 'Pagado'
      case 'pending': return 'Pendiente'
      default: return 'Calculado'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'calculated': return 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'paid': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      default: return 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }
  }

  const getTotalInterest = () => {
    return calculations.reduce((sum, calc) => sum + calc.interestAmount, 0)
  }

  const getTotalOverdue = () => {
    return calculations.reduce((sum, calc) => sum + calc.totalAmount, 0)
  }

  const getOverdueConsumptions = () => {
    return consumptions.filter(consumption => {
      const paymentDate = new Date(consumption.date)
      const today = new Date()
      const daysDiff = Math.floor((today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysDiff > 30 // Consideramos vencido después de 30 días
    })
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
                  Calculadora de Intereses
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCard ? `Cálculos para ${selectedCard.name}` : 'Calcula intereses por mora'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resetCalculator()
                    setShowCalculator(true)
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Calculator className="w-4 h-4" />
                  Calcular Interés
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {showCalculator ? (
              /* Calculator Form */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Calcular Interés por Mora
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Consumo
                      </label>
                      <select
                        value={calculatorData.consumptionId}
                        onChange={(e) => {
                          const consumption = consumptions.find(c => c.id === e.target.value)
                          setCalculatorData(prev => ({
                            ...prev,
                            consumptionId: e.target.value,
                            consumptionName: consumption?.merchant || '',
                            originalAmount: consumption?.amount?.toString() || prev.originalAmount
                          }))
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Seleccionar consumo</option>
                        {consumptions.map(consumption => (
                          <option key={consumption.id} value={consumption.id}>
                            {consumption.merchant} - {formatCurrency(consumption.amount)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monto Original *
                      </label>
                      <input
                        type="number"
                        value={calculatorData.originalAmount}
                        onChange={(e) => setCalculatorData(prev => ({ ...prev, originalAmount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tasa de Interés (% anual) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={calculatorData.interestRate}
                        onChange={(e) => setCalculatorData(prev => ({ ...prev, interestRate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="30.0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Días de Mora *
                      </label>
                      <input
                        type="number"
                        value={calculatorData.daysOverdue}
                        onChange={(e) => setCalculatorData(prev => ({ ...prev, daysOverdue: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="30"
                      />
                    </div>
                  </div>

                  {/* Preview Calculation */}
                  {calculatorData.originalAmount && calculatorData.interestRate && calculatorData.daysOverdue && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Vista Previa del Cálculo
                      </h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Monto original:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {formatCurrency(parseFloat(calculatorData.originalAmount || '0'))}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Tasa anual:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {calculatorData.interestRate}%
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Días de mora:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {calculatorData.daysOverdue} días
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Interés calculado:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {formatCurrency((parseFloat(calculatorData.originalAmount || '0') * parseFloat(calculatorData.interestRate || '0') * parseInt(calculatorData.daysOverdue || '0')) / 365)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={calculateInterest}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {loading ? 'Calculando...' : 'Calcular Interés'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCalculator(false)
                        resetCalculator()
                      }}
                      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Calculations List and Summary */
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">Total Intereses</span>
                    </div>
                    <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                      {formatCurrency(getTotalInterest())}
                    </div>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Total Vencido</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {formatCurrency(getTotalOverdue())}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Cálculos</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {calculations.length}
                    </div>
                  </div>
                </div>

                {/* Overdue Consumptions Alert */}
                {getOverdueConsumptions().length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="font-semibold text-red-900 dark:text-red-100">
                        Consumos Vencidos Detectados
                      </span>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                      Tienes {getOverdueConsumptions().length} consumos que pueden generar intereses por mora.
                    </p>
                    <div className="space-y-2">
                      {getOverdueConsumptions().map(consumption => (
                        <div key={consumption.id} className="flex items-center justify-between text-sm">
                          <span className="text-red-700 dark:text-red-300">
                            {consumption.merchant} - {formatCurrency(consumption.amount)}
                          </span>
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            {Math.floor((new Date().getTime() - new Date(consumption.date).getTime()) / (1000 * 60 * 60 * 24))} días
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calculations List */}
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando cálculos...</p>
                  </div>
                ) : calculations.length === 0 ? (
                  <div className="text-center py-12">
                    <Calculator className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No tienes cálculos de interés
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Calcula intereses por mora para tus consumos vencidos
                    </p>
                    <button
                      onClick={() => setShowCalculator(true)}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Realizar Primer Cálculo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {calculations.map((calculation, index) => (
                      <motion.div
                        key={calculation.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`p-4 rounded-xl border transition-all duration-200 ${getStatusColor(calculation.status)}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-gray-900 dark:text-white">
                                {calculation.consumptionName}
                              </h5>
                              {getStatusIcon(calculation.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(calculation.calculationDate).toLocaleDateString('es-CO')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Percent className="w-3 h-3" />
                                {calculation.interestRate}% anual
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {calculation.daysOverdue} días
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                              {formatCurrency(calculation.totalAmount)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              +{formatCurrency(calculation.interestAmount)} interés
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
