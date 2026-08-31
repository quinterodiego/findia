import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { ApiError, wrapPhase1Call } from '../_lib/apiError'

const MAX_NAME_LENGTH = 80
const repository = getSharedGroupsRepository()

/**
 * GET /api/shared-groups/[id]
 * Solo un miembro vinculado puede ver el grupo. La membresía se resuelve
 * SIEMPRE por SharedGroupMember.userId — nunca por email, nunca por
 * createdBy (otro usuario registrado puede pertenecer al grupo sin haberlo
 * creado).
 */
export async function getSharedGroupDetailForUser(groupId: string, userId: string) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const member = await repository.getMemberForUser(groupId, userId)
  if (!member) throw new ApiError(403, 'No pertenecés a este grupo')

  return { group, myMemberId: member.id }
}

/** PUT /api/shared-groups/[id] — solo el creador puede renombrar. */
export async function renameSharedGroupForUser(groupId: string, userId: string, body: unknown) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')
  if (group.createdBy !== userId) throw new ApiError(403, 'Solo el creador del grupo puede renombrarlo')

  const rawName = (body as { name?: unknown })?.name
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!name) throw new ApiError(400, 'El nombre del grupo es requerido')
  if (name.length > MAX_NAME_LENGTH) throw new ApiError(400, `El nombre del grupo no puede superar los ${MAX_NAME_LENGTH} caracteres`)

  return wrapPhase1Call(() => repository.updateGroup(groupId, userId, { name }))
}

/**
 * DELETE /api/shared-groups/[id] — solo el creador. Delete coordinado en
 * cascada (splits -> expenses -> settlements -> members -> group), ver
 * deleteSharedGroupCascade en lib/googleSheets.ts. Google Sheets no tiene
 * transacciones reales: si un paso intermedio falla, la operación puede
 * quedar parcialmente aplicada — se relanza el error tal cual, sin ocultar
 * esa posibilidad (ver informe de entrega para la justificación completa).
 */
export async function deleteSharedGroupForUser(groupId: string, userId: string) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')
  if (group.createdBy !== userId) throw new ApiError(403, 'Solo el creador del grupo puede eliminarlo')

  await wrapPhase1Call(() => repository.deleteGroupCascade(groupId, userId))
}
