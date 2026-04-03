'use client'

import { motion } from 'framer-motion'
import { Trophy, Clock, DollarSign } from 'lucide-react'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { CreditCard } from '@/types'

interface PaymentStrategy {
  totalMonths: number
}

interface ProgressHistoryItem {
  date: string
  totalDebt: number
  paid: number
}

interface CreditCardProgressProps {
  progressHistory: ProgressHistoryItem[]
  totalDebt: number
  selectedStrategy: PaymentStrategy | null
  cards: CreditCard[]
  formatCurrency: (amount: number) => string
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899']

export default function CreditCardProgress({
  progressHistory,
  totalDebt,
  selectedStrategy,
  cards,
  formatCurrency,
}: CreditCardProgressProps) {
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
          Visualiza tu progreso y celebra tus logros en el camino hacia la libertad financiera.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="font-semibold text-gray-900 dark:text-white">Deuda Pagada</span>
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            {progressHistory.length > 0
              ? formatCurrency(progressHistory[progressHistory.length - 1].paid)
              : formatCurrency(0)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {progressHistory.length > 0
              ? `de ${formatCurrency(progressHistory[0].totalDebt + progressHistory[0].paid)} (${formatCurrency(totalDebt)} actual)`
              : `de ${formatCurrency(totalDebt)}`}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-gray-900 dark:text-white">Tiempo Restante</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {selectedStrategy ? `${selectedStrategy.totalMonths} meses` : 'N/A'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">según tu plan actual</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-gray-900 dark:text-white">Intereses Ahorrados</span>
          </div>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">$0</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">con tu estrategia</p>
        </div>
      </div>

      {progressHistory.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Evolución de la Deuda</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressHistory.map(h => ({
                date: new Date(h.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
                deuda: h.totalDebt,
                pagado: h.paid,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }} formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="deuda" stroke="#ef4444" strokeWidth={2} name="Deuda Total" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="pagado" stroke="#10b981" strokeWidth={2} name="Pagado" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distribución de Deuda por Tarjeta</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cards.filter(c => c.currentBalance > 0).map(c => ({ name: c.name, value: c.currentBalance }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {cards.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6">
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Los gráficos de progreso se generarán cuando comiences a registrar pagos.
          </p>
        </div>
      )}
    </motion.div>
  )
}
