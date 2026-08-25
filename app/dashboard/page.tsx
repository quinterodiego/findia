'use client'

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Target, Trophy, DollarSign, LogOut, Wallet, Search, Filter, ArrowUpDown, BarChart3, X, Download, FileText, CreditCard, Calculator, BarChart as BarChartIcon, Bell, Lightbulb, FileText as FileTextIcon, ChevronDown, ChevronUp, ChevronRight, Bolt, Users, RefreshCw, Calendar, CheckCircle, Landmark } from 'lucide-react'
import Image from 'next/image'
import { useDebts } from '@/hooks/useDebts'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenses } from '@/hooks/useExpenses'
import { useGoals } from '@/hooks/useGoals'
import { useCategories } from '@/hooks/useCategories'
import { useSubcategories } from '@/hooks/useSubcategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import type { Income, Expense, Goal, Debt, Payment, SharedExpense } from '@/types'
import { formatCurrency } from '@/lib/formatNumber'
import FloatingActionButton from '@/components/FloatingActionButton'
import TransactionModal from '@/components/TransactionModal'
import TransactionDetailModal from '@/components/TransactionDetailModal'
import ConfirmModal from '@/components/ConfirmModal'
import PaymentModal from '@/components/PaymentModal'
import dynamic from 'next/dynamic'
import QuickExport from '@/components/QuickExport'
import CreditCardModal from '@/components/CreditCardModal'

// Modales pesados: cargados sólo cuando se abren por primera vez
const ExportModal = dynamic(() => import('@/components/ExportModal'), { ssr: false })
const ExpenseTemplateModal = dynamic(() => import('@/components/ExpenseTemplateModal'), { ssr: false })
const CreditCardCenter = dynamic(() => import('@/components/CreditCardCenter'), { ssr: false })
const CreditCardConsumptionModal = dynamic(() => import('@/components/CreditCardConsumptionModal'), { ssr: false })
const CreditCardPaymentModal = dynamic(() => import('@/components/CreditCardPaymentModal'), { ssr: false })
const InterestCalculatorModal = dynamic(() => import('@/components/InterestCalculatorModal'), { ssr: false })
const CreditCardProjectionModal = dynamic(() => import('@/components/CreditCardProjectionModal'), { ssr: false })
const CreditCardAlertsModal = dynamic(() => import('@/components/CreditCardAlertsModal'), { ssr: false })
const CreditCardRecommendationsModal = dynamic(() => import('@/components/CreditCardRecommendationsModal'), { ssr: false })
const CreditCardReportsModal = dynamic(() => import('@/components/CreditCardReportsModal'), { ssr: false })
import { SkeletonStats, SkeletonTable } from '@/components/Skeleton'
import { useLoadingState } from '@/hooks/useLoadingState'
import ThemeToggle from '@/components/ThemeToggle'
import { useToast, ToastContainer } from '@/components/Toast'
import ShareExpenseModal from '@/components/ShareExpenseModal'
import SharedExpensesSection from '@/components/SharedExpensesSection'
import FixedExpensesTable from '@/components/FixedExpensesTable'
import { useFixedExpenses } from '@/hooks/useFixedExpenses'
import DashboardAnalytics from '@/components/DashboardAnalytics'
import DashboardBudget from '@/components/DashboardBudget'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import PullToRefresh from '@/components/PullToRefresh'
import NotificationBell from '@/components/NotificationBell'
import BottomNavBar from '@/components/BottomNavBar'

type TransactionType = 'debt' | 'expense' | 'income' | 'goal'

interface ExtendedTransactionData extends TransactionData {
  totalInstallmentsDebt?: number
  remainingInstallmentsDebt?: number
  paymentMethodDebt?: 'automatic' | 'manual' | 'transfer'
}

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
  status?: 'active' | 'paid' | 'overdue'
  // Campos para préstamos con cuotas
totalInstallments?: number
  remainingInstallments?: number
  paymentMethod?: 'automatic' | 'manual' | 'transfer'
  // Campos específicos para metas
  targetDate?: string
  currentAmount?: number
  // Campos específicos para gastos/ingresos
  expenseType?: 'fixed' | 'variable' | 'installments'
  isRecurring?: boolean
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  // Campos para gastos en cuotas
  currentInstallment?: number
  // Campos específicos del formulario (no se envían directamente)
  totalInstallmentsDebt?: number
  remainingInstallmentsDebt?: number
  paymentMethodDebt?: 'automatic' | 'manual' | 'transfer'
}

interface TransactionWithType {
  id: string
  name: string
  amount: number
  date?: string
  type: TransactionType
  category?: string
  notes?: string
  balance?: number
  dueDate?: string
  createdAt?: string
  currentAmount?: number
  [key: string]: unknown
}

function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toasts, removeToast, info, success: toastSuccess, error: toastError } = useToast()
  const [welcomeShown, setWelcomeShown] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [transactionType, setTransactionType] = useState<TransactionType>('debt')
  const [editingIncome, setEditingIncome] = useState<TransactionWithType | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithType | null>(null)
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
  
  // Filtro de fecha por defecto: mes actual
  const [dateFilter, setDateFilter] = useState<'current-month' | 'all'>('current-month')
  
  const currentMonthRange = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    return {
      startDate: new Date(year, month, 1),
      endDate: new Date(year, month + 1, 0, 23, 59, 59, 999),
    }
  }, [])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false)
  const [expenseBreakdownView, setExpenseBreakdownView] = useState<'summary' | 'fixed' | 'variable'>('summary')
  const [showGoalsBreakdown, setShowGoalsBreakdown] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showExpenseTemplateModal, setShowExpenseTemplateModal] = useState(false)
  const [showCreditCardModal, setShowCreditCardModal] = useState(false)
  const [showCreditCardCenter, setShowCreditCardCenter] = useState(false)
  const [showFixedExpensesTable, setShowFixedExpensesTable] = useState(false)
  const [budgetMonthOffset, setBudgetMonthOffset] = useState(0) // 0 = mes actual, 1 = próximo mes
  const [debtPayments, setDebtPayments] = useState<Payment[]>([])
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
  const [selectedCreditCard, setSelectedCreditCard] = useState<{ id: string; name: string } | null>(null)
  const [selectedConsumption, setSelectedConsumption] = useState<{ id: string; merchant: string } | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showShareExpenseModal, setShowShareExpenseModal] = useState(false)
  const [selectedExpenseForShare, setSelectedExpenseForShare] = useState<Expense | null>(null)
  const [sharedExpenses, setSharedExpenses] = useState<Array<Record<string, unknown>>>([])
  const [isSharedExpensesExpanded, setIsSharedExpensesExpanded] = useState(false)
  const [addingToGoalId, setAddingToGoalId] = useState<string | null>(null)
  const [goalAddInput, setGoalAddInput] = useState('')

  // Cargar gastos compartidos aceptados
  useEffect(() => {
    if (session?.user?.id) {
      const loadSharedExpenses = async () => {
        try {
          const response = await fetch('/api/shared-expenses?status=accepted');
          const data = await response.json();
          if (data.success) {
            setSharedExpenses(data.sharedExpenses || []);
          }
        } catch (error) {
          console.error('Error cargando gastos compartidos:', error);
        }
      };
      loadSharedExpenses();
    }
  }, [session?.user?.id])

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
    createIncome,
    updateIncome,
    deleteIncome,
    fetchIncomes,
  } = useIncomes()

  const {
    expenses = [],
    loading: expensesLoading,
    createExpense,
    updateExpense,
    deleteExpense,
    fetchExpenses,
  } = useExpenses()

  const {
    goals = [],
    loading: goalsLoading,
    createGoal,
    updateGoal,
    deleteGoal,
    fetchGoals,
  } = useGoals()

  // Hook para manejar categorías
  const { categories = [], fetchCategories } = useCategories()
  
  // Hook para manejar subcategorías
  const { subcategories = [], fetchSubcategories } = useSubcategories()
  
  // Cargar categorías y subcategorías cuando el usuario esté autenticado
  useEffect(() => {
    if (session?.user?.email) {
      fetchCategories()
      fetchSubcategories()
    }
  }, [session?.user?.email, fetchCategories, fetchSubcategories])

  // Hook para manejar tarjetas de crédito
  const { cards: creditCards, loading: cardsLoading, fetchCards } = useCreditCards()

  // Cargar pagos de deudas y tarjetas
  useEffect(() => {
    if (!session?.user?.id) return;
    
    const loadPayments = async () => {
      try {
        // Cargar pagos de deudas
        const debtPaymentsResponse = await fetch('/api/payments');
        if (debtPaymentsResponse.ok) {
          const debtPaymentsData = await debtPaymentsResponse.json();
          setDebtPayments(debtPaymentsData.payments || []);
        }

      } catch (error) {
        console.error('Error cargando pagos:', error);
      }
    };

    if (creditCards.length > 0 || debts.length > 0) {
      loadPayments();
    }
  }, [session?.user?.id, creditCards, debts.length]);

  // Hook para gastos fijos
  const {
    fixedExpenses,
    loading: fixedExpensesLoading,
    totalAmount: totalFixedAmount,
    totalPaid: totalFixedPaid,
  } = useFixedExpenses(expenses, debts, debtPayments, budgetMonthOffset);

  // Manejar shortcuts de la PWA (?open=expense|income|debt|goal, ?filter=debt|...)
  useEffect(() => {
    const open = searchParams.get('open') as TransactionType | null
    const filter = searchParams.get('filter') as typeof filterType | null

    if (open && ['expense', 'income', 'debt', 'goal'].includes(open)) {
      setTransactionType(open)
      setShowTransactionModal(true)
    }
    if (filter) {
      setFilterType(filter)
    }
  // Solo al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Evitar dobles cargas (StrictMode/dev y re-hidratación de sesión)
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    fetchDebts()
    fetchStats()
    fetchCards()
  }, [status, session?.user?.id, fetchDebts, fetchStats, fetchCards])

  // Refrescar todos los datos (pull-to-refresh + visibilitychange)
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchDebts(),
      fetchStats(),
      fetchCards(),
      fetchIncomes(),
      fetchExpenses(),
      fetchGoals(),
    ])
  }, [fetchDebts, fetchStats, fetchCards, fetchIncomes, fetchExpenses, fetchGoals])

  // Auto-refresh cuando la PWA vuelve al foco tras 5+ minutos en background
  const hiddenAtRef = useRef<number | null>(null)
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else if (hiddenAtRef.current && Date.now() - hiddenAtRef.current > STALE_MS) {
        refreshAll()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refreshAll])

  const pullToRefresh = usePullToRefresh(refreshAll)

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

    const userId = (session.user as { id?: string }).id || session.user.email || 'current'
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

  const confirmLogout = useCallback(async () => {
    try {
      // Limpiar el flag del toast de bienvenida para mostrarlo en el próximo login
      if (session?.user) {
        const userId = (session.user as { id?: string }).id || session.user.email || 'current'
        const storageKey = `welcome-toast-shown:${userId}`
        sessionStorage.removeItem(storageKey)
      }
    } catch {}
    setIsLoggingOut(true)
    setShowLogoutModal(false)
    await signOut({ callbackUrl: '/' })
  }, [session?.user])

  const handleApplyTemplate = useCallback((template: {
    id: string
    name: string
    amount: number
    category: string
    subcategory: string
    expenseType: 'fixed' | 'variable'
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    description?: string
    createdAt: string
  }) => {
    // Cerrar el modal de plantillas
    setShowExpenseTemplateModal(false)
    
    // Abrir el modal de transacciones con los datos de la plantilla
    setTransactionType('expense')
    setEditingIncome({
      id: template.id || '',
      name: template.name || '',
      amount: template.amount || 0,
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      category: template.category,
      notes: template.description,
      expenseType: template.expenseType,
    } as TransactionWithType)
    setShowTransactionModal(true)
  }, [])

  const handleSelectCreditCard = useCallback((card: { id: string; name: string }) => {
    setSelectedCreditCard(card)
    setShowCreditCardModal(false)
    setShowCreditCardConsumptionModal(true)
  }, [])


  const handleShareExpense = useCallback(async (data: {
    expenseId: string;
    sharedWithEmail: string;
    splitType: 'equal' | 'percentage' | 'amount';
    ownerAmount?: number;
    partnerAmount?: number;
    ownerPercentage?: number;
    partnerPercentage?: number;
    notes?: string;
  }) => {
    try {
      const response = await fetch('/api/shared-expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        info('Gasto compartido', 'El gasto se ha compartido exitosamente');
      } else {
        throw new Error(result.error || 'Error al compartir el gasto');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al compartir el gasto';
      console.error('Error compartiendo gasto:', errorMessage);
      info('Error', errorMessage);
    }
  }, [info])

  const handleTransactionAction = useCallback((type: TransactionType) => {
    setTransactionType(type)
    setShowTransactionModal(true)
  }, [])

  const openConfirmModal = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
    setShowConfirmModal(true);
  }, []);

  const handleSaveTransaction = useCallback(async (data: TransactionData) => {
    
    // Si estamos editando
    if (editingIncome) {
      try {
        if (editingIncome.type === 'income') {
          const result = await updateIncome(editingIncome.id, data);
          if (result.success) {
            toastSuccess('Ingreso actualizado', data.name);
          } else {
            toastError('Error al actualizar ingreso');
          }
        } else if (editingIncome.type === 'expense') {
          const result = await updateExpense(editingIncome.id, data);
          if (result.success) {
            toastSuccess('Gasto actualizado', data.name);
          } else {
            toastError('Error al actualizar gasto');
          }
        } else if (editingIncome.type === 'goal') {
          const result = await updateGoal(editingIncome.id, data);
          if (result.success) {
            toastSuccess('Meta actualizada', data.name);
          } else {
            toastError('Error al actualizar meta');
          }
        } else if (editingIncome.type === 'debt') {
          const extendedData = data as ExtendedTransactionData;
          const totalInstallments = extendedData.totalInstallmentsDebt ? parseInt(String(extendedData.totalInstallmentsDebt)) : undefined;
          const remainingInstallments = extendedData.remainingInstallmentsDebt ? parseInt(String(extendedData.remainingInstallmentsDebt)) : undefined;
          // Si hay cuotas configuradas, siempre guardar el método de pago (incluso si es 'manual')
          const paymentMethod = (totalInstallments || remainingInstallments)
            ? (extendedData.paymentMethodDebt || 'manual')
            : undefined;

          const debtData = {
            ...data,
            dueDate: data.dueDate || data.date,
            totalInstallments,
            remainingInstallments,
            paymentMethod,
          };
          await updateDebt(editingIncome.id, debtData);
          toastSuccess('Deuda actualizada', data.name);
        }
      } catch (error) {
        console.error('❌ Error actualizando transacción:', error);
        toastError('Error al guardar los cambios');
      }
      return;
    }
    
    switch (transactionType) {
      case 'debt':
        // Asegurar que dueDate esté presente para deudas
        const extendedData = data as ExtendedTransactionData;
        const totalInstallments = extendedData.totalInstallmentsDebt ? parseInt(String(extendedData.totalInstallmentsDebt)) : undefined;
        const remainingInstallments = extendedData.remainingInstallmentsDebt ? parseInt(String(extendedData.remainingInstallmentsDebt)) : undefined;
        // Si hay cuotas configuradas, siempre guardar el método de pago (incluso si es 'manual')
        const paymentMethod = (totalInstallments || remainingInstallments) 
          ? (extendedData.paymentMethodDebt || 'manual')
          : undefined;
        
        const debtData = {
          ...data,
          dueDate: data.dueDate || data.date,
          totalInstallments,
          remainingInstallments,
          paymentMethod,
          status: data.status || 'active',
        }

        try {
          await createDebt(debtData);
          toastSuccess('Deuda creada', data.name);
        } catch (error) {
          console.error('❌ Error creando deuda:', error);
          toastError('Error al crear la deuda');
        }
        break
      case 'expense':
        try {
          const result = await createExpense(data);
          if (result.success) {
            toastSuccess('Gasto registrado', data.name);
          } else {
            toastError('Error al registrar gasto');
          }
        } catch (error) {
          console.error('❌ Error creando gasto:', error);
          toastError('Error al registrar gasto');
        }
        break
      case 'income':
        try {
          const result = await createIncome(data);
          if (result.success) {
            toastSuccess('Ingreso registrado', data.name);
          } else {
            toastError('Error al registrar ingreso');
          }
        } catch (error) {
          console.error('❌ Error creando ingreso:', error);
          toastError('Error al registrar ingreso');
        }
        break
      case 'goal':
        try {
          const result = await createGoal({ ...data, currentAmount: data.currentAmount ?? 0, targetDate: data.targetDate ?? '' });
          if (result.success) {
            toastSuccess('Meta creada', data.name);
          } else {
            toastError('Error al crear meta');
          }
        } catch (error) {
          console.error('❌ Error creando meta:', error);
          toastError('Error al crear meta');
        }
        break
    }
  }, [editingIncome, transactionType, updateIncome, updateExpense, updateGoal, updateDebt, createDebt, createExpense, createIncome, createGoal, toastSuccess, toastError])

  // Estado de carga optimizado
  const { shouldShowSkeleton } = useLoadingState({
    debtsLoading,
    incomesLoading,
    expensesLoading,
    goalsLoading,
    sessionStatus: status
  })

  const filteredIncomes = useMemo(() =>
    dateFilter === 'current-month'
      ? incomes.filter(income => {
          const d = new Date(income.date + 'T00:00:00')
          return d >= currentMonthRange.startDate && d <= currentMonthRange.endDate
        })
      : incomes,
  [incomes, dateFilter, currentMonthRange])

  const filteredExpenses = useMemo(() =>
    dateFilter === 'current-month'
      ? expenses.filter(expense => {
          const d = new Date(expense.date + 'T00:00:00')
          return d >= currentMonthRange.startDate && d <= currentMonthRange.endDate
        })
      : expenses,
  [expenses, dateFilter, currentMonthRange])

  const sharedExpensesMap = useMemo(() => {
    const map = new Map<string, SharedExpense>()
    sharedExpenses.forEach(se => {
      const expenseId = typeof se === 'object' && se !== null && 'expenseId' in se ? String(se.expenseId) : ''
      const status = typeof se === 'object' && se !== null && 'status' in se ? String(se.status) : ''
      if (expenseId && status === 'accepted') {
        map.set(expenseId, se as unknown as SharedExpense)
      }
    })
    return map
  }, [sharedExpenses])

  const displayStats = useMemo(() => {
    const userId = session?.user?.id

    const totalIncomes = filteredIncomes.reduce((sum, income) => sum + income.amount, 0)

    const calcExpenseAmount = (expense: Expense) => {
      const se = sharedExpensesMap.get(expense.id)
      if (se) {
        if (se.ownerUserId === userId) return typeof se.ownerAmount === 'number' ? se.ownerAmount : 0
        if (se.sharedWithUserId === userId) return typeof se.partnerAmount === 'number' ? se.partnerAmount : 0
      }
      return expense.amount
    }

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + calcExpenseAmount(e), 0)
    const totalFixedExpenses = filteredExpenses
      .filter(e => e.expenseType === 'fixed')
      .reduce((sum, e) => sum + calcExpenseAmount(e), 0)
    const totalVariableExpenses = filteredExpenses
      .filter(e => e.expenseType === 'variable')
      .reduce((sum, e) => sum + calcExpenseAmount(e), 0)

    const netBalance = totalIncomes - totalExpenses
    const completedGoals = goals.filter(g => (g.currentAmount || 0) >= g.amount).length
    const totalGoals = goals.length
    const totalGoalValue = goals.reduce((sum, g) => sum + g.amount, 0)
    const totalCurrentValue = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0)
    const goalsProgress = totalGoalValue > 0 ? (totalCurrentValue / totalGoalValue) * 100 : 0
    const averageProgress = totalGoals > 0
      ? goals.reduce((sum, g) => sum + Math.min((g.currentAmount || 0) / g.amount * 100, 100), 0) / totalGoals
      : 0

    return {
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
      totalBalance: stats?.totalBalance || 0,
      totalPaid: stats?.totalPaid || 0,
      progress: stats?.progress || 0,
      monthlyMinPayment: stats?.monthlyMinPayment || 0,
    }
  }, [filteredIncomes, filteredExpenses, sharedExpensesMap, goals, stats, session?.user?.id])

  const allMovements = useMemo(() => {
    let list: TransactionWithType[] = [
      ...debts.map((debt: Debt) => ({ ...debt, type: 'debt' } as TransactionWithType)),
      ...incomes.map((income: Income) => ({ ...income, type: 'income' } as TransactionWithType)),
      ...expenses.map((expense: Expense) => ({ ...expense, type: 'expense' } as TransactionWithType)),
      ...goals.map((goal: Goal) => ({ ...goal, type: 'goal' } as TransactionWithType)),
    ]

    if (filterType !== 'all') {
      list = list.filter(t => t.type === filterType)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      list = list.filter(t => {
        const name = String(t.name || '').toLowerCase()
        const category = String(t.category || '').toLowerCase()
        const notes = String(t.notes || '').toLowerCase()
        return name.includes(query) || category.includes(query) || notes.includes(query)
      })
    }

    // Filtrar por fecha: aplica a gastos e ingresos; deudas y metas se muestran siempre
    if (dateFilter === 'current-month') {
      list = list.filter(t => {
        if (t.type === 'expense' || t.type === 'income') {
          const dateStr = String(t.date || '')
          if (!dateStr) return false
          const transactionDate = new Date(dateStr + 'T00:00:00')
          return transactionDate >= currentMonthRange.startDate && transactionDate <= currentMonthRange.endDate
        }
        return true
      })
    }

    list.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.date || a.createdAt || '').getTime()
        const dateB = new Date(b.date || b.createdAt || '').getTime()
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
      } else if (sortBy === 'amount') {
        return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount
      } else {
        return sortOrder === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
      }
    })

    return list
  }, [debts, incomes, expenses, goals, filterType, searchQuery, dateFilter, currentMonthRange, sortBy, sortOrder])

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
      <PullToRefresh {...pullToRefresh} />
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
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
              <div className="hidden md:block">
                <NotificationBell />
              </div>

              {/* Botón de Presupuesto - Solo Desktop */}
              <div className="relative dropdown-container hidden md:block">
                <button
                  onClick={() => {
                    setShowFixedExpensesTable(true)
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  title="Presupuesto"
                >
                  <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>Presupuesto</span>
                </button>
              </div>

              {/* Dropdown de Tarjetas de Crédito - Solo Desktop */}
              <div className="relative dropdown-container hidden md:block">
                <button
                  onClick={() => {
                    setShowCreditCardDropdown(!showCreditCardDropdown)
                    // Cerrar otros dropdowns
                    setShowAnalysisDropdown(false)
                    setShowToolsDropdown(false)
                  }}
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
                  onClick={() => {
                    setShowAnalysisDropdown(!showAnalysisDropdown)
                    // Cerrar otros dropdowns
                    setShowCreditCardDropdown(false)
                    setShowToolsDropdown(false)
                  }}
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
                  onClick={() => {
                    setShowToolsDropdown(!showToolsDropdown)
                    // Cerrar otros dropdowns
                    setShowCreditCardDropdown(false)
                    setShowAnalysisDropdown(false)
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  title="Herramientas"
                >
                  <Bolt className="w-5 h-5 text-gray-600 dark:text-gray-400" />
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

              <div className="hidden md:flex items-center gap-3">
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

              </div>
              {/* Botón de refresh — solo mobile */}
              <div className="md:hidden">
                <button
                  onClick={refreshAll}
                  disabled={pullToRefresh.isRefreshing}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
                  title="Actualizar datos"
                  aria-label="Actualizar datos"
                >
                  <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${pullToRefresh.isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-4 lg:px-6 py-6 pb-28 md:pb-6">
        <div className="space-y-6">
          {/* Filtro Global del Dashboard */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 shadow-sm border border-gray-200/50 dark:border-gray-700"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Filtro Global
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Aplica a todo el dashboard
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="global-date-filter" className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Período:
                </label>
                <select
                  id="global-date-filter"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'current-month' | 'all')}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white cursor-pointer text-sm font-medium"
                  aria-label="Filtrar por período"
                >
                  <option value="current-month">
                    {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).charAt(0).toUpperCase() +
                     new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).slice(1)}
                  </option>
                  <option value="all">Todos los períodos</option>
                </select>
              </div>
            </div>
          </motion.div>

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
                        className="text-3xl font-bold text-green-500 dark:text-green-400 mb-1"
                      >
+{formatCurrency(displayStats.totalIncomes)}
                      </motion.p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {filteredIncomes.length} {filteredIncomes.length === 1 ? 'ingreso' : 'ingresos'} {dateFilter === 'current-month' ? 'este mes' : 'total'}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-7 h-7 text-green-500 dark:text-green-400" />
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
                    className="text-3xl font-bold text-red-500 dark:text-red-400 mb-1"
                  >
-{formatCurrency(displayStats.totalExpenses)}
                  </motion.p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                    {filteredExpenses.length} {filteredExpenses.length === 1 ? 'gasto' : 'gastos'} {dateFilter === 'current-month' ? 'este mes' : 'total'}
                  </p>
                  {(displayStats.totalFixedExpenses > 0 || displayStats.totalVariableExpenses > 0) && (
                    <motion.button
                      whileHover={{ x: 2 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowExpenseBreakdown(true)
                      }}
                      className="inline-flex items-center gap-1 px-1 -mx-1 py-1 text-xs font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer"
                    >
                      Ver detalle
                      <ChevronRight className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </div>
                <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <Target className="w-7 h-7 text-red-500 dark:text-red-400" />
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
                    className={`text-3xl font-bold mb-1 ${displayStats.netBalance >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                  >
                    {displayStats.netBalance >= 0 ? '+' : ''}{formatCurrency(displayStats.netBalance)}
                  </motion.p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {dateFilter === 'current-month' ? 'este mes' : 'total'} · {displayStats.netBalance >= 0 ? 'positivo' : 'negativo'}
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${displayStats.netBalance >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <DollarSign className={`w-7 h-7 ${displayStats.netBalance >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`} />
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
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Metas de Ahorro</p>
                    <span className="text-xs text-gray-400 dark:text-gray-500">· total</span>
                  </div>
                  <motion.p
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                    className="text-3xl font-bold text-purple-500 dark:text-purple-400 mb-1"
                  >
                    {displayStats.goalsProgress.toFixed(1)}%
                  </motion.p>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {displayStats.completedGoals} de {displayStats.totalGoals} completadas
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {formatCurrency(displayStats.totalCurrentValue)} / {formatCurrency(displayStats.totalGoalValue)}
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
                      whileHover={{ x: 2 }}
                      onClick={() => {
                        setShowGoalsBreakdown(true)
                      }}
                      className="inline-flex items-center gap-1 px-1 -mx-1 py-1 mt-3 text-xs font-medium text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      Ver detalle
                      <ChevronRight className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </div>
                <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-purple-500 dark:text-purple-400" />
                </div>
              </div>
            </motion.div>
              </>
            )}
          </div>

          {/* Banner de deudas vencidas */}
          {!shouldShowSkeleton && debts.filter((d: Debt) => d.status === 'overdue').length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
            >
              <span className="text-red-500 text-lg">⚠️</span>
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                Tenés {debts.filter((d: Debt) => d.status === 'overdue').length} deuda{debts.filter((d: Debt) => d.status === 'overdue').length !== 1 ? 's' : ''} vencida{debts.filter((d: Debt) => d.status === 'overdue').length !== 1 ? 's' : ''}.
              </p>
              <button
                onClick={() => { setFilterType('debt'); setDateFilter('all'); }}
                className="ml-auto text-xs text-red-600 dark:text-red-400 underline cursor-pointer"
              >
                Ver deudas
              </button>
            </motion.div>
          )}

          {/* Analytics Section */}
          <DashboardAnalytics
            shouldShowSkeleton={shouldShowSkeleton}
            displayStats={displayStats}
            filteredIncomes={filteredIncomes}
            filteredExpenses={filteredExpenses}
            dateFilter={dateFilter}
            sharedExpensesMap={sharedExpensesMap}
            currentUserId={session?.user?.id}
            formatCurrency={formatCurrency}
            headerAction={
              !shouldShowSkeleton ? (
                <QuickExport
                  data={{
                    incomes,
                    expenses,
                    debts,
                    goals,
                    stats: displayStats
                  }}
                />
              ) : undefined
            }
          />

          {/* Sección de Gastos Compartidos (Acordeón) */}
          {session?.user?.id && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50 dark:border-gray-700"
            >
              <button
                onClick={() => setIsSharedExpensesExpanded(!isSharedExpensesExpanded)}
                className="w-full flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Gastos Compartidos
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Gestiona tus gastos compartidos con otros usuarios
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSharedExpensesExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
              </button>
              
              <AnimatePresence>
                {isSharedExpensesExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <SharedExpensesSection
                      currentUserId={session.user.id}
                      formatCurrency={formatCurrency}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Sección de Presupuesto */}
          <DashboardBudget
            fixedExpensesLoading={fixedExpensesLoading}
            budgetMonthOffset={budgetMonthOffset}
            setBudgetMonthOffset={setBudgetMonthOffset}
            fixedExpenses={fixedExpenses}
            totalFixedAmount={totalFixedAmount}
            totalFixedPaid={totalFixedPaid}
            setShowFixedExpensesTable={setShowFixedExpensesTable}
            formatCurrency={formatCurrency}
          />

          {/* Lista de Deudas */}
          <motion.div
            id="transaction-list"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-xl border border-gray-200/50"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Movimientos
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {shouldShowSkeleton ? (
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-20 rounded"></div>
                ) : (
                  `${allMovements.length} ${allMovements.length === 1 ? 'movimiento' : 'movimientos'}`
                )}
              </div>
            </div>

            {/* Filtros y Búsqueda */}
            <div className="space-y-3 mb-4">
              {/* Barra de búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, categoría o notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filtros por tipo */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setFilterType('all')}
                  className={`shrink-0 px-4 py-2 rounded-xl transition-colors cursor-pointer text-sm font-medium ${
                    filterType === 'all'
                      ? 'bg-[#FF3A5F] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors cursor-pointer text-sm font-medium ${
                    filterType === 'income'
                      ? 'bg-[#FF3A5F] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Ingresos
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors cursor-pointer text-sm font-medium ${
                    filterType === 'expense'
                      ? 'bg-[#FF3A5F] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  Gastos
                </button>
                <button
                  onClick={() => setFilterType('goal')}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors cursor-pointer text-sm font-medium ${
                    filterType === 'goal'
                      ? 'bg-[#FF3A5F] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  Metas
                </button>
                <button
                  onClick={() => setFilterType('debt')}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors cursor-pointer text-sm font-medium ${
                    filterType === 'debt'
                      ? 'bg-[#FF3A5F] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Deudas
                </button>
              </div>

              {/* Barra secundaria: período, orden y exportación */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Período:</span>
                  {dateFilter === 'current-month' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#FF3A5F]/10 text-[#FF3A5F] font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      Mes actual
                      <button onClick={() => setDateFilter('all')} className="hover:opacity-70 cursor-pointer leading-none" aria-label="Quitar filtro de mes actual">×</button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      Todos los períodos
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">Ordenar:</span>
                  <label htmlFor="sort-select" className="sr-only">
                    Ordenar movimientos
                  </label>
                  <select
                    id="sort-select"
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [newSortBy, newSortOrder] = e.target.value.split('-') as ['date' | 'amount' | 'name', 'asc' | 'desc'];
                      setSortBy(newSortBy);
                      setSortOrder(newSortOrder);
                    }}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white cursor-pointer text-sm"
                    aria-label="Ordenar movimientos"
                  >
                    <option value="date-desc">Más recientes</option>
                    <option value="date-asc">Más antiguos</option>
                    <option value="amount-desc">Monto: mayor a menor</option>
                    <option value="amount-asc">Monto: menor a mayor</option>
                    <option value="name-asc">Nombre: A-Z</option>
                    <option value="name-desc">Nombre: Z-A</option>
                  </select>
                  {!shouldShowSkeleton && (
                    <QuickExport data={{ incomes, expenses, debts, goals, stats: displayStats }} />
                  )}
                </div>
              </div>
            </div>

            {debts.length + incomes.length + expenses.length + goals.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-10 h-10 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No tienes movimientos registrados
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Usa el botón + para agregar deudas, gastos, ingresos o metas de ahorro.
                </p>
                <div className="text-center text-gray-400">
                  <p className="text-sm">Mira el botón flotante en la esquina inferior derecha</p>
                </div>
              </div>
            ) : shouldShowSkeleton ? (
              <SkeletonTable />
            ) : allMovements.length === 0 ? (
              (() => {
                const hasActiveFilters = filterType !== 'all' || searchQuery || dateFilter === 'current-month';
                return (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                      Sin resultados
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {searchQuery
                        ? `No se encontraron movimientos para "${searchQuery}"`
                        : dateFilter === 'current-month'
                          ? 'No hay gastos registrados en el mes actual'
                          : 'No hay movimientos de ese tipo'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterType('all');
                          setDateFilter('all');
                        }}
                        className="text-sm text-[#FF3A5F] hover:underline cursor-pointer"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="space-y-2">
                {allMovements.map((transaction) => {
                  const isOverdueDebt = transaction.type === 'debt' && (transaction as unknown as Debt).status === 'overdue';
                  const isPaidDebt = transaction.type === 'debt' && (transaction as unknown as Debt).status === 'paid';

                  const TransactionIcon = (() => {
                    if (transaction.type === 'debt') {
                      switch ((transaction as unknown as Debt).debtType) {
                        case 'prestamo': return Landmark;
                        case 'credito': return Calculator;
                        case 'tarjeta': return CreditCard;
                        default: return CreditCard;
                      }
                    }
                    switch (transaction.type) {
                      case 'income': return TrendingUp;
                      case 'expense': return Target;
                      case 'goal': return Trophy;
                      default: return Wallet;
                    }
                  })();

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
                    if (transaction.type === 'debt') {
                      switch ((transaction as unknown as Debt).debtType) {
                        case 'prestamo': return 'Préstamo';
                        case 'tarjeta': return 'Tarjeta de crédito';
                        case 'credito': return 'Línea de crédito';
                        default: return 'Deuda';
                      }
                    }
                    switch (transaction.type) {
                      case 'income': return 'Ingreso';
                      case 'expense': return 'Gasto';
                      case 'goal': return 'Meta';
                      default: return 'Transacción';
                    }
                  };

                  const dateLabel = (() => {
                    const dateToShow = transaction.type === 'debt'
                      ? (String((transaction as unknown as Debt).dueDate || transaction.createdAt || transaction.date || ''))
                      : String(transaction.date || '');
                    if (!dateToShow) return 'Sin fecha';
                    let formatted: string;
                    if (dateToShow.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      const [year, month, day] = dateToShow.split('-').map(Number);
                      formatted = new Date(year, month - 1, day).toLocaleDateString('es-AR');
                    } else {
                      const dateObj = new Date(dateToShow);
                      formatted = isNaN(dateObj.getTime()) ? 'Fecha inválida' : dateObj.toLocaleDateString('es-AR');
                    }
                    return transaction.type === 'debt' ? `Vence: ${formatted}` : formatted;
                  })();

                  const notesText = typeof transaction.notes === 'string' ? transaction.notes.trim() : '';
                  const showNotes = notesText !== '' && notesText !== 'false' && !notesText.includes('seed-mock-data');
                  const displayColor = isPaidDebt ? 'text-green-400 dark:text-green-300' : getTransactionColor();

                  return (
                    <motion.div
                      key={`${transaction.type}-${transaction.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className={`border rounded-lg p-3 hover:shadow-md transition-all duration-300 group cursor-pointer ${
                        isOverdueDebt
                          ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-900/10'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setShowDetailModal(true);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <TransactionIcon className={`w-5 h-5 mt-0.5 shrink-0 ${displayColor}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {transaction.name}
                              </h4>
                              <span className={`text-[11px] leading-none px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 ${displayColor}`}>
                                {getTransactionLabel()}
                              </span>
                              {isOverdueDebt && (
                                <span className="text-[11px] leading-none px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-medium">
                                  Vencida
                                </span>
                              )}
                              {isPaidDebt && (
                                <span className="text-[11px] leading-none px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-medium">
                                  Pagada
                                </span>
                              )}
                            </div>
                            {showNotes && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                {notesText}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-base font-bold ${displayColor}`}>
                            {isPaidDebt ? '' : transaction.type === 'debt' ? '-' : transaction.type === 'expense' ? '-' : '+'}{formatCurrency(typeof transaction.amount === 'number' ? transaction.amount : 0)}
                          </div>
                          <div className={`text-xs mt-0.5 ${isOverdueDebt ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                            {dateLabel}
                          </div>
                        </div>
                      </div>

                      {transaction.type === 'debt' && typeof transaction.amount === 'number' && typeof transaction.balance === 'number' && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Progreso de pago</span>
                            <span>{((transaction.amount - transaction.balance) / transaction.amount * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                            <div
                              className="bg-blue-400 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${((transaction.amount - transaction.balance) / transaction.amount * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {transaction.type === 'goal' && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Progreso de meta</span>
                            <span>{((transaction.currentAmount || 0) / transaction.amount * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                            <div
                              className="bg-purple-400 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${((transaction.currentAmount || 0) / transaction.amount * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {transaction.type === 'expense' && (transaction as unknown as Expense).expenseType === 'installments' && typeof (transaction as unknown as Expense).totalInstallments === 'number' && (transaction as unknown as Expense).totalInstallments! > 0 && (() => {
                        const exp = transaction as unknown as Expense;
                        const current = exp.currentInstallment || 1;
                        const total = exp.totalInstallments!;
                        const done = current > total;
                        const pct = Math.min((current - 1) / total * 100, 100);
                        return (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Cuota {Math.min(current, total)}/{total}
                              </span>
                              {done ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Pagado
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openConfirmModal(
                                      `¿Marcar cuota ${current}/${total} como pagada?`,
                                      'Esta acción no se puede deshacer fácilmente.',
                                      () => {
                                        updateExpense(exp.id, { currentInstallment: current + 1 });
                                        toastSuccess(`Cuota ${current}/${total} marcada como pagada`);
                                      }
                                    );
                                  }}
                                  className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 font-medium cursor-pointer"
                                >
                                  + Pagar cuota {current}
                                </button>
                              )}
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full transition-all duration-300 ${done ? 'bg-green-400' : 'bg-orange-400'}`}
                                style={{ width: `${done ? 100 : pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Botón Flotante Mejorado */}
      {/* FAB: only on desktop — mobile uses BottomNavBar center button */}
      <div className="hidden md:block">
        <FloatingActionButton onAction={handleTransactionAction} />
      </div>

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
        categories={categories}
        subcategories={subcategories}
      />

      {/* Modal de Detalles de Transacción */}
      <TransactionDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        subcategories={subcategories}
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
            const hasPayments = debtPayments.some(p => p.debtId === selectedTransaction.id);
            const openDebtEdit = () => {
              setEditingIncome(selectedTransaction);
              setTransactionType('debt');
              setShowDetailModal(false);
              setShowTransactionModal(true);
            };
            if (hasPayments) {
              openConfirmModal(
                'Esta deuda tiene pagos registrados',
                'Si modificás el monto original, el porcentaje de progreso cambiará. ¿Querés continuar?',
                openDebtEdit
              );
            } else {
              openDebtEdit();
            }
          }
        }}
        onAddPayment={() => {
          if (selectedTransaction?.type === 'debt') {
            setSelectedDebt(selectedTransaction as unknown as Debt);
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
                toastSuccess('Ingreso eliminado');
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
                toastSuccess('Gasto eliminado');
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
                toastSuccess('Meta eliminada');
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
                toastSuccess('Deuda eliminada');
              }
            );
          }
        }}
        onShare={() => {
          if (selectedTransaction?.type === 'expense') {
            setSelectedExpenseForShare(selectedTransaction as unknown as Expense);
            setShowDetailModal(false);
            setShowShareExpenseModal(true);
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
            onClick={() => {
              setShowExpenseBreakdown(false);
              setExpenseBreakdownView('summary');
            }}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expenseBreakdownView !== 'summary' && (
                    <button
                      onClick={() => setExpenseBreakdownView('summary')}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <ArrowUpDown className="w-5 h-5 text-gray-600 dark:text-gray-400 rotate-90" />
                    </button>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {expenseBreakdownView === 'fixed' ? 'Gastos Fijos' :
                     expenseBreakdownView === 'variable' ? 'Gastos Variables' :
                     'Desglose de Gastos'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowExpenseBreakdown(false);
                    setExpenseBreakdownView('summary');
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {expenseBreakdownView === 'summary' ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setExpenseBreakdownView('fixed')}
                    className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Gastos Fijos</p>
                      <p className="text-2xl font-bold text-red-400 dark:text-red-300">
-{formatCurrency(displayStats.totalFixedExpenses)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {expenses.filter((e: Expense) => e.expenseType === 'fixed').length} gastos fijos
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-red-200 rounded-xl flex items-center justify-center">
                      <Target className="w-6 h-6 text-red-400" />
                    </div>
                  </button>

                  <button
                    onClick={() => setExpenseBreakdownView('variable')}
                    className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Gastos Variables</p>
                      <p className="text-2xl font-bold text-purple-400 dark:text-purple-300">
-{formatCurrency(displayStats.totalVariableExpenses)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {expenses.filter((e: Expense) => e.expenseType === 'variable').length} gastos variables
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-200 rounded-xl flex items-center justify-center">
                      <Target className="w-6 h-6 text-purple-400" />
                    </div>
                  </button>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
{formatCurrency(displayStats.totalExpenses)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const filteredExpenses = expenses.filter((e: Expense) => 
                      expenseBreakdownView === 'fixed' ? e.expenseType === 'fixed' : e.expenseType === 'variable'
                    );

                    if (filteredExpenses.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Target className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                          <p>No tienes {expenseBreakdownView === 'fixed' ? 'gastos fijos' : 'gastos variables'}</p>
                        </div>
                      );
                    }

                    return filteredExpenses.map((expense: Expense, index: number) => {
                      const sharedExpense = sharedExpensesMap.get(expense.id);
                      let displayAmount = expense.amount;
                      
                      if (sharedExpense) {
                        if (sharedExpense.ownerUserId === session?.user?.id) {
                          displayAmount = typeof sharedExpense.ownerAmount === 'number' ? sharedExpense.ownerAmount : 0;
                        } else if (sharedExpense.sharedWithUserId === session?.user?.id) {
                          displayAmount = typeof sharedExpense.partnerAmount === 'number' ? sharedExpense.partnerAmount : 0;
                        }
                      }

                      return (
                        <motion.div
                          key={expense.id || index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          onClick={() => {
                            setSelectedTransaction({ ...expense, type: 'expense' });
                            setShowDetailModal(true);
                            setShowExpenseBreakdown(false);
                            setExpenseBreakdownView('summary');
                          }}
                          className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer ${
                            expenseBreakdownView === 'fixed'
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                {expense.name}
                              </h4>
                              {expense.category && (
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                  {expense.category}
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${
                                expenseBreakdownView === 'fixed'
                                  ? 'text-red-400 dark:text-red-300'
                                  : 'text-purple-400 dark:text-purple-300'
                              }`}>
                                -{formatCurrency(displayAmount)}
                              </div>
                              {sharedExpense && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Compartido
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {(() => {
                              if (!expense.date) return 'Sin fecha';
                              // Si la fecha viene en formato YYYY-MM-DD, parsearla manualmente para evitar problemas de UTC
                              if (expense.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                const [year, month, day] = expense.date.split('-').map(Number);
                                const dateObj = new Date(year, month - 1, day);
                                return dateObj.toLocaleDateString('es-AR');
                              }
                              // Para otros formatos, intentar parsear normalmente
                              const dateObj = new Date(expense.date);
                              if (isNaN(dateObj.getTime())) return 'Fecha inválida';
                              return dateObj.toLocaleDateString('es-AR');
                            })()}
                          </div>
                          {(() => {
                            const notes = (expense as Expense & { notes?: string }).notes;
                            return notes && typeof notes === 'string' && notes.trim() !== '' && notes !== 'false' ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                                {notes}
                              </p>
                            ) : null;
                          })()}
                        </motion.div>
                      );
                    });
                  })()}
                </div>
              )}
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
                      {goals.filter((g: Goal) => (g.currentAmount || 0) >= g.amount).length} metas alcanzadas
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
                      {goals.filter((g: Goal) => (g.currentAmount || 0) < g.amount).length} metas pendientes
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
                      {formatCurrency(displayStats.totalCurrentValue)} / {formatCurrency(displayStats.totalGoalValue)}
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
                  goals.map((goal: Goal, index: number) => {
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
                                {formatCurrency(goal.amount)}
                              </div>
                            </div>
                            <div className="bg-white/50 dark:bg-gray-600/50 rounded-lg p-2">
                              <div className="text-gray-500 dark:text-gray-400 text-xs">Ahorrado</div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(goal.currentAmount || 0)}
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
                                {isCompleted ? '¡Listo!' : formatCurrency(remaining)}
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
                        
                        {/* Botón agregar ahorro */}
                        {!isCompleted && (
                          <div className="mt-3">
                            {addingToGoalId === goal.id ? (
                              <div className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  min="0"
                                  autoFocus
                                  value={goalAddInput}
                                  onChange={(e) => setGoalAddInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      setAddingToGoalId(null);
                                      setGoalAddInput('');
                                    }
                                    if (e.key === 'Enter') {
                                      const added = parseFloat(goalAddInput);
                                      if (!isNaN(added) && added > 0) {
                                        updateGoal(goal.id, { currentAmount: (goal.currentAmount || 0) + added });
                                        toastSuccess('Progreso actualizado', goal.name);
                                      }
                                      setAddingToGoalId(null);
                                      setGoalAddInput('');
                                    }
                                  }}
                                  className="flex-1 px-3 py-1.5 text-sm border border-purple-300 dark:border-purple-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                  placeholder="Monto a agregar..."
                                />
                                <button
                                  onClick={() => {
                                    const added = parseFloat(goalAddInput);
                                    if (!isNaN(added) && added > 0) {
                                      updateGoal(goal.id, { currentAmount: (goal.currentAmount || 0) + added });
                                      toastSuccess('Progreso actualizado', goal.name);
                                    }
                                    setAddingToGoalId(null);
                                    setGoalAddInput('');
                                  }}
                                  className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors cursor-pointer"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => { setAddingToGoalId(null); setGoalAddInput(''); }}
                                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddingToGoalId(goal.id); setGoalAddInput(''); }}
                                className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium cursor-pointer flex items-center gap-1"
                              >
                                + Agregar ahorro
                              </button>
                            )}
                          </div>
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

      {/* Modal de Gastos Fijos */}
      {showFixedExpensesTable && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowFixedExpensesTable(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                {budgetMonthOffset === 0 
                  ? (() => {
                      const now = new Date();
                      const monthNames = [
                        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                      ];
                      const month = monthNames[now.getMonth()];
                      const year = now.getFullYear();
                      return `Presupuesto ${month} ${year}`;
                    })()
                  : (() => {
                      const nextMonth = new Date();
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      const monthNames = [
                        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                      ];
                      const month = monthNames[nextMonth.getMonth()];
                      const year = nextMonth.getFullYear();
                      return `Presupuesto ${month} ${year}`;
                    })()}
              </h2>
              <button
                onClick={() => setShowFixedExpensesTable(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <FixedExpensesTable
                fixedExpenses={fixedExpenses}
                loading={fixedExpensesLoading}
                totalAmount={totalFixedAmount}
                totalPaid={totalFixedPaid}
                formatCurrency={formatCurrency}
                onItemClick={() => {
                  // Aquí puedes agregar lógica para abrir el detalle del item
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}

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
        cards={creditCards || []}
        loading={cardsLoading}
        onCreateCard={() => {
          setShowCreditCardProjectionModal(false)
          setShowCreditCardModal(true)
        }}
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
            // Recargar pagos para actualizar el presupuesto
            const debtPaymentsResponse = await fetch('/api/payments');
            if (debtPaymentsResponse.ok) {
              const debtPaymentsData = await debtPaymentsResponse.json();
              setDebtPayments(debtPaymentsData.payments || []);
            }
          }
        }}
        debt={selectedDebt}
        loading={debtsLoading}
      />

      {/* More sheet — slides up from bottom nav */}
      <AnimatePresence>
        {showBottomNav && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setShowBottomNav(false)}
            />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed left-0 right-0 z-50 md:hidden rounded-t-3xl overflow-hidden shadow-2xl"
            style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-4 py-3">
                {/* User + Quick actions */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden">
                      {session?.user?.image ? (
                        <Image src={session.user.image} alt={session.user.name || 'Usuario'} width={32} height={32} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] flex items-center justify-center text-white font-semibold text-sm">
                          {session?.user?.name?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {session?.user?.name || session?.user?.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <button
                      onClick={() => {
                        setShowLogoutModal(true)
                        setShowBottomNav(false)
                      }}
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                      title="Cerrar sesión"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
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
          </>
        )}
      </AnimatePresence>

      {/* Modal de Compartir Gasto */}
      <ShareExpenseModal
        isOpen={showShareExpenseModal}
        onClose={() => {
          setShowShareExpenseModal(false);
          setSelectedExpenseForShare(null);
        }}
        expense={selectedExpenseForShare}
        onShare={handleShareExpense}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Bottom Navigation Bar — mobile only */}
      <BottomNavBar
        activeFilter={filterType}
        onFilterChange={(f) => {
          setFilterType(f)
          if (f !== 'all') {
            setTimeout(() => {
              document.getElementById('transaction-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 50)
          }
        }}
        onAction={handleTransactionAction}
        onMore={() => setShowBottomNav(!showBottomNav)}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  )
}
