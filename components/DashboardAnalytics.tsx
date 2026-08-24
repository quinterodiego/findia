'use client'

import { motion } from 'framer-motion'
import { BarChart3, PieChart } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartPieChart, Pie, Cell } from 'recharts'
import { SkeletonCard } from '@/components/Skeleton'
import type { Expense, Income, SharedExpense } from '@/types'

interface DisplayStats {
  totalIncomes: number
  totalExpenses: number
}

interface DashboardAnalyticsProps {
  shouldShowSkeleton: boolean
  displayStats: DisplayStats
  filteredIncomes: Income[]
  filteredExpenses: Expense[]
  dateFilter: 'current-month' | 'all'
  sharedExpensesMap: Map<string, SharedExpense>
  currentUserId: string | null | undefined
  formatCurrency: (amount: number) => string
  headerAction?: React.ReactNode
}

const COLORS = ['#f87171', '#c084fc', '#a78bfa', '#60a5fa', '#3b82f6', '#4ade80']

function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function DashboardAnalytics({
  shouldShowSkeleton,
  displayStats,
  filteredIncomes,
  filteredExpenses,
  dateFilter,
  sharedExpensesMap,
  currentUserId,
  formatCurrency,
  headerAction,
}: DashboardAnalyticsProps) {
  if (shouldShowSkeleton) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const hasFinancialData = displayStats.totalIncomes > 0 || displayStats.totalExpenses > 0

  const getExpenseAmount = (expense: Expense) => {
    const sharedExpense = sharedExpensesMap.get(expense.id)
    if (sharedExpense) {
      if (sharedExpense.ownerUserId === currentUserId) {
        return typeof sharedExpense.ownerAmount === 'number' ? sharedExpense.ownerAmount : 0
      }
      if (sharedExpense.sharedWithUserId === currentUserId) {
        return typeof sharedExpense.partnerAmount === 'number' ? sharedExpense.partnerAmount : 0
      }
    }
    return expense.amount
  }

  // ==========================================================================
  // Evolución de Ingresos vs Gastos dentro del período seleccionado
  // (por semana cuando el filtro es "current-month", por mes cuando es "all")
  // ==========================================================================
  let evolutionData: { label: string; Ingresos: number; Gastos: number }[] = []

  if (dateFilter === 'current-month') {
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const totalWeeks = Math.ceil(daysInMonth / 7)

    const weekBuckets = Array.from({ length: totalWeeks }, (_, i) => ({
      label: `Semana ${i + 1}`,
      Ingresos: 0,
      Gastos: 0,
    }))

    filteredIncomes.forEach(income => {
      const day = parseLocalDate(income.date).getDate()
      const weekIndex = Math.ceil(day / 7) - 1
      if (weekBuckets[weekIndex]) weekBuckets[weekIndex].Ingresos += income.amount
    })

    filteredExpenses.forEach(expense => {
      const day = parseLocalDate(expense.date).getDate()
      const weekIndex = Math.ceil(day / 7) - 1
      if (weekBuckets[weekIndex]) weekBuckets[weekIndex].Gastos += getExpenseAmount(expense)
    })

    evolutionData = weekBuckets
  } else {
    const monthMap = new Map<string, { year: number; month: number; label: string; Ingresos: number; Gastos: number }>()

    const ensureMonthBucket = (year: number, month: number) => {
      const key = `${year}-${month}`
      if (!monthMap.has(key)) {
        const label = capitalize(new Date(year, month, 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }))
        monthMap.set(key, { year, month, label, Ingresos: 0, Gastos: 0 })
      }
      return monthMap.get(key)!
    }

    filteredIncomes.forEach(income => {
      const d = parseLocalDate(income.date)
      ensureMonthBucket(d.getFullYear(), d.getMonth()).Ingresos += income.amount
    })

    filteredExpenses.forEach(expense => {
      const d = parseLocalDate(expense.date)
      ensureMonthBucket(d.getFullYear(), d.getMonth()).Gastos += getExpenseAmount(expense)
    })

    // Completar los meses intermedios sin movimientos para mantener continuidad temporal
    const existing = Array.from(monthMap.values()).sort((a, b) => a.year - b.year || a.month - b.month)
    if (existing.length > 0) {
      const first = existing[0]
      const last = existing[existing.length - 1]
      let y = first.year
      let m = first.month
      while (y < last.year || (y === last.year && m <= last.month)) {
        ensureMonthBucket(y, m)
        m += 1
        if (m > 11) { m = 0; y += 1 }
      }
    }

    evolutionData = Array.from(monthMap.values())
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map(({ label, Ingresos, Gastos }) => ({ label, Ingresos, Gastos }))
  }

  const categoryExpenses = filteredExpenses.reduce((acc, expense) => {
    const category = expense.category || 'Sin categoría'
    acc[category] = (acc[category] || 0) + getExpenseAmount(expense)
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(categoryExpenses).map(([name, value]) => ({ name, value }))

  const totalPieValue = pieData.reduce((sum, d) => sum + d.value, 0)
  const MAX_LEGEND_ITEMS = 6
  const legendItems = pieData
    .map((d, index) => ({
      name: d.name,
      value: d.value,
      color: COLORS[index % COLORS.length],
      percent: totalPieValue > 0 ? (d.value / totalPieValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
  const visibleLegendItems = legendItems.slice(0, MAX_LEGEND_ITEMS)
  const restLegendItems = legendItems.slice(MAX_LEGEND_ITEMS)
  const restLegendValue = restLegendItems.reduce((sum, d) => sum + d.value, 0)
  const restLegendPercent = totalPieValue > 0 ? (restLegendValue / totalPieValue) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.7 }}
      className={`grid grid-cols-1 ${pieData.length > 0 ? 'lg:grid-cols-2' : ''} gap-4 lg:gap-6 mb-6`}
    >
      {/* Gráfica de Ingresos vs Gastos */}
      <motion.div className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50 dark:border-gray-700 transition-all duration-200 hover:shadow-2xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Balance Financiero</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Evolución de ingresos y gastos</p>
          </div>
          <div className="flex items-center gap-3">
            {headerAction}
            <div className="w-12 h-12 bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        {hasFinancialData ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={evolutionData}
              margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
              barGap={4}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
              <XAxis dataKey="label" stroke="#6b7280" fontSize={12} tick={{ fill: '#6b7280' }} />
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
              <Bar dataKey="Ingresos" fill="#4ade80" radius={[6, 6, 0, 0]} style={{ filter: 'drop-shadow(0 2px 4px rgba(74, 222, 128, 0.3))' }} />
              <Bar dataKey="Gastos" fill="#f87171" radius={[6, 6, 0, 0]} style={{ filter: 'drop-shadow(0 2px 4px rgba(248, 113, 113, 0.3))' }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-3">
              <BarChart3 className="w-6 h-6 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Todavía no hay movimientos para mostrar.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
              Registrá tus primeros ingresos o gastos para empezar a ver tu balance.
            </p>
          </div>
        )}
      </motion.div>

      {/* Gastos por Categoría */}
      {pieData.length > 0 && (
        <motion.div className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50 dark:border-gray-700 transition-all duration-200 hover:shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gastos por Categoría</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Distribución de gastos</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] rounded-xl flex items-center justify-center shrink-0">
              <PieChart className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-3">
            <div className="w-full md:w-1/2 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <RechartPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
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
            </div>

            <div className="w-full md:w-1/2 space-y-2.5">
              {visibleLegendItems.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2 shrink-0">
                    <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(item.value)}</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs tabular-nums w-9 text-right">{item.percent.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
              {restLegendItems.length > 0 && (
                <div className="flex items-center justify-between gap-3 text-sm pt-2 mt-1 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-300 dark:bg-gray-600" />
                    <span className="text-gray-500 dark:text-gray-400">+{restLegendItems.length} más</span>
                  </div>
                  <div className="flex items-baseline gap-2 shrink-0">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{formatCurrency(restLegendValue)}</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs tabular-nums w-9 text-right">{restLegendPercent.toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
