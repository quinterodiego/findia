/**
 * Fase DB-7A.1 — predicado puro del maintenance freeze de Shared Groups V2.
 * Separado de `middleware.ts` a propósito: así se puede testear sin levantar
 * el runtime de Next (edge/node) y sin depender del matcher del framework
 * (que además ya restringe qué requests llegan acá) -- doble chequeo de
 * pathname como defensa en profundidad, nunca confiar solo en el matcher.
 *
 * Alcance EXCLUSIVO: `/api/shared-groups/**` y `/api/shared-group-invitations/**`.
 * Nunca toca `/api/shared-expenses` (feature legacy, no relacionada), `/api/auth`,
 * ni ninguna otra ruta de FINDIA.
 */

export const SHARED_GROUPS_MAINTENANCE_MESSAGE =
  'Gastos compartidos está temporalmente en mantenimiento. Probá de nuevo en unos minutos.'

const PROTECTED_PATH_PREFIXES = ['/api/shared-groups', '/api/shared-group-invitations']

/** Métodos que nunca mutan -- siempre permitidos, incluso con el freeze activo. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isSharedGroupsMutationPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** Tipo de `env` deliberadamente laxo (no `NodeJS.ProcessEnv`) para que los
 * tests puedan pasar objetos parciales -- mismo patrón que
 * `resolveSharedGroupsStorage` en lib/repositories/sharedGroups/index.ts. */
export function isMaintenanceModeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SHARED_GROUPS_MAINTENANCE_MODE === 'true'
}

/** true si esta request debe cortarse con 503 antes de llegar al handler. */
export function shouldBlockForMaintenance(
  method: string,
  pathname: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false
  if (!isSharedGroupsMutationPath(pathname)) return false
  return isMaintenanceModeEnabled(env)
}
