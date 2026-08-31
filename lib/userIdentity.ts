/**
 * Fase 4.4.1 -- regla única de "¿podemos vincular directamente a este User a
 * un SharedGroupMember sin invitación?". Ver auditorías 4.4.1-A/A2/A3.
 *
 * `googleOnlyIdentity` usa semántica CONSERVADORA a propósito: `true` SOLO
 * se persiste (en lib/auth.ts) cuando una fila de Users se crea desde cero
 * mediante Google, sin que haya existido nunca antes. Cualquier otro valor
 * -- `false`, `undefined`, legacy -- significa "no seguro", nunca se
 * convierte una ausencia en `false` ni se infiere nada del pasado.
 *
 * El chequeo de `password` vacío es defensa en profundidad: por
 * construcción, ninguna fila con `googleOnlyIdentity === true` debería
 * tener password (nunca pasó por registerUser), pero se revalida igual acá
 * en vez de confiar ciegamente en esa invariante.
 *
 * Esto NO cubre el caso "Credentials que luego verifica con Google" -- la
 * auditoría 4.4.1-A3 demostró que un JWT Credentials emitido antes de esa
 * verificación sigue siendo válido después (next-auth con `strategy: "jwt"`
 * no revoca tokens ya emitidos), así que ese caso se deja deliberadamente
 * afuera hasta que exista una revocación de sesiones real.
 */
export interface DirectLinkableUser {
  password?: string
  googleVerifiedAt?: string
  googleOnlyIdentity?: boolean
}

export function canDirectlyLinkUser(user: DirectLinkableUser): boolean {
  return !!user.googleVerifiedAt && !user.password && user.googleOnlyIdentity === true
}
