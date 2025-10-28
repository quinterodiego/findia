'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, TrendingDown, Calculator, BarChart3, PieChart, Target, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface ProjectionData {
  month: string
  totalDebt: number
  interestPaid: number
  principalPaid: number
  remainingDebt: number
}

interface CreditCardProjectionModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: any
  consumptions?: any[]
  payments?: any[]
}

export default function CreditCardProjectionModal({ 
  isOpen, 
  onClose, 
  selectedCard,
  consumptions = [],
  payments = []
}: CreditCardProjectionModalProps) {
  const [projections, setProjections] = useState<ProjectionData[]>([])
  const [showSimulator, setShowSimulator] = useState(false)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Simulator form state
  const [simulatorData, setSimulatorData] = useState({
    currentDebt: '',
    monthlyPayment: '',
    interestRate: '',
    months: '12',
    scenario: 'current' as 'current' | 'optimistic' | 'pessimistic'
  })

  // Cargar proyecciones existentes
  useEffect(() => {
    if (isOpen) {
      loadProjections()
    }
  }, [isOpen])

  const loadProjections = async () => {
    try {
      setLoading(true)
      // Generar proyección de ejemplo
      const mockProjections: ProjectionData[] = generateProjection({
        currentDebt: 500000,
        monthlyPayment: 100000,
        interestRate: 2.5,
        months: 12
      })
      setProjections(mockProjections)
    } catch (err) {
      error('Error al cargar proyecciones')
    } finally {
      setLoading(false)
    }
  }

  const generateProjection = (params: any): ProjectionData[] => {
    const { currentDebt, monthlyPayment, interestRate, months } = params
    const projections: ProjectionData[] = []
    let remainingDebt = currentDebt
    let totalInterestPaid = 0

    for (let i = 0; i < months; i++) {
      const interestPayment = (remainingDebt * interestRate) / 100
      const principalPayment = Math.min(monthlyPayment - interestPayment, remainingDebt)
      const actualPayment = principalPayment + interestPayment

      remainingDebt = Math.max(0, remainingDebt - principalPayment)
      totalInterestPaid += interestPayment

      projections.push({
        month: `Mes ${i + 1}`,
        totalDebt: remainingDebt,
        interestPaid: interestPayment,
        principalPaid: principalPayment,
        remainingDebt: remainingDebt
      })

      if (remainingDebt <= 0) break
    }

    return projections
  }

  const runSimulation = () => {
    if (!simulatorData.currentDebt || !simulatorData.monthlyPayment || !simulatorData.interestRate) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    const params = {
      currentDebt: parseFloat(simulatorData.currentDebt),
      monthlyPayment: parseFloat(simulatorData.monthlyPayment),
      interestRate: parseFloat(simulatorData.interestRate),
      months: parseInt(simulatorData.months)
    }

    const newProjections = generateProjection(params)
    setProjections(newProjections)
    success('Simulación realizada exitosamente')
    setShowSimulator(false)
  }

  const getScenarioData = () => {
    const baseData = {
      currentDebt: parseFloat(simulatorData.currentDebt) || 0,
      monthlyPayment: parseFloat(simulatorData.monthlyPayment) || 0,
      interestRate: parseFloat(simulatorData.interestRate) || 0,
      months: parseInt(simulatorData.months) || 12
    }

    switch (simulatorData.scenario) {
      case 'optimistic':
        return {
          ...baseData,
          interestRate: baseData.interestRate * 0.8, // 20% menos interés
          monthlyPayment: baseData.monthlyPayment * 1.2 // 20% más pago
        }
      case 'pessimistic':
        return {
          ...baseData,
          interestRate: baseData.interestRate * 1.3, // 30% más interés
          monthlyPayment: baseData.monthlyPayment * 0.8 // 20% menos pago
        }
      default:
        return baseData
    }
  }

  const getTotalInterest = () => {
    return projections.reduce((sum, proj) => sum + proj.interestPaid, 0)
  }

  const getTotalPrincipal = () => {
    return projections.reduce((sum, proj) => sum + proj.principalPaid, 0)
  }

  const getMonthsToPayOff = () => {
    return projections.length
  }

  const getFinalDebt = () => {
    return projections.length > 0 ? projections[projections.length - 1].remainingDebt : 0
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
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Proyecciones y Simuladores
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCard ? `Proyecciones para ${selectedCard.name}` : 'Simula escenarios futuros de pago'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSimulator(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Calculator className="w-4 h-4" />
                  Nuevo Simulador
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
            {showSimulator ? (
              /* Simulator Form */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Simulador de Escenarios
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Deuda Actual *
                      </label>
                      <input
                        type="number"
                        value={simulatorData.currentDebt}
                        onChange={(e) => setSimulatorData(prev => ({ ...prev, currentDebt: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pago Mensual *
                      </label>
                      <input
                        type="number"
                        value={simulatorData.monthlyPayment}
                        onChange={(e) => setSimulatorData(prev => ({ ...prev, monthlyPayment: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tasa de Interés (% mensual) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={simulatorData.interestRate}
                        onChange={(e) => setSimulatorData(prev => ({ ...prev, interestRate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="2.5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Meses a Proyectar
                      </label>
                      <select
                        value={simulatorData.months}
                        onChange={(e) => setSimulatorData(prev => ({ ...prev, months: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="6">6 meses</option>
                        <option value="12">12 meses</option>
                        <option value="18">18 meses</option>
                        <option value="24">24 meses</option>
                        <option value="36">36 meses</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Escenario
                    </label>
                    <div className="flex gap-3">
                      {[
                        { value: 'optimistic', label: 'Optimista', color: 'green' },
                        { value: 'current', label: 'Actual', color: 'blue' },
                        { value: 'pessimistic', label: 'Pesimista', color: 'red' }
                      ].map(scenario => (
                        <button
                          key={scenario.value}
                          type="button"
                          onClick={() => setSimulatorData(prev => ({ ...prev, scenario: scenario.value as any }))}
                          className={`flex-1 p-3 rounded-lg border transition-all duration-200 ${
                            simulatorData.scenario === scenario.value
                              ? `bg-${scenario.color}-500 text-white border-${scenario.color}-500 shadow-md`
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                          } cursor-pointer`}
                        >
                          {scenario.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview Simulation */}
                  {simulatorData.currentDebt && simulatorData.monthlyPayment && simulatorData.interestRate && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Vista Previa del Escenario {simulatorData.scenario === 'optimistic' ? 'Optimista' : simulatorData.scenario === 'pessimistic' ? 'Pesimista' : 'Actual'}
                      </h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Deuda inicial:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            ${parseFloat(simulatorData.currentDebt || '0').toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Pago mensual:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            ${parseFloat(simulatorData.monthlyPayment || '0').toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Tasa de interés:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {simulatorData.interestRate}% mensual
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Proyección:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {simulatorData.months} meses
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={runSimulation}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {loading ? 'Simulando...' : 'Ejecutar Simulación'}
                    </button>
                    <button
                      onClick={() => setShowSimulator(false)}
                      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Projections Display */
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Meses para Pagar</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {getMonthsToPayOff()}
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Total Principal</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      ${getTotalPrincipal().toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">Total Intereses</span>
                    </div>
                    <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                      ${getTotalInterest().toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Deuda Final</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      ${getFinalDebt().toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Charts */}
                {projections.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Debt Reduction Chart */}
                    <div className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Reducción de Deuda
                      </h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={projections}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: any) => [`$${value.toLocaleString()}`, 'Deuda Restante']}
                            labelStyle={{ color: '#374151' }}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="remainingDebt" 
                            stroke="#3B82F6" 
                            strokeWidth={2}
                            name="Deuda Restante"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Payment Breakdown Chart */}
                    <div className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Desglose de Pagos
                      </h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={projections.slice(0, 12)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
                            labelStyle={{ color: '#374151' }}
                          />
                          <Legend />
                          <Bar dataKey="principalPaid" fill="#10B981" name="Capital" />
                          <Bar dataKey="interestPaid" fill="#EF4444" name="Intereses" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Projections Table */}
                {projections.length > 0 && (
                  <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-600">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Proyección Detallada
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Mes
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Pago Principal
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Intereses
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Deuda Restante
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                          {projections.map((projection, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {projection.month}
                              </td>
                              <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-semibold">
                                ${projection.principalPaid.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400 font-semibold">
                                ${projection.interestPaid.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-semibold">
                                ${projection.remainingDebt.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {projections.length === 0 && (
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No hay proyecciones disponibles
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Ejecuta una simulación para ver proyecciones futuras
                    </p>
                    <button
                      onClick={() => setShowSimulator(true)}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Ejecutar Primera Simulación
                    </button>
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
