import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Save, Calendar, DollarSign, AlertCircle, Edit3, Trash2, RefreshCw } from 'lucide-react'
import { useDebtManager } from '@/lib/hooks'
import { ValidationUtils } from '@/lib/utils'

export default function DebtTracker() {
  const [paymentAmount, setPaymentAmount] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [showAddDebt, setShowAddDebt] = useState(false)
  const [selectedDebtId, setSelectedDebtId] = useState<string>('')
  const [newDebt, setNewDebt] = useState({
    name: '',
    amount: '',
    interestRate: '',
    dueDate: ''
  })

  // Usar el hook de gestión de deudas
  const { 
    debts, 
    stats, 
    addDebt, 
    updateDebt, 
    deleteDebt, 
    addPayment, 
    syncData,
    isLoading, 
    error,
    syncStatus 
  } = useDebtManager()

  const { totalDebt, totalPaid, remainingDebt, progressPercentage } = stats

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount)
    if (amount > 0) {
      // Registrar el pago
      addPayment({
        amount,
        date: new Date().toISOString(),
        description: selectedDebtId ? `Pago a deuda específica` : 'Pago general',
        type: 'payment',
        debtId: selectedDebtId || undefined
      })
      
      setPaymentAmount('')
      setSelectedDebtId('')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    }
  }

  const handleAddDebt = () => {
    const amount = parseFloat(newDebt.amount)
    if (newDebt.name && ValidationUtils.isValidAmount(amount)) {
      addDebt({
        name: newDebt.name,
        amount: amount,
        paid: 0,
        interestRate: newDebt.interestRate ? parseFloat(newDebt.interestRate) : undefined,
        dueDate: newDebt.dueDate || undefined
      })
      
      setNewDebt({ name: '', amount: '', interestRate: '', dueDate: '' })
      setShowAddDebt(false)
    }
  }

  const handleSync = async () => {
    await syncData()
  }

  const handleDeleteDebt = (debtId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta deuda?')) {
      deleteDebt(debtId)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Seguimiento de Deudas 📊
        </h2>
        <p className="text-gray-600">
          Registra tus pagos y ve tu progreso en tiempo real
        </p>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </motion.div>

      {/* Panel Principal de Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Resumen de Deuda */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-green-600" />
              Resumen Financiero
            </h3>
            {syncStatus.needsSync && (
              <button
                onClick={handleSync}
                className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                title="Sincronizar con Google Sheets"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="text-xs">Sync</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg border border-red-100">
              <span className="text-gray-700 font-medium">Deuda Total</span>
              <span className="text-2xl font-bold text-red-600">${totalDebt.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-100">
              <span className="text-gray-700 font-medium">Total Pagado</span>
              <span className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-gray-700 font-medium">Deuda Restante</span>
              <span className="text-2xl font-bold text-blue-600">${remainingDebt.toLocaleString()}</span>
            </div>
          </div>

          {/* Barra de Progreso */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progreso</span>
              <span className="text-lg font-bold text-blue-600">{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <motion.div
                className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </motion.div>

        {/* Registrar Pago */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Plus className="h-5 w-5 mr-2 text-blue-600" />
            Registrar Pago
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deuda Específica (Opcional)
              </label>
              <select
                value={selectedDebtId}
                onChange={(e) => setSelectedDebtId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Pago general</option>
                {debts.map(debt => (
                  <option key={debt.id} value={debt.id}>
                    {debt.name} (${(debt.amount - debt.paid).toLocaleString()} restante)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto del Pago
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="0.00"
                />
              </div>
            </div>

            <motion.button
              onClick={handlePayment}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Save className="h-5 w-5" />
              <span>Registrar Pago</span>
            </motion.button>

            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-green-50 border border-green-200 rounded-lg p-4 text-center"
              >
                <p className="text-green-800 font-medium">
                  ¡Excelente! Pago registrado correctamente 🎉
                </p>
              </motion.div>
            )}
          </div>

          {/* Consejos Rápidos */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-800 mb-1">💡 Consejo</h4>
                <p className="text-sm text-yellow-700">
                  Registra tus pagos tan pronto como los hagas para mantener un seguimiento preciso.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Lista de Deudas Individuales */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-purple-600" />
            Deudas Individuales ({debts.length})
          </h3>
          <button
            onClick={() => setShowAddDebt(true)}
            className="bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:from-green-600 hover:to-teal-700 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Deuda</span>
          </button>
        </div>

        {debts.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h4 className="text-xl font-semibold text-gray-600 mb-2">No tienes deudas registradas</h4>
            <p className="text-gray-500 mb-4">
              ¡Agrega tus primeras deudas para comenzar a hacer seguimiento!
            </p>
            <button
              onClick={() => setShowAddDebt(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
            >
              Agregar Primera Deuda
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {debts.map((debt) => {
              const debtProgress = debt.amount > 0 ? (debt.paid / debt.amount) * 100 : 0
              const remaining = debt.amount - debt.paid
              
              return (
                <div key={debt.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors duration-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{debt.name}</h4>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span>Total: ${debt.amount.toLocaleString()}</span>
                        <span>Pagado: ${debt.paid.toLocaleString()}</span>
                        <span>Restante: ${remaining.toLocaleString()}</span>
                        {debt.interestRate && (
                          <span className="text-red-600">Interés: {debt.interestRate}%</span>
                        )}
                        {debt.dueDate && (
                          <span className="text-blue-600">
                            Vence: {new Date(debt.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button 
                        onClick={() => updateDebt(debt.id, { name: prompt('Nuevo nombre:', debt.name) || debt.name })}
                        className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                        title="Editar deuda"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDebt(debt.id)}
                        className="text-red-600 hover:text-red-800 transition-colors duration-200"
                        title="Eliminar deuda"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(debtProgress, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{debtProgress.toFixed(1)}% pagado</span>
                    {remaining > 0 ? (
                      <span className="text-red-600">Debe: ${remaining.toLocaleString()}</span>
                    ) : (
                      <span className="text-green-600 font-semibold">¡Pagado completamente! 🎉</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal para agregar nueva deuda */}
        {showAddDebt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddDebt(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-xl font-semibold text-gray-900 mb-4">Agregar Nueva Deuda</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Deuda *
                  </label>
                  <input
                    type="text"
                    value={newDebt.name}
                    onChange={(e) => setNewDebt({...newDebt, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Tarjeta de Crédito Visa"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto Total *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={newDebt.amount}
                      onChange={(e) => setNewDebt({...newDebt, amount: e.target.value})}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tasa de Interés (%)
                    </label>
                    <input
                      type="number"
                      value={newDebt.interestRate}
                      onChange={(e) => setNewDebt({...newDebt, interestRate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      step="0.1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Límite
                    </label>
                    <input
                      type="date"
                      value={newDebt.dueDate}
                      onChange={(e) => setNewDebt({...newDebt, dueDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowAddDebt(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddDebt}
                  disabled={!newDebt.name || !newDebt.amount || !ValidationUtils.isValidAmount(parseFloat(newDebt.amount))}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Agregar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}