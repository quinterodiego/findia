import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { normalizeInvitationEmail } from '@/lib/sharedGroupInvitations'
import { toPublicInvitationWithDetails, type PublicSharedGroupInvitationWithDetails } from '@/app/api/shared-groups/_lib/invitationDto'

const repository = getSharedGroupsRepository()

/**
 * GET /api/shared-group-invitations — invitaciones PENDING dirigidas al
 * usuario autenticado (por su email de sesión, nunca por userId enviado por
 * el cliente), enriquecidas con `groupName`/`inviterName` (Fase 4.4) para
 * que el inbox dentro de SharedGroupsModal pueda mostrar "Diego te invitó a
 * Casa" sin resolver nada del lado del cliente.
 *
 * Costo: getSharedGroupInvitationsWithDetailsForTargetEmail ya documenta que
 * es 1 lectura (o 3 como máximo, nunca más, nunca "por invitación") — ver
 * lib/googleSheets.ts.
 */
export async function listMySharedGroupInvitationsForUser(
  userEmail: string | null | undefined
): Promise<PublicSharedGroupInvitationWithDetails[]> {
  if (!userEmail) return []

  const normalized = normalizeInvitationEmail(userEmail)
  const invitations = await repository.getInvitationsWithDetailsForTargetEmail(normalized)
  return invitations.map(toPublicInvitationWithDetails)
}
