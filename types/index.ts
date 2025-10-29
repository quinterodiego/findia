export interface Income {
  id: string
  name: string
  amount: number
  date: string
  userId: string
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: string
  name: string
  amount: number
  date: string
  userId: string
  expenseType?: 'fixed' | 'variable'
  category?: string
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  name: string
  amount: number
  currentAmount: number
  targetDate: string
  userId: string
  createdAt: string
  updatedAt: string
}

export interface Debt {
  id: string
  name: string
  amount: number
  balance: number
  interestRate: number
  minPayment: number
  dueDate: string
  priority: 'high' | 'medium' | 'low'
  userId: string
  createdAt: string
  updatedAt: string
  status?: 'active' | 'paid' | 'overdue'
  categoryId?: string
  subcategoryId?: string
  notes?: string
}

export interface CreditCard {
  id: string
  userId: string
  name: string
  bank: string
  cardNumber: string
  limit: number
  currentBalance: number
  cutDate: number // Día del mes (1-31)
  paymentDate: number // Día del mes (1-31)
  interestRate: number // Tasa de interés mensual
  status: 'active' | 'blocked' | 'expired'
  createdAt: string
  updatedAt: string
}

export interface CreditCardPayment {
  id: string
  creditCardId: string
  userId: string
  amount: number
  date: string
  paymentMethod: 'transfer' | 'cash' | 'debit' | 'other'
  notes?: string
  createdAt: string
}

export interface CreditCardConsumption {
  id: string
  creditCardId: string
  userId: string
  merchant: string
  amount: number
  installments: number
  currentInstallment: number
  monthlyPayment: number
  date: string
  categoryId?: string
  subcategoryId?: string
  description?: string
  createdAt: string
}
