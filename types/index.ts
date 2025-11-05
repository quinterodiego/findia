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
  isShared?: boolean
  sharedExpenseId?: string
}

export interface SharedExpense {
  id: string
  expenseId: string
  ownerUserId: string
  sharedWithUserId: string
  splitType: 'equal' | 'percentage' | 'amount'
  ownerAmount: number
  partnerAmount: number
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  acceptedAt?: string
  rejectedAt?: string
  notes?: string
  // Relaciones (populadas cuando se obtienen)
  expense?: Expense
  owner?: {
    id: string
    name: string
    email: string
    image?: string
  }
  partner?: {
    id: string
    name: string
    email: string
    image?: string
  }
}

export interface SharedExpenseBalance {
  totalOwed: number // Lo que te deben
  totalReceived: number // Lo que debes
  balance: number // Balance neto (positivo = te deben, negativo = debes)
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

// Mapeo de comercio para autocategorización
export interface MerchantMapping {
  merchantName: string // Nombre del comercio (puede ser patrón regex)
  categoryId?: string // Categoría asignada automáticamente
  subcategoryId?: string // Subcategoría asignada automáticamente
  currency?: 'pesos' | 'usd' // Moneda típica de este comercio
  isSubscription?: boolean // Si es una suscripción recurrente
  typicalAmount?: number // Monto típico (útil para validación)
  frequency?: number // Cuántas veces se ha visto este comercio (para aprendizaje)
  lastSeen?: string // Última vez que se vio este comercio
}

// Plantilla Inteligente que aprende patrones
export interface SmartTemplate extends PDFImportTemplate {
  // Patrones aprendidos del PDF
  regexFecha?: string // Patrón regex aprendido para fechas (ej: "(\d{2}-[A-Za-z]{3}-\d{2})")
  regexMonto?: string // Patrón regex aprendido para montos
  seccionConsumosStart?: string // Marcador de inicio de sección de consumos (ej: "DETALLE DEL CONSUMO")
  seccionConsumosEnd?: string // Marcador de fin de sección de consumos (ej: "SUBTOTAL")
  
  // Mapeo de comercios aprendidos
  mapeoComercios?: Record<string, MerchantMapping> // key = nombre del comercio, value = mapeo
  
  // Estadísticas de aprendizaje
  totalImports?: number // Cuántas veces se ha usado este template
  accuracy?: number // Precisión del template (0-1)
  lastUsed?: string // Última vez que se usó
}