import { getSharedGroupById, getSharedGroupBalanceInputs } from '@/lib/googleSheets'
import { computeGroupBalances } from '@/lib/sharedGroupBalances'
import { ApiError } from '../../_lib/apiError'

/**
 * GET /api/shared-groups/[id]/balance — solo miembros vinculados. Lee
 * members + expenses + splits + settlements UNA vez cada uno
 * (getSharedGroupBalanceInputs) y llama computeGroupBalances() una sola vez
 * — nunca se recalcula el balance más de una vez por request. 5 lecturas
 * totales (grupo + las 4 de balance inputs).
 */
export async function getSharedGroupBalanceForUser(groupId: string, userId: string) {
  const group = await getSharedGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const { members, expenses, splits, settlements } = await getSharedGroupBalanceInputs(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  const balances = computeGroupBalances(
    members.map((m) => ({ id: m.id })),
    expenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency })),
    splits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: s.amount })),
    settlements.map((s) => ({
      paidByMemberId: s.paidByMemberId,
      paidToMemberId: s.paidToMemberId,
      amount: s.amount,
      currency: s.currency,
    }))
  )

  return { groupId, balances }
}
