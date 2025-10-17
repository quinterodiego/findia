import { Debt, ProgressStats, DebtStrategy } from '@/types'

// Utilidades para cálculos financieros
export class FinancialCalculator {
  
  // Calcula el progreso general de pago de deudas
  static calculateProgress(totalDebt: number, totalPaid: number): ProgressStats {
    const remainingDebt = Math.max(0, totalDebt - totalPaid)
    const progressPercentage = totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0
    
    // Estimación simple de meses para completar (asumiendo pago constante)
    const avgMonthlyPayment = totalPaid > 0 ? totalPaid / 12 : 1000 // Valor por defecto
    const estimatedCompletionMonths = avgMonthlyPayment > 0 
      ? Math.ceil(remainingDebt / avgMonthlyPayment) 
      : 0

    // Próximo hito (25%, 50%, 75%, 100%)
    const nextMilestone = Math.ceil(progressPercentage / 25) * 25

    return {
      totalDebt,
      totalPaid,
      remainingDebt,
      progressPercentage,
      estimatedCompletionMonths,
      nextMilestone
    }
  }

  // Calcula el ahorro de intereses al pagar deudas más rápido
  static calculateInterestSavings(
    principal: number, 
    annualRate: number, 
    currentPayment: number, 
    extraPayment: number
  ): { monthsSaved: number, interestSaved: number } {
    const monthlyRate = annualRate / 100 / 12
    
    if (monthlyRate === 0) {
      return { monthsSaved: 0, interestSaved: 0 }
    }

    // Cálculo para pago normal
    const normalMonths = Math.log(1 + (principal * monthlyRate) / currentPayment) / Math.log(1 + monthlyRate)
    const normalInterest = (currentPayment * normalMonths) - principal

    // Cálculo con pago extra
    const newPayment = currentPayment + extraPayment
    const extraMonths = Math.log(1 + (principal * monthlyRate) / newPayment) / Math.log(1 + monthlyRate)
    const extraInterest = (newPayment * extraMonths) - principal

    return {
      monthsSaved: Math.max(0, normalMonths - extraMonths),
      interestSaved: Math.max(0, normalInterest - extraInterest)
    }
  }

  // Optimiza el orden de pago según estrategia
  static optimizePaymentOrder(debts: Debt[], strategy: DebtStrategy): Debt[] {
    const sortedDebts = [...debts]

    switch (strategy) {
      case 'avalanche':
        // Pagar primero deudas con mayor tasa de interés
        return sortedDebts.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0))
      
      case 'snowball':
        // Pagar primero deudas más pequeñas
        return sortedDebts.sort((a, b) => (a.amount - a.paid) - (b.amount - b.paid))
      
      case 'custom':
      default:
        // Mantener orden personalizado
        return sortedDebts
    }
  }

  // Calcula el tiempo estimado para pagar una deuda específica
  static calculatePayoffTime(
    balance: number, 
    monthlyPayment: number, 
    annualInterestRate: number = 0
  ): number {
    if (monthlyPayment <= 0) return Infinity
    if (balance <= 0) return 0
    if (annualInterestRate === 0) return Math.ceil(balance / monthlyPayment)

    const monthlyRate = annualInterestRate / 100 / 12
    const months = -Math.log(1 - (balance * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate)
    
    return Math.ceil(months)
  }

  // Genera un plan de pagos detallado
  static generatePaymentPlan(
    debts: Debt[], 
    totalMonthlyBudget: number, 
    strategy: DebtStrategy = 'avalanche'
  ): Array<{
    month: number
    payments: Array<{ debtId: string, amount: number, remaining: number }>
    totalPaid: number
    totalRemaining: number
  }> {
    const optimizedDebts = this.optimizePaymentOrder(debts, strategy)
    const plan = []
    let month = 1
    let remainingBudget = totalMonthlyBudget
    let activeDebts = optimizedDebts.map(debt => ({ ...debt, currentBalance: debt.amount - debt.paid }))

    while (activeDebts.some(debt => debt.currentBalance > 0) && month <= 120) { // Límite de 10 años
      const monthlyPayments = []
      let budgetThisMonth = remainingBudget

      // Pagar mínimos primero (asumiendo 2% del balance como mínimo)
      for (const debt of activeDebts) {
        if (debt.currentBalance <= 0) continue
        
        const minimumPayment = Math.min(debt.currentBalance, debt.currentBalance * 0.02)
        const payment = Math.min(minimumPayment, budgetThisMonth)
        
        debt.currentBalance -= payment
        budgetThisMonth -= payment
        
        monthlyPayments.push({
          debtId: debt.id,
          amount: payment,
          remaining: debt.currentBalance
        })
      }

      // Aplicar presupuesto restante a la primera deuda según estrategia
      if (budgetThisMonth > 0) {
        const targetDebt = activeDebts.find(debt => debt.currentBalance > 0)
        if (targetDebt) {
          const extraPayment = Math.min(targetDebt.currentBalance, budgetThisMonth)
          targetDebt.currentBalance -= extraPayment
          
          const existingPayment = monthlyPayments.find(p => p.debtId === targetDebt.id)
          if (existingPayment) {
            existingPayment.amount += extraPayment
            existingPayment.remaining = targetDebt.currentBalance
          }
        }
      }

      plan.push({
        month,
        payments: monthlyPayments,
        totalPaid: monthlyPayments.reduce((sum, p) => sum + p.amount, 0),
        totalRemaining: activeDebts.reduce((sum, d) => sum + d.currentBalance, 0)
      })

      month++
    }

    return plan
  }
}

// Utilidades para formateo y validación
export class ValidationUtils {
  
  static isValidAmount(amount: string | number): boolean {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return !isNaN(num) && num >= 0 && num <= 10000000 // Límite razonable
  }

  static isValidInterestRate(rate: string | number): boolean {
    const num = typeof rate === 'string' ? parseFloat(rate) : rate
    return !isNaN(num) && num >= 0 && num <= 100
  }

  static isValidDate(dateString: string): boolean {
    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date.getTime()) && date > new Date()
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  static sanitizeAmount(amount: string): number {
    return Math.round(parseFloat(amount.replace(/[^0-9.-]/g, '')) * 100) / 100
  }

  static formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  static formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`
  }
}

// Utilidades para almacenamiento local
export class StorageUtils {
  
  static saveToLocalStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }

  static loadFromLocalStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error('Error loading from localStorage:', error)
      return null
    }
  }

  static removeFromLocalStorage(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error removing from localStorage:', error)
    }
  }

  static clearAllData(): void {
    try {
      const keysToKeep = ['theme', 'language'] // Mantener preferencias básicas
      const allKeys = Object.keys(localStorage)
      
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }
}

// Generador de IDs únicos
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Utilidades de fecha
export class DateUtils {
  
  static formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  static getDateDifference(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  static addMonths(date: Date, months: number): Date {
    const result = new Date(date)
    result.setMonth(result.getMonth() + months)
    return result
  }

  static isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date()
  }
}