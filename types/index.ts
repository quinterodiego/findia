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
  expenseType?: 'fixed' | 'variable' | 'installments'
  category?: string
  createdAt: string
  updatedAt: string
  isShared?: boolean
  sharedExpenseId?: string
  // Campos para gastos en cuotas
  totalInstallments?: number // Total de cuotas
  currentInstallment?: number // Cuota actual (1, 2, 3, etc.)
  paymentMethod?: 'automatic' | 'manual' | 'transfer' // Método de pago
}

export interface SharedExpense {
  id: string
  expenseId: string
  ownerUserId: string
  sharedWithUserId: string
  splitType: 'equal' | 'percentage' | 'amount'
  ownerAmount: number
  partnerAmount: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancellation_requested'
  createdAt: string
  acceptedAt?: string
  rejectedAt?: string
  notes?: string
  isSettled?: boolean // Indica si la parte del otro usuario está saldada
  settledAt?: string // Fecha cuando se marcó como saldado
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

// ============================================================================
// GASTOS COMPARTIDOS V2 — grupos con N miembros (Splitwise-like).
// Convive en paralelo con SharedExpense (1:1) de arriba; no lo reemplaza ni lo
// modifica. Nomenclatura deliberadamente distinta (SharedGroup*, nunca
// SharedExpense) para evitar cualquier colisión de nombres o de datos.
// ============================================================================

export interface SharedGroup {
  id: string
  name: string
  createdBy: string // userId del creador
  createdAt: string
}

/**
 * Un miembro del grupo. `userId` puede no existir todavía (miembro sin cuenta
 * FindIA, agregado solo por nombre) — el flujo de vinculación posterior a un
 * userId real es una fase futura, no implementada acá.
 */
export interface SharedGroupMember {
  id: string
  groupId: string
  userId?: string
  name: string
  email?: string
  createdAt: string
}

export interface SharedGroupExpense {
  id: string
  groupId: string
  description: string
  amount: number
  currency: 'pesos' | 'usd'
  paidByMemberId: string // SharedGroupMember.id de quien pagó
  date: string // "YYYY-MM-DD", fecha civil (ver lib/formatDate.ts)
  createdBy: string // userId de quien cargó el gasto
  createdAt: string
}

/** Una línea de división de un SharedGroupExpense. La suma de amount de todos
 * los splits de un mismo expenseId debe ser exactamente igual a expense.amount
 * (comparado en centavos). */
export interface SharedGroupSplit {
  id: string
  expenseId: string
  memberId: string
  amount: number
}

/** Registro de un pago externo entre dos miembros del grupo (no procesa
 * dinero real, solo lo asienta para que el motor de balances lo descuente). */
export interface SharedGroupSettlement {
  id: string
  groupId: string
  paidByMemberId: string
  paidToMemberId: string
  amount: number
  currency: 'pesos' | 'usd'
  date: string
  createdBy: string
  createdAt: string
  notes?: string
}

/** Balance neto entre un par de miembros, en una moneda: fromMemberId le debe
 * `amount` a toMemberId. Solo se listan pares con deuda pendiente (amount > 0);
 * un par saldado simplemente no aparece. */
export interface SharedGroupPairBalance {
  fromMemberId: string
  toMemberId: string
  currency: 'pesos' | 'usd'
  amount: number
}

export interface SharedGroupBalanceResult {
  groupId: string
  balances: SharedGroupPairBalance[]
}

/**
 * Invitación para vincular un SharedGroupMember (shadow) a una cuenta FindIA
 * real. La invitación NUNCA crea el member — apunta a uno ya existente
 * (`memberId`); el vínculo real (`SharedGroupMember.userId`) sigue siendo la
 * única fuente de verdad de "quién es este miembro", esta entidad solo
 * registra el estado del proceso de invitación en sí.
 *
 * `tokenHash` es lo único persistido del token de invitación — el token
 * plano solo existe en memoria en el momento de crearla (ver
 * lib/googleSheets.ts#createSharedGroupInvitation y
 * lib/sharedGroupInvitations.ts).
 */
export interface SharedGroupInvitation {
  id: string
  groupId: string
  memberId: string
  invitedByUserId: string
  targetEmail: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  tokenHash: string
  createdAt: string
  respondedAt?: string
}

/**
 * SharedGroupInvitation + los dos datos que la UI necesita para mostrar
 * "Diego te invitó a Casa" sin que el frontend tenga que resolverlos —
 * ver getSharedGroupInvitationsWithDetailsForTargetEmail en
 * lib/googleSheets.ts (Fase 4.4). `groupName` sale de SharedGroup.name;
 * `inviterName` sale del SharedGroupMember del propio invitador dentro de
 * ESE grupo (mismo criterio que el resto de la UI: los nombres se muestran
 * siempre desde el member, nunca desde la cuenta global de Users).
 */
export interface SharedGroupInvitationWithDetails extends SharedGroupInvitation {
  groupName: string
  inviterName: string
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

export interface Payment {
  id: string
  debtId: string
  userId: string
  amount: number
  date: string
  type?: 'regular' | 'extra' | 'minimum'
  notes?: string
  createdAt: string
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
  paymentMethod?: 'automatic' | 'manual' | 'transfer' // Método de pago (DbA/Man/Transf)
  remainingInstallments?: number // Cuotas restantes
  totalInstallments?: number // Total de cuotas originales
  debtType?: 'prestamo' | 'tarjeta' | 'credito' // Tipo de deuda
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
  montoPesos?: number
  montoUSD?: number
  currency?: 'pesos' | 'usd'
  cardId?: string
  cardName?: string
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

export interface Category {
  id: string
  userId: string
  name: string
  color: string
  icon: string
  type: 'income' | 'expense' | 'saving' | 'custom'
  isDefault?: boolean
  createdAt: string
}

export interface Subcategory {
  id: string
  userId: string
  categoryId: string
  name: string
  icon: string
  isDefault?: boolean
  createdAt: string
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