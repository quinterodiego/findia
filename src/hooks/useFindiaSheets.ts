import { useState, useEffect } from 'react'
import findiaSheets from '@/lib/findiaSheets'
import { useAuth } from '@/contexts/AuthContext'

interface DebtData {
  id: string
  userId: string
  name: string
  amount: number
  currentAmount: number
  minimumPayment: number
  interestRate: number
  category: string
  createdAt: string
  updatedAt: string
}

interface PaymentData {
  id: string
  debtId: string
  userId: string
  amount: number
  paymentDate: string
  notes?: string
}

interface UseFindiaSheetsReturn {
  // Estados
  debts: DebtData[]
  payments: PaymentData[]
  isLoading: boolean
  error: string | null
  
  // Acciones
  refreshData: () => Promise<void>
  addDebt: (debt: Omit<DebtData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<boolean>
  updateDebt: (debtId: string, updates: Partial<DebtData>) => Promise<boolean>
  deleteDebt: (debtId: string) => Promise<boolean>
  addPayment: (payment: Omit<PaymentData, 'id' | 'userId'>) => Promise<boolean>
  
  // Estadísticas calculadas
  stats: {
    totalDebt: number
    totalPaid: number
    progressPercentage: number
    monthlyMinimum: number
    estimatedPayoffMonths: number
  }
}

export const useFindiaSheets = (): UseFindiaSheetsReturn => {
  const { user } = useAuth()
  const [debts, setDebts] = useState<DebtData[]>([])
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar datos desde Google Sheets
  const refreshData = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      if (findiaSheets.isConfigured()) {
        // Usar Google Sheets real
        const [debtsData, paymentsData] = await Promise.all([
          findiaSheets.getDebts(user.id),
          findiaSheets.getPayments(user.id)
        ])
        setDebts(debtsData)
        setPayments(paymentsData)
      } else {
        // Usar datos de demo
        const demoData = await findiaSheets.getDemoData(user.id)
        setDebts(demoData.debts)
        setPayments(demoData.payments)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos')
      console.error('Error en useFindiaSheets:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    refreshData()
  }, [user?.id])

  // === ACCIONES DE DEUDAS ===
  const addDebt = async (debtData: Omit<DebtData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
    if (!user) return false

    const newDebt: DebtData = {
      ...debtData,
      id: `debt-${Date.now()}`,
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    try {
      const success = await findiaSheets.saveDebt(newDebt)
      if (success) {
        setDebts(prev => [...prev, newDebt])
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando deuda')
      return false
    }
  }

  const updateDebt = async (debtId: string, updates: Partial<DebtData>): Promise<boolean> => {
    try {
      const success = await findiaSheets.updateDebt(debtId, {
        ...updates,
        updatedAt: new Date().toISOString()
      })
      
      if (success) {
        setDebts(prev => prev.map(debt => 
          debt.id === debtId 
            ? { ...debt, ...updates, updatedAt: new Date().toISOString() }
            : debt
        ))
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando deuda')
      return false
    }
  }

  const deleteDebt = async (debtId: string): Promise<boolean> => {
    try {
      const success = await findiaSheets.deleteDebt(debtId)
      if (success) {
        setDebts(prev => prev.filter(debt => debt.id !== debtId))
        // También eliminar pagos relacionados
        setPayments(prev => prev.filter(payment => payment.debtId !== debtId))
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando deuda')
      return false
    }
  }

  // === ACCIONES DE PAGOS ===
  const addPayment = async (paymentData: Omit<PaymentData, 'id' | 'userId'>): Promise<boolean> => {
    if (!user) return false

    const newPayment: PaymentData = {
      ...paymentData,
      id: `payment-${Date.now()}`,
      userId: user.id
    }

    try {
      const success = await findiaSheets.savePayment(newPayment)
      if (success) {
        setPayments(prev => [...prev, newPayment])
        
        // Actualizar el monto actual de la deuda
        const debt = debts.find(d => d.id === paymentData.debtId)
        if (debt) {
          const newCurrentAmount = Math.max(0, debt.currentAmount - paymentData.amount)
          await updateDebt(debt.id, { currentAmount: newCurrentAmount })
        }
        
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando pago')
      return false
    }
  }

  // === ESTADÍSTICAS CALCULADAS ===
  const stats = {
    totalDebt: debts.reduce((sum, debt) => sum + debt.amount, 0),
    totalPaid: debts.reduce((sum, debt) => sum + (debt.amount - debt.currentAmount), 0),
    progressPercentage: debts.length > 0 
      ? ((debts.reduce((sum, debt) => sum + (debt.amount - debt.currentAmount), 0) / 
         debts.reduce((sum, debt) => sum + debt.amount, 0)) * 100)
      : 0,
    monthlyMinimum: debts.reduce((sum, debt) => sum + debt.minimumPayment, 0),
    estimatedPayoffMonths: debts.length > 0
      ? Math.ceil(debts.reduce((sum, debt) => sum + debt.currentAmount, 0) / 
                  Math.max(1, debts.reduce((sum, debt) => sum + debt.minimumPayment, 0)))
      : 0
  }

  return {
    // Estados
    debts,
    payments,
    isLoading,
    error,
    
    // Acciones
    refreshData,
    addDebt,
    updateDebt,
    deleteDebt,
    addPayment,
    
    // Estadísticas
    stats
  }
}