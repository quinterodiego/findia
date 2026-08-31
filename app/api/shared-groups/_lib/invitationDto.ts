import type { SharedGroupInvitation, SharedGroupInvitationWithDetails } from '@/types'

/**
 * Forma pública de una invitación — EXCLUYE `tokenHash` siempre. Ninguna
 * ruta de invitaciones debe devolver un SharedGroupInvitation "crudo" al
 * cliente; todas deben pasar por toPublicInvitation() antes de
 * NextResponse.json(...).
 */
export interface PublicSharedGroupInvitation {
  id: string
  groupId: string
  memberId: string
  invitedByUserId: string
  targetEmail: string
  status: SharedGroupInvitation['status']
  createdAt: string
  respondedAt?: string
}

export function toPublicInvitation(invitation: SharedGroupInvitation): PublicSharedGroupInvitation {
  return {
    id: invitation.id,
    groupId: invitation.groupId,
    memberId: invitation.memberId,
    invitedByUserId: invitation.invitedByUserId,
    targetEmail: invitation.targetEmail,
    status: invitation.status,
    createdAt: invitation.createdAt,
    respondedAt: invitation.respondedAt,
  }
}

/** Igual que PublicSharedGroupInvitation + los 2 datos que necesita el
 * inbox de invitaciones dentro de SharedGroupsModal ("Diego te invitó a
 * Casa") — usada ÚNICAMENTE por GET /api/shared-group-invitations, nunca
 * por send/accept/reject/cancel (que no necesitan pagar el costo de
 * resolverlos). Sigue sin incluir tokenHash. */
export interface PublicSharedGroupInvitationWithDetails extends PublicSharedGroupInvitation {
  groupName: string
  inviterName: string
}

export function toPublicInvitationWithDetails(invitation: SharedGroupInvitationWithDetails): PublicSharedGroupInvitationWithDetails {
  return {
    ...toPublicInvitation(invitation),
    groupName: invitation.groupName,
    inviterName: invitation.inviterName,
  }
}
