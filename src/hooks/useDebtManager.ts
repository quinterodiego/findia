import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import type { Debt, Payment, DebtStats } from '@/types'

interface DashboardData {
  stats: DebtStats
  debts: Debt[]
  payments: Payment[]
  recentPayments: Payment[]
}

interface UseDebtManagerReturn {
  // Data
  debts: Debt[]
  payments: Payment[]
  stats: DebtStats | null
  recentPayments: Payment[]
  
  // Loading states
  loading: boolean
  creating: boolean
  updating: boolean
  paying: boolean
  
  // Error states
  error: string | null
  
  // Methods
  refreshData: () => Promise<void>
  createDebt: (debtData: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<Debt | null>
  updateDebt: (debtId: string, updates: Partial<Debt>) => Promise<Debt | null>
  deleteDebt: (debtId: string) => Promise<boolean>
  makePayment: (debtId: string, amount: number, date: string, notes?: string) => Promise<boolean>
}

export function useDebtManager(): UseDebtManagerReturn {
  const { data: session } = useSession()
  const [debts, setDebts] = useState<Debt[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<DebtStats | null>(null)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshData = async () => {
    if (!session?.user?.email) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data: DashboardData = await response.json()
      setDebts(data.debts)
      setPayments(data.payments)
      setStats(data.stats)
      setRecentPayments(data.recentPayments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createDebt = async (debtData: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Debt | null> => {
    try {
      setCreating(true)
      setError(null)

      const response = await fetch('/api/debts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(debtData),
      })

      if (!response.ok) {
        throw new Error('Failed to create debt')
      }

      const newDebt: Debt = await response.json()
      setDebts(prev => [...prev, newDebt])
      
      // Refresh stats
      await refreshData()
      
      return newDebt
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create debt')
      return null
    } finally {
      setCreating(false)
    }
  }

  const updateDebt = async (debtId: string, updates: Partial<Debt>): Promise<Debt | null> => {
    try {
      setUpdating(true)
      setError(null)

      const response = await fetch(`/api/debts/${debtId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update debt')
      }

      const updatedDebt: Debt = await response.json()
      setDebts(prev => prev.map(debt => debt.id === debtId ? updatedDebt : debt))
      
      // Refresh stats
      await refreshData()
      
      return updatedDebt
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update debt')
      return null
    } finally {
      setUpdating(false)
    }
  }

  const deleteDebt = async (debtId: string): Promise<boolean> => {
    try {
      setUpdating(true)
      setError(null)

      const response = await fetch(`/api/debts/${debtId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete debt')
      }

      setDebts(prev => prev.filter(debt => debt.id !== debtId))
      
      // Refresh stats
      await refreshData()
      
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete debt')
      return false
    } finally {
      setUpdating(false)
    }
  }

  const makePayment = async (debtId: string, amount: number, date: string, notes?: string): Promise<boolean> => {
    try {
      setPaying(true)
      setError(null)

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          debtId,
          amount,
          date,
          notes,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to record payment')
      }

      const { payment, updatedDebt } = await response.json()
      
      // Update local state
      setPayments(prev => [...prev, payment])
      setDebts(prev => prev.map(debt => debt.id === debtId ? updatedDebt : debt))
      
      // Refresh all data
      await refreshData()
      
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment')
      return false
    } finally {
      setPaying(false)
    }
  }

  // Load data when session is available
  useEffect(() => {
    if (session?.user?.email) {
      refreshData()
    }
  }, [session?.user?.email])

  return {
    // Data
    debts,
    payments,
    stats,
    recentPayments,
    
    // Loading states
    loading,
    creating,
    updating,
    paying,
    
    // Error state
    error,
    
    // Methods
    refreshData,
    createDebt,
    updateDebt,
    deleteDebt,
    makePayment,
  }
}