import { useState, useEffect } from 'react'
import type { Debt } from '@/types'

interface Payment {
  id: string
  debtId: string
  amount: number
  date: string
}

interface CelebrationData {
  milestone: number
  message: string
  achieved: boolean
}

export function useDebtManager() {
  const [debts, setDebts] = useState<Debt[]>([
    {
      id: '1',
      name: 'Tarjeta Visa',
      currentAmount: 5000000,
      originalAmount: 6000000,
      minimumPayment: 300000,
      interestRate: 24.5,
      dueDate: '2024-02-15',
      priority: 'high' as const,
      category: 'Tarjeta de Crédito',
      type: 'credit_card',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'demo'
    },
    {
      id: '2',
      name: 'Préstamo Personal',
      currentAmount: 8000000,
      originalAmount: 10000000,
      minimumPayment: 500000,
      interestRate: 18.2,
      dueDate: '2024-02-20',
      priority: 'medium' as const,
      category: 'Préstamo Personal',
      type: 'loan',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'demo'
    }
  ])

  const [payments, setPayments] = useState<Payment[]>([])
  const [initialTotalDebt] = useState(() => 
    debts.reduce((sum, debt) => sum + debt.currentAmount, 0)
  )

  const addDebt = (debtData: Omit<Debt, 'id'>) => {
    const newDebt: Debt = {
      ...debtData,
      id: Date.now().toString()
    }
    setDebts(prev => [...prev, newDebt])
  }

  const deleteDebt = (id: string) => {
    setDebts(prev => prev.filter(debt => debt.id !== id))
    setPayments(prev => prev.filter(payment => payment.debtId !== id))
  }

  const makePayment = (debtId: string, amount: number) => {
    const payment: Payment = {
      id: Date.now().toString(),
      debtId,
      amount,
      date: new Date().toISOString()
    }

    setPayments(prev => [...prev, payment])
    
    setDebts(prev => prev.map(debt => 
      debt.id === debtId 
        ? { ...debt, currentAmount: Math.max(0, debt.currentAmount - amount) }
        : debt
    ))
  }

  const totalDebt = debts.reduce((sum, debt) => sum + debt.currentAmount, 0)
  const totalMinimumPayment = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0)
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  
  const debtFreeProgress = initialTotalDebt > 0 
    ? Math.min(100, (totalPaid / initialTotalDebt) * 100)
    : 0

  const monthlyPayment = totalMinimumPayment + 200000 // Adding some extra for faster payoff

  return {
    debts,
    payments,
    addDebt,
    deleteDebt,
    makePayment,
    totalDebt,
    totalMinimumPayment,
    totalPaid,
    debtFreeProgress,
    monthlyPayment,
    initialTotalDebt
  }
}

export function useCelebrations() {
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null)

  const triggerCelebration = (milestone: number) => {
    setCelebrationData({
      milestone,
      message: `¡Has alcanzado el ${milestone}% de tu meta!`,
      achieved: true
    })
    setShowCelebration(true)
  }

  const closeCelebration = () => {
    setShowCelebration(false)
    setTimeout(() => setCelebrationData(null), 300)
  }

  // Auto-trigger celebrations based on progress
  useEffect(() => {
    // This would be connected to actual progress tracking
    // For demo purposes, we can trigger celebrations manually
  }, [])

  return {
    showCelebration,
    celebrationData,
    triggerCelebration,
    closeCelebration
  }
}