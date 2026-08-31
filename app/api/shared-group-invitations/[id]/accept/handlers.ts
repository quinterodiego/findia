import { getSharedGroupsRepository } from '@/lib/repositories/sharedGroups'
import { normalizeInvitationEmail, verifyInvitationToken } from '@/lib/sharedGroupInvitations'
import { ApiError, wrapPhase1Call } from '@/app/api/shared-groups/_lib/apiError'
import type { SharedGroupInvitation } from '@/types'

const GENERIC_UNAUTHORIZED = 'Invitación no autorizada'
const repository = getSharedGroupsRepository()

/**
 * POST /api/shared-group-invitations/[id]/accept
 *
 * Seguridad: la prueba de identidad NO es "el email coincide" — es la
 * POSESIÓN del token secreto (recibido por email) sumada a una sesión
 * autenticada. El email match es una defensa ADICIONAL (evita que alguien
 * ya logueado reenvíe sin querer un link ajeno y termine vinculando su
 * propia cuenta a un member que no le corresponde) — nunca la prueba
 * principal, precisamente porque la auditoría de auth de FINDIA encontró
 * que Credentials no verifica ownership de email.
 *
 * Orden deliberado, DISTINTO al orden numerado del enunciado original: acá
 * se verifica el token PRIMERO, antes de mirar el status de la invitación.
 * Si se mirara el status antes (o se devolviera un mensaje distinto según
 * el status con un token inválido), alguien sin el token correcto podría
 * usar la respuesta como oráculo para inferir si una invitación sigue
 * pending, ya fue aceptada, etc., sin nunca haber probado que la posee.
 * Por eso: token inválido O email no coincide -> SIEMPRE el mismo 403
 * genérico, sin importar el status real. Recién con token+email
 * verificados se distingue el motivo exacto de un 409 (ya aceptada, ya
 * rechazada, etc.), porque en ese punto quien pregunta ya demostró
 * legítimamente que la invitación es suya.
 *
 * FASE 4.4 — CANAL B (in-app, sin token): una invitación descubierta dentro
 * de FINDIA (GET /api/shared-group-invitations) no trae el token plano —
 * solo se persiste tokenHash, por diseño (Fase 4.1). Permitir aceptar sin
 * token SOLO si `hasVerifiedGoogleSession` es true: ese flag sale de
 * `!!session.accessToken` en el route.ts, y `accessToken` en el JWT de
 * FINDIA únicamente se setea cuando el proveedor fue Google (ver
 * lib/auth.ts, sin modificarlo) — o sea, es una prueba de que ESTA sesión
 * verificó el email vía OAuth de Google, equivalente en fuerza a "poseer el
 * token del email" para el caso de Credentials (que nunca verifica
 * ownership de email, motivo por el cual NO se permite este canal para
 * sesiones Credentials). No se agrega ninguna tabla ni criptografía nueva.
 */
export async function acceptSharedGroupInvitationForUser(
  invitationId: string,
  userId: string,
  userEmail: string | null | undefined,
  hasVerifiedGoogleSession: boolean,
  body: unknown
): Promise<SharedGroupInvitation> {
  const rawToken = (body as { token?: unknown })?.token
  const token = typeof rawToken === 'string' ? rawToken : ''

  const invitation = await repository.getInvitationById(invitationId)
  if (!invitation) throw new ApiError(404, 'Invitación no encontrada')

  if (token) {
    // CANAL A — sin cambios de comportamiento respecto a Fase 4.2.
    if (!verifyInvitationToken(token, invitation.tokenHash)) {
      throw new ApiError(403, GENERIC_UNAUTHORIZED)
    }
  } else if (!hasVerifiedGoogleSession) {
    // Ni token ni sesión de Google verificada -- no hay forma segura de
    // probar identidad para este canal. Mensaje específico (no es un
    // oráculo: no revela nada sobre el status de la invitación).
    throw new ApiError(403, 'Para aceptar esta invitación necesitás abrir el link que te enviamos por email.')
  }

  if (!userEmail) throw new ApiError(403, GENERIC_UNAUTHORIZED)
  if (normalizeInvitationEmail(userEmail) !== invitation.targetEmail) {
    throw new ApiError(403, GENERIC_UNAUTHORIZED)
  }

  // A partir de acá, token + email ya están probados: los mensajes pueden
  // ser específicos sin filtrar información a un atacante sin el token.
  const members = await repository.getMembers(invitation.groupId)
  const member = members.find((m) => m.id === invitation.memberId)
  if (!member) throw new ApiError(404, 'El miembro de esta invitación ya no existe')

  if (invitation.status === 'accepted') {
    if (member.userId === userId) {
      return invitation // Caso C: idempotente, ya estaba todo hecho
    }
    if (!member.userId) {
      // Caso D: estado inconsistente -- no se asume nada, se reporta.
      throw new ApiError(
        500,
        'Estado de invitación inconsistente (aceptada pero sin miembro vinculado). Contactá soporte.'
      )
    }
    // Caso E: accepted y vinculada a OTRA cuenta real.
    throw new ApiError(409, 'Esta invitación ya fue aceptada por otra cuenta')
  }

  if (invitation.status !== 'pending') {
    const label = invitation.status === 'rejected' ? 'rechazada' : 'cancelada'
    throw new ApiError(409, `Esta invitación ya fue ${label}`)
  }

  // status === 'pending' -- Caso F: el member ya está linkeado a OTRA cuenta.
  if (member.userId && member.userId !== userId) {
    throw new ApiError(409, 'Este miembro ya está vinculado a otra cuenta')
  }

  // Fase DB-4.1: link + accept ahora es UNA operación de repository
  // (acceptInvitationAndLinkMember) en vez de 2 llamadas separadas -- en
  // Postgres es una transacción real (todo o nada); en Sheets sigue siendo
  // el mismo orden best-effort de siempre (link primero, accept después).
  const result = await wrapPhase1Call(() => repository.acceptInvitationAndLinkMember(invitationId, userId))
  return result.invitation
}
