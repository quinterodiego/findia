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
}
