'use client'

import { motion } from 'framer-motion'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCivilDateShort } from '@/lib/formatDate'

interface ProgressHistoryItem {
  date: string
  totalDebt: number
  paid: number
  isInitial?: boolean
}

interface CreditCardProgressProps {
  progressHistory: ProgressHistoryItem[]
  totalDebt: number
  formatCurrency: (amount: number) => string
}

export default function CreditCardProgress({
  progressHistory,
  totalDebt,
  formatCurrency,
}: CreditCardProgressProps) {
  const hasPayments = progressHistory.length > 0
  const totalPaid = hasPayments ? progressHistory[progressHistory.length - 1].paid : 0
  // Deuda actual + lo ya pagado = deuda antes de esos pagos (ver limitación en loadProgressHistory).
  const initialDebt = hasPayments ? totalPaid + totalDebt : totalDebt
  const progressPercent = initialDebt > 0 ? Math.min(100, (totalPaid / initialDebt) * 100) : 0

  return (
    <motion.div
      key="progress"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Seguimiento de Progreso</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Tu progreso real, basado en los pagos que registraste.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Deuda Inicial</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(initialDebt)}</p>
        </div>
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Deuda Actual</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pagado</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Progreso</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{progressPercent.toFixed(0)}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {hasPayments && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Basado en tu saldo actual y los pagos que registraste.
        </p>
      )}

      {hasPayments ? (
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Evolución de la Deuda</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Cómo fue bajando tu deuda a medida que registraste pagos.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={progressHistory.map(h => ({
              date: h.isInitial ? 'Inicio' : formatCivilDateShort(h.date),
              deuda: h.totalDebt,
              pagado: h.paid,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" allowDuplicatedCategory={false} stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }} formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="deuda" stroke="#ef4444" strokeWidth={2} name="Deuda restante" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="pagado" stroke="#10b981" strokeWidth={2} name="Pagado acumulado" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6">
          <p className="text-center font-medium text-gray-700 dark:text-gray-200 py-2">
            Todavía no registraste pagos.
          </p>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 pb-6">
            Cuando registres tu primer pago, vas a poder seguir acá la evolución de tu deuda.
          </p>
        </div>
      )}
    </motion.div>
  )
}
