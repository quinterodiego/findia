import { getSharedGroupInvitationById, updateSharedGroupInvitation } from '@/lib/googleSheets'
import { normalizeInvitationEmail, verifyInvitationToken } from '@/lib/sharedGroupInvitations'
import { ApiError, wrapPhase1Call } from '@/app/api/shared-groups/_lib/apiError'
import type { SharedGroupInvitation } from '@/types'

const GENERIC_UNAUTHORIZED = 'Invitación no autorizada'

/**
 * POST /api/shared-group-invitations/[id]/reject — mismas validaciones de
 * seguridad que accept (token primero, email después, mismo 403 genérico
 * para no dar pistas a quien no tiene el token — ver comentario en
 * accept/handlers.ts). NUNCA toca SharedGroupMember: el member sigue shadow
 * tal cual estaba.
 *
 * FASE 4.4 — mismo CANAL B que accept: sin token, solo se permite si
 * `hasVerifiedGoogleSession` es true. Aunque reject no linkea nada, sin
 * esta misma restricción alguien con una cuenta Credentials no verificada
 * (email "squatteado") podría rechazar invitaciones ajenas — un daño real
 * (le niega el acceso al destinatario legítimo), aunque no gane nada para
 * sí mismo.
 */
export async function rejectSharedGroupInvitationForUser(
  invitationId: string,
  userEmail: string | null | undefined,
  hasVerifiedGoogleSession: boolean,
  body: unknown
): Promise<SharedGroupInvitation> {
  const rawToken = (body as { token?: unknown })?.token
  const token = typeof rawToken === 'string' ? rawToken : ''

  const invitation = await getSharedGroupInvitationById(invitationId)
  if (!invitation) throw new ApiError(404, 'Invitación no encontrada')

  if (token) {
    if (!verifyInvitationToken(token, invitation.tokenHash)) {
      throw new ApiError(403, GENERIC_UNAUTHORIZED)
    }
  } else if (!hasVerifiedGoogleSession) {
    throw new ApiError(403, 'Para rechazar esta invitación necesitás abrir el link que te enviamos por email.')
  }

  if (!userEmail) throw new ApiError(403, GENERIC_UNAUTHORIZED)
  if (normalizeInvitationEmail(userEmail) !== invitation.targetEmail) {
    throw new ApiError(403, GENERIC_UNAUTHORIZED)
  }

  if (invitation.status === 'rejected') {
    return invitation // idempotente
  }
  if (invitation.status !== 'pending') {
    const label = invitation.status === 'accepted' ? 'aceptada' : 'cancelada'
    throw new ApiError(409, `Esta invitación ya fue ${label}`)
  }

  return wrapPhase1Call(() => updateSharedGroupInvitation(invitationId, 'rejected'))
}
