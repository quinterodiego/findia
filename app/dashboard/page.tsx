'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Target, Sparkles, Trophy, DollarSign, LogOut, Wallet, Sun, Moon } from 'lucide-react'
import Image from 'next/image'
import { useDebts } from '@/hooks/useDebts'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenses } from '@/hooks/useExpenses'
import { useGoals } from '@/hooks/useGoals'
import FloatingActionButton from '@/components/FloatingActionButton'
import TransactionModal from '@/components/TransactionModal'
import TransactionDetailModal from '@/components/TransactionDetailModal'
import ConfirmModal from '@/components/ConfirmModal'

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
  const [editingIncome, setEditingIncome] = useState<any>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null)

  // Hook para manejar deudas
  const {
    debts = [],
    stats = {
      totalDebt: 0,
      totalBalance: 0,
      totalPaid: 0,
      progress: 0,
      activeDebts: 0,
      paidDebts: 0,
      overdueDebts: 0,
      monthlyMinPayment: 0,
      totalPaidThisMonth: 0,
      paymentsThisMonth: 0,
    },
    loading: debtsLoading,
    error: debtsError,
    fetchDebts,
    fetchStats,
    createDebt,
    updateDebt,
    deleteDebt,
  } = useDebts()

  // Hooks para manejar otras transacciones
  const {
    incomes = [],
    loading: incomesLoading,
    error: incomesError,
    createIncome,
    updateIncome,
    deleteIncome,
  } = useIncomes()

  const {
    expenses = [],
    loading: expensesLoading,
    error: expensesError,
    createExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses()

  const {
    goals = [],
    loading: goalsLoading,
    error: goalsError,
    createGoal,
    updateGoal,
    deleteGoal,
  } = useGoals()

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
    console.log('🎯 handleTransactionAction llamado con type:', type);
    console.log('🎯 transactionType actual antes de cambiar:', transactionType);
    setTransactionType(type)
    setShowTransactionModal(true)
    console.log('🎯 transactionType establecido a:', type);
    console.log('🎯 Modal abierto:', true);
  }

  const openConfirmModal = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
    setShowConfirmModal(true);
  };

  const handleSaveTransaction = async (data: TransactionData) => {
    console.log('🔍 handleSaveTransaction llamado con:', { transactionType, data, editingIncome });
    
    // Si estamos editando
    if (editingIncome) {
      try {
        if (editingIncome.type === 'income') {
          console.log('✏️ Editando ingreso:', editingIncome.id);
          const result = await updateIncome(editingIncome.id, data);
          if (result.success) {
            console.log('✅ Ingreso actualizado exitosamente:', result.income);
          } else {
            console.error('❌ Error actualizando ingreso:', result.error);
          }
        } else if (editingIncome.type === 'expense') {
          console.log('✏️ Editando gasto:', editingIncome.id);
          const result = await updateExpense(editingIncome.id, data);
          if (result.success) {
            console.log('✅ Gasto actualizado exitosamente:', result.expense);
          } else {
            console.error('❌ Error actualizando gasto:', result.error);
          }
        } else if (editingIncome.type === 'goal') {
          console.log('✏️ Editando meta:', editingIncome.id);
          const result = await updateGoal(editingIncome.id, data);
          if (result.success) {
            console.log('✅ Meta actualizada exitosamente:', result.goal);
          } else {
            console.error('❌ Error actualizando meta:', result.error);
          }
        } else if (editingIncome.type === 'debt') {
          console.log('✏️ Editando deuda:', editingIncome.id);
          const debtData = {
            ...data,
            dueDate: data.dueDate || data.date,
          };
          await updateDebt(editingIncome.id, debtData);
          console.log('✅ Deuda actualizada exitosamente');
        }
      } catch (error) {
        console.error('❌ Error actualizando transacción:', error);
      }
      return;
    }
    
    switch (transactionType) {
      case 'debt':
        // Asegurar que dueDate esté presente para deudas
        const debtData = {
          ...data,
          dueDate: data.dueDate || data.date, // Usar date como fallback
        }
        console.log('💳 Datos de deuda preparados:', debtData);
        
        try {
          const result = await createDebt(debtData);
          console.log('✅ Deuda creada exitosamente:', result);
        } catch (error) {
          console.error('❌ Error creando deuda:', error);
        }
        break
      case 'expense':
        console.log('💰 Datos de gasto preparados:', data);
        try {
          const result = await createExpense(data);
          if (result.success) {
            console.log('✅ Gasto creado exitosamente:', result.expense);
          } else {
            console.error('❌ Error creando gasto:', result.error);
          }
        } catch (error) {
          console.error('❌ Error creando gasto:', error);
        }
        break
      case 'income':
        console.log('💵 Datos de ingreso preparados:', data);
        try {
          const result = await createIncome(data);
          if (result.success) {
            console.log('✅ Ingreso creado exitosamente:', result.income);
          } else {
            console.error('❌ Error creando ingreso:', result.error);
          }
        } catch (error) {
          console.error('❌ Error creando ingreso:', error);
        }
        break
      case 'goal':
        console.log('🎯 Datos de meta preparados:', data);
        try {
          const result = await createGoal(data);
          if (result.success) {
            console.log('✅ Meta creada exitosamente:', result.goal);
          } else {
            console.error('❌ Error creando meta:', result.error);
          }
        } catch (error) {
          console.error('❌ Error creando meta:', error);
        }
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

  // Calcular estadísticas financieras completas
  const totalIncomes = incomes.reduce((sum, income) => sum + income.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netBalance = totalIncomes - totalExpenses;
  const completedGoals = goals.filter(goal => (goal.currentAmount || 0) >= goal.amount).length;
  const totalGoals = goals.length;
  const goalsProgress = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;

  const displayStats = {
    totalIncomes,
    totalExpenses,
    netBalance,
    goalsProgress,
    completedGoals,
    totalGoals,
    // Mantener estadísticas de deudas para compatibilidad
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
            {/* Ingresos Totales */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Ingresos Totales</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    +${displayStats.totalIncomes.toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {incomes.length} {incomes.length === 1 ? 'ingreso' : 'ingresos'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* Gastos Totales */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Gastos Totales</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    -${displayStats.totalExpenses.toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {expenses.length} {expenses.length === 1 ? 'gasto' : 'gastos'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Target className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            {/* Balance Neto */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Balance Neto</p>
                  <p className={`text-2xl font-bold ${displayStats.netBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {displayStats.netBalance >= 0 ? '+' : ''}${displayStats.netBalance.toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {displayStats.netBalance >= 0 ? 'Positivo' : 'Negativo'}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${displayStats.netBalance >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <DollarSign className={`w-6 h-6 ${displayStats.netBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                </div>
              </div>
            </div>

            {/* Metas Completadas */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Metas de Ahorro</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {displayStats.goalsProgress.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {displayStats.completedGoals}/{displayStats.totalGoals} completadas
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
                {debts.length + incomes.length + expenses.length + goals.length} transacciones registradas
              </div>
            </div>

            {debts.length + incomes.length + expenses.length + goals.length === 0 ? (
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
                {(() => {
                  const allTransactions = [
                    ...debts.map(debt => ({ ...debt, type: 'debt' })),
                    ...incomes.map(income => ({ ...income, type: 'income' })),
                    ...expenses.map(expense => ({ ...expense, type: 'expense' })),
                    ...goals.map(goal => ({ ...goal, type: 'goal' }))
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  return allTransactions.map((transaction) => {
                    const getTransactionIcon = () => {
                      switch (transaction.type) {
                        case 'debt': return '💳';
                        case 'income': return '💰';
                        case 'expense': return '💸';
                        case 'goal': return '🎯';
                        default: return '📊';
                      }
                    };

                    const getTransactionColor = () => {
                      switch (transaction.type) {
                        case 'debt': return 'text-red-600 dark:text-red-400';
                        case 'income': return 'text-green-600 dark:text-green-400';
                        case 'expense': return 'text-orange-600 dark:text-orange-400';
                        case 'goal': return 'text-purple-600 dark:text-purple-400';
                        default: return 'text-gray-600 dark:text-gray-400';
                      }
                    };

                    const getTransactionLabel = () => {
                      switch (transaction.type) {
                        case 'debt': return 'Deuda';
                        case 'income': return 'Ingreso';
                        case 'expense': return 'Gasto';
                        case 'goal': return 'Meta';
                        default: return 'Transacción';
                      }
                    };

                        return (
                      <div 
                        key={`${transaction.type}-${transaction.id}`}
                        className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all duration-300 group cursor-pointer"
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setShowDetailModal(true);
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getTransactionIcon()}</span>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                {transaction.name}
                              </h4>
                              <span className={`text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 ${getTransactionColor()}`}>
                                {getTransactionLabel()}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-semibold ${getTransactionColor()}`}>
                              {transaction.type === 'debt' ? '-' : transaction.type === 'expense' ? '-' : '+'}${transaction.amount.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(transaction.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        {transaction.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {transaction.notes}
                          </p>
                        )}

                        {transaction.type === 'debt' && (
                          <div className="mt-3">
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <span>Progreso de pago</span>
                              <span>{((transaction.amount - transaction.balance) / transaction.amount * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((transaction.amount - transaction.balance) / transaction.amount * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {transaction.type === 'goal' && (
                          <div className="mt-3">
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <span>Progreso de meta</span>
                              <span>{((transaction.currentAmount || 0) / transaction.amount * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((transaction.currentAmount || 0) / transaction.amount * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
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
        onClose={() => {
          setShowTransactionModal(false);
          setEditingIncome(null);
        }}
        type={transactionType}
        onSave={handleSaveTransaction}
        loading={debtsLoading}
        editingTransaction={editingIncome}
      />

      {/* Modal de Detalles de Transacción */}
      <TransactionDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        onEdit={() => {
          if (selectedTransaction?.type === 'income') {
            setEditingIncome(selectedTransaction);
            setTransactionType('income');
            setShowDetailModal(false);
            setShowTransactionModal(true);
          } else if (selectedTransaction?.type === 'expense') {
            setEditingIncome(selectedTransaction);
            setTransactionType('expense');
            setShowDetailModal(false);
            setShowTransactionModal(true);
          } else if (selectedTransaction?.type === 'goal') {
            setEditingIncome(selectedTransaction);
            setTransactionType('goal');
            setShowDetailModal(false);
            setShowTransactionModal(true);
          } else if (selectedTransaction?.type === 'debt') {
            setEditingIncome(selectedTransaction);
            setTransactionType('debt');
            setShowDetailModal(false);
            setShowTransactionModal(true);
          }
        }}
        onDelete={() => {
          if (selectedTransaction?.type === 'income') {
            openConfirmModal(
              '¿Eliminar ingreso?',
              'Esta acción no se puede deshacer. ¿Estás seguro de eliminar este ingreso?',
              () => {
                deleteIncome(selectedTransaction.id);
                setShowDetailModal(false);
                setSelectedTransaction(null);
              }
            );
          } else if (selectedTransaction?.type === 'expense') {
            openConfirmModal(
              '¿Eliminar gasto?',
              'Esta acción no se puede deshacer. ¿Estás seguro de eliminar este gasto?',
              () => {
                deleteExpense(selectedTransaction.id);
                setShowDetailModal(false);
                setSelectedTransaction(null);
              }
            );
          } else if (selectedTransaction?.type === 'goal') {
            openConfirmModal(
              '¿Eliminar meta?',
              'Esta acción no se puede deshacer. ¿Estás seguro de eliminar esta meta?',
              () => {
                deleteGoal(selectedTransaction.id);
                setShowDetailModal(false);
                setSelectedTransaction(null);
              }
            );
          } else if (selectedTransaction?.type === 'debt') {
            openConfirmModal(
              '¿Eliminar deuda?',
              'Esta acción no se puede deshacer. ¿Estás seguro de eliminar esta deuda?',
              () => {
                deleteDebt(selectedTransaction.id);
                setShowDetailModal(false);
                setSelectedTransaction(null);
              }
            );
          }
        }}
      />

      {/* Modal de Confirmación */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setConfirmConfig(null);
          }}
          onConfirm={confirmConfig.onConfirm}
          title={confirmConfig.title}
          message={confirmConfig.message}
          type="danger"
          confirmText="Eliminar"
          cancelText="Cancelar"
        />
      )}
    </div>
  )
}
