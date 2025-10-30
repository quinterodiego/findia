'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Target, Sparkles, Trophy, DollarSign, LogOut, Wallet, Sun, Moon, Search, Filter, ArrowUpDown, BarChart3, PieChart, TrendingDown, Info, X, Download, FileText, CreditCard, Calculator, BarChart as BarChartIcon, Bell, Lightbulb, FileText as FileTextIcon, ChevronDown, MoreHorizontal, Home, Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartPieChart, Pie, Cell, LineChart, Line } from 'recharts'
import Image from 'next/image'
import { useDebts } from '@/hooks/useDebts'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenses } from '@/hooks/useExpenses'
import { useGoals } from '@/hooks/useGoals'
import { useCategories } from '@/hooks/useCategories'
import { useSubcategories } from '@/hooks/useSubcategories'
import type { Income, Expense, Goal } from '@/types'
import FloatingActionButton from '@/components/FloatingActionButton'
import TransactionModal from '@/components/TransactionModal'
import TransactionDetailModal from '@/components/TransactionDetailModal'
import ConfirmModal from '@/components/ConfirmModal'
import PaymentModal from '@/components/PaymentModal'
import ExportModal from '@/components/ExportModal'
import QuickExport from '@/components/QuickExport'
import ExpenseTemplateModal from '@/components/ExpenseTemplateModal'
import CreditCardModal from '@/components/CreditCardModal'
import CreditCardCenter from '@/components/CreditCardCenter'
import CreditCardConsumptionModal from '@/components/CreditCardConsumptionModal'
import CreditCardPaymentModal from '@/components/CreditCardPaymentModal'
import InterestCalculatorModal from '@/components/InterestCalculatorModal'
import CreditCardProjectionModal from '@/components/CreditCardProjectionModal'
import CreditCardAlertsModal from '@/components/CreditCardAlertsModal'
import CreditCardRecommendationsModal from '@/components/CreditCardRecommendationsModal'
import CreditCardReportsModal from '@/components/CreditCardReportsModal'
import { Skeleton, SkeletonStats, SkeletonCard, SkeletonTable } from '@/components/Skeleton'
import { useLoadingState } from '@/hooks/useLoadingState'
import ThemeToggle from '@/components/ThemeToggle'
import { useToast, ToastContainer } from '@/components/Toast'

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

interface TransactionWithType {
  [key: string]: any
  type: TransactionType
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toasts, removeToast, info } = useToast()
  const [welcomeShown, setWelcomeShown] = useState(false)
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
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'income' | 'expense' | 'goal'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'name'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<any>(null)
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false)
  const [showGoalsBreakdown, setShowGoalsBreakdown] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showExpenseTemplateModal, setShowExpenseTemplateModal] = useState(false)
  const [showCreditCardModal, setShowCreditCardModal] = useState(false)
  const [showCreditCardCenter, setShowCreditCardCenter] = useState(false)
  const [showCreditCardConsumptionModal, setShowCreditCardConsumptionModal] = useState(false)
  const [showCreditCardPaymentModal, setShowCreditCardPaymentModal] = useState(false)
  const [showInterestCalculatorModal, setShowInterestCalculatorModal] = useState(false)
  const [showCreditCardProjectionModal, setShowCreditCardProjectionModal] = useState(false)
  const [showCreditCardAlertsModal, setShowCreditCardAlertsModal] = useState(false)
  const [showCreditCardRecommendationsModal, setShowCreditCardRecommendationsModal] = useState(false)
  const [showCreditCardReportsModal, setShowCreditCardReportsModal] = useState(false)
  const [showCreditCardDropdown, setShowCreditCardDropdown] = useState(false)
  const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false)
  const [showToolsDropdown, setShowToolsDropdown] = useState(false)
  const [showBottomNav, setShowBottomNav] = useState(false)
  const [selectedCreditCard, setSelectedCreditCard] = useState<any>(null)
  const [selectedConsumption, setSelectedConsumption] = useState<any>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
    makePayment,
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

  // Hook para manejar categorías
  const { categories = [] } = useCategories()
  
  // Hook para manejar subcategorías
  const { subcategories = [] } = useSubcategories()

  // Evitar dobles cargas (StrictMode/dev y re-hidratación de sesión)
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    fetchDebts()
    fetchStats()
  }, [status, session?.user?.id, fetchDebts, fetchStats])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/')
      return
    }
  }, [session, status, router])

  // Mostrar mensaje de bienvenida como toast flotante SOLO al iniciar sesión (no en cada refresh)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return

    const userId = (session.user as any).id || session.user.email || 'current'
    const storageKey = `welcome-toast-shown:${userId}`

    // Si ya se mostró en esta sesión de pestaña, no volver a mostrar
    if (sessionStorage.getItem(storageKey)) return

    if (!welcomeShown) {
      const userName = session.user.name?.split(' ')[0] || 'Usuario'
      info(
        `¡Hola, ${userName}! 👋`,
        'Bienvenido a tu dashboard de libertad financiera',
        4000
      )
      sessionStorage.setItem(storageKey, 'true')
      setWelcomeShown(true)
    }
  }, [status, session, welcomeShown, info])

  // Cerrar dropdowns cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setShowCreditCardDropdown(false)
        setShowAnalysisDropdown(false)
        setShowToolsDropdown(false)
      }
    }

    if (showCreditCardDropdown || showAnalysisDropdown || showToolsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCreditCardDropdown, showAnalysisDropdown, showToolsDropdown])

  // Cerrar bottom nav cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.bottom-nav-container')) {
        setShowBottomNav(false)
      }
    }

    if (showBottomNav) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showBottomNav])


  const handleSignOut = () => {
    setShowLogoutModal(true)
  }

  const confirmLogout = async () => {
    try {
      // Limpiar el flag del toast de bienvenida para mostrarlo en el próximo login
      if (session?.user) {
        const userId = (session.user as any).id || session.user.email || 'current'
        const storageKey = `welcome-toast-shown:${userId}`
        sessionStorage.removeItem(storageKey)
      }
    } catch {}
    setIsLoggingOut(true)
    setShowLogoutModal(false)
    await signOut({ callbackUrl: '/' })
  }

  const handleApplyTemplate = (template: any) => {
    // Cerrar el modal de plantillas
    setShowExpenseTemplateModal(false)
    
    // Abrir el modal de transacciones con los datos de la plantilla
    setTransactionType('expense')
    setEditingIncome({
      name: template.name,
      amount: template.amount,
      date: new Date().toISOString().split('T')[0],
      category: template.category,
      subcategory: template.subcategory,
      expenseType: template.expenseType,
      description: template.description || ''
    })
    setShowTransactionModal(true)
  }

  const handleSelectCreditCard = (card: any) => {
    setSelectedCreditCard(card)
    setShowCreditCardModal(false)
    setShowCreditCardConsumptionModal(true)
  }

  const handleSelectConsumption = (consumption: any) => {
    setSelectedConsumption(consumption)
    setShowCreditCardConsumptionModal(false)
    setShowCreditCardPaymentModal(true)
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

  // Estado de carga optimizado
  const { isDataLoading, shouldShowSkeleton } = useLoadingState({
    debtsLoading,
    incomesLoading,
    expensesLoading,
    goalsLoading,
    sessionStatus: status
  })

  // Si no hay sesión, redirigir al login
  if (status === 'unauthenticated') {
    router.push('/')
    return null
  }

  if (debtsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FF3A5F]/5 via-white to-[#FF007A]/5 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error al cargar datos</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{debtsError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#FF3A5F] text-white rounded-lg hover:bg-[#FF3A5F]/90 transition-colors cursor-pointer"
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
  
  // Calcular progreso ponderado por valor de meta (más inteligente)
  const totalGoalValue = goals.reduce((sum, goal) => sum + goal.amount, 0);
  const totalCurrentValue = goals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0);
  const goalsProgress = totalGoalValue > 0 ? (totalCurrentValue / totalGoalValue) * 100 : 0;
  
  // Calcular progreso promedio simple (para comparación)
  const averageProgress = totalGoals > 0 ? 
    goals.reduce((sum, goal) => sum + Math.min((goal.currentAmount || 0) / goal.amount * 100, 100), 0) / totalGoals : 0;
  
  // Calcular gastos fijos y variables
  const totalFixedExpenses = expenses
    .filter(expense => expense.expenseType === 'fixed')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const totalVariableExpenses = expenses
    .filter(expense => expense.expenseType === 'variable')
    .reduce((sum, expense) => sum + expense.amount, 0);

  const displayStats = {
    totalIncomes,
    totalExpenses,
    totalFixedExpenses,
    totalVariableExpenses,
    netBalance,
    goalsProgress,
    averageProgress,
    completedGoals,
    totalGoals,
    totalGoalValue,
    totalCurrentValue,
    // Mantener estadísticas de deudas para compatibilidad
    totalBalance: stats?.totalBalance || 0,
    totalPaid: stats?.totalPaid || 0,
    progress: stats?.progress || 0,
    monthlyMinPayment: stats?.monthlyMinPayment || 0,
  }

  // Usar el estado de carga optimizado del hook

  // Mostrar pantalla de logout inmediata
  if (isLoggingOut) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FF3A5F]/5 via-white to-[#FF007A]/5 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-6 border-4 border-[#FF3A5F]/20 dark:border-gray-700 border-t-[#FF3A5F] rounded-full"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-gray-600 dark:text-gray-300 text-lg font-medium"
          >
            Cerrando sesión...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="w-full max-w-[98%] mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Image 
                src="/images/logo.png" 
                alt="FindIA Logo" 
                width={40} 
                height={40}
                className="rounded-xl"
              />
              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] bg-clip-text text-transparent">
                FindIA
              </span>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />

              {/* Dropdown de Tarjetas de Crédito - Solo Desktop */}
              <div className="relative dropdown-container hidden md:block">
                <button
                  onClick={() => setShowCreditCardDropdown(!showCreditCardDropdown)}
                  className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  title="Tarjetas de crédito"
                >
                  <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span>Tarjetas</span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                
                {showCreditCardDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                  >
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowCreditCardCenter(true)
                          setShowCreditCardDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <CreditCard className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Centro de Control</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Estrategias y plan de pago</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowCreditCardPaymentModal(true)
                          setShowCreditCardDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Pagos</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Registrar pagos</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowInterestCalculatorModal(true)
                          setShowCreditCardDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <Calculator className="w-4 h-4 text-purple-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Calculadora de Intereses</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Calcular intereses por mora</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowCreditCardProjectionModal(true)
                          setShowCreditCardDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <BarChartIcon className="w-4 h-4 text-orange-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Proyecciones</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Simuladores y escenarios</div>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Dropdown de Análisis - Solo Desktop */}
              <div className="relative dropdown-container hidden md:block">
                <button
                  onClick={() => setShowAnalysisDropdown(!showAnalysisDropdown)}
                  className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  title="Análisis y reportes"
                >
                  <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span>Análisis</span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                
                {showAnalysisDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                  >
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowCreditCardAlertsModal(true)
                          setShowAnalysisDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <Bell className="w-4 h-4 text-red-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Alertas</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Notificaciones automáticas</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowCreditCardRecommendationsModal(true)
                          setShowAnalysisDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Recomendaciones</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Optimización inteligente</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowCreditCardReportsModal(true)
                          setShowAnalysisDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <FileTextIcon className="w-4 h-4 text-indigo-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Reportes</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Análisis detallados</div>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Dropdown de Herramientas - Solo Desktop */}
              <div className="relative dropdown-container hidden md:block">
                <button
                  onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                  className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  title="Herramientas"
                >
                  <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span>Herramientas</span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                
                {showToolsDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                  >
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowExportModal(true)
                          setShowToolsDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <Download className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Exportar Datos</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">PDF y Excel</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowExpenseTemplateModal(true)
                          setShowToolsDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Plantillas de Gastos</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Gastos recurrentes</div>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

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
                    <div className="w-full h-full bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] flex items-center justify-center text-white font-semibold text-sm">
                      {session?.user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {session?.user?.name || session?.user?.email}
                </span>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Botón de menú móvil */}
                <button
                  onClick={() => setShowBottomNav(!showBottomNav)}
                  className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  title="Menú"
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-4 lg:px-6 py-6">
        <div className="space-y-6">
          {/* Stats Cards - Diseño limpio y con impacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
            {(shouldShowSkeleton && (debtsLoading || incomesLoading || expensesLoading || goalsLoading)) ? (
              <SkeletonStats />
            ) : (
              <>
                {/* Ingresos Totales */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-200/50 transition-all duration-200 hover:shadow-2xl group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Ingresos Totales</p>
                      <motion.p 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="text-3xl font-bold text-green-400 mb-1"
                      >
                        +${displayStats.totalIncomes.toLocaleString()}
                      </motion.p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {incomes.length} {incomes.length === 1 ? 'ingreso' : 'ingresos'} este mes
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-green-200 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-7 h-7 text-green-400" />
                    </div>
                  </div>
                </motion.div>

            {/* Gastos Totales con desglose */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-200/50 transition-all duration-200 hover:shadow-2xl group relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Gastos Totales</p>
                  </div>
                  <motion.p 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="text-3xl font-bold text-red-400 mb-1"
                  >
                    -${displayStats.totalExpenses.toLocaleString()}
                  </motion.p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                    {expenses.length} {expenses.length === 1 ? 'gasto' : 'gastos'} en total
                  </p>
                  {(displayStats.totalFixedExpenses > 0 || displayStats.totalVariableExpenses > 0) && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowExpenseBreakdown(true)
                      }}
                      className="w-full px-4 py-2 bg-red-200 hover:bg-red-300 text-red-400 rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Info className="w-4 h-4" />
                      Ver detalle
                    </motion.button>
                  )}
                </div>
                <div className="w-14 h-14 bg-red-200 rounded-xl flex items-center justify-center">
                  <Target className="w-7 h-7 text-red-400" />
                </div>
              </div>
            </motion.div>

            {/* Balance Neto */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-200/50 transition-all duration-200 hover:shadow-2xl group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Balance Neto</p>
                  <motion.p 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                    className={`text-3xl font-bold mb-1 ${displayStats.netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {displayStats.netBalance >= 0 ? '+' : ''}${displayStats.netBalance.toLocaleString()}
                  </motion.p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {displayStats.netBalance >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${displayStats.netBalance >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
                  <DollarSign className={`w-7 h-7 ${displayStats.netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                </div>
              </div>
            </motion.div>

            {/* Metas de Ahorro */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-200/50 transition-all duration-200 hover:shadow-2xl group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Metas de Ahorro</p>
                  <motion.p 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                    className="text-3xl font-bold text-purple-400 mb-1"
                  >
                    {displayStats.goalsProgress.toFixed(1)}%
                  </motion.p>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {displayStats.completedGoals} de {displayStats.totalGoals} completadas
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      ${displayStats.totalCurrentValue.toLocaleString()} / ${displayStats.totalGoalValue.toLocaleString()}
                    </p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(displayStats.goalsProgress, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="bg-gradient-to-r from-purple-400 to-purple-500 h-2 rounded-full"
                      />
                    </div>
                  </div>
                  {goals.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowGoalsBreakdown(true)
                      }}
                      className="w-full px-4 py-2 bg-purple-200 hover:bg-purple-300 text-purple-400 rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer mt-3"
                    >
                      <Info className="w-4 h-4" />
                      Ver detalle
                    </motion.button>
                  )}
                </div>
                <div className="w-14 h-14 bg-purple-200 rounded-xl flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-purple-400" />
                </div>
              </div>
            </motion.div>
              </>
            )}
          </div>

          {/* Quick Export */}
          {!shouldShowSkeleton && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex justify-end mb-6"
            >
              <QuickExport 
                data={{
                  incomes,
                  expenses,
                  debts,
                  goals,
                  stats: displayStats
                }}
              />
            </motion.div>
          )}

          {/* Analytics Section */}
          {shouldShowSkeleton ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (incomes.length > 0 || expenses.length > 0) && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6"
            >
              {/* Gráfica de Ingresos vs Gastos */}
              <motion.div 
              className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50 dark:border-gray-700 transition-all duration-200 hover:shadow-2xl"
              >
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
                    data={[
                      { name: 'Total', Ingresos: displayStats.totalIncomes, Gastos: displayStats.totalExpenses }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#6b7280"
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconSize={12}
                      formatter={(value) => (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
                      )}
                    />
                    <Bar 
                      dataKey="Ingresos" 
                      fill="#4ade80"
                      radius={[8, 8, 0, 0]}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(74, 222, 128, 0.3))' }}
                    />
                    <Bar 
                      dataKey="Gastos" 
                      fill="#f87171"
                      radius={[8, 8, 0, 0]}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(248, 113, 113, 0.3))' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Gastos por Categoría */}
              {(() => {
                const categoryExpenses = expenses.reduce((acc, expense) => {
                  const category = expense.category || 'Sin categoría';
                  acc[category] = (acc[category] || 0) + expense.amount;
                  return acc;
                }, {} as Record<string, number>);

                const data = Object.entries(categoryExpenses).map(([name, value]) => ({
                  name,
                  value
                }));

                // Paleta de colores pastel consistente con el tema de la app (purple/blue/green-400/red-400)
                const COLORS = ['#f87171', '#c084fc', '#a78bfa', '#60a5fa', '#3b82f6', '#4ade80'];

                if (data.length === 0) return null;

                return (
                  <motion.div 
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50 dark:border-gray-700 transition-all duration-200 hover:shadow-2xl"
                  >
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
                          data={data}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={function(entry: any) {
                            const percent = entry.percent;
                            if (percent < 0.05) return '';
                            return `${entry.name}: ${(percent * 100).toFixed(0)}%`;
                          }}
                          outerRadius={100}
                          innerRadius={40}
                          fill="#8884d8"
                          dataKey="value"
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                          formatter={(value: number) => `$${value.toLocaleString()}`}
                        />
                      </RechartPieChart>
                    </ResponsiveContainer>
                  </motion.div>
                );
              })()}
            </motion.div>
          )}

          {/* Lista de Deudas */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Mis Transacciones Financieras
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {shouldShowSkeleton ? (
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-20 rounded"></div>
                ) : (() => {
                  const allTransactions: TransactionWithType[] = [
                    ...debts.map((debt: any) => ({ ...debt, type: 'debt' } as TransactionWithType)),
                    ...incomes.map((income: any) => ({ ...income, type: 'income' } as TransactionWithType)),
                    ...expenses.map((expense: any) => ({ ...expense, type: 'expense' } as TransactionWithType)),
                    ...goals.map((goal: any) => ({ ...goal, type: 'goal' } as TransactionWithType))
                  ];

                  let filtered = allTransactions;

                  if (filterType !== 'all') {
                    filtered = filtered.filter(t => t.type === filterType);
                  }

                  if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    filtered = filtered.filter(t =>
                      t.name.toLowerCase().includes(query) ||
                      t.category?.toLowerCase().includes(query) ||
                      t.notes?.toLowerCase().includes(query)
                    );
                  }

                  return filtered.length;
                })()} {(() => {
                  const count = (() => {
                    const allTransactions: TransactionWithType[] = [
                      ...debts.map((debt: any) => ({ ...debt, type: 'debt' } as TransactionWithType)),
                      ...incomes.map((income: any) => ({ ...income, type: 'income' } as TransactionWithType)),
                      ...expenses.map((expense: any) => ({ ...expense, type: 'expense' } as TransactionWithType)),
                      ...goals.map((goal: any) => ({ ...goal, type: 'goal' } as TransactionWithType))
                    ];

                    let filtered = allTransactions;

                    if (filterType !== 'all') {
                      filtered = filtered.filter(t => t.type === filterType);
                    }

                    if (searchQuery) {
                      const query = searchQuery.toLowerCase();
                      filtered = filtered.filter(t =>
                        t.name.toLowerCase().includes(query) ||
                        t.category?.toLowerCase().includes(query) ||
                        t.notes?.toLowerCase().includes(query)
                      );
                    }

                    return filtered.length;
                  })();

                  return count === 1 ? 'transacción' : 'transacciones';
                })()} {filterType !== 'all' || searchQuery ? 'encontradas' : 'registradas'}
              </div>
            </div>

            {/* Filtros y Búsqueda */}
            <div className="space-y-4 mb-6">
              {/* Barra de búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, categoría o notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Filtros por tipo */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-[#FF3A5F] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                    filterType === 'income'
                      ? 'bg-green-400 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  💰 Ingresos
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                    filterType === 'expense'
                      ? 'bg-orange-400 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  💸 Gastos
                </button>
                <button
                  onClick={() => setFilterType('goal')}
                  className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                    filterType === 'goal'
                      ? 'bg-purple-400 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  🎯 Metas
                </button>
                <button
                  onClick={() => setFilterType('debt')}
                  className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                    filterType === 'debt'
                      ? 'bg-red-400 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  💳 Deudas
                </button>
              </div>

              {/* Ordenamiento */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'name')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white cursor-pointer"
                >
                  <option value="date">Ordenar por fecha</option>
                  <option value="amount">Ordenar por monto</option>
                  <option value="name">Ordenar por nombre</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors dark:text-white cursor-pointer"
                >
                  {sortOrder === 'desc' ? '⬇️' : '⬆️'}
                </button>
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
                  <p className="text-sm">👉 Mira el botón flotante en la esquina inferior derecha</p>
                </div>
              </div>
            ) : shouldShowSkeleton ? (
              <SkeletonTable />
            ) : (
              <div className="space-y-4">
                {(() => {
                  let allTransactions: TransactionWithType[] = [
                    ...debts.map((debt: any) => ({ ...debt, type: 'debt' } as TransactionWithType)),
                    ...incomes.map((income: any) => ({ ...income, type: 'income' } as TransactionWithType)),
                    ...expenses.map((expense: any) => ({ ...expense, type: 'expense' } as TransactionWithType)),
                    ...goals.map((goal: any) => ({ ...goal, type: 'goal' } as TransactionWithType))
                  ];

                  // Filtrar por tipo
                  if (filterType !== 'all') {
                    allTransactions = allTransactions.filter(t => t.type === filterType);
                  }

                  // Filtrar por búsqueda
                  if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    allTransactions = allTransactions.filter(t =>
                      t.name.toLowerCase().includes(query) ||
                      t.category?.toLowerCase().includes(query) ||
                      t.notes?.toLowerCase().includes(query)
                    );
                  }

                  // Ordenar
                  allTransactions.sort((a, b) => {
                    if (sortBy === 'date') {
                      const dateA = new Date(a.date).getTime();
                      const dateB = new Date(b.date).getTime();
                      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                    } else if (sortBy === 'amount') {
                      return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
                    } else {
                      return sortOrder === 'desc'
                        ? b.name.localeCompare(a.name)
                        : a.name.localeCompare(b.name);
                    }
                  });

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
                        case 'debt': return 'text-red-400 dark:text-red-300';
                        case 'income': return 'text-green-400 dark:text-green-300';
                        case 'expense': return 'text-orange-400 dark:text-orange-300';
                        case 'goal': return 'text-purple-400 dark:text-purple-300';
                        default: return 'text-gray-400 dark:text-gray-300';
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
                      <motion.div 
                        key={`${transaction.type}-${transaction.id}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
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
                            <div className="text-sm text-gray-600 dark:text-gray-400">
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
                                className="bg-blue-400 h-2 rounded-full transition-all duration-300"
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
                                className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((transaction.currentAmount || 0) / transaction.amount * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  });
                })()}
              </div>
            )}
          </motion.div>
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
        onAddPayment={() => {
          if (selectedTransaction?.type === 'debt') {
            setSelectedDebt(selectedTransaction);
            setShowDetailModal(false);
            setShowPaymentModal(true);
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

      {/* Modal de Confirmación de Logout */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        title="Cerrar Sesión"
        message="¿Estás seguro de que quieres cerrar sesión?"
        type="brand"
        confirmText="Cerrar Sesión"
        cancelText="Cancelar"
      />

      {/* Modal de Exportación */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={{
          incomes,
          expenses,
          debts,
          goals,
          stats: displayStats
        }}
      />

      {/* Modal de Desglose de Gastos */}
      {showExpenseBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowExpenseBreakdown(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Desglose de Gastos
                </h3>
                <button
                  onClick={() => setShowExpenseBreakdown(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Gastos Fijos</p>
                  <p className="text-2xl font-bold text-red-400 dark:text-red-300">
                    -${displayStats.totalFixedExpenses.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {expenses.filter((e: any) => e.expenseType === 'fixed').length} gastos fijos
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-200 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-red-400" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Gastos Variables</p>
                  <p className="text-2xl font-bold text-purple-400 dark:text-purple-300">
                    -${displayStats.totalVariableExpenses.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {expenses.filter((e: any) => e.expenseType === 'variable').length} gastos variables
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-200 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-400" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${displayStats.totalExpenses.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Desglose de Metas */}
      {showGoalsBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowGoalsBreakdown(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Desglose Detallado de Metas
                </h3>
                <button
                  onClick={() => setShowGoalsBreakdown(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Resumen General */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Metas Completadas</p>
                    <p className="text-2xl font-bold text-green-400 dark:text-green-300">
                      {displayStats.completedGoals}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {goals.filter((g: any) => (g.currentAmount || 0) >= g.amount).length} metas alcanzadas
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-green-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">En Progreso</p>
                    <p className="text-2xl font-bold text-yellow-400 dark:text-yellow-300">
                      {displayStats.totalGoals - displayStats.completedGoals}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {goals.filter((g: any) => (g.currentAmount || 0) < g.amount).length} metas pendientes
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-200 rounded-xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-yellow-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Progreso Ponderado</p>
                    <p className="text-2xl font-bold text-purple-400 dark:text-purple-300">
                      {displayStats.goalsProgress.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ${displayStats.totalCurrentValue.toLocaleString()} / ${displayStats.totalGoalValue.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-200 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </div>

              {/* Lista Detallada de Metas */}
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Detalle por Meta
                </h4>
                {goals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p>No tienes metas de ahorro configuradas</p>
                    <p className="text-sm">¡Crea tu primera meta para comenzar!</p>
                  </div>
                ) : (
                  goals.map((goal: any, index: number) => {
                    const progress = goal.amount > 0 ? Math.min(((goal.currentAmount || 0) / goal.amount) * 100, 100) : 0;
                    const isCompleted = (goal.currentAmount || 0) >= goal.amount;
                    const remaining = Math.max(goal.amount - (goal.currentAmount || 0), 0);
                    
                    return (
                      <motion.div
                        key={goal.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`p-4 rounded-xl border transition-all duration-200 ${
                          isCompleted 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-gray-900 dark:text-white text-lg">
                              {goal.name || 'Meta sin nombre'}
                            </h5>
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${
                                isCompleted 
                                  ? 'text-green-400 dark:text-green-300' 
                                  : 'text-purple-400 dark:text-purple-300'
                              }`}>
                                {progress.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {isCompleted ? 'Completada' : 'En progreso'}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                            <div className="bg-white/50 dark:bg-gray-600/50 rounded-lg p-2">
                              <div className="text-gray-500 dark:text-gray-400 text-xs">Meta</div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                ${goal.amount.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-white/50 dark:bg-gray-600/50 rounded-lg p-2">
                              <div className="text-gray-500 dark:text-gray-400 text-xs">Ahorrado</div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                ${(goal.currentAmount || 0).toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-white/50 dark:bg-gray-600/50 rounded-lg p-2">
                              <div className="text-gray-500 dark:text-gray-400 text-xs">
                                {isCompleted ? 'Completada' : 'Falta'}
                              </div>
                              <div className={`font-semibold ${
                                isCompleted 
                                  ? 'text-green-400 dark:text-green-300' 
                                  : 'text-orange-500 dark:text-orange-400'
                              }`}>
                                {isCompleted ? '¡Listo!' : `$${remaining.toLocaleString()}`}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Barra de progreso individual */}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.8, delay: 0.5 + (index * 0.1) }}
                            className={`h-2 rounded-full ${
                              isCompleted 
                                ? 'bg-gradient-to-r from-green-400 to-green-500' 
                                : 'bg-gradient-to-r from-purple-400 to-purple-500'
                            }`}
                          />
                        </div>
                        
                        {/* Información adicional */}
                        {goal.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                            {goal.description}
                          </p>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Plantillas de Gastos */}
      <ExpenseTemplateModal
        isOpen={showExpenseTemplateModal}
        onClose={() => setShowExpenseTemplateModal(false)}
        onApplyTemplate={handleApplyTemplate}
        categories={categories}
        subcategories={subcategories}
      />

      {/* Modal de Tarjetas de Crédito */}
      <CreditCardModal
        isOpen={showCreditCardModal}
        onClose={() => setShowCreditCardModal(false)}
        onSelectCard={handleSelectCreditCard}
      />

      {/* Centro de Control de Tarjetas */}
      <CreditCardCenter
        isOpen={showCreditCardCenter}
        onClose={() => setShowCreditCardCenter(false)}
        categories={categories}
        subcategories={subcategories}
      />

      {/* Modal de Consumos de Tarjeta */}
      <CreditCardConsumptionModal
        isOpen={showCreditCardConsumptionModal}
        onClose={() => {
          setShowCreditCardConsumptionModal(false)
          setSelectedCreditCard(null)
        }}
        selectedCard={selectedCreditCard}
        categories={categories}
        subcategories={subcategories}
      />

      {/* Modal de Pagos de Tarjeta */}
      <CreditCardPaymentModal
        isOpen={showCreditCardPaymentModal}
        onClose={() => {
          setShowCreditCardPaymentModal(false)
          setSelectedConsumption(null)
        }}
        selectedCard={selectedCreditCard}
        selectedConsumption={selectedConsumption}
      />

      {/* Modal de Calculadora de Intereses */}
      <InterestCalculatorModal
        isOpen={showInterestCalculatorModal}
        onClose={() => setShowInterestCalculatorModal(false)}
        selectedCard={selectedCreditCard}
        consumptions={[]} // Aquí irían los consumos reales
      />

      {/* Modal de Proyecciones */}
      <CreditCardProjectionModal
        isOpen={showCreditCardProjectionModal}
        onClose={() => setShowCreditCardProjectionModal(false)}
        selectedCard={selectedCreditCard}
        consumptions={[]} // Aquí irían los consumos reales
        payments={[]} // Aquí irían los pagos reales
      />

      {/* Modal de Alertas */}
      <CreditCardAlertsModal
        isOpen={showCreditCardAlertsModal}
        onClose={() => setShowCreditCardAlertsModal(false)}
        selectedCard={selectedCreditCard}
        consumptions={[]} // Aquí irían los consumos reales
        payments={[]} // Aquí irían los pagos reales
      />

      {/* Modal de Recomendaciones */}
      <CreditCardRecommendationsModal
        isOpen={showCreditCardRecommendationsModal}
        onClose={() => setShowCreditCardRecommendationsModal(false)}
        selectedCard={selectedCreditCard}
        consumptions={[]} // Aquí irían los consumos reales
        payments={[]} // Aquí irían los pagos reales
      />

      {/* Modal de Reportes */}
      <CreditCardReportsModal
        isOpen={showCreditCardReportsModal}
        onClose={() => setShowCreditCardReportsModal(false)}
        selectedCard={selectedCreditCard}
        consumptions={[]} // Aquí irían los consumos reales
        payments={[]} // Aquí irían los pagos reales
      />

      {/* Modal de Pagos */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedDebt(null);
        }}
        onSave={async (paymentData) => {
          if (selectedDebt) {
            await makePayment(selectedDebt.id, paymentData);
          }
        }}
        debt={selectedDebt}
        loading={debtsLoading}
      />

      {/* Bottom Navigation Bar - Solo Mobile */}
      <AnimatePresence>
        {showBottomNav && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
          >
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl bottom-nav-container">
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Sección Tarjetas de Crédito */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Tarjetas de Crédito
                    </h3>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setShowCreditCardCenter(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <CreditCard className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Gestión</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowCreditCardPaymentModal(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Pagos</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowInterestCalculatorModal(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <Calculator className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Intereses</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowCreditCardProjectionModal(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <BarChartIcon className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Proyecciones</span>
                      </button>
                    </div>
                  </div>

                  {/* Sección Análisis y Herramientas */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Análisis & Herramientas
                    </h3>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setShowCreditCardAlertsModal(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <Bell className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Alertas</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowCreditCardRecommendationsModal(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Recomendaciones</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowCreditCardReportsModal(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <FileTextIcon className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Reportes</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowExportModal(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <Download className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Exportar</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowExpenseTemplateModal(true)
                          setShowBottomNav(false)
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Plantillas</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
