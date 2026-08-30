'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, TrendingDown, Plus, CreditCard, MoreHorizontal, X, DollarSign, TrendingUp, Target, Users } from 'lucide-react'

type FilterType = 'all' | 'debt' | 'income' | 'expense' | 'goal'
type ActionType = 'debt' | 'expense' | 'income' | 'goal' | 'shared-expense'

interface BottomNavBarProps {
  activeFilter: FilterType
  onFilterChange: (f: FilterType) => void
  onAction: (type: ActionType) => void
  onMore: () => void
}

const ADD_ACTIONS = [
  { type: 'shared-expense' as const, label: 'Gasto Compartido', icon: Users, color: 'from-pink-400 to-pink-500' },
  { type: 'expense' as const, label: 'Gasto', icon: DollarSign, color: 'from-orange-400 to-orange-500' },
  { type: 'debt' as const, label: 'Deuda', icon: CreditCard, color: 'from-red-400 to-red-500' },
  { type: 'income' as const, label: 'Ingreso', icon: TrendingUp, color: 'from-green-400 to-green-500' },
  { type: 'goal' as const, label: 'Meta', icon: Target, color: 'from-blue-400 to-blue-500' },
]

const LEFT_TABS = [
  { id: 'all' as FilterType, label: 'Inicio', icon: Home },
  { id: 'expense' as FilterType, label: 'Gastos', icon: TrendingDown },
]

const RIGHT_TABS = [
  { id: 'debt' as FilterType, label: 'Deudas', icon: CreditCard },
  { id: 'more' as const, label: 'Más', icon: MoreHorizontal },
]

export default function BottomNavBar({ activeFilter, onFilterChange, onAction, onMore }: BottomNavBarProps) {
  const [showAddSheet, setShowAddSheet] = useState(false)

  return (
    <>
      {/* Add action sheet overlay */}
      <AnimatePresence>
        {showAddSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setShowAddSheet(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl md:hidden"
              style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-3 mb-6" />
              <div className="px-6 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Agregar</h3>
                  <button
                    onClick={() => setShowAddSheet(false)}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {ADD_ACTIONS.map((action, index) => {
                    const Icon = action.icon
                    // Con un número impar de acciones, la última queda sola en
                    // la fila -- que ocupe el ancho completo en vez de dejar
                    // una celda vacía a su lado.
                    const isLastOrphan = index === ADD_ACTIONS.length - 1 && ADD_ACTIONS.length % 2 === 1
                    return (
                      <button
                        key={action.type}
                        onClick={() => {
                          onAction(action.type)
                          setShowAddSheet(false)
                        }}
                        className={`flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r ${action.color} text-white cursor-pointer active:scale-95 transition-transform ${isLastOrphan ? 'col-span-2' : ''}`}
                      >
                        <Icon className="w-6 h-6 shrink-0" />
                        <span className="font-semibold text-sm">{action.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
        aria-label="Navegación principal"
      >
        <div
          className="flex items-end justify-around"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {LEFT_TABS.map((item) => {
            const Icon = item.icon
            const isActive = activeFilter === item.id
            return (
              <button
                key={item.id}
                onClick={() => onFilterChange(item.id)}
                className="flex flex-col items-center justify-center gap-1 flex-1 h-16 cursor-pointer"
              >
                <Icon
                  className={`w-6 h-6 transition-colors duration-150 ${
                    isActive ? 'text-[#FF3A5F]' : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors duration-150 ${
                    isActive ? 'text-[#FF3A5F]' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            )
          })}

          {/* Center + button */}
          <div className="flex flex-col items-center justify-end flex-1 pb-3">
            <button
              onClick={() => setShowAddSheet(true)}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] shadow-lg shadow-pink-300/40 dark:shadow-pink-900/40 flex items-center justify-center cursor-pointer active:scale-95 transition-transform -translate-y-2"
              aria-label="Agregar transacción"
            >
              <Plus className="w-7 h-7 text-white" />
            </button>
          </div>

          {RIGHT_TABS.map((item) => {
            const Icon = item.icon
            const isMore = item.id === 'more'
            const isActive = !isMore && activeFilter === item.id
            return (
              <button
                key={item.id}
                onClick={() => (isMore ? onMore() : onFilterChange(item.id as FilterType))}
                className="flex flex-col items-center justify-center gap-1 flex-1 h-16 cursor-pointer"
              >
                <Icon
                  className={`w-6 h-6 transition-colors duration-150 ${
                    isActive ? 'text-[#FF3A5F]' : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors duration-150 ${
                    isActive ? 'text-[#FF3A5F]' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
