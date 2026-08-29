'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard as CreditCardIcon, DollarSign, Calendar, Receipt } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { useCreditCards } from '@/hooks/useCreditCards'
import { formatCurrency } from '@/lib/formatNumber'
import { formatCivilDate, getLocalTodayISODate } from '@/lib/formatDate'
import type { CreditCardPayment } from '@/types'

type PaymentWithCardName = CreditCardPayment & { cardName: string }

interface CreditCardPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: { id: string; name: string } | null
  // Ya no se usa dentro de este modal (los "consumos" que ofrecía eran mock,
  // ver diagnóstico). Se mantiene en la interfaz solo para no romper al padre,
  // que sigue pasando la prop.
  selectedConsumption?: unknown
}

export default function CreditCardPaymentModal({
  isOpen,
  onClose,
  selectedCard,
}: CreditCardPaymentModalProps) {
  const { success, error } = useToastContext()
  const { cards, fetchCards, fetchPayments, makePayment } = useCreditCards()

  const [allPayments, setAllPayments] = useState<PaymentWithCardName[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<{ amount?: string; cardId?: string; date?: string }>({})

  const [formData, setFormData] = useState({
    cardId: '',
    amount: '',
    paymentDate: getLocalTodayISODate(),
    paymentMethod: 'transfer' as 'transfer' | 'cash' | 'debit' | 'other',
    notes: '',
  })

  // Trae los pagos reales (CreditCardPayments, vía fetchPayments) de las tarjetas
  // indicadas y arma una lista plana ordenada por fecha, la más reciente primero.
  const loadPaymentsFor = async (cardsToLoad: Array<{ id: string; name: string }>) => {
    setLoadingPayments(true)
    try {
      const results = await Promise.all(
        cardsToLoad.map(async (card) => {
          try {
            const cardPayments = await fetchPayments(card.id)
            return cardPayments.map(p => ({ ...p, cardName: card.name }))
          } catch {
            return []
          }
        })
      )
      const merged = results.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setAllPayments(merged)
    } catch {
      error('No se pudieron cargar los pagos')
    } finally {
      setLoadingPayments(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setShowCreateForm(false)
    setFormErrors({})
    setFormData(prev => ({
      ...prev,
      cardId: selectedCard?.id || '',
      amount: '',
      paymentDate: getLocalTodayISODate(),
      notes: '',
    }));

    (async () => {
      const fetchedCards = await fetchCards().catch(() => [])
      const relevant = selectedCard
        ? fetchedCards.filter((c: { id: string }) => c.id === selectedCard.id)
        : fetchedCards
      await loadPaymentsFor(relevant)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedCard])

  const resetForm = () => {
    setFormData({
      cardId: selectedCard?.id || '',
      amount: '',
      paymentDate: getLocalTodayISODate(),
      paymentMethod: 'transfer',
      notes: '',
    })
    setFormErrors({})
  }

  const handleCreatePayment = async () => {
    const cardId = selectedCard?.id || formData.cardId
    const errs: { amount?: string; cardId?: string; date?: string } = {}

    if (!cardId) errs.cardId = 'Seleccioná una tarjeta'

    const amountNum = Number(formData.amount)
    if (!formData.amount || Number.isNaN(amountNum)) {
      errs.amount = 'Ingresá un importe válido'
    } else if (amountNum <= 0) {
      errs.amount = 'El importe debe ser mayor a $0'
    } else {
      const card = cards.find(c => c.id === cardId)
      if (card && amountNum > card.currentBalance) {
        errs.amount = `El importe no puede superar el saldo actual (${formatCurrency(card.currentBalance)})`
      }
    }

    if (!formData.paymentDate || Number.isNaN(new Date(formData.paymentDate).getTime())) {
      errs.date = 'Ingresá una fecha válida'
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs)
      return
    }
    setFormErrors({})

    try {
      setSubmitting(true)
      // Backend real: persiste en CreditCardPayments y actualiza CreditCards.currentBalance
      // (Math.max(0, saldo - importe)) — no se duplica ese cálculo acá.
      await makePayment(cardId, {
        amount: amountNum,
        date: formData.paymentDate,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes || undefined,
      })

      success('Pago registrado correctamente')
      resetForm()
      setShowCreateForm(false)

      const refreshedCards = await fetchCards().catch(() => cards)
      const relevant = selectedCard
        ? refreshedCards.filter((c: { id: string }) => c.id === selectedCard.id)
        : refreshedCards
      await loadPaymentsFor(relevant)
    } catch (err) {
      error(err instanceof Error ? err.message : 'No se pudo registrar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'transfer': return <CreditCardIcon className="w-4 h-4" />
      case 'cash': return <DollarSign className="w-4 h-4" />
      case 'debit': return <Receipt className="w-4 h-4" />
      default: return <CreditCardIcon className="w-4 h-4" />
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

  const totalPaid = allPayments.reduce((sum, payment) => sum + payment.amount, 0)

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
                  className="px-4 py-2 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 transition-opacity text-white rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer"
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
                        Tarjeta *
                      </label>
                      {selectedCard ? (
                        <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {selectedCard.name}
                        </div>
                      ) : (
                        <select
                          value={formData.cardId}
                          onChange={(e) => { setFormData(prev => ({ ...prev, cardId: e.target.value })); setFormErrors(prev => ({ ...prev, cardId: undefined })) }}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${formErrors.cardId ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                        >
                          <option value="">Seleccionar tarjeta</option>
                          {cards.map(card => (
                            <option key={card.id} value={card.id}>
                              {card.name} — {formatCurrency(card.currentBalance)}
                            </option>
                          ))}
                        </select>
                      )}
                      {formErrors.cardId && <p className="mt-1 text-xs text-red-500">{formErrors.cardId}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Importe *
                      </label>
                      {selectedCard && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Saldo actual: {formatCurrency(cards.find(c => c.id === selectedCard.id)?.currentBalance ?? 0)}
                        </p>
                      )}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => { setFormData(prev => ({ ...prev, amount: e.target.value })); setFormErrors(prev => ({ ...prev, amount: undefined })) }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${formErrors.amount ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                        placeholder="0"
                      />
                      {formErrors.amount && <p className="mt-1 text-xs text-red-500">{formErrors.amount}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha de Pago *
                      </label>
                      <input
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) => { setFormData(prev => ({ ...prev, paymentDate: e.target.value })); setFormErrors(prev => ({ ...prev, date: undefined })) }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${formErrors.date ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                      {formErrors.date && <p className="mt-1 text-xs text-red-500">{formErrors.date}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Método de Pago
                      </label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as 'transfer' | 'cash' | 'debit' | 'other' }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="transfer">Transferencia</option>
                        <option value="debit">Débito</option>
                        <option value="cash">Efectivo</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      rows={3}
                      placeholder="Detalles adicionales del pago..."
                    />
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={handleCreatePayment}
                      disabled={submitting}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {submitting ? 'Registrando...' : 'Registrar Pago'}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Total Pagado</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(totalPaid)}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Pagos Registrados</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {allPayments.length}
                    </div>
                  </div>
                </div>

                {/* Payments List */}
                {loadingPayments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando pagos...</p>
                  </div>
                ) : allPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Todavía no registraste pagos.
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Cuando registres un pago, vas a poder seguir la evolución de tu deuda.
                    </p>
                    <button
                      onClick={() => { resetForm(); setShowCreateForm(true) }}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Registrar Primer Pago
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allPayments.map((payment, index) => (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.05 }}
                        className="p-4 rounded-xl border bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {payment.cardName}
                            </h5>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatCivilDate(payment.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                {getPaymentMethodIcon(payment.paymentMethod)}
                                {getPaymentMethodText(payment.paymentMethod)}
                              </span>
                            </div>
                            {payment.notes && (
                              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                                {payment.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(payment.amount)}
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
