import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { calculateEqualSplit } from '@/lib/sharedGroupBalances'
import type { SharedGroupSplit } from '@/types'
import { ApiError, wrapPhase1Call } from '../../_lib/apiError'

const repository = getSharedGroupsRepository()

/**
 * GET /api/shared-groups/[id]/expenses — solo miembros vinculados. Devuelve
 * cada gasto con sus splits ya adjuntos (`{...expense, splits: [...]}`) para
 * que el frontend no tenga que hacer N+1 fetches. 4 lecturas TOTALES (group,
 * members, expenses, splits) sin importar la cantidad de gastos — los
 * splits se leen UNA sola vez para todo el grupo y se agrupan en memoria.
 */
export async function listSharedGroupExpensesForUser(groupId: string, userId: string) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await repository.getMembers(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  const expenses = await repository.getExpenses(groupId)
  const splits = await repository.getSplitsForExpenseIds(expenses.map((e) => e.id))

  const splitsByExpenseId = new Map<string, SharedGroupSplit[]>()
  for (const s of splits) {
    const arr = splitsByExpenseId.get(s.expenseId) ?? []
    arr.push(s)
    splitsByExpenseId.set(s.expenseId, arr)
  }

  return expenses.map((e) => ({ ...e, splits: splitsByExpenseId.get(e.id) ?? [] }))
}

/**
 * POST /api/shared-groups/[id]/expenses — cualquier miembro vinculado puede
 * crear un gasto. `paidByMemberId` puede ser un miembro vinculado O un
 * shadow member (quien pagó no tiene por qué ser quien carga el registro —
 * eso es `createdBy`, resuelto siempre desde la sesión).
 *
 * splitType 'equal': si no se envía `participantMemberIds`, se divide entre
 * TODOS los miembros actuales del grupo (UX rápida por defecto: "dividir
 * entre todos"). Si se envía, se usa ese subconjunto (validado contra el
 * grupo, sin duplicados). Usa calculateEqualSplit() de Fase 1 sin cambios.
 *
 * splitType 'amount': requiere `splits: [{memberId, amount}]` explícitos —
 * la validación de pertenencia al grupo y de suma exacta la hace
 * createSharedGroupExpense (Fase 1), sin duplicar esa lógica acá.
 */
export async function createSharedGroupExpenseForUser(groupId: string, userId: string, body: unknown) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await repository.getMembers(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  const b = (body ?? {}) as Record<string, unknown>

  const description = typeof b.description === 'string' ? b.description.trim() : ''
  if (!description) throw new ApiError(400, 'La descripción es requerida')

  const amount = typeof b.amount === 'number' ? b.amount : NaN
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'El monto debe ser un número finito mayor a 0')

  const currency = b.currency
  if (currency !== 'pesos' && currency !== 'usd') throw new ApiError(400, "La moneda debe ser 'pesos' o 'usd'")

  const paidByMemberId = typeof b.paidByMemberId === 'string' ? b.paidByMemberId : ''
  if (!members.some((m) => m.id === paidByMemberId)) throw new ApiError(400, 'El pagador debe ser un miembro del grupo')

  const date = typeof b.date === 'string' ? b.date : ''
  if (!date) throw new ApiError(400, 'La fecha es requerida')

  const splitType = b.splitType
  let splits: { memberId: string; amount: number }[]

  if (splitType === 'equal') {
    let participantMemberIds: string[]
    if (Array.isArray(b.participantMemberIds) && b.participantMemberIds.length > 0) {
      if (!b.participantMemberIds.every((id) => typeof id === 'string')) {
        throw new ApiError(400, 'participantMemberIds debe ser un array de strings')
      }
      participantMemberIds = b.participantMemberIds as string[]
      if (new Set(participantMemberIds).size !== participantMemberIds.length) {
        throw new ApiError(400, 'participantMemberIds no puede tener ids duplicados')
      }
      const invalid = participantMemberIds.find((id) => !members.some((m) => m.id === id))
      if (invalid) throw new ApiError(400, `El miembro ${invalid} no pertenece al grupo`)
    } else {
      // Default de UX rápida: dividir entre todos los miembros actuales del grupo.
      participantMemberIds = members.map((m) => m.id)
    }
    splits = calculateEqualSplit(amount, participantMemberIds)
  } else if (splitType === 'amount') {
    if (!Array.isArray(b.splits) || b.splits.length === 0) {
      throw new ApiError(400, "splitType 'amount' requiere un array 'splits' con al menos un elemento")
    }
    splits = (b.splits as unknown[]).map((raw, index) => {
      const s = (raw ?? {}) as Record<string, unknown>
      const memberId = typeof s.memberId === 'string' ? s.memberId : ''
      const splitAmount = typeof s.amount === 'number' ? s.amount : NaN
      if (!memberId) throw new ApiError(400, `splits[${index}].memberId es requerido`)
      if (!Number.isFinite(splitAmount)) throw new ApiError(400, `splits[${index}].amount debe ser un número finito`)
      return { memberId, amount: splitAmount }
    })
  } else {
    throw new ApiError(400, "splitType debe ser 'equal' o 'amount'")
  }

  return wrapPhase1Call(() =>
    repository.createExpense(groupId, userId, { description, amount, currency, paidByMemberId, date, splits })
  )
}
