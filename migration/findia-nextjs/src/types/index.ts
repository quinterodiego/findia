import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: {
      id: string
      email: string
      name: string
      image?: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    name: string
    image?: string
  }
}

export interface Debt {
  id: string
  name: string
  currentAmount: number
  originalAmount: number
  minimumPayment: number
  interestRate: number
  dueDate: string
  priority: 'high' | 'medium' | 'low'
  category: string
  notes?: string
  createdAt: string
  updatedAt: string
  userId: string
}

export interface Payment {
  id: string
  debtId: string
  amount: number
  date: string
  notes?: string
  userId: string
}

export interface User {
  id: string
  email: string
  name: string
  picture?: string
  provider: 'google' | 'email'
  createdAt: string
  isAdmin: boolean
}

export interface DebtStats {
  totalDebt: number
  totalPaid: number
  progressPercentage: number
  monthlyPayment: number
  estimatedPayoffDate: string
  totalDebts: number
}

export interface GoogleSheetsConfig {
  spreadsheetId: string
  ranges: {
    debts: string
    payments: string
    users: string
  }
}

export interface AdminSettings {
  allowRegistration: boolean
  requireEmailVerification: boolean
  googleSheetsConnected: boolean
  lastSyncDate?: string
}