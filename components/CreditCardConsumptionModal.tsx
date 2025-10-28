'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, DollarSign, Calendar, Tag, FileText, Calculator, AlertCircle } from 'lucide-react'
import { useToastContext } from '@/components/Toast'

interface CreditCardConsumption {
  id: string
  cardId: string
  cardName: string
  merchant: string
  amount: number
  date: string
  category: string
  subcategory: string
  installments: number
  currentInstallment: number
  monthlyPayment: number
  description?: string
  createdAt: string
}

interface CreditCardConsumptionModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: any
  categories: any[]
  subcategories: any[]
}

export default function CreditCardConsumptionModal({ 
  isOpen, 
  onClose, 
  selectedCard,
  categories,
  subcategories
}: CreditCardConsumptionModalProps) {
  const [consumptions, setConsumptions] = useState<CreditCardConsumption[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Form state
  const [formData, setFormData] = useState({
    cardId: '',
    cardName: '',
    merchant: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    subcategory: '',
    installments: '1',
    description: ''
  })

  // Cargar consumos existentes
  useEffect(() => {
    if (isOpen) {
      loadConsumptions()
      if (selectedCard) {
        setFormData(prev => ({
          ...prev,
          cardId: selectedCard.id,
          cardName: selectedCard.name
        }))
      }
    }
  }, [isOpen, selectedCard])

  const loadConsumptions = async () => {
    try {
      setLoading(true)
      // Por ahora simulamos datos, después conectaremos con la API
      const mockConsumptions: CreditCardConsumption[] = [
        {
          id: '1',
          cardId: '1',
          cardName: 'Visa Platinum',
          merchant: 'Amazon',
          amount: 150000,
          date: '2024-01-15',
          category: 'Compras',
          subcategory: 'Online',
          installments: 3,
          currentInstallment: 1,
          monthlyPayment: 50000,
          description: 'Compra de productos electrónicos',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          cardId: '1',
          cardName: 'Visa Platinum',
          merchant: 'Supermercado',
          amount: 85000,
          date: '2024-01-20',
          category: 'Alimentación',
          subcategory: 'Supermercado',
          installments: 1,
          currentInstallment: 1,
          monthlyPayment: 85000,
          description: 'Compra semanal',
          createdAt: new Date().toISOString()
        }
      ]
      setConsumptions(mockConsumptions)
    } catch (err) {
      error('Error al cargar consumos')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateConsumption = async () => {
    if (!formData.cardId || !formData.merchant || !formData.amount || !formData.category) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      setLoading(true)
      const installments = parseInt(formData.installments)
      const amount = parseFloat(formData.amount)
      const monthlyPayment = amount / installments

      const newConsumption: CreditCardConsumption = {
        id: Date.now().toString(),
        cardId: formData.cardId,
        cardName: formData.cardName,
        merchant: formData.merchant,
        amount: amount,
        date: formData.date,
        category: formData.category,
        subcategory: formData.subcategory,
        installments: installments,
        currentInstallment: 1,
        monthlyPayment: monthlyPayment,
        description: formData.description,
        createdAt: new Date().toISOString()
      }

      setConsumptions(prev => [...prev, newConsumption])
      success('Consumo registrado exitosamente')
      resetForm()
      setShowCreateForm(false)
    } catch (err) {
      error('Error al registrar consumo')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      cardId: selectedCard?.id || '',
      cardName: selectedCard?.name || '',
      merchant: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      category: '',
      subcategory: '',
      installments: '1',
      description: ''
    })
  }

  const getInstallmentStatus = (consumption: CreditCardConsumption) => {
    if (consumption.installments === 1) {
      return 'Pago único'
    }
    return `${consumption.currentInstallment}/${consumption.installments} cuotas`
  }

  const getRemainingPayments = (consumption: CreditCardConsumption) => {
    if (consumption.installments === 1) {
      return 0
    }
    return consumption.installments - consumption.currentInstallment
  }

  const getTotalRemaining = (consumption: CreditCardConsumption) => {
    return consumption.monthlyPayment * getRemainingPayments(consumption)
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
                  Consumos de Tarjeta de Crédito
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCard ? `Registra consumos para ${selectedCard.name}` : 'Registra y gestiona tus consumos'}
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
                  <CreditCard className="w-4 h-4" />
                  Nuevo Consumo
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
                    Registrar Nuevo Consumo
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Comercio/Establecimiento *
                      </label>
                      <input
                        type="text"
                        value={formData.merchant}
                        onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="Ej: Amazon, Supermercado, Restaurante..."
                      />
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
                        Fecha *
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Número de Cuotas
                      </label>
                      <select
                        value={formData.installments}
                        onChange={(e) => setFormData(prev => ({ ...prev, installments: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>
                            {num === 1 ? 'Pago único' : `${num} cuotas`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Categoría *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value, subcategory: '' }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Seleccionar categoría</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Subcategoría
                      </label>
                      <select
                        value={formData.subcategory}
                        onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        disabled={!formData.category}
                      >
                        <option value="">Seleccionar subcategoría</option>
                        {subcategories
                          .filter(sub => sub.category === formData.category)
                          .map(sub => (
                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                          ))}
                      </select>
                    </div>
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
                      placeholder="Detalles adicionales del consumo..."
                    />
                  </div>

                  {/* Resumen de cuotas */}
                  {formData.amount && formData.installments && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Resumen de Cuotas
                      </h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Monto total:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            ${parseFloat(formData.amount || '0').toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Cuotas:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {formData.installments === '1' ? 'Pago único' : `${formData.installments} cuotas`}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Pago mensual:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            ${(parseFloat(formData.amount || '0') / parseInt(formData.installments)).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Total a pagar:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            ${parseFloat(formData.amount || '0').toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={handleCreateConsumption}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {loading ? 'Registrando...' : 'Registrar Consumo'}
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
              /* Consumptions List */
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando consumos...</p>
                  </div>
                ) : consumptions.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No tienes consumos registrados
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Registra tu primer consumo para comenzar
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Registrar Primer Consumo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {consumptions.map((consumption, index) => (
                      <motion.div
                        key={consumption.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-gray-900 dark:text-white">
                                {consumption.merchant}
                              </h5>
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full">
                                {consumption.cardName}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <span className="flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {consumption.category}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(consumption.date).toLocaleDateString('es-CO')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calculator className="w-3 h-3" />
                                {getInstallmentStatus(consumption)}
                              </span>
                            </div>
                            {consumption.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                {consumption.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                              ${consumption.amount.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              ${consumption.monthlyPayment.toLocaleString()}/mes
                            </div>
                          </div>
                        </div>

                        {/* Progress bar for installments */}
                        {consumption.installments > 1 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                              <span>Progreso de cuotas</span>
                              <span>{consumption.currentInstallment}/{consumption.installments}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(consumption.currentInstallment / consumption.installments) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Remaining payments info */}
                        {getRemainingPayments(consumption) > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>Pendiente: {getRemainingPayments(consumption)} cuotas</span>
                            </div>
                            <div className="font-semibold text-orange-600 dark:text-orange-400">
                              ${getTotalRemaining(consumption).toLocaleString()}
                            </div>
                          </div>
                        )}
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
