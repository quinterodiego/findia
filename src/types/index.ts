// Tipos principales para la aplicación FindIA
export interface Debt {
  id: string
  name: string
  amount: number
  paid: number
  interestRate?: number
  dueDate?: string
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  debtId?: string // Si es para una deuda específica
  amount: number
  date: string
  description?: string
  type: 'payment' | 'adjustment' | 'interest'
}

export interface Goal {
  id: string
  title: string
  description: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  isCompleted: boolean
  createdAt: string
}

export interface UserProfile {
  id: string
  name: string
  email?: string
  totalDebt: number
  totalPaid: number
  monthlyIncome?: number
  monthlyExpenses?: number
  createdAt: string
  preferences: {
    notifications: boolean
    celebrationsEnabled: boolean
    theme: 'light' | 'dark'
    currency: string
  }
}

export interface AiSuggestion {
  id: string
  type: 'strategy' | 'motivation' | 'financial' | 'planning'
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
  isCompleted: boolean
  createdAt: string
  expiresAt?: string
}

export interface CelebrationMilestone {
  percentage: number
  title: string
  message: string
  emoji: string
  color: string
  isUnlocked: boolean
  unlockedAt?: string
}

// Tipos para Google Sheets
export interface GoogleSheetsConfig {
  spreadsheetId: string
  apiKey: string
  range: string
}

export interface SheetData {
  range: string
  majorDimension: string
  values: string[][]
}

// Estados de la aplicación
export type AppTab = 'dashboard' | 'tracker' | 'ai' | 'settings'

export type DebtStrategy = 'avalanche' | 'snowball' | 'custom'

export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

// Utilidades
export interface ProgressStats {
  totalDebt: number
  totalPaid: number
  remainingDebt: number
  progressPercentage: number
  estimatedCompletionMonths: number
  nextMilestone: number
}

export interface MonthlyBudget {
  income: number
  expenses: {
    housing: number
    food: number
    transportation: number
    utilities: number
    entertainment: number
    debtPayment: number
    savings: number
    other: number
  }
  availableForDebt: number
}

// Tipos para autenticación
export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
  isLoading: boolean
}

export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
}