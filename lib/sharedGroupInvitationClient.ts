/**
 * Helper puro y mínimo para Fase 4.3.1 — construye la ruta de retorno a la
 * página de invitación (usada como `callbackUrl` de AuthModal y como
 * `callbackUrl` de `signOut()`). Separado de la página en sí para poder
 * testearlo sin necesitar un framework de testing de componentes (este
 * repo no tiene jest/vitest/testing-library — todos los tests son scripts
 * de Node).
 *
 * SIEMPRE construye una ruta INTERNA relativa a partir de `invitationId`
 * (el param de la propia ruta, nunca un query param) — nunca acepta ni lee
 * un callback/redirect arbitrario. Es la única fuente de verdad de "a dónde
 * volver", para que no pueda existir un open redirect por otro camino.
 */
export function buildInvitationReturnPath(invitationId: string): string {
  return `/shared-group-invitation/${encodeURIComponent(invitationId)}`
}
