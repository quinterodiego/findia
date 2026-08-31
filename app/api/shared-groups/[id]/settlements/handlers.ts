import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { ApiError, wrapPhase1Call } from '../../_lib/apiError'

const repository = getSharedGroupsRepository()

/** GET /api/shared-groups/[id]/settlements — solo miembros vinculados. */
export async function listSharedGroupSettlementsForUser(groupId: string, userId: string) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await repository.getMembers(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  return repository.getSettlements(groupId)
}

/**
 * POST /api/shared-groups/[id]/settlements — cualquier miembro vinculado
 * puede registrar un pago entre CUALQUIER par de miembros del grupo (§16:
 * "Laura pagó a Diego" registrado por Juan es válido en el MVP — simplifica
 * la administración familiar/grupal). NO se exige
 * `session.user === paidByMember.userId`. `createdBy` guarda quién lo
 * registró, resuelto siempre desde la sesión.
 *
 * paidByMemberId/paidToMemberId pueden ser shadow members. La validación de
 * overpayment (rechazo directo, 400) la hace createSharedGroupSettlement de
 * Fase 1 vía computeGroupBalances + validateSettlementAgainstBalance — no se
 * duplica acá.
 */
export async function createSharedGroupSettlementForUser(groupId: string, userId: string, body: unknown) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await repository.getMembers(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  const b = (body ?? {}) as Record<string, unknown>

  const paidByMemberId = typeof b.paidByMemberId === 'string' ? b.paidByMemberId : ''
  if (!members.some((m) => m.id === paidByMemberId)) throw new ApiError(400, 'paidByMemberId debe ser un miembro del grupo')

  const paidToMemberId = typeof b.paidToMemberId === 'string' ? b.paidToMemberId : ''
  if (!members.some((m) => m.id === paidToMemberId)) throw new ApiError(400, 'paidToMemberId debe ser un miembro del grupo')

  if (paidByMemberId === paidToMemberId) throw new ApiError(400, 'El pagador y el receptor no pueden ser el mismo miembro')

  const amount = typeof b.amount === 'number' ? b.amount : NaN
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'El monto debe ser un número finito mayor a 0')

  const currency = b.currency
  if (currency !== 'pesos' && currency !== 'usd') throw new ApiError(400, "La moneda debe ser 'pesos' o 'usd'")

  const date = typeof b.date === 'string' ? b.date : ''
  if (!date) throw new ApiError(400, 'La fecha es requerida')

  const notes = typeof b.notes === 'string' ? b.notes : undefined

  return wrapPhase1Call(() =>
    repository.createSettlement(groupId, userId, { paidByMemberId, paidToMemberId, amount, currency, date, notes })
  )
}
