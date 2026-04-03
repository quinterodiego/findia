'use client'

import { motion } from 'framer-motion'
import { BarChart3, PieChart } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartPieChart, Pie, Cell } from 'recharts'
import { SkeletonCard } from '@/components/Skeleton'
import type { Expense, SharedExpense } from '@/types'

interface DisplayStats {
  totalIncomes: number
  totalExpenses: number
}

interface DashboardAnalyticsProps {
  shouldShowSkeleton: boolean
  incomes: unknown[]
  expenses: unknown[]
  displayStats: DisplayStats
  filteredExpenses: Expense[]
  sharedExpensesMap: Map<string, SharedExpense>
  currentUserId: string | null | undefined
  formatCurrency: (amount: number) => string
}

const COLORS = ['#f87171', '#c084fc', '#a78bfa', '#60a5fa', '#3b82f6', '#4ade80']

export default function DashboardAnalytics({
  shouldShowSkeleton,
  incomes,
  expenses,
  displayStats,
  filteredExpenses,
  sharedExpensesMap,
  currentUserId,
  formatCurrency,
}: DashboardAnalyticsProps) {
  if (shouldShowSkeleton) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (incomes.length === 0 && expenses.length === 0) return null

  const categoryExpenses = filteredExpenses.reduce((acc, expense) => {
    const category = expense.category || 'Sin categoría'
    const sharedExpense = sharedExpensesMap.get(expense.id)
    let amount = expense.amount

    if (sharedExpense) {
      if (sharedExpense.ownerUserId === currentUserId) {
        amount = typeof sharedExpense.ownerAmount === 'number' ? sharedExpense.ownerAmount : 0
      } else if (sharedExpense.sharedWithUserId === currentUserId) {
        amount = typeof sharedExpense.partnerAmount === 'number' ? sharedExpense.partnerAmount : 0
      }
    }

    acc[category] = (acc[category] || 0) + amount
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(categoryExpenses).map(([name, value]) => ({ name, value }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.7 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6"
    >
      {/* Gráfica de Ingresos vs Gastos */}
      <motion.div className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50 dark:border-gray-700 transition-all duration-200 hover:shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Balance Financiero</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Ingresos vs Gastos</p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={[{ name: 'Total', Ingresos: displayStats.totalIncomes, Gastos: displayStats.totalExpenses }]}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tick={{ fill: '#6b7280' }} />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tick={{ fill: '#6b7280' }}
              tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: 'none', borderRadius: '12px', padding: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconSize={12}
              formatter={(value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>}
            />
            <Bar dataKey="Ingresos" fill="#4ade80" radius={[8, 8, 0, 0]} style={{ filter: 'drop-shadow(0 2px 4px rgba(74, 222, 128, 0.3))' }} />
            <Bar dataKey="Gastos" fill="#f87171" radius={[8, 8, 0, 0]} style={{ filter: 'drop-shadow(0 2px 4px rgba(248, 113, 113, 0.3))' }} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Gastos por Categoría */}
      {pieData.length > 0 && (
        <motion.div className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50 dark:border-gray-700 transition-all duration-200 hover:shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gastos por Categoría</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Distribución de gastos</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] rounded-xl flex items-center justify-center">
              <PieChart className="w-6 h-6 text-white" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartPieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={(entry: { percent?: number; name?: string }) => {
                  const percent = entry.percent || 0
                  if (percent < 0.05) return ''
                  return `${entry.name || ''}: ${(percent * 100).toFixed(0)}%`
                }}
                outerRadius={100}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: 'none', borderRadius: '12px', padding: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number) => formatCurrency(value)}
              />
            </RechartPieChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </motion.div>
  )
}
