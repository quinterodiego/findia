'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Target, Sparkles, Trophy, DollarSign, LogOut, Wallet, Sun, Moon } from 'lucide-react'
import Image from 'next/image'
import { useDebts } from '@/hooks/useDebts'
import FloatingActionButton from '@/components/FloatingActionButton'
import TransactionModal from '@/components/TransactionModal'

type TransactionType = 'debt' | 'expense' | 'income' | 'goal'

interface TransactionData {
  name: string
  amount: number
  date: string
  category?: string
  notes?: string
  // Campos específicos para deudas
  balance?: number
  interestRate?: number
  minPayment?: number
  dueDate?: string
  priority?: 'high' | 'medium' | 'low'
  // Campos específicos para metas
  targetDate?: string
  currentAmount?: number
  // Campos específicos para gastos/ingresos
  isRecurring?: boolean
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [transactionType, setTransactionType] = useState<TransactionType>('debt')

  // Hook para manejar deudas
  const {
    debts,
    stats,
    loading: debtsLoading,
    error: debtsError,
    fetchDebts,
    fetchStats,
    createDebt,
  } = useDebts()

  // Cargar datos al montar el componente
  useEffect(() => {
    if (session?.user?.id) {
      fetchDebts()
      fetchStats()
    }
  }, [session?.user?.id, fetchDebts, fetchStats])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/')
      return
    }
  }, [session, status, router])

  // Cargar tema guardado al iniciar
  useEffect(() => {
    // Verificar el tema guardado en localStorage
    const savedTheme = localStorage.getItem('findia-theme')
    
    // Si no hay tema guardado, establecer light por defecto
    if (!savedTheme) {
      localStorage.setItem('findia-theme', 'light')
    }
    
    // Default to light mode if no saved theme
    const shouldUseDark = savedTheme === 'dark'
    
    setIsDarkMode(shouldUseDark)
    
    if (shouldUseDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('findia-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('findia-theme', 'light')
    }
  }

  const handleSignOut = async () => {
    const confirmed = confirm('¿Estás seguro de que quieres cerrar sesión?')
    if (confirmed) {
      await signOut({ callbackUrl: '/' })
    }
  }

  const handleTransactionAction = (type: TransactionType) => {
    setTransactionType(type)
    setShowTransactionModal(true)
  }

  const handleSaveTransaction = async (data: TransactionData) => {
    switch (transactionType) {
      case 'debt':
        // Asegurar que dueDate esté presente para deudas
        const debtData = {
          ...data,
          dueDate: data.dueDate || data.date, // Usar date como fallback
        }
        await createDebt(debtData)
        break
      case 'expense':
        // TODO: Implementar función de gastos
        console.log('Guardando gasto:', data)
        break
      case 'income':
        // TODO: Implementar función de ingresos
        console.log('Guardando ingreso:', data)
        break
      case 'goal':
        // TODO: Implementar función de metas
        console.log('Guardando meta:', data)
        break
    }
  }

  if (status === 'loading' || debtsLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (debtsError) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error al cargar datos</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{debtsError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Calcular estadísticas desde la API
  const displayStats = {
    totalBalance: stats?.totalBalance || 0,
    totalPaid: stats?.totalPaid || 0,
    progress: stats?.progress || 0,
    monthlyMinPayment: stats?.monthlyMinPayment || 0,
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-linear-to-r from-blue-500 to-purple-600 p-2 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                FindIA
              </span>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-gray-600" />}
              </button>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  {session?.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'Usuario'}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-linear-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                      {session?.user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {session?.user?.name || session?.user?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Welcome Message */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              ¡Hola, {session?.user?.name?.split(' ')[0] || 'Usuario'}! 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Bienvenido a tu dashboard de libertad financiera
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Deuda Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${displayStats.totalBalance.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Target className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Pagado</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${displayStats.totalPaid.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pago Mensual</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${displayStats.monthlyMinPayment.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Progreso</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {displayStats.progress.toFixed(1)}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Deudas */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Mis Transacciones Financieras
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {debts.length} {debts.length === 1 ? 'deuda registrada' : 'deudas registradas'}
              </div>
            </div>

            {debts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-10 h-10 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No tienes transacciones registradas
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Usa el botón + para agregar deudas, gastos, ingresos o metas de ahorro.
                </p>
                <div className="text-center text-gray-400">
                  <p className="text-sm">👇 Mira el botón flotante en la esquina inferior derecha</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {debts.map((debt) => {
                  const progress = debt.amount > 0 ? ((debt.amount - debt.balance) / debt.amount) * 100 : 0;
                  return (
                    <div 
                      key={debt.id} 
                      className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {debt.name}
                        </h4>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            ${debt.balance.toLocaleString('es-CO')}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            de ${debt.amount.toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span>Progreso</span>
                          <span>{progress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-linear-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <span>Pago mínimo: ${debt.minPayment.toLocaleString('es-CO')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Botón Flotante Mejorado */}
      <FloatingActionButton onAction={handleTransactionAction} />

      {/* Modal Unificado de Transacciones */}
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        type={transactionType}
        onSave={handleSaveTransaction}
        loading={debtsLoading}
      />
    </div>
  )
}
