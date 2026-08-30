import {
  getSharedGroupById,
  getSharedGroupMembers,
  getSharedGroupExpenses,
  updateSharedGroupExpense,
  deleteSharedGroupExpense,
} from '@/lib/googleSheets'
import { calculateEqualSplit } from '@/lib/sharedGroupBalances'
import { ApiError, wrapPhase1Call } from '../../../_lib/apiError'

/**
 * PUT /api/shared-groups/[id]/expenses/[expenseId] — solo el autor
 * (expense.createdBy === session.user.id), y además debe seguir siendo
 * miembro vinculado del grupo (si fue removido del grupo después de crear
 * el gasto, ya no puede editarlo).
 *
 * §14: cambiar `amount` o `currency` es OBLIGATORIO acompañarlo de
 * `splitType` (y `splits` si es 'amount') en la MISMA operación — nunca se
 * permite dejar los splits representando otro monto/moneda. Para 'equal' se
 * recalculan con calculateEqualSplit() de Fase 1; para 'amount' se validan
 * los nuevos splits (Fase 1 valida la suma exacta al llamar
 * updateSharedGroupExpense).
 */
export async function updateSharedGroupExpenseForUser(
  groupId: string,
  expenseId: string,
  userId: string,
  body: unknown
) {
  const group = await getSharedGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await getSharedGroupMembers(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  const expenses = await getSharedGroupExpenses(groupId)
  const target = expenses.find((e) => e.id === expenseId)
  if (!target) throw new ApiError(404, 'Gasto no encontrado')
  if (target.createdBy !== userId) throw new ApiError(403, 'Solo el autor del gasto puede editarlo')

  const b = (body ?? {}) as Record<string, unknown>
  const data: {
    description?: string
    amount?: number
    currency?: 'pesos' | 'usd'
    paidByMemberId?: string
    date?: string
    splits?: { memberId: string; amount: number }[]
  } = {}

  if (b.description !== undefined) {
    const description = typeof b.description === 'string' ? b.description.trim() : ''
    if (!description) throw new ApiError(400, 'La descripción no puede estar vacía')
    data.description = description
  }

  if (b.paidByMemberId !== undefined) {
    const paidByMemberId = typeof b.paidByMemberId === 'string' ? b.paidByMemberId : ''
    if (!members.some((m) => m.id === paidByMemberId)) throw new ApiError(400, 'El pagador debe ser un miembro del grupo')
    data.paidByMemberId = paidByMemberId
  }

  if (b.date !== undefined) {
    const date = typeof b.date === 'string' ? b.date : ''
    if (!date) throw new ApiError(400, 'La fecha es requerida')
    data.date = date
  }

  const amountProvided = b.amount !== undefined
  const currencyProvided = b.currency !== undefined

  if (currencyProvided) {
    if (b.currency !== 'pesos' && b.currency !== 'usd') throw new ApiError(400, "La moneda debe ser 'pesos' o 'usd'")
    data.currency = b.currency
  }
  if (amountProvided) {
    const amount = typeof b.amount === 'number' ? b.amount : NaN
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'El monto debe ser un número finito mayor a 0')
    data.amount = amount
  }

  const splitsIntentProvided = b.splitType !== undefined || Array.isArray(b.splits)

  if ((amountProvided || currencyProvided) && !splitsIntentProvided) {
    throw new ApiError(400, 'Para cambiar el monto o la moneda también hay que indicar splitType (y los splits si corresponde)')
  }

  if (splitsIntentProvided) {
    const finalAmount = data.amount ?? target.amount

    if (b.splitType === 'equal') {
      let participantMemberIds: string[]
      if (Array.isArray(b.participantMemberIds) && b.participantMemberIds.length > 0) {
        if (!b.participantMemberIds.every((x) => typeof x === 'string')) {
          throw new ApiError(400, 'participantMemberIds debe ser un array de strings')
        }
        participantMemberIds = b.participantMemberIds as string[]
        if (new Set(participantMemberIds).size !== participantMemberIds.length) {
          throw new ApiError(400, 'participantMemberIds no puede tener ids duplicados')
        }
        const invalid = participantMemberIds.find((pid) => !members.some((m) => m.id === pid))
        if (invalid) throw new ApiError(400, `El miembro ${invalid} no pertenece al grupo`)
      } else {
        participantMemberIds = members.map((m) => m.id)
      }
      data.splits = calculateEqualSplit(finalAmount, participantMemberIds)
    } else if (b.splitType === 'amount' || (b.splitType === undefined && Array.isArray(b.splits))) {
      if (!Array.isArray(b.splits) || b.splits.length === 0) {
        throw new ApiError(400, "Se requiere un array 'splits' con al menos un elemento")
      }
      data.splits = (b.splits as unknown[]).map((raw, index) => {
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
  }

  return wrapPhase1Call(() => updateSharedGroupExpense(expenseId, userId, data))
}

/** DELETE /api/shared-groups/[id]/expenses/[expenseId] — solo el autor.
 * deleteSharedGroupExpense (Fase 1) ya borra los splits en cascada. */
export async function deleteSharedGroupExpenseForUser(groupId: string, expenseId: string, userId: string) {
  const group = await getSharedGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const expenses = await getSharedGroupExpenses(groupId)
  const target = expenses.find((e) => e.id === expenseId)
  if (!target) throw new ApiError(404, 'Gasto no encontrado')
  if (target.createdBy !== userId) throw new ApiError(403, 'Solo el autor del gasto puede eliminarlo')

  await wrapPhase1Call(() => deleteSharedGroupExpense(expenseId, userId))
}
