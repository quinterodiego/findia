import { useState, useEffect, useCallback, useMemo } from 'react'
import { Debt, Payment, UserProfile } from '@/types'
import { FinancialCalculator, StorageUtils, generateId } from '@/lib/utils'

// Hook principal para manejar datos de deudas
export const useDebtManager = () => {
  const [debts, setDebts] = useState<Debt[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [, ] = useState(false) // isLoading temporalmente deshabilitado
  const [error, setError] = useState<string | null>(null)

  // Cargar datos al inicializar (solo localStorage por ahora)
  useEffect(() => {
    const loadLocalData = () => {
      try {
        const localDebts = StorageUtils.loadFromLocalStorage<Debt[]>('findia_debts') || []
        const localPayments = StorageUtils.loadFromLocalStorage<Payment[]>('findia_payments') || []
        
        setDebts(localDebts)
        setPayments(localPayments)
      } catch (err) {
        console.error('Error loading local data:', err)
        setError('Error al cargar datos locales')
      }
    }
    
    loadLocalData()
  }, [])

  const loadData = useCallback(() => {
    try {
      const localDebts = StorageUtils.loadFromLocalStorage<Debt[]>('findia_debts') || []
      const localPayments = StorageUtils.loadFromLocalStorage<Payment[]>('findia_payments') || []
      
      setDebts(localDebts)
      setPayments(localPayments)
    } catch (err) {
      console.error('Error loading local data:', err)
      setError('Error al cargar datos locales')
    }
  }, [])

  // Agregar nueva deuda
  const addDebt = useCallback((debtData: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDebt: Debt = {
      ...debtData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const updatedDebts = [...debts, newDebt]
    setDebts(updatedDebts)
    
    // Guardar localmente
    StorageUtils.saveToLocalStorage('findia_debts', updatedDebts)
    StorageUtils.saveToLocalStorage('findia_last_modification', new Date().toISOString())
    
    return newDebt
  }, [debts])

  // Actualizar deuda existente
  const updateDebt = useCallback((debtId: string, updates: Partial<Debt>) => {
    const updatedDebts = debts.map(debt => 
      debt.id === debtId 
        ? { ...debt, ...updates, updatedAt: new Date().toISOString() }
        : debt
    )
    
    setDebts(updatedDebts)
    StorageUtils.saveToLocalStorage('findia_debts', updatedDebts)
    StorageUtils.saveToLocalStorage('findia_last_modification', new Date().toISOString())
  }, [debts])

  // Eliminar deuda
  const deleteDebt = useCallback((debtId: string) => {
    const updatedDebts = debts.filter(debt => debt.id !== debtId)
    const updatedPayments = payments.filter(payment => payment.debtId !== debtId)
    
    setDebts(updatedDebts)
    setPayments(updatedPayments)
    
    StorageUtils.saveToLocalStorage('findia_debts', updatedDebts)
    StorageUtils.saveToLocalStorage('findia_payments', updatedPayments)
    StorageUtils.saveToLocalStorage('findia_last_modification', new Date().toISOString())
  }, [debts, payments])

  // Registrar pago
  const addPayment = useCallback((paymentData: Omit<Payment, 'id'>) => {
    const newPayment: Payment = {
      ...paymentData,
      id: generateId()
    }
    
    const updatedPayments = [...payments, newPayment]
    setPayments(updatedPayments)
    
    // Si el pago es para una deuda específica, actualizar la deuda
    if (paymentData.debtId) {
      updateDebt(paymentData.debtId, {
        paid: (debts.find(d => d.id === paymentData.debtId)?.paid || 0) + paymentData.amount
      })
    }
    
    StorageUtils.saveToLocalStorage('findia_payments', updatedPayments)
    StorageUtils.saveToLocalStorage('findia_last_modification', new Date().toISOString())
    
    return newPayment
  }, [payments, debts, updateDebt])

  // Sincronizar con Google Sheets (simplificado por ahora)
  const syncData = useCallback(async () => {
    try {
      setError(null)
      // TODO: Implementar sincronización con Google Sheets
      return { success: true, message: 'Sincronización pendiente de implementar' }
    } catch (err) {
      const message = 'Error durante la sincronización'
      setError(message)
      return { success: false, message }
    }
  }, [])

  // Calcular estadísticas
  const stats = useMemo(() => {
    const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0)
    const totalPaid = debts.reduce((sum, debt) => sum + debt.paid, 0)
    
    return FinancialCalculator.calculateProgress(totalDebt, totalPaid)
  }, [debts])

  return {
    // Estado
    debts,
    payments,
    stats,
    isLoading: false,
    error,
    
    // Acciones
    addDebt,
    updateDebt,
    deleteDebt,
    addPayment,
    syncData,
    loadData,
    
    // Estado de sincronización (simplificado)
    syncStatus: { needsSync: false, lastSync: null }
  }
}

// Hook para perfil de usuario
export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  
  useEffect(() => {
    const savedProfile = StorageUtils.loadFromLocalStorage<UserProfile>('findia_profile')
    if (savedProfile) {
      setProfile(savedProfile)
    } else {
      // Crear perfil por defecto
      const defaultProfile: UserProfile = {
        id: generateId(),
        name: 'Usuario',
        totalDebt: 0,
        totalPaid: 0,
        createdAt: new Date().toISOString(),
        preferences: {
          notifications: true,
          celebrationsEnabled: true,
          theme: 'light',
          currency: 'USD'
        }
      }
      setProfile(defaultProfile)
      StorageUtils.saveToLocalStorage('findia_profile', defaultProfile)
    }
  }, [])

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    if (profile) {
      const updatedProfile = { ...profile, ...updates }
      setProfile(updatedProfile)
      StorageUtils.saveToLocalStorage('findia_profile', updatedProfile)
    }
  }, [profile])

  return {
    profile,
    updateProfile
  }
}

// Hook para celebraciones y logros
export const useCelebrations = () => {
  const [unlockedMilestones, setUnlockedMilestones] = useState<number[]>([])
  
  useEffect(() => {
    const saved = StorageUtils.loadFromLocalStorage<number[]>('findia_milestones') || []
    setUnlockedMilestones(saved)
  }, [])

  const unlockMilestone = useCallback((percentage: number) => {
    if (!unlockedMilestones.includes(percentage)) {
      const updated = [...unlockedMilestones, percentage]
      setUnlockedMilestones(updated)
      StorageUtils.saveToLocalStorage('findia_milestones', updated)
      return true // Milestone desbloqueado por primera vez
    }
    return false // Ya estaba desbloqueado
  }, [unlockedMilestones])

  return {
    unlockedMilestones,
    unlockMilestone,
    hasUnlockedMilestone: (percentage: number) => unlockedMilestones.includes(percentage)
  }
}

