import {
  getSharedGroupById,
  getSharedGroupMembers,
  getSharedGroupMemberForUser,
  getSharedGroupInvitationsByMember,
  getSharedGroupInvitationsByTargetEmail,
  getSharedGroupInvitationsByGroup,
  createSharedGroupInvitation,
} from '@/lib/googleSheets'
import { normalizeInvitationEmail, canCreateInvitation, isInvitationPending } from '@/lib/sharedGroupInvitations'
import { sendSharedGroupInvitationNotification } from '@/lib/email'
import { buildSharedGroupInvitationUrl } from '../../_lib/invitationUrl'
import { ApiError, wrapPhase1Call } from '../../_lib/apiError'
import type { SharedGroupInvitation } from '@/types'

/**
 * POST /api/shared-groups/[id]/invitations — cualquier miembro VINCULADO del
 * grupo puede invitar a un shadow member existente (misma regla V2 de
 * siempre: no se limita a solo el creator). `invitedByUserId` sale SIEMPRE
 * de la sesión (nunca del body). El email objetivo sale SIEMPRE de
 * `SharedGroupMember.email` — nunca de un `targetEmail` enviado por el
 * cliente, para que no se pueda invitar "a nombre de" un member usando un
 * email distinto al que realmente tiene cargado.
 *
 * `groupName` (de `group`, ya cargado arriba para el permiso) e
 * `inviterName` (de `requester`, ya cargado arriba para el permiso) salen
 * de datos que esta función YA leyó — 0 lecturas adicionales de Sheets solo
 * para el email.
 *
 * Devuelve `{ invitation, token, emailSent }` — el token plano NUNCA debe
 * cruzar hacia la respuesta HTTP; es responsabilidad del route.ts
 * descartarlo antes de serializar (ver _lib/invitationDto.ts). Si el envío
 * de email falla (SMTP caído, etc.) la invitación YA quedó persistida y
 * NO se revierte — Sheets y email no son una transacción; `emailSent`
 * permite al caller distinguir "se creó pero no se pudo avisar por mail".
 */
export async function sendSharedGroupInvitationForUser(
  groupId: string,
  userId: string,
  body: unknown
): Promise<{ invitation: SharedGroupInvitation; token: string; emailSent: boolean }> {
  const group = await getSharedGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const requester = await getSharedGroupMemberForUser(groupId, userId)
  if (!requester) throw new ApiError(403, 'No pertenecés a este grupo')

  const rawMemberId = (body as { memberId?: unknown })?.memberId
  const memberId = typeof rawMemberId === 'string' ? rawMemberId : ''
  if (!memberId) throw new ApiError(400, 'memberId es requerido')

  const members = await getSharedGroupMembers(groupId)
  const targetMember = members.find((m) => m.id === memberId)
  if (!targetMember) throw new ApiError(404, 'El miembro no pertenece a este grupo')

  if (!targetMember.email) {
    throw new ApiError(400, 'Este miembro no tiene un email cargado — agregalo antes de invitarlo')
  }

  const normalizedEmail = normalizeInvitationEmail(targetMember.email)

  // Duplicados — dos ejes distintos, ambos 409:
  const existingForMember = await getSharedGroupInvitationsByMember(groupId, memberId)
  const memberCheck = canCreateInvitation(targetMember, existingForMember)
  if (!memberCheck.valid) throw new ApiError(409, memberCheck.error || 'No se puede invitar a este miembro')

  const existingForEmail = await getSharedGroupInvitationsByTargetEmail(normalizedEmail)
  const pendingForThisGroupAndEmail = existingForEmail.filter(
    (inv) => inv.groupId === groupId && inv.memberId !== memberId && isInvitationPending(inv)
  )
  if (pendingForThisGroupAndEmail.length > 0) {
    throw new ApiError(409, 'Ya existe una invitación pendiente para ese email en este grupo')
  }

  const { invitation, token } = await wrapPhase1Call(() =>
    createSharedGroupInvitation(groupId, memberId, userId, normalizedEmail)
  )

  const inviteUrl = buildSharedGroupInvitationUrl(invitation.id, token)
  const inviterName = requester.name
  const groupName = group.name

  // La invitación YA está persistida en este punto. Si el email falla, NO se
  // revierte ni se borra -- Sheets y el envío de mail no son una
  // transacción. `emailSent` es lo único que refleja el resultado del envío.
  const emailSent = await sendSharedGroupInvitationNotification(normalizedEmail, inviterName, groupName, inviteUrl)

  return { invitation, token, emailSent }
}

/**
 * GET /api/shared-groups/[id]/invitations — solo miembros vinculados del
 * grupo. Devuelve las invitaciones PENDING de ESE grupo (sin importar a
 * quién van dirigidas) — es lo que MembersView necesita para saber, por
 * cada shadow member, si ya tiene una invitación en camino ("Invitación
 * pendiente") o si todavía puede invitarse ("Invitar a FINDIA"). 1 lectura
 * (reutiliza getSharedGroupInvitationsByGroup ya existente de Fase 4.1).
 */
export async function listSharedGroupInvitationsForGroupForUser(groupId: string, userId: string) {
  const group = await getSharedGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const requester = await getSharedGroupMemberForUser(groupId, userId)
  if (!requester) throw new ApiError(403, 'No pertenecés a este grupo')

  const invitations = await getSharedGroupInvitationsByGroup(groupId)
  return invitations.filter((inv) => inv.status === 'pending')
}
