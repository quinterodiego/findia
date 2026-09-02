/**
 * Fase DB-8.1 (cutover) — predicado puro del maintenance freeze de
 * PushSubscriptions. Mismo patrón que `lib/sharedGroupsMaintenance.ts`
 * (DB-7A.1), env var propia (`PUSH_SUBSCRIPTIONS_MAINTENANCE_MODE`) --
 * nunca `SHARED_GROUPS_MAINTENANCE_MODE`, para que un freeze de un dominio
 * no pueda afectar accidentalmente al otro.
 *
 * Alcance EXCLUSIVO: `POST`/`DELETE /api/push/subscribe` -- las dos únicas
 * mutaciones reales de PushSubscriptions (crear/actualizar y eliminar una
 * suscripción). `GET /api/push/vapid-public-key` no es una mutación, sigue
 * abierto. `POST /api/push/send` deliberadamente NO se congela acá: su
 * única escritura incidental es un cleanup de una suscripción vencida
 * (410 Gone) -- fuera del alcance pedido ("congelar exclusivamente
 * subscribe/unsubscribe"), documentado como riesgo aceptado y menor.
 */

export const PUSH_SUBSCRIPTIONS_MAINTENANCE_MESSAGE =
  'Las notificaciones push están temporalmente en mantenimiento. Probá de nuevo en unos minutos.'

const PROTECTED_PATH = '/api/push/subscribe'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isPushSubscriptionsMutationPath(pathname: string): boolean {
  return pathname === PROTECTED_PATH
}

export function isMaintenanceModeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PUSH_SUBSCRIPTIONS_MAINTENANCE_MODE === 'true'
}

export function shouldBlockForMaintenance(
  method: string,
  pathname: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false
  if (!isPushSubscriptionsMutationPath(pathname)) return false
  return isMaintenanceModeEnabled(env)
}
