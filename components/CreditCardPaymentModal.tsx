'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, DollarSign, Calendar, CheckCircle, AlertCircle, Clock, TrendingUp, TrendingDown, Calculator, Receipt } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { formatCurrency } from '@/lib/formatNumber'

interface CreditCardPayment {
  id: string
  cardId: string
  cardName: string
  consumptionId?: string
  consumptionName?: string
  amount: number
  paymentDate: string
  paymentMethod: 'transfer' | 'cash' | 'debit' | 'other'
  installmentNumber?: number
  totalInstallments?: number
  description?: string
  status: 'completed' | 'pending' | 'overdue'
  createdAt: string
}

interface CreditCardPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: any
  selectedConsumption?: any
}

export default function CreditCardPaymentModal({ 
  isOpen, 
  onClose, 
  selectedCard,
  selectedConsumption
}: CreditCardPaymentModalProps) {
  const [payments, setPayments] = useState<CreditCardPayment[]>([])
  const [consumptions, setConsumptions] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Form state
  const [formData, setFormData] = useState({
    cardId: '',
    cardName: '',
    consumptionId: '',
    consumptionName: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'transfer' as 'transfer' | 'cash' | 'debit' | 'other',
    installmentNumber: '',
    totalInstallments: '',
    description: ''
  })

  // Cargar datos existentes
  useEffect(() => {
    if (isOpen) {
      loadPayments()
      loadConsumptions()
      if (selectedCard) {
        setFormData(prev => ({
          ...prev,
          cardId: selectedCard.id,
          cardName: selectedCard.name
        }))
      }
      if (selectedConsumption) {
        setFormData(prev => ({
          ...prev,
          consumptionId: selectedConsumption.id,
          consumptionName: selectedConsumption.merchant,
          amount: selectedConsumption.monthlyPayment.toString(),
          installmentNumber: selectedConsumption.currentInstallment.toString(),
          totalInstallments: selectedConsumption.installments.toString()
        }))
      }
    }
  }, [isOpen, selectedCard, selectedConsumption])

  const loadPayments = async () => {
    try {
      setLoading(true)
      // Por ahora simulamos datos, después conectaremos con la API
      const mockPayments: CreditCardPayment[] = [
        {
          id: '1',
          cardId: '1',
          cardName: 'Visa Platinum',
          consumptionId: '1',
          consumptionName: 'Amazon',
          amount: 50000,
          paymentDate: '2024-01-25',
          paymentMethod: 'transfer',
          installmentNumber: 1,
          totalInstallments: 3,
          description: 'Pago de cuota 1/3',
          status: 'completed',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          cardId: '1',
          cardName: 'Visa Platinum',
          consumptionId: '2',
          consumptionName: 'Supermercado',
          amount: 85000,
          paymentDate: '2024-01-30',
          paymentMethod: 'debit',
          installmentNumber: 1,
          totalInstallments: 1,
          description: 'Pago único',
          status: 'completed',
          createdAt: new Date().toISOString()
        }
      ]
      setPayments(mockPayments)
    } catch (err) {
      error('Error al cargar pagos')
    } finally {
      setLoading(false)
    }
  }

  const loadConsumptions = async () => {
    try {
      // Simulamos consumos existentes
      const mockConsumptions = [
        {
          id: '1',
          cardId: '1',
          cardName: 'Visa Platinum',
          merchant: 'Amazon',
          amount: 150000,
          installments: 3,
          currentInstallment: 1,
          monthlyPayment: 50000,
          date: '2024-01-15'
        },
        {
          id: '2',
          cardId: '1',
          cardName: 'Visa Platinum',
          merchant: 'Supermercado',
          amount: 85000,
          installments: 1,
          currentInstallment: 1,
          monthlyPayment: 85000,
          date: '2024-01-20'
        }
      ]
      setConsumptions(mockConsumptions)
    } catch (err) {
      error('Error al cargar consumos')
    }
  }

  const handleCreatePayment = async () => {
    if (!formData.cardId || !formData.amount || !formData.paymentDate) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      setLoading(true)
      const newPayment: CreditCardPayment = {
        id: Date.now().toString(),
        cardId: formData.cardId,
        cardName: formData.cardName,
        consumptionId: formData.consumptionId || undefined,
        consumptionName: formData.consumptionName || undefined,
        amount: parseFloat(formData.amount),
        paymentDate: formData.paymentDate,
        paymentMethod: formData.paymentMethod,
        installmentNumber: formData.installmentNumber ? parseInt(formData.installmentNumber) : undefined,
        totalInstallments: formData.totalInstallments ? parseInt(formData.totalInstallments) : undefined,
        description: formData.description,
        status: 'completed',
        createdAt: new Date().toISOString()
      }

      setPayments(prev => [...prev, newPayment])
      
      // Actualizar el consumo si es una cuota
      if (formData.consumptionId && formData.installmentNumber) {
        setConsumptions(prev => prev.map(consumption => {
          if (consumption.id === formData.consumptionId) {
            return {
              ...consumption,
              currentInstallment: parseInt(formData.installmentNumber) + 1
            }
          }
          return consumption
        }))
      }

      success('Pago registrado exitosamente')
      resetForm()
      setShowCreateForm(false)
    } catch (err) {
      error('Error al registrar pago')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      cardId: selectedCard?.id || '',
      cardName: selectedCard?.name || '',
      consumptionId: '',
      consumptionName: '',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'transfer',
      installmentNumber: '',
      totalInstallments: '',
      description: ''
    })
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'transfer': return <CreditCard className="w-4 h-4" />
      case 'cash': return <DollarSign className="w-4 h-4" />
      case 'debit': return <Receipt className="w-4 h-4" />
      default: return <CreditCard className="w-4 h-4" />
    }
  }

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'transfer': return 'Transferencia'
      case 'cash': return 'Efectivo'
      case 'debit': return 'Débito'
      case 'other': return 'Otro'
      default: return 'Transferencia'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />
      case 'overdue': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return <CheckCircle className="w-4 h-4 text-green-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completado'
      case 'pending': return 'Pendiente'
      case 'overdue': return 'Vencido'
      default: return 'Completado'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'overdue': return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      default: return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }
  }

  const getTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0)
  }

  const getPendingPayments = () => {
    return consumptions.reduce((sum, consumption) => {
      const paidInstallments = payments.filter(p => p.consumptionId === consumption.id).length
      const remainingInstallments = consumption.installments - paidInstallments
      return sum + (remainingInstallments * consumption.monthlyPayment)
    }, 0)
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
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Gestión de Pagos de Tarjeta
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCard ? `Pagos para ${selectedCard.name}` : 'Registra y gestiona tus pagos'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resetForm()
                    setShowCreateForm(true)
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  Nuevo Pago
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
            {showCreateForm ? (
              /* Create Form */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Registrar Nuevo Pago
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Consumo (Opcional)
                      </label>
                      <select
                        value={formData.consumptionId}
                        onChange={(e) => {
                          const consumption = consumptions.find(c => c.id === e.target.value)
                          setFormData(prev => ({
                            ...prev,
                            consumptionId: e.target.value,
                            consumptionName: consumption?.merchant || '',
                            amount: consumption?.monthlyPayment?.toString() || prev.amount,
                            installmentNumber: consumption?.currentInstallment?.toString() || prev.installmentNumber,
                            totalInstallments: consumption?.installments?.toString() || prev.totalInstallments
                          }))
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Seleccionar consumo</option>
                        {consumptions.map(consumption => (
                          <option key={consumption.id} value={consumption.id}>
                            {consumption.merchant} - {formatCurrency(consumption.monthlyPayment)}/mes
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monto *
                      </label>
                      <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha de Pago *
                      </label>
                      <input
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Método de Pago
                      </label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="transfer">Transferencia</option>
                        <option value="debit">Débito</option>
                        <option value="cash">Efectivo</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>

                    {formData.consumptionId && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Cuota Número
                          </label>
                          <input
                            type="number"
                            value={formData.installmentNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, installmentNumber: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="1"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Total de Cuotas
                          </label>
                          <input
                            type="number"
                            value={formData.totalInstallments}
                            onChange={(e) => setFormData(prev => ({ ...prev, totalInstallments: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="1"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      rows={3}
                      placeholder="Detalles adicionales del pago..."
                    />
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={handleCreatePayment}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {loading ? 'Registrando...' : 'Registrar Pago'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false)
                        resetForm()
                      }}
                      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Payments List and Summary */
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Total Pagado</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(getTotalPaid())}
                    </div>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Pendiente</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                      {formatCurrency(getPendingPayments())}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Pagos</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {payments.length}
                    </div>
                  </div>
                </div>

                {/* Payments List */}
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando pagos...</p>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No tienes pagos registrados
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Registra tu primer pago para comenzar
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Registrar Primer Pago
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment, index) => (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`p-4 rounded-xl border transition-all duration-200 ${getStatusColor(payment.status)}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-gray-900 dark:text-white">
                                {payment.consumptionName || 'Pago general'}
                              </h5>
                              {getStatusIcon(payment.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(payment.paymentDate).toLocaleDateString('es-CO')}
                              </span>
                              <span className="flex items-center gap-1">
                                {getPaymentMethodIcon(payment.paymentMethod)}
                                {getPaymentMethodText(payment.paymentMethod)}
                              </span>
                              {payment.installmentNumber && (
                                <span className="flex items-center gap-1">
                                  <CreditCard className="w-3 h-3" />
                                  Cuota {payment.installmentNumber}/{payment.totalInstallments}
                                </span>
                              )}
                            </div>
                            {payment.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                {payment.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                              {formatCurrency(payment.amount)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {getStatusText(payment.status)}
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
