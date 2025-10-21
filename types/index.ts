import { DefaultSession } from "next-auth"

// Extender tipos de NextAuth
declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: {
      id: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    accessToken?: string
  }
}

// Tipos de la aplicación
export interface User {
  id: string
  email: string
  name: string
  image?: string
  createdAt: string
  updatedAt: string
}

export interface Debt {
  id: string
  userId: string
  name: string
  amount: number
  balance: number
  interestRate: number
  minPayment: number
  dueDate: string
  priority: 'high' | 'medium' | 'low'
  status: 'active' | 'paid' | 'overdue'
  category: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  debtId: string
  userId: string
  amount: number
  date: string
  type: 'regular' | 'extra' | 'minimum'
  notes: string
  createdAt: string
}

export interface DebtStats {
  totalDebt: number
  totalPaid: number
  progressPercentage: number
  monthlyPayment: number
  estimatedPayoffDate: string
  totalDebts: number
}
