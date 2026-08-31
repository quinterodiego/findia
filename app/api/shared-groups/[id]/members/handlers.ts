import { getUserByEmail } from '@/lib/googleSheets'
import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { canDirectlyLinkUser } from '@/lib/userIdentity'
import { ApiError, wrapPhase1Call } from '../../_lib/apiError'

const MAX_NAME_LENGTH = 80
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const repository = getSharedGroupsRepository()

/** GET /api/shared-groups/[id]/members — solo miembros vinculados pueden listar. */
export async function listSharedGroupMembersForUser(groupId: string, userId: string) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await repository.getMembers(groupId)
  const isMember = members.some((m) => m.userId === userId)
  if (!isMember) throw new ApiError(403, 'No pertenecés a este grupo')

  return members
}

/**
 * POST /api/shared-groups/[id]/members — cualquier miembro vinculado puede
 * agregar un miembro (fricción cero, MVP). El `userId` NUNCA se lee del
 * body, ni siquiera si el cliente lo envía — se resuelve exclusivamente
 * server-side (Fase 4.4.1):
 *
 *   1. si ya hay un member en el grupo con ese email normalizado:
 *      - si ya está linked (userId) -> 409, no se toca ni se duplica.
 *      - si es shadow -> se reevalúa si el User de ese email ahora es
 *        `canDirectlyLinkUser`; si sí, se linkea ESE MISMO member (nunca se
 *        crea uno nuevo, preserva expenses/splits/settlements históricos) y
 *        se cancela cualquier invitation pending suya (member-first). Si no
 *        es elegible, sigue siendo el mismo 409 de siempre — no hay forma de
 *        distinguir desde afuera "existe pero no es elegible" de "ya existe
 *        un miembro con ese email", por diseño (no se filtra info de auth).
 *   2. si no hay member previo con ese email: se busca el User una sola vez
 *      y, si es `canDirectlyLinkUser`, el member nuevo se crea YA linked
 *      (sin invitación/token/email); si no, se crea shadow, exactamente
 *      como en Fase 4.1-4.4.
 *
 * Nunca se expone al cliente el motivo de inelegibilidad ni ningún campo de
 * User (password/googleVerifiedAt/googleOnlyIdentity) — el DTO de member no
 * los incluye por diseño.
 */
export async function addSharedGroupMemberForUser(groupId: string, userId: string, body: unknown) {
  const group = await repository.getGroupById(groupId)
  if (!group) throw new ApiError(404, 'Grupo no encontrado')

  const members = await repository.getMembers(groupId)
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

  if (!email) {
    // Sin email no hay nada que resolver -- shadow de siempre.
    return wrapPhase1Call(() => repository.createMember(groupId, { name }))
  }

  const normalizedNew = email.toLowerCase()
  const existingMemberWithEmail = members.find((m) => m.email && m.email.toLowerCase() === normalizedNew)

  if (existingMemberWithEmail) {
    if (existingMemberWithEmail.userId) {
      throw new ApiError(409, 'Ya existe un miembro con ese email en este grupo')
    }

    // Member-first: shadow existente con este email -- reevaluar si ahora es elegible.
    const foundUser = await getUserByEmail(email)
    if (!foundUser || !canDirectlyLinkUser(foundUser)) {
      throw new ApiError(409, 'Ya existe un miembro con ese email en este grupo')
    }

    // Fase DB-4.1: link + cancelación de la(s) invitation(s) pending ahora es
    // UNA operación de repository (linkMemberAndCancelPendingInvitation) en
    // vez de 3 llamadas separadas -- en Postgres es una transacción real; en
    // Sheets sigue siendo best-effort (el link ya quedó aplicado aunque la
    // cancelación falle, ver sheetsRepository.ts).
    const result = await wrapPhase1Call(() => repository.linkMemberAndCancelPendingInvitation(existingMemberWithEmail.id, foundUser.id))
    return result.member
  }

  // Sin member previo con este email: decidir linked vs shadow para uno nuevo.
  const foundUser = await getUserByEmail(email)
  const directLinkUserId = foundUser && canDirectlyLinkUser(foundUser) ? foundUser.id : undefined

  return wrapPhase1Call(() => repository.createMember(groupId, { name, email, userId: directLinkUserId }))
}
