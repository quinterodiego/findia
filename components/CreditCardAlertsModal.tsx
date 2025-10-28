'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, AlertTriangle, Clock, Calendar, CreditCard, DollarSign, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'
import { useToastContext } from '@/components/Toast'

interface CreditCardAlert {
  id: string
  cardId: string
  cardName: string
  type: 'payment_due' | 'payment_overdue' | 'high_utilization' | 'cut_date' | 'low_balance' | 'interest_warning'
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate?: string
  amount?: number
  isRead: boolean
  createdAt: string
}

interface CreditCardAlertsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: any
  consumptions?: any[]
  payments?: any[]
}

export default function CreditCardAlertsModal({ 
  isOpen, 
  onClose, 
  selectedCard,
  consumptions = [],
  payments = []
}: CreditCardAlertsModalProps) {
  const [alerts, setAlerts] = useState<CreditCardAlert[]>([])
  const [filteredAlerts, setFilteredAlerts] = useState<CreditCardAlert[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'high'>('all')
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Cargar alertas existentes
  useEffect(() => {
    if (isOpen) {
      loadAlerts()
    }
  }, [isOpen])

  // Filtrar alertas
  useEffect(() => {
    let filtered = alerts

    switch (filter) {
      case 'unread':
        filtered = alerts.filter(alert => !alert.isRead)
        break
      case 'critical':
        filtered = alerts.filter(alert => alert.priority === 'critical')
        break
      case 'high':
        filtered = alerts.filter(alert => alert.priority === 'high' || alert.priority === 'critical')
        break
      default:
        filtered = alerts
    }

    setFilteredAlerts(filtered)
  }, [alerts, filter])

  const loadAlerts = async () => {
    try {
      setLoading(true)
      // Generar alertas automáticas basadas en datos simulados
      const mockAlerts: CreditCardAlert[] = [
        {
          id: '1',
          cardId: '1',
          cardName: 'Visa Platinum',
          type: 'payment_due',
          title: 'Pago Vencido',
          message: 'El pago de tu tarjeta Visa Platinum vence hoy. Evita intereses por mora.',
          priority: 'critical',
          dueDate: new Date().toISOString().split('T')[0],
          amount: 150000,
          isRead: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          cardId: '1',
          cardName: 'Visa Platinum',
          type: 'high_utilization',
          title: 'Alto Uso de Crédito',
          message: 'Tu utilización de crédito está en 85%. Considera reducir gastos.',
          priority: 'high',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          cardId: '2',
          cardName: 'Mastercard Gold',
          type: 'cut_date',
          title: 'Fecha de Corte Próxima',
          message: 'La fecha de corte de Mastercard Gold es en 3 días.',
          priority: 'medium',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          isRead: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '4',
          cardId: '1',
          cardName: 'Visa Platinum',
          type: 'interest_warning',
          title: 'Intereses Acumulados',
          message: 'Tienes $25,000 en intereses acumulados. Considera pagar más del mínimo.',
          priority: 'high',
          amount: 25000,
          isRead: false,
          createdAt: new Date().toISOString()
        }
      ]
      setAlerts(mockAlerts)
    } catch (err) {
      error('Error al cargar alertas')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, isRead: true } : alert
    ))
  }

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, isRead: true })))
    success('Todas las alertas marcadas como leídas')
  }

  const deleteAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
    success('Alerta eliminada')
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'payment_due': return <Calendar className="w-5 h-5 text-red-500" />
      case 'payment_overdue': return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'high_utilization': return <TrendingUp className="w-5 h-5 text-orange-500" />
      case 'cut_date': return <Clock className="w-5 h-5 text-blue-500" />
      case 'low_balance': return <DollarSign className="w-5 h-5 text-yellow-500" />
      case 'interest_warning': return <AlertCircle className="w-5 h-5 text-red-500" />
      default: return <Bell className="w-5 h-5 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'high': return 'bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'low': return 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      default: return 'bg-gray-100 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
  }

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Crítica'
      case 'high': return 'Alta'
      case 'medium': return 'Media'
      case 'low': return 'Baja'
      default: return 'Normal'
    }
  }

  const getUnreadCount = () => {
    return alerts.filter(alert => !alert.isRead).length
  }

  const getCriticalCount = () => {
    return alerts.filter(alert => alert.priority === 'critical').length
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
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Alertas de Tarjetas de Crédito
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCard ? `Alertas para ${selectedCard.name}` : 'Mantente al día con tus tarjetas'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getUnreadCount() > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold cursor-pointer"
                  >
                    Marcar todas como leídas
                  </button>
                )}
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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">Críticas</span>
                </div>
                <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {getCriticalCount()}
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">No Leídas</span>
                </div>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {getUnreadCount()}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Alertas</span>
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {alerts.length}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Leídas</span>
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {alerts.length - getUnreadCount()}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar:</span>
              {[
                { value: 'all', label: 'Todas', count: alerts.length },
                { value: 'unread', label: 'No leídas', count: getUnreadCount() },
                { value: 'critical', label: 'Críticas', count: getCriticalCount() },
                { value: 'high', label: 'Altas', count: alerts.filter(a => a.priority === 'high' || a.priority === 'critical').length }
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

            {/* Alerts List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Cargando alertas...</p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No hay alertas
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {filter === 'all' ? 'No tienes alertas pendientes' : `No hay alertas ${filter === 'unread' ? 'no leídas' : filter === 'critical' ? 'críticas' : 'de alta prioridad'}`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert, index) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`p-4 rounded-xl border transition-all duration-200 ${getPriorityColor(alert.priority)} ${
                      !alert.isRead ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getAlertIcon(alert.type)}
                          <h5 className="font-semibold text-gray-900 dark:text-white">
                            {alert.title}
                          </h5>
                          {!alert.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            {alert.cardName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            {getPriorityText(alert.priority)}
                          </span>
                          {alert.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(alert.dueDate).toLocaleDateString('es-CO')}
                            </span>
                          )}
                          {alert.amount && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              ${alert.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!alert.isRead && (
                        <button
                          onClick={() => markAsRead(alert.id)}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold cursor-pointer"
                        >
                          Marcar como leída
                        </button>
                      )}
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-semibold cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
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
