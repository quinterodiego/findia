import { getSharedGroupInvitationById, getSharedGroupById, updateSharedGroupInvitation } from '@/lib/googleSheets'
import { ApiError, wrapPhase1Call } from '@/app/api/shared-groups/_lib/apiError'
import type { SharedGroupInvitation } from '@/types'

/**
 * DELETE /api/shared-group-invitations/[id] — "cancelar". NO es un borrado
 * físico: pasa la invitación a `cancelled`, preservando el historial (una
 * reinvitación posterior siempre crea una fila nueva, nunca reabre esta).
 * El member al que apunta queda completamente intacto — esta función nunca
 * lo toca.
 *
 * Puede cancelar quien la envió (`invitation.invitedByUserId`) o el creador
 * del grupo (`group.createdBy`) — siempre por `session.user.id`, nunca por
 * un id enviado en el body. No requiere el token del receptor (cancelar no
 * es una acción del receptor).
 */
export async function cancelSharedGroupInvitationForUser(invitationId: string, userId: string): Promise<SharedGroupInvitation> {
  const invitation = await getSharedGroupInvitationById(invitationId)
  if (!invitation) throw new ApiError(404, 'Invitación no encontrada')

  const group = await getSharedGroupById(invitation.groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const canCancel = invitation.invitedByUserId === userId || group.createdBy === userId
  if (!canCancel) throw new ApiError(403, 'No podés cancelar esta invitación')

  if (invitation.status === 'cancelled') {
    return invitation // idempotente: ya estaba cancelada
  }
  if (invitation.status !== 'pending') {
    const label = invitation.status === 'accepted' ? 'aceptada' : 'rechazada'
    throw new ApiError(409, `Esta invitación ya fue ${label}, no se puede cancelar`)
  }

  return wrapPhase1Call(() => updateSharedGroupInvitation(invitationId, 'cancelled'))
}
