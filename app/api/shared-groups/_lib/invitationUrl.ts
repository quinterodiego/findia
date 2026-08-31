import { getBaseUrl } from '@/lib/email'

/**
 * URL pública que ve el receptor de una invitación — una página real de
 * FINDIA (`/shared-group-invitation/[id]`), nunca una ruta de `/api/...`.
 * Reutiliza getBaseUrl() de lib/email.ts (misma estrategia ya usada por los
 * templates de SharedExpense: NEXT_PUBLIC_APP_URL -> NEXTAUTH_URL -> NODE_ENV
 * -> localhost) en vez de inventar una segunda forma de resolver el origin.
 *
 * El token va como query param porque es la única forma de que le llegue al
 * receptor por email; el resto del flujo (ver app/shared-group-invitation/
 * [id]/page.tsx) lo saca de la URL apenas lo recibe y no lo vuelve a dejar
 * ahí.
 */
export function buildSharedGroupInvitationUrl(invitationId: string, token: string): string {
  const base = getBaseUrl().replace(/\/$/, '')
  return `${base}/shared-group-invitation/${encodeURIComponent(invitationId)}?token=${encodeURIComponent(token)}`
}
