import { create } from 'zustand'
import { Debt, Payment, DebtStats } from '@/types'

interface DebtStore {
  debts: Debt[]
  payments: Payment[]
  stats: DebtStats
  isLoading: boolean
  error: string | null
  
  // Actions
  setDebts: (debts: Debt[]) => void
  addDebt: (debt: Debt) => void
  updateDebt: (debt: Debt) => void
  deleteDebt: (debtId: string) => void
  loadDebts: () => Promise<void>
  
  setPayments: (payments: Payment[]) => void
  addPayment: (payment: Payment) => void
  
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Computed
  calculateStats: () => void
}

export const useDebtStore = create<DebtStore>((set, get) => ({
  debts: [],
  payments: [],
  stats: {
    totalDebt: 0,
    totalPaid: 0,
    progressPercentage: 0,
    monthlyPayment: 0,
    estimatedPayoffDate: '',
    totalDebts: 0,
  },
  isLoading: false,
  error: null,

  setDebts: (debts) => {
    set({ debts })
    get().calculateStats()
  },

  addDebt: (debt) => {
    set((state) => ({ debts: [...state.debts, debt] }))
    get().calculateStats()
  },

  updateDebt: (updatedDebt) => {
    set((state) => ({
      debts: state.debts.map((debt) =>
        debt.id === updatedDebt.id ? updatedDebt : debt
      ),
    }))
    get().calculateStats()
  },

  deleteDebt: (debtId) => {
    set((state) => ({
      debts: state.debts.filter((debt) => debt.id !== debtId),
      payments: state.payments.filter((payment) => payment.debtId !== debtId),
    }))
    get().calculateStats()
  },

  loadDebts: async () => {
    try {
      set({ isLoading: true, error: null })
      const response = await fetch('/api/debts')
      if (response.ok) {
        const debts = await response.json()
        set({ debts })
        get().calculateStats()
      } else {
        set({ error: 'Error loading debts' })
      }
    } catch (error) {
      set({ error: 'Error loading debts' })
      console.error('Error loading debts:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  setPayments: (payments) => set({ payments }),

  addPayment: (payment) => {
    set((state) => ({ payments: [...state.payments, payment] }))
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  calculateStats: () => {
    const { debts } = get()
    
    const totalDebt = debts.reduce((sum, debt) => sum + debt.currentAmount, 0)
    const totalPaid = debts.reduce((sum, debt) => sum + (debt.originalAmount - debt.currentAmount), 0)
    const progressPercentage = (totalDebt + totalPaid) > 0 ? Math.round((totalPaid / (totalDebt + totalPaid)) * 100) : 0
    const monthlyPayment = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0)
    
    // Calculate estimated payoff date
    const remainingDebt = totalDebt
    const monthsToPayoff = monthlyPayment > 0 ? Math.ceil(remainingDebt / monthlyPayment) : 0
    const payoffDate = new Date()
    payoffDate.setMonth(payoffDate.getMonth() + monthsToPayoff)
    
    const estimatedPayoffDate = monthlyPayment > 0 ? 
      payoffDate.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : 
      'N/A'

    set({
      stats: {
        totalDebt,
        totalPaid,
        progressPercentage,
        monthlyPayment,
        estimatedPayoffDate,
        totalDebts: debts.length,
      },
    })
  },
}))

interface UIStore {
  sidebarOpen: boolean
  currentPage: string
  showCelebration: boolean
  celebrationMilestone: number
  
  setSidebarOpen: (open: boolean) => void
  setCurrentPage: (page: string) => void
  setShowCelebration: (show: boolean) => void
  setCelebrationMilestone: (milestone: number) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  currentPage: 'dashboard',
  showCelebration: false,
  celebrationMilestone: 0,
  
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setShowCelebration: (showCelebration) => set({ showCelebration }),
  setCelebrationMilestone: (celebrationMilestone) => set({ celebrationMilestone }),
}))