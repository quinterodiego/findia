import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { ApiError, wrapPhase1Call } from '../../../_lib/apiError'

const MAX_NAME_LENGTH = 80
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const repository = getSharedGroupsRepository()

/**
 * PUT /api/shared-groups/[id]/members/[memberId] — solo el creador del
 * grupo puede editar un miembro. Solo se leen/aplican `name`/`email` del
 * body: `userId`, `groupId`, `id` y `createdAt` nunca se tocan, aunque el
 * cliente los envíe (simplemente se ignoran, no se rechazan explícitamente).
 */
export async function editSharedGroupMemberForUser(
  groupId: string,
  memberId: string,
  userId: string,
  body: unknown
) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')
  if (group.createdBy !== userId) throw new ApiError(403, 'Solo el creador del grupo puede editar miembros')

  const members = await repository.getMembers(groupId)
  const target = members.find((m) => m.id === memberId)
  if (!target) throw new ApiError(404, 'Miembro no encontrado')

  const data: { name?: string; email?: string } = {}

  const rawName = (body as { name?: unknown })?.name
  if (rawName !== undefined) {
    const name = typeof rawName === 'string' ? rawName.trim() : ''
    if (!name) throw new ApiError(400, 'El nombre del miembro no puede estar vacío')
    if (name.length > MAX_NAME_LENGTH) throw new ApiError(400, `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres`)
    data.name = name
  }

  const rawEmail = (body as { email?: unknown })?.email
  if (rawEmail !== undefined) {
    if (rawEmail === null || rawEmail === '') {
      data.email = ''
    } else {
      if (typeof rawEmail !== 'string') throw new ApiError(400, 'El email debe ser un texto')
      const trimmed = rawEmail.trim()
      if (trimmed && !EMAIL_REGEX.test(trimmed)) throw new ApiError(400, 'El email no tiene un formato válido')
      if (trimmed) {
        const normalizedNew = trimmed.toLowerCase()
        const duplicate = members.some((m) => m.id !== memberId && m.email && m.email.toLowerCase() === normalizedNew)
        if (duplicate) throw new ApiError(409, 'Ya existe un miembro con ese email en este grupo')
      }
      data.email = trimmed
    }
  }

  return wrapPhase1Call(() => repository.updateMember(memberId, data))
}

/**
 * DELETE /api/shared-groups/[id]/members/[memberId] — solo el creador.
 * Bloqueado (409) si el miembro tiene gastos/splits/settlements asociados
 * (evita filas huérfanas), y bloqueado (409) si es el miembro vinculado al
 * propio creador del grupo (no se puede quitar al dueño del grupo de su
 * propio grupo en esta fase).
 */
export async function deleteSharedGroupMemberForUser(groupId: string, memberId: string, userId: string) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')
  if (group.createdBy !== userId) throw new ApiError(403, 'Solo el creador del grupo puede eliminar miembros')

  const members = await repository.getMembers(groupId)
  const target = members.find((m) => m.id === memberId)
  if (!target) throw new ApiError(404, 'Miembro no encontrado')

  const creatorMember = members.find((m) => m.userId === group.createdBy)
  if (creatorMember?.id === memberId) {
    throw new ApiError(409, 'No se puede eliminar al miembro vinculado al creador del grupo')
  }

  const referenced = await repository.isMemberReferenced(groupId, memberId)
  if (referenced) {
    throw new ApiError(409, 'No podés eliminar este miembro porque tiene movimientos asociados')
  }

  await wrapPhase1Call(() => repository.deleteMember(memberId))
}
