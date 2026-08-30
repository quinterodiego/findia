import { getSharedGroupById, getSharedGroupMembers, createSharedGroupMember } from '@/lib/googleSheets'
import { ApiError, wrapPhase1Call } from '../../_lib/apiError'

const MAX_NAME_LENGTH = 80
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** GET /api/shared-groups/[id]/members — solo miembros vinculados pueden listar. */
export async function listSharedGroupMembersForUser(groupId: string, userId: string) {
  const group = await getSharedGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await getSharedGroupMembers(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  return members
}

/**
 * POST /api/shared-groups/[id]/members — cualquier miembro vinculado puede
 * agregar un miembro (fricción cero, MVP). Todo miembro agregado por esta
 * ruta queda SIEMPRE como shadow member (sin userId) — el body NUNCA se lee
 * para un `userId`, ni siquiera si el cliente lo envía; no hay auto-claim ni
 * búsqueda por email, incluso si ese email coincide con una cuenta FindIA
 * real. Duplicados: mismo email normalizado (trim+lowercase) entre dos
 * miembros con email -> rechazado; nombres iguales sin email son válidos
 * (dos personas reales pueden llamarse igual).
 */
export async function addSharedGroupMemberForUser(groupId: string, userId: string, body: unknown) {
  const group = await getSharedGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await getSharedGroupMembers(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  const rawName = (body as { name?: unknown })?.name
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!name) throw new ApiError(400, 'El nombre del miembro es requerido')
  if (name.length > MAX_NAME_LENGTH) throw new ApiError(400, `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres`)

  const rawEmail = (body as { email?: unknown })?.email
  let email: string | undefined
  if (rawEmail !== undefined && rawEmail !== null && rawEmail !== '') {
    if (typeof rawEmail !== 'string') throw new ApiError(400, 'El email debe ser un texto')
    const trimmed = rawEmail.trim()
    if (trimmed && !EMAIL_REGEX.test(trimmed)) throw new ApiError(400, 'El email no tiene un formato válido')
    email = trimmed || undefined
  }

  if (email) {
    const normalizedNew = email.toLowerCase()
    const duplicate = members.some((m) => m.email && m.email.toLowerCase() === normalizedNew)
    if (duplicate) throw new ApiError(409, 'Ya existe un miembro con ese email en este grupo')
  }

  // userId nunca se pasa acá, aunque el body lo incluya -- queda undefined (shadow member).
  return wrapPhase1Call(() => createSharedGroupMember(groupId, { name, email }))
}
