"use client"

import { motion } from 'framer-motion'
import { Plus, Trash2, Calendar, DollarSign, CreditCard } from 'lucide-react'
import { useState } from 'react'
import type { Debt } from '@/types'

interface DebtTrackerProps {
  debts: Debt[]
  onAddDebt: (debt: Omit<Debt, 'id'>) => void
  onDeleteDebt: (id: string) => void
  onMakePayment: (id: string, amount: number) => void
}

export default function DebtTracker({ 
  debts, 
  onAddDebt, 
  onDeleteDebt, 
  onMakePayment 
}: DebtTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<{ [key: string]: string }>({})

  const [newDebt, setNewDebt] = useState<{
    name: string
    amount: string
    minimumPayment: string
    interestRate: string
    dueDate: string
    type: 'credit_card' | 'loan' | 'mortgage' | 'other'
  }>({
    name: '',
    amount: '',
    minimumPayment: '',
    interestRate: '',
    dueDate: '',
    type: 'credit_card'
  })

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault()
    if (newDebt.name && newDebt.amount && newDebt.minimumPayment) {
      const amount = parseFloat(newDebt.amount)
      onAddDebt({
        name: newDebt.name,
        currentAmount: amount,
        originalAmount: amount,
        minimumPayment: parseFloat(newDebt.minimumPayment),
        interestRate: parseFloat(newDebt.interestRate) || 0,
        dueDate: newDebt.dueDate,
        priority: 'medium' as const,
        category: 'General',
        type: newDebt.type,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'current-user'
      })
      setNewDebt({
        name: '',
        amount: '',
        minimumPayment: '',
        interestRate: '',
        dueDate: '',
        type: 'credit_card'
      })
      setShowAddForm(false)
    }
  }

  const handlePayment = (debtId: string) => {
    const amount = parseFloat(paymentAmount[debtId] || '0')
    if (amount > 0) {
      onMakePayment(debtId, amount)
      setPaymentAmount({ ...paymentAmount, [debtId]: '' })
    }
  }

  const getDebtTypeIcon = (type: string) => {
    switch (type) {
      case 'credit_card':
        return <CreditCard className="h-5 w-5 text-red-500" />
      case 'loan':
        return <DollarSign className="h-5 w-5 text-blue-500" />
      case 'mortgage':
        return <Calendar className="h-5 w-5 text-green-500" />
      default:
        return <DollarSign className="h-5 w-5 text-gray-500" />
    }
  }

  const getDebtTypeLabel = (type: string) => {
    switch (type) {
      case 'credit_card':
        return 'Tarjeta de Crédito'
      case 'loan':
        return 'Préstamo'
      case 'mortgage':
        return 'Hipoteca'
      default:
        return 'Otro'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const totalDebt = debts.reduce((sum, debt) => sum + debt.currentAmount, 0)
  const totalMinimumPayment = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0)

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Seguimiento de Deudas</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar Deuda</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="h-5 w-5 text-red-500" />
            <span className="text-sm font-medium text-red-700">Total Deudas</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totalDebt)}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-blue-700">Pago Mínimo Total</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalMinimumPayment)}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <CreditCard className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-700">Número de Deudas</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{debts.length}</p>
        </div>
      </div>

      {/* Add Debt Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gray-50 rounded-lg p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Agregar Nueva Deuda</h3>
          <form onSubmit={handleAddDebt} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Deuda
                </label>
                <input
                  type="text"
                  value={newDebt.name}
                  onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Tarjeta Visa"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Deuda
                </label>
                <select
                  value={newDebt.type}
                  onChange={(e) => setNewDebt({ ...newDebt, type: e.target.value as typeof newDebt.type })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="credit_card">Tarjeta de Crédito</option>
                  <option value="loan">Préstamo</option>
                  <option value="mortgage">Hipoteca</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto Total
                </label>
                <input
                  type="number"
                  value={newDebt.amount}
                  onChange={(e) => setNewDebt({ ...newDebt, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pago Mínimo
                </label>
                <input
                  type="number"
                  value={newDebt.minimumPayment}
                  onChange={(e) => setNewDebt({ ...newDebt, minimumPayment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tasa de Interés (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newDebt.interestRate}
                  onChange={(e) => setNewDebt({ ...newDebt, interestRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Vencimiento
                </label>
                <input
                  type="date"
                  value={newDebt.dueDate}
                  onChange={(e) => setNewDebt({ ...newDebt, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Agregar Deuda
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Debt List */}
      <div className="space-y-4">
        {debts.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No has agregado ninguna deuda aún.</p>
            <p className="text-sm text-gray-400">Haz clic en &quot;Agregar Deuda&quot; para comenzar.</p>
          </div>
        ) : (
          debts.map((debt, index) => (
            <motion.div
              key={debt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getDebtTypeIcon(debt.type)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{debt.name}</h3>
                    <p className="text-sm text-gray-500">{getDebtTypeLabel(debt.type)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onDeleteDebt(debt.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <span className="text-sm text-gray-500">Monto Total</span>
                  <p className="font-semibold text-lg">{formatCurrency(debt.currentAmount)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Pago Mínimo</span>
                  <p className="font-semibold">{formatCurrency(debt.minimumPayment)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Tasa de Interés</span>
                  <p className="font-semibold">{debt.interestRate}%</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Vencimiento</span>
                  <p className="font-semibold">
                    {debt.dueDate ? new Date(debt.dueDate).toLocaleDateString('es-CO') : 'No definido'}
                  </p>
                </div>
              </div>

              {/* Payment Section */}
              <div className="flex items-center space-x-3 pt-3 border-t border-gray-100">
                <input
                  type="number"
                  placeholder="Monto del pago"
                  value={paymentAmount[debt.id] || ''}
                  onChange={(e) => setPaymentAmount({ ...paymentAmount, [debt.id]: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => handlePayment(debt.id)}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Registrar Pago
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}