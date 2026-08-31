import crypto from 'crypto'
import type { SharedGroupInvitation } from '@/types'
import type { ValidationResult } from '@/lib/sharedGroupBalances'

// ============================================================================
// Fase 4.1 — Invitaciones de Gastos Compartidos V2: helpers puros.
// Nada acá toca Google Sheets. La persistencia real vive en
// lib/googleSheets.ts y llama a estas funciones — se separan para poder
// testear las reglas de negocio y la seguridad del token sin red ni Sheets.
// ============================================================================

const INVITATION_TOKEN_BYTES = 32

/**
 * Normaliza un email para compararlo de forma consistente en toda la
 * persistencia de invitaciones (trim + lowercase). Mismo criterio que
 * getUserByEmail en lib/googleSheets.ts, pero como helper propio y mínimo:
 * no se toca esa función global para no ampliar el alcance de esta fase.
 */
export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Token de invitación de un solo uso, apto para ir directo en una URL.
 * Generado con crypto.randomBytes (nunca Math.random) y codificado en
 * base64url. El token PLANO solo existe en memoria en el momento de la
 * creación de la invitación — nunca se persiste ni se loggea; lo único
 * que se guarda es su hash (hashInvitationToken).
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(INVITATION_TOKEN_BYTES).toString('base64url')
}

/** SHA-256 del token plano — es lo único que se persiste en `tokenHash`. */
export function hashInvitationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Verifica un token recibido contra el hash persistido usando
 * timingSafeEqual (no `===`) para no filtrar información por el tiempo de
 * comparación. Si los buffers no tienen la misma longitud (dato corrupto o
 * hash inválido) se trata como "no verificado" en vez de dejar lanzar
 * timingSafeEqual, que exige longitudes iguales.
 */
export function verifyInvitationToken(token: string, tokenHash: string): boolean {
  const candidateHash = hashInvitationToken(token)
  const candidate = Buffer.from(candidateHash, 'hex')
  const stored = Buffer.from(tokenHash, 'hex')
  if (candidate.length !== stored.length) return false
  return crypto.timingSafeEqual(candidate, stored)
}

export function isInvitationPending(invitation: SharedGroupInvitation): boolean {
  return invitation.status === 'pending'
}

export function hasPendingInvitation(invitations: SharedGroupInvitation[]): boolean {
  return invitations.some(isInvitationPending)
}

/**
 * Reglas mínimas antes de crear una invitación para un member. Es un helper
 * puro para que la API de Fase 4.2 decida qué status HTTP corresponde (ej.
 * 409) — createSharedGroupInvitation en lib/googleSheets.ts NO llama a esto
 * automáticamente, solo valida integridad de datos (grupo/member existen).
 * La decisión de negocio "¿se puede invitar a este member ahora?" queda acá,
 * separada y testeable sin Sheets.
 */
export function canCreateInvitation(
  member: { userId?: string },
  existingInvitationsForMember: SharedGroupInvitation[]
): ValidationResult {
  if (member.userId) {
    return { valid: false, error: 'Este miembro ya está vinculado a una cuenta' }
  }
  if (hasPendingInvitation(existingInvitationsForMember)) {
    return { valid: false, error: 'Ya existe una invitación pendiente para este miembro' }
  }
  return { valid: true }
}

const ALLOWED_INVITATION_TRANSITIONS: Record<SharedGroupInvitation['status'], SharedGroupInvitation['status'][]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: [],
  rejected: [],
  cancelled: [],
}

/**
 * Única fuente de verdad de qué transiciones de status son válidas.
 * `pending` es el único estado no terminal; accepted/rejected/cancelled son
 * finales — reinvitar siempre crea una fila nueva (nueva invitación), nunca
 * reabre una existente.
 */
export function validateInvitationTransition(
  from: SharedGroupInvitation['status'],
  to: SharedGroupInvitation['status']
): ValidationResult {
  if (ALLOWED_INVITATION_TRANSITIONS[from]?.includes(to)) {
    return { valid: true }
  }
  return { valid: false, error: `No se puede pasar de "${from}" a "${to}"` }
}
