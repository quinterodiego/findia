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

// Template para importación de PDFs de resúmenes de tarjetas
export interface PDFImportTemplate {
  id: string
  creditCardId: string
  userId: string
  name: string // Nombre del template (ej: "Santander Visa", "Galicia Mastercard")
  // Patrones regex personalizados
  datePattern?: string // Patrón regex para fechas (ej: /(\d{2})\/(\d{2})\/(\d{4})/g)
  amountPattern?: string // Patrón regex para montos
  descriptionPattern?: string // Patrón regex para descripciones
  installmentsPattern?: string // Patrón regex para cuotas
  // Reglas de detección de tipo
  interestKeywords?: string[] // Palabras clave para intereses
  feeKeywords?: string[] // Palabras clave para comisiones
  // Configuración de extracción
  dateFormat?: 'dd/mm/yyyy' | 'dd-mm-yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd' // Formato esperado
  amountDecimalSeparator?: ',' | '.' // Separador decimal esperado
  amountThousandsSeparator?: ',' | '.' // Separador de miles esperado
  // Límites de búsqueda
  searchRange?: number // Número de líneas a buscar después de encontrar una fecha (default: 3)
  // Reglas adicionales
  skipLines?: string[] // Líneas que contengan estos patrones se ignoran
  createdAt: string
  updatedAt: string
}