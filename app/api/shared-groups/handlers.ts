import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { ApiError, wrapPhase1Call } from './_lib/apiError'

const MAX_NAME_LENGTH = 80
const repository = getSharedGroupsRepository()

/**
 * GET /api/shared-groups
 * Lista los grupos del usuario (solo donde tiene un SharedGroupMember.userId
 * vinculado) con el balance de cada uno ya calculado — ver
 * getSharedGroupsSummaryForUser: 5 lecturas TOTALES sin importar la cantidad
 * de grupos (nunca "por cada grupo, un fetch de balance").
 */
export async function listSharedGroupsForUser(userId: string) {
  return repository.getGroupsSummaryForUser(userId)
}

/**
 * POST /api/shared-groups
 * Crea un grupo. `createdBy` y el nombre/email del miembro-creador SIEMPRE
 * se resuelven desde la sesión — nunca desde el body — para que el frontend
 * no pueda hacerse pasar por otro nombre/email.
 */
export async function createSharedGroupForUser(
  userId: string,
  sessionUser: { name?: string | null; email?: string | null },
  body: unknown
) {
  const rawName = (body as { name?: unknown })?.name
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!name) throw new ApiError(400, 'El nombre del grupo es requerido')
  if (name.length > MAX_NAME_LENGTH) throw new ApiError(400, `El nombre del grupo no puede superar los ${MAX_NAME_LENGTH} caracteres`)

  // Estrategia de fallback documentada: nombre de sesión -> parte local del
  // email -> literal "Usuario". Nunca se acepta un nombre enviado por el cliente.
  const creatorName = (sessionUser.name || '').trim() || (sessionUser.email || '').split('@')[0] || 'Usuario'
  const creatorEmail = sessionUser.email || undefined

  const { group, creatorMember } = await wrapPhase1Call(() => repository.createGroup(userId, { name, creatorName, creatorEmail }))
  return { group, creatorMember }
}
