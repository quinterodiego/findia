/**
 * Fase DB-3 — implementación Sheets de SharedGroupsRepository.
 *
 * Envoltorio delgado: cada método delega 1:1 en la función existente de
 * `lib/googleSheets.ts`, SIN cambiar orden de operaciones, validaciones,
 * ni comportamiento multi-step (compensating deletes incluidos). Es
 * exactamente el mismo código que ya corría -- solo cambia desde dónde se
 * lo llama.
 */
import {
  createSharedGroup,
  getSharedGroupById,
  getSharedGroupsSummaryForUser,
  updateSharedGroup,
  deleteSharedGroupCascade,
  getSharedGroupMembers,
  getSharedGroupMemberForUser,
  createSharedGroupMember,
  updateSharedGroupMember,
  linkSharedGroupMemberToUser,
  deleteSharedGroupMember,
  isSharedGroupMemberReferenced,
  getSharedGroupExpenses,
  getSharedGroupSplitsForExpenseIds,
  createSharedGroupExpense,
  updateSharedGroupExpense,
  deleteSharedGroupExpense,
  getSharedGroupSettlements,
  getSharedGroupBalanceInputs,
  createSharedGroupSettlement,
  updateSharedGroupSettlement,
  deleteSharedGroupSettlement,
  getSharedGroupInvitationById,
  getSharedGroupInvitationsByGroup,
  getSharedGroupInvitationsByMember,
  getSharedGroupInvitationsByTargetEmail,
  getSharedGroupInvitationsWithDetailsForTargetEmail,
  createSharedGroupInvitation,
  updateSharedGroupInvitation,
  deleteSharedGroupInvitation,
} from '@/lib/googleSheets'
import type { SharedGroupInvitation, SharedGroupMember } from '@/types'
import type { SharedGroupsRepository } from './types'

// ============================================================================
// Fase DB-4.1 — operaciones compuestas. Sheets NO soporta transacciones
// reales: estas dos funciones son best-effort, con el MISMO orden seguro que
// ya usaban los handlers antes de esta fase (linkear primero, marcar la
// invitation después -- si algo falla entre medio, el estado importante ya
// quedó aplicado y un reintento completa lo que falta).
// ============================================================================

async function acceptInvitationAndLinkMemberSheets(
  invitationId: string,
  userId: string
): Promise<{ invitation: SharedGroupInvitation; member: SharedGroupMember }> {
  const invitation = await getSharedGroupInvitationById(invitationId)
  if (!invitation) throw new Error('Invitación no encontrada')

  const members = await getSharedGroupMembers(invitation.groupId)
  const member = members.find((m) => m.id === invitation.memberId)
  if (!member) throw new Error('El miembro de esta invitación ya no existe')

  // Idempotencia (mismo criterio que ya vivía en el handler antes de esta
  // fase): si ya está accepted y el member ya es de este userId, no-op.
  if (invitation.status === 'accepted' && member.userId === userId) {
    return { invitation, member }
  }

  const linkedMember = await linkSharedGroupMemberToUser(member.id, userId)
  const updatedInvitation = await updateSharedGroupInvitation(invitationId, 'accepted')
  return { invitation: updatedInvitation, member: linkedMember }
}

async function linkMemberAndCancelPendingInvitationSheets(
  memberId: string,
  userId: string
): Promise<{ member: SharedGroupMember; cancelledInvitationIds: string[] }> {
  const linkedMember = await linkSharedGroupMemberToUser(memberId, userId)

  // Sheets no tiene el invariante "máximo 1 pending por member" a nivel de
  // constraint (eso solo existe en Postgres, Fase DB-2). Si datos históricos
  // dejaran más de una por una corrupción/race pasada, se cancelan TODAS las
  // pending encontradas -- nunca se tocan estados terminales (accepted/
  // rejected/cancelled quedan intactos).
  const cancelledInvitationIds: string[] = []
  try {
    const groupInvitations = await getSharedGroupInvitationsByGroup(linkedMember.groupId)
    const pending = groupInvitations.filter((inv) => inv.memberId === memberId && inv.status === 'pending')
    for (const inv of pending) {
      await updateSharedGroupInvitation(inv.id, 'cancelled')
      cancelledInvitationIds.push(inv.id)
    }
  } catch (error) {
    console.error('No se pudo cancelar alguna invitation pending tras un direct-link (no crítico):', error)
  }

  return { member: linkedMember, cancelledInvitationIds }
}

export const sheetsSharedGroupsRepository: SharedGroupsRepository = {
  // --- groups ---------------------------------------------------------
  createGroup: createSharedGroup,
  getGroupById: getSharedGroupById,
  getGroupsSummaryForUser: getSharedGroupsSummaryForUser,
  updateGroup: updateSharedGroup,
  deleteGroupCascade: deleteSharedGroupCascade,

  // --- members ---------------------------------------------------------
  getMembers: getSharedGroupMembers,
  getMemberForUser: getSharedGroupMemberForUser,
  createMember: createSharedGroupMember,
  updateMember: updateSharedGroupMember,
  linkMemberToUser: linkSharedGroupMemberToUser,
  deleteMember: deleteSharedGroupMember,
  isMemberReferenced: isSharedGroupMemberReferenced,

  // --- expenses ---------------------------------------------------------
  getExpenses: getSharedGroupExpenses,
  getSplitsForExpenseIds: getSharedGroupSplitsForExpenseIds,
  createExpense: createSharedGroupExpense,
  updateExpense: updateSharedGroupExpense,
  deleteExpense: deleteSharedGroupExpense,

  // --- settlements ---------------------------------------------------------
  getSettlements: getSharedGroupSettlements,
  getBalanceInputs: getSharedGroupBalanceInputs,
  createSettlement: createSharedGroupSettlement,
  updateSettlement: updateSharedGroupSettlement,
  deleteSettlement: deleteSharedGroupSettlement,

  // --- invitations ---------------------------------------------------------
  getInvitationById: getSharedGroupInvitationById,
  getInvitationsByGroup: getSharedGroupInvitationsByGroup,
  getInvitationsByMember: getSharedGroupInvitationsByMember,
  getInvitationsByTargetEmail: getSharedGroupInvitationsByTargetEmail,
  getInvitationsWithDetailsForTargetEmail: getSharedGroupInvitationsWithDetailsForTargetEmail,
  createInvitation: createSharedGroupInvitation,
  updateInvitationStatus: updateSharedGroupInvitation,
  deleteInvitation: deleteSharedGroupInvitation,

  // --- operaciones compuestas (Fase DB-4.1) ---------------------------------
  acceptInvitationAndLinkMember: acceptInvitationAndLinkMemberSheets,
  linkMemberAndCancelPendingInvitation: linkMemberAndCancelPendingInvitationSheets,
}
