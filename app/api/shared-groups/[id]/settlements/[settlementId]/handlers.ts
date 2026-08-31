import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { findFirstSettlementBrokenByReplay } from '@/lib/sharedGroupBalances'
import { ApiError, wrapPhase1Call } from '../../../_lib/apiError'

const repository = getSharedGroupsRepository()

/**
 * PUT /api/shared-groups/[id]/settlements/[settlementId] — solo el autor
 * (settlement.createdBy === session.user.id). Si cambia algún campo
 * financiero (paidByMemberId/paidToMemberId/amount/currency), se hace un
 * REPLAY cronológico de todos los settlements del grupo con el cambio ya
 * aplicado (findFirstSettlementBrokenByReplay): si algún OTRO settlement
 * posterior quedaría pagando más de lo que se debía en su propio momento,
 * se rechaza con 409 (conflicto retroactivo). La validación DIRECTA del
 * propio settlement contra su balance actual (excluyéndose a sí mismo) la
 * sigue haciendo updateSharedGroupSettlement de Fase 1 sin cambios — por
 * eso acá se ignora explícitamente si el propio settlementId es el que
 * "rompe" el replay (eso ya da 400 desde Fase 1, no 409).
 */
export async function updateSharedGroupSettlementForUser(
  groupId: string,
  settlementId: string,
  userId: string,
  body: unknown
) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const { members, expenses, splits, settlements } = await repository.getBalanceInputs(groupId)
  const target = settlements.find((s) => s.id === settlementId)
  if (!target) throw new ApiError(404, 'Pago no encontrado')
  if (target.createdBy !== userId) throw new ApiError(403, 'Solo el autor del pago puede editarlo')

  const b = (body ?? {}) as Record<string, unknown>
  const data: {
    paidByMemberId?: string
    paidToMemberId?: string
    amount?: number
    currency?: 'pesos' | 'usd'
    date?: string
    notes?: string
  } = {}

  if (b.paidByMemberId !== undefined) {
    const paidByMemberId = typeof b.paidByMemberId === 'string' ? b.paidByMemberId : ''
    if (!members.some((m) => m.id === paidByMemberId)) throw new ApiError(400, 'paidByMemberId debe ser un miembro del grupo')
    data.paidByMemberId = paidByMemberId
  }
  if (b.paidToMemberId !== undefined) {
    const paidToMemberId = typeof b.paidToMemberId === 'string' ? b.paidToMemberId : ''
    if (!members.some((m) => m.id === paidToMemberId)) throw new ApiError(400, 'paidToMemberId debe ser un miembro del grupo')
    data.paidToMemberId = paidToMemberId
  }
  if (b.amount !== undefined) {
    const amount = typeof b.amount === 'number' ? b.amount : NaN
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'El monto debe ser un número finito mayor a 0')
    data.amount = amount
  }
  if (b.currency !== undefined) {
    if (b.currency !== 'pesos' && b.currency !== 'usd') throw new ApiError(400, "La moneda debe ser 'pesos' o 'usd'")
    data.currency = b.currency
  }
  if (b.date !== undefined) {
    const date = typeof b.date === 'string' ? b.date : ''
    if (!date) throw new ApiError(400, 'La fecha es requerida')
    data.date = date
  }
  if (b.notes !== undefined) {
    data.notes = typeof b.notes === 'string' ? b.notes : undefined
  }

  const newPaidBy = data.paidByMemberId ?? target.paidByMemberId
  const newPaidTo = data.paidToMemberId ?? target.paidToMemberId
  if (newPaidBy === newPaidTo) throw new ApiError(400, 'El pagador y el receptor no pueden ser el mismo miembro')

  const financialFieldsChanged =
    data.amount !== undefined || data.currency !== undefined || data.paidByMemberId !== undefined || data.paidToMemberId !== undefined

  if (financialFieldsChanged) {
    const hypotheticalTarget = {
      id: target.id,
      createdAt: target.createdAt,
      paidByMemberId: newPaidBy,
      paidToMemberId: newPaidTo,
      amount: data.amount ?? target.amount,
      currency: data.currency ?? target.currency,
    }
    const hypotheticalSettlements = settlements.map((s) =>
      s.id === settlementId
        ? hypotheticalTarget
        : { id: s.id, createdAt: s.createdAt, paidByMemberId: s.paidByMemberId, paidToMemberId: s.paidToMemberId, amount: s.amount, currency: s.currency }
    )

    const brokenId = findFirstSettlementBrokenByReplay(
      members.map((m) => ({ id: m.id })),
      expenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency })),
      splits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: s.amount })),
      hypotheticalSettlements
    )

    // Si el que "rompe" es el propio settlement editado, eso ya lo valida (400)
    // updateSharedGroupSettlement de Fase 1 al llamarlo más abajo -- acá solo
    // nos importa si ROMPE a algún OTRO settlement (conflicto retroactivo, 409).
    if (brokenId && brokenId !== settlementId) {
      throw new ApiError(
        409,
        `Este cambio dejaría un pago posterior (${brokenId}) pagando más de lo que se debía en ese momento`
      )
    }
  }

  return wrapPhase1Call(() => repository.updateSettlement(settlementId, userId, data))
}

/**
 * DELETE /api/shared-groups/[id]/settlements/[settlementId] — solo el
 * autor. Antes de borrar, reconstruye qué pasaría SIN este settlement
 * (findFirstSettlementBrokenByReplay): si algún settlement posterior
 * quedaría pagando de más, se rechaza con 409.
 */
export async function deleteSharedGroupSettlementForUser(groupId: string, settlementId: string, userId: string) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const { members, expenses, splits, settlements } = await repository.getBalanceInputs(groupId)
  const target = settlements.find((s) => s.id === settlementId)
  if (!target) throw new ApiError(404, 'Pago no encontrado')
  if (target.createdBy !== userId) throw new ApiError(403, 'Solo el autor del pago puede eliminarlo')

  const remainingSettlements = settlements
    .filter((s) => s.id !== settlementId)
    .map((s) => ({ id: s.id, createdAt: s.createdAt, paidByMemberId: s.paidByMemberId, paidToMemberId: s.paidToMemberId, amount: s.amount, currency: s.currency }))

  const brokenId = findFirstSettlementBrokenByReplay(
    members.map((m) => ({ id: m.id })),
    expenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency })),
    splits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: s.amount })),
    remainingSettlements
  )

  if (brokenId) {
    throw new ApiError(
      409,
      `No se puede eliminar: dejaría un pago posterior (${brokenId}) pagando más de lo que se debía en ese momento`
    )
  }

  await wrapPhase1Call(() => repository.deleteSettlement(settlementId, userId))
}
