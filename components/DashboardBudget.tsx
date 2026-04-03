'use client'

import { motion } from 'framer-motion'
import { TrendingUp, Calendar } from 'lucide-react'
import type { FixedExpenseItem } from '@/hooks/useFixedExpenses'

interface DashboardBudgetProps {
  fixedExpensesLoading: boolean
  budgetMonthOffset: number
  setBudgetMonthOffset: (offset: number) => void
  fixedExpenses: FixedExpenseItem[]
  totalFixedAmount: number
  totalFixedPaid: number
  setShowFixedExpensesTable: (show: boolean) => void
  formatCurrency: (amount: number) => string
}

function getMonthLabel(offset: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function DashboardBudget({
  fixedExpensesLoading,
  budgetMonthOffset,
  setBudgetMonthOffset,
  fixedExpenses,
  totalFixedAmount,
  totalFixedPaid,
  setShowFixedExpensesTable,
  formatCurrency,
}: DashboardBudgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Presupuesto {getMonthLabel(budgetMonthOffset)}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Vista consolidada de tus gastos fijos recurrentes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <select
              value={budgetMonthOffset}
              onChange={(e) => setBudgetMonthOffset(Number(e.target.value))}
              className="bg-transparent border-0 focus:ring-0 focus:outline-none text-sm font-medium cursor-pointer text-indigo-700 dark:text-indigo-300"
              aria-label="Seleccionar mes del presupuesto"
            >
              <option value={0}>{getMonthLabel(0)}</option>
              <option value={1}>{getMonthLabel(1)}</option>
            </select>
          </div>
          <button
            onClick={() => setShowFixedExpensesTable(true)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:from-indigo-600 hover:to-violet-600 transition-all font-medium text-sm flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Ver Tabla Completa
          </button>
        </div>
      </div>

      {/* Resumen rápido */}
      {fixedExpensesLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Total a Pagar</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(totalFixedAmount)}</div>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">Total Pagado</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(totalFixedPaid)}</div>
          </div>
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-1">Pendiente</div>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(totalFixedAmount - totalFixedPaid)}</div>
          </div>
        </div>
      )}

      {/* Lista de próximos vencimientos (top 5) */}
      {!fixedExpensesLoading && fixedExpenses.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Próximos Vencimientos</h4>
          <div className="space-y-2">
            {fixedExpenses.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.type === 'debt'
                      ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      : 'expenseType' in item.originalData && item.originalData.expenseType === 'installments'
                      ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  }`}>
                    {item.type === 'debt'
                      ? 'Préstamo'
                      : 'expenseType' in item.originalData && item.originalData.expenseType === 'installments'
                      ? 'Cuotas'
                      : 'Gasto Fijo'}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                  {item.dueDate && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.isOverdue
                        ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-semibold'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}>
                      {new Date(item.dueDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {fixedExpenses.length > 5 && (
            <button
              onClick={() => setShowFixedExpensesTable(true)}
              className="mt-3 w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              Ver todos los {fixedExpenses.length} pagos programados →
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
