/**
 * Motor puro de Gastos Compartidos V2 (grupos con N miembros).
 *
 * Todo lo de este archivo es sincrónico y sin efectos secundarios: no hace
 * fetch, no lee Google Sheets, no depende de React. Recibe datos ya cargados
 * y devuelve resultados — así se puede probar sin infraestructura, y la capa
 * de persistencia (lib/googleSheets.ts) es la única responsable de leer/
 * escribir y de llamar a estas funciones con los datos correctos.
 *
 * Todos los montos se manejan en pesos/dólares (con decimales) en las firmas
 * públicas, pero internamente todo cálculo de sumas se hace en CENTAVOS
 * ENTEROS (Math.round(monto * 100)) para no arrastrar errores de punto
 * flotante (ej. 0.1 + 0.2 !== 0.3 en JS).
 */

import type { SharedGroupPairBalance } from '@/types'

export type Currency = 'pesos' | 'usd'

export interface SplitInput {
  memberId: string
  amount: number
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/** Redondea a centavos enteros (no a un número con 2 decimales — a un entero). */
function toCents(amount: number): number {
  return Math.round(amount * 100)
}

// ============================================================================
// SPLITS
// ============================================================================

/**
 * Genera una división en partes iguales, determinística y exacta (sin arrastre
 * de centavos). El orden de `memberIds` es el orden en que se reciben — NO se
 * reordena — y los primeros `resto` miembros de ese orden reciben el centavo
 * extra cuando el total no es divisible exactamente por N.
 *
 * Ejemplo: calculateEqualSplit(100, ['A','B','C']) ->
 *   [{memberId:'A', amount:33.34}, {memberId:'B', amount:33.33}, {memberId:'C', amount:33.33}]
 */
export function calculateEqualSplit(totalAmount: number, memberIds: string[]): SplitInput[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('El monto total debe ser un número finito mayor a 0')
  }
  if (!memberIds || memberIds.length === 0) {
    throw new Error('Debe haber al menos un participante para dividir el gasto')
  }

  const totalCents = toCents(totalAmount)
  const n = memberIds.length
  const baseCents = Math.floor(totalCents / n)
  const remainder = totalCents - baseCents * n

  return memberIds.map((memberId, index) => ({
    memberId,
    amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
  }))
}

/**
 * Valida que la suma de los splits sea exactamente igual al monto total,
 * comparando en centavos enteros (nunca floats crudos). Sirve tanto para
 * validar una división por monto exacto como, en general, como invariante
 * final de cualquier división (igual, monto, o — a futuro — porcentaje).
 */
export function validateSplitsSum(totalAmount: number, splits: SplitInput[]): ValidationResult {
  const totalCents = toCents(totalAmount)
  const sumCents = splits.reduce((sum, s) => sum + toCents(s.amount), 0)

  if (sumCents !== totalCents) {
    return {
      valid: false,
      error: `La suma de los splits (${(sumCents / 100).toFixed(2)}) debe ser igual al monto total (${(totalCents / 100).toFixed(2)})`,
    }
  }
  return { valid: true }
}

/**
 * Validación completa de un SharedGroupExpense + sus splits, antes de
 * persistir nada. Cubre: monto, descripción, moneda, que el pagador y todos
 * los participantes pertenezcan al grupo, que no haya memberId duplicado,
 * que cada split sea >= 0, y que la suma cierre exacto con el monto total.
 */
export function validateSharedGroupExpenseInput(
  input: {
    description: string
    amount: number
    currency: Currency
    paidByMemberId: string
    splits: SplitInput[]
  },
  validMemberIds: string[]
): ValidationResult {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, error: 'El monto debe ser un número finito mayor a 0' }
  }
  if (!input.description || input.description.trim().length === 0) {
    return { valid: false, error: 'La descripción no puede estar vacía' }
  }
  if (input.currency !== 'pesos' && input.currency !== 'usd') {
    return { valid: false, error: "La moneda debe ser 'pesos' o 'usd'" }
  }
  if (!validMemberIds.includes(input.paidByMemberId)) {
    return { valid: false, error: 'El pagador debe ser un miembro del grupo' }
  }
  if (!input.splits || input.splits.length === 0) {
    return { valid: false, error: 'Debe haber al menos un split' }
  }
  if (input.splits.length < 2) {
    return { valid: false, error: 'Un gasto compartido requiere al menos 2 participantes' }
  }

  const seenMemberIds = new Set<string>()
  for (const split of input.splits) {
    if (!validMemberIds.includes(split.memberId)) {
      return { valid: false, error: `El miembro ${split.memberId} no pertenece al grupo` }
    }
    if (seenMemberIds.has(split.memberId)) {
      return { valid: false, error: `El miembro ${split.memberId} está duplicado en los splits` }
    }
    seenMemberIds.add(split.memberId)
    if (!Number.isFinite(split.amount) || split.amount < 0) {
      return { valid: false, error: 'Cada split debe ser un número finito mayor o igual a 0' }
    }
  }

  return validateSplitsSum(input.amount, input.splits)
}

// ============================================================================
// MOTOR DE BALANCES
// ============================================================================

interface ExpenseForBalance {
  id: string
  paidByMemberId: string
  currency: Currency
}

interface SplitForBalance {
  expenseId: string
  memberId: string
  amount: number
}

interface SettlementForBalance {
  paidByMemberId: string
  paidToMemberId: string
  amount: number
  currency: Currency
}

/**
 * Calcula los balances netos por par de miembros y por moneda, a partir de
 * gastos + splits + settlements. No persiste nada, no muta ninguno de sus
 * argumentos.
 *
 * Regla: por cada split de un gasto pagado por P, si el miembro del split M
 * es distinto de P, M le debe split.amount a P. Cada settlement (X pagó A a Y)
 * reduce la deuda X→Y en A. Al final se netea cada par (A debe B) vs (B debe A)
 * y solo se conserva la diferencia — SIN simplificar transitivamente entre
 * pares distintos (A debe B, B debe C no se convierte en A debe C).
 *
 * `members` se recibe por completitud de la firma (coherente con "members,
 * expenses, splits, settlements" como las 4 fuentes de verdad) aunque el
 * cálculo en sí solo necesita los ids referenciados por splits/settlements;
 * no se usa para filtrar ni para inicializar balances en cero.
 */
export function computeGroupBalances(
  members: { id: string }[],
  expenses: ExpenseForBalance[],
  splits: SplitForBalance[],
  settlements: SettlementForBalance[]
): SharedGroupPairBalance[] {
  // Set de ids válidos: Google Sheets no tiene claves foráneas, así que un split o
  // settlement puede quedar apuntando a un memberId que ya no existe (ej. si se borró
  // el miembro sin limpiar sus referencias — ver deleteSharedGroupMember). Se ignoran
  // defensivamente en vez de romper el cálculo.
  const memberIds = new Set(members.map((m) => m.id))

  // ledger[currency][deudor][acreedor] = centavos que el deudor le debe al acreedor (bruto, sin netear)
  const ledger: Record<string, Record<string, Record<string, number>>> = {}

  const addDebt = (currency: Currency, debtorId: string, creditorId: string, cents: number) => {
    if (debtorId === creditorId || cents === 0) return
    if (!ledger[currency]) ledger[currency] = {}
    if (!ledger[currency][debtorId]) ledger[currency][debtorId] = {}
    ledger[currency][debtorId][creditorId] = (ledger[currency][debtorId][creditorId] || 0) + cents
  }

  const expenseById = new Map(expenses.map((e) => [e.id, e]))

  for (const split of splits) {
    const expense = expenseById.get(split.expenseId)
    if (!expense) continue // split huérfano (sin gasto asociado): se ignora defensivamente
    if (!memberIds.has(split.memberId) || !memberIds.has(expense.paidByMemberId)) continue // referencia a un miembro que ya no existe
    if (split.memberId === expense.paidByMemberId) continue // el pagador no se debe a sí mismo
    addDebt(expense.currency, split.memberId, expense.paidByMemberId, toCents(split.amount))
  }

  for (const settlement of settlements) {
    if (!memberIds.has(settlement.paidByMemberId) || !memberIds.has(settlement.paidToMemberId)) continue
    // Un pago de X a Y reduce lo que X le debe a Y (puede dejarlo en negativo si
    // el pago superó la deuda; ver validateSettlementAgainstBalance para
    // impedir esto ANTES de llegar a este punto).
    addDebt(settlement.currency, settlement.paidByMemberId, settlement.paidToMemberId, -toCents(settlement.amount))
  }

  const result: SharedGroupPairBalance[] = []
  const seenPairs = new Set<string>()

  for (const currency of Object.keys(ledger) as Currency[]) {
    for (const debtorId of Object.keys(ledger[currency])) {
      for (const creditorId of Object.keys(ledger[currency][debtorId])) {
        const pairKey = `${currency}|${[debtorId, creditorId].sort().join('|')}`
        if (seenPairs.has(pairKey)) continue
        seenPairs.add(pairKey)

        const debtorOwesCreditor = ledger[currency][debtorId]?.[creditorId] || 0
        const creditorOwesDebtor = ledger[currency][creditorId]?.[debtorId] || 0
        const netCents = debtorOwesCreditor - creditorOwesDebtor

        if (netCents > 0) {
          result.push({ fromMemberId: debtorId, toMemberId: creditorId, currency, amount: netCents / 100 })
        } else if (netCents < 0) {
          result.push({ fromMemberId: creditorId, toMemberId: debtorId, currency, amount: -netCents / 100 })
        }
        // netCents === 0: par saldado, no se agrega nada al resultado.
      }
    }
  }

  return result
}

/**
 * Valida un settlement propuesto contra los balances actuales del grupo,
 * ANTES de persistirlo. Rechaza si el pago supera lo que el pagador
 * efectivamente debe al receptor en esa moneda (evita generar una deuda
 * invertida por error de usuario). No permite crear un settlement
 * "adelantado" para una deuda que todavía no existe.
 */
export function validateSettlementAgainstBalance(
  currentBalances: SharedGroupPairBalance[],
  settlement: { paidByMemberId: string; paidToMemberId: string; amount: number; currency: Currency }
): ValidationResult {
  if (!Number.isFinite(settlement.amount) || settlement.amount <= 0) {
    return { valid: false, error: 'El monto del pago debe ser un número finito mayor a 0' }
  }
  if (settlement.paidByMemberId === settlement.paidToMemberId) {
    return { valid: false, error: 'El pagador y el receptor del pago no pueden ser el mismo miembro' }
  }

  const existing = currentBalances.find(
    (b) =>
      b.fromMemberId === settlement.paidByMemberId &&
      b.toMemberId === settlement.paidToMemberId &&
      b.currency === settlement.currency
  )
  const owedCents = existing ? toCents(existing.amount) : 0
  const settlementCents = toCents(settlement.amount)

  if (settlementCents > owedCents) {
    return {
      valid: false,
      error: `El pago (${(settlementCents / 100).toFixed(2)}) supera la deuda actual (${(owedCents / 100).toFixed(2)}) en ${settlement.currency.toUpperCase()}`,
    }
  }

  return { valid: true }
}

// ============================================================================
// FASE 2 — validación retroactiva para delete/update de settlements.
// No modifica ni reemplaza nada de arriba (Fase 1 aprobada, sin rediseñar).
// ============================================================================

export interface SettlementForReplay extends SettlementForBalance {
  id: string
  createdAt: string
}

/**
 * Dada una lista HIPOTÉTICA de settlements (ya con una remoción o una
 * modificación aplicada por el llamador), verifica que cada uno siga siendo
 * válido en el momento en que ocurrió, respecto de los settlements
 * anteriores a él en el tiempo (por `createdAt`). Se usa para bloquear un
 * DELETE o UPDATE que retroactivamente dejaría un settlement POSTERIOR
 * pagando más de lo que en ese momento se debía.
 *
 * Devuelve el id del primer settlement que quedaría inválido, o null si la
 * lista hipotética completa es consistente. Pura: no lee Sheets, no muta sus
 * argumentos.
 */
export function findFirstSettlementBrokenByReplay(
  members: { id: string }[],
  expenses: ExpenseForBalance[],
  splits: SplitForBalance[],
  hypotheticalSettlements: SettlementForReplay[]
): string | null {
  const sorted = [...hypotheticalSettlements].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  for (let i = 0; i < sorted.length; i++) {
    const candidate = sorted[i]
    const priorSettlements = sorted.slice(0, i)
    const balanceBeforeCandidate = computeGroupBalances(members, expenses, splits, priorSettlements)
    const validation = validateSettlementAgainstBalance(balanceBeforeCandidate, candidate)
    if (!validation.valid) {
      return candidate.id
    }
  }

  return null
}
