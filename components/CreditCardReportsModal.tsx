'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Download, Calendar, BarChart3, PieChart, TrendingUp, TrendingDown, DollarSign, CreditCard, Target, AlertCircle } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartPieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { formatCurrency } from '@/lib/formatNumber'

interface CreditCardReport {
  id: string
  cardId: string
  cardName: string
  period: string
  totalSpent: number
  totalPaid: number
  totalInterest: number
  averageUtilization: number
  paymentHistory: any[]
  spendingByCategory: any[]
  monthlyTrends: any[]
  createdAt: string
}

interface CreditCardReportsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: any
  consumptions?: any[]
  payments?: any[]
}

export default function CreditCardReportsModal({ 
  isOpen, 
  onClose, 
  selectedCard,
  consumptions = [],
  payments = []
}: CreditCardReportsModalProps) {
  const [reports, setReports] = useState<CreditCardReport[]>([])
  const [selectedReport, setSelectedReport] = useState<CreditCardReport | null>(null)
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Form state
  const [reportForm, setReportForm] = useState({
    cardId: '',
    cardName: '',
    startDate: '',
    endDate: '',
    reportType: 'comprehensive' as 'comprehensive' | 'spending' | 'payments' | 'utilization'
  })

  // Cargar reportes existentes
  useEffect(() => {
    if (isOpen) {
      loadReports()
      if (selectedCard) {
        setReportForm(prev => ({
          ...prev,
          cardId: selectedCard.id,
          cardName: selectedCard.name
        }))
      }
    }
  }, [isOpen, selectedCard])

  const loadReports = async () => {
    try {
      setLoading(true)
      // Generar reportes simulados
      const mockReports: CreditCardReport[] = [
        {
          id: '1',
          cardId: '1',
          cardName: 'Visa Platinum',
          period: 'Enero 2024',
          totalSpent: 850000,
          totalPaid: 600000,
          totalInterest: 25000,
          averageUtilization: 75,
          paymentHistory: [
            { month: 'Ene', paid: 200000, due: 200000 },
            { month: 'Feb', paid: 200000, due: 200000 },
            { month: 'Mar', paid: 200000, due: 200000 }
          ],
          spendingByCategory: [
            { category: 'Alimentación', amount: 300000, percentage: 35 },
            { category: 'Compras', amount: 250000, percentage: 29 },
            { category: 'Servicios', amount: 150000, percentage: 18 },
            { category: 'Entretenimiento', amount: 100000, percentage: 12 },
            { category: 'Otros', amount: 50000, percentage: 6 }
          ],
          monthlyTrends: [
            { month: 'Ene', spent: 300000, paid: 200000, balance: 100000 },
            { month: 'Feb', spent: 250000, paid: 200000, balance: 150000 },
            { month: 'Mar', spent: 300000, paid: 200000, balance: 250000 }
          ],
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          cardId: '2',
          cardName: 'Mastercard Gold',
          period: 'Enero 2024',
          totalSpent: 450000,
          totalPaid: 400000,
          totalInterest: 15000,
          averageUtilization: 45,
          paymentHistory: [
            { month: 'Ene', paid: 150000, due: 150000 },
            { month: 'Feb', paid: 150000, due: 150000 },
            { month: 'Mar', paid: 100000, due: 100000 }
          ],
          spendingByCategory: [
            { category: 'Alimentación', amount: 200000, percentage: 44 },
            { category: 'Compras', amount: 150000, percentage: 33 },
            { category: 'Servicios', amount: 100000, percentage: 23 }
          ],
          monthlyTrends: [
            { month: 'Ene', spent: 150000, paid: 150000, balance: 0 },
            { month: 'Feb', spent: 150000, paid: 150000, balance: 0 },
            { month: 'Mar', spent: 150000, paid: 100000, balance: 50000 }
          ],
          createdAt: new Date().toISOString()
        }
      ]
      setReports(mockReports)
    } catch (err) {
      error('Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    if (!reportForm.cardId || !reportForm.startDate || !reportForm.endDate) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      setLoading(true)
      // Simular generación de reporte
      const newReport: CreditCardReport = {
        id: Date.now().toString(),
        cardId: reportForm.cardId,
        cardName: reportForm.cardName,
        period: `${new Date(reportForm.startDate).toLocaleDateString('es-CO')} - ${new Date(reportForm.endDate).toLocaleDateString('es-CO')}`,
        totalSpent: 750000,
        totalPaid: 500000,
        totalInterest: 20000,
        averageUtilization: 65,
        paymentHistory: [
          { month: 'Ene', paid: 150000, due: 150000 },
          { month: 'Feb', paid: 150000, due: 150000 },
          { month: 'Mar', paid: 200000, due: 200000 }
        ],
        spendingByCategory: [
          { category: 'Alimentación', amount: 250000, percentage: 33 },
          { category: 'Compras', amount: 200000, percentage: 27 },
          { category: 'Servicios', amount: 150000, percentage: 20 },
          { category: 'Entretenimiento', amount: 100000, percentage: 13 },
          { category: 'Otros', amount: 50000, percentage: 7 }
        ],
        monthlyTrends: [
          { month: 'Ene', spent: 250000, paid: 150000, balance: 100000 },
          { month: 'Feb', spent: 250000, paid: 150000, balance: 200000 },
          { month: 'Mar', spent: 250000, paid: 200000, balance: 250000 }
        ],
        createdAt: new Date().toISOString()
      }

      setReports(prev => [newReport, ...prev])
      success('Reporte generado exitosamente')
      setShowGenerateForm(false)
      setSelectedReport(newReport)
    } catch (err) {
      error('Error al generar reporte')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = (report: CreditCardReport) => {
    // Simular exportación
    success('Reporte exportado exitosamente')
  }

  const getReportTypeText = (type: string) => {
    switch (type) {
      case 'comprehensive': return 'Completo'
      case 'spending': return 'Gastos'
      case 'payments': return 'Pagos'
      case 'utilization': return 'Utilización'
      default: return 'Completo'
    }
  }

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'text-red-600 dark:text-red-400'
    if (utilization >= 60) return 'text-orange-600 dark:text-orange-400'
    if (utilization >= 30) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  const getUtilizationStatus = (utilization: number) => {
    if (utilization >= 80) return 'Crítica'
    if (utilization >= 60) return 'Alta'
    if (utilization >= 30) return 'Moderada'
    return 'Saludable'
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
                  Reportes Detallados de Tarjetas
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCard ? `Reportes para ${selectedCard.name}` : 'Análisis completo de tus tarjetas'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGenerateForm(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Generar Reporte
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
            {showGenerateForm ? (
              /* Generate Form */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Generar Nuevo Reporte
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tarjeta
                      </label>
                      <input
                        type="text"
                        value={reportForm.cardName}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipo de Reporte
                      </label>
                      <select
                        value={reportForm.reportType}
                        onChange={(e) => setReportForm(prev => ({ ...prev, reportType: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="comprehensive">Completo</option>
                        <option value="spending">Gastos</option>
                        <option value="payments">Pagos</option>
                        <option value="utilization">Utilización</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha Inicio *
                      </label>
                      <input
                        type="date"
                        value={reportForm.startDate}
                        onChange={(e) => setReportForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha Fin *
                      </label>
                      <input
                        type="date"
                        value={reportForm.endDate}
                        onChange={(e) => setReportForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={generateReport}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {loading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                    <button
                      onClick={() => setShowGenerateForm(false)}
                      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : selectedReport ? (
              /* Report Details */
              <div className="space-y-6">
                {/* Report Header */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedReport.cardName} - {selectedReport.period}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Reporte generado el {new Date(selectedReport.createdAt).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                    <button
                      onClick={() => exportReport(selectedReport)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Exportar
                    </button>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Gastado</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(selectedReport.totalSpent)}
                      </div>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Pagado</div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(selectedReport.totalPaid)}
                      </div>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Intereses</div>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(selectedReport.totalInterest)}
                      </div>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Utilización</div>
                      <div className={`text-lg font-bold ${getUtilizationColor(selectedReport.averageUtilization)}`}>
                        {selectedReport.averageUtilization}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {getUtilizationStatus(selectedReport.averageUtilization)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Spending by Category */}
                  <div className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                    <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Gastos por Categoría
                    </h5>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartPieChart>
                        <Pie
                          data={selectedReport.spendingByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category, percentage }) => `${category} ${percentage}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="amount"
                        >
                          {selectedReport.spendingByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [formatCurrency(value), 'Monto']} />
                      </RechartPieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Monthly Trends */}
                  <div className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                    <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Tendencia Mensual
                    </h5>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={selectedReport.monthlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any) => [formatCurrency(value), '']}
                          labelStyle={{ color: '#374151' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="spent" stroke="#EF4444" strokeWidth={2} name="Gastado" />
                        <Line type="monotone" dataKey="paid" stroke="#10B981" strokeWidth={2} name="Pagado" />
                        <Line type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2} name="Saldo" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Payment History */}
                <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-600">
                    <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Historial de Pagos
                    </h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Mes
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Pagado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Vencido
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {selectedReport.paymentHistory.map((payment, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {payment.month}
                            </td>
                            <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-semibold">
                              {formatCurrency(payment.paid)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-semibold">
                              {formatCurrency(payment.due)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                payment.paid >= payment.due 
                                  ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                  : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                              }`}>
                                {payment.paid >= payment.due ? 'Al día' : 'Pendiente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-semibold cursor-pointer"
                  >
                    Volver a Reportes
                  </button>
                </div>
              </div>
            ) : (
              /* Reports List */
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando reportes...</p>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No hay reportes disponibles
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Genera tu primer reporte para comenzar
                    </p>
                    <button
                      onClick={() => setShowGenerateForm(true)}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Generar Primer Reporte
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.map((report, index) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-200 cursor-pointer"
                        onClick={() => setSelectedReport(report)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-gray-900 dark:text-white">
                                {report.cardName}
                              </h5>
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full">
                                {report.period}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Generado el {new Date(report.createdAt).toLocaleDateString('es-CO')}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                              {formatCurrency(report.totalSpent)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Total gastado
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500 dark:text-gray-400 mb-1">Pagado</div>
                            <div className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(report.totalPaid)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400 mb-1">Intereses</div>
                            <div className="font-semibold text-red-600 dark:text-red-400">
                              {formatCurrency(report.totalInterest)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400 mb-1">Utilización</div>
                            <div className={`font-semibold ${getUtilizationColor(report.averageUtilization)}`}>
                              {report.averageUtilization}%
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
