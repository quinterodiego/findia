/**
 * Tests puros de Fase 4.3.1 — construcción de la URL de retorno usada como
 * `callbackUrl` (login/registro/signOut) para volver a la página de
 * invitación. Sin red, sin Sheets, sin renderizar componentes.
 *
 * Ejecutar con: npx tsx scripts/test-shared-group-invitation-callback-pure.ts
 */
import { buildInvitationReturnPath } from '../lib/sharedGroupInvitationClient'

let failures = 0
function assertTrue(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

console.log('\n=== Caso normal ===')
const normal = buildInvitationReturnPath('inv-123')
assertTrue('Es una ruta interna que empieza con /shared-group-invitation/', normal.startsWith('/shared-group-invitation/'), normal)
assertTrue('Contiene el invitation id', normal.includes('inv-123'), normal)
assertTrue('NUNCA contiene ?token=', !normal.includes('token='), normal)
assertTrue('Es relativa (no tiene protocolo)', !normal.includes('://'), normal)

console.log('\n=== No se puede inyectar un open redirect vía el invitationId ===')
const attempts = [
  'https://evil.com',
  '//evil.com',
  '/../../evil.com',
  'inv-123?callbackUrl=https://evil.com',
  'inv-123#@evil.com',
]
for (const maliciousId of attempts) {
  const path = buildInvitationReturnPath(maliciousId)
  // La propiedad de seguridad real no es "no contiene la palabra evil.com"
  // (percent-encoded, "evil.com" puede seguir apareciendo como texto plano
  // dentro de un segmento de ruta inerte -- eso es inofensivo). Lo que
  // importa es que siga siendo UNA SOLA ruta interna: arranca con el
  // prefijo fijo, no arranca con "//" (protocol-relative) y no queda
  // ningún "://" SIN escapar que un navegador pudiera interpretar como
  // esquema+host.
  const isSingleInternalPath =
    path.startsWith('/shared-group-invitation/') &&
    !path.startsWith('/shared-group-invitation//') &&
    !path.includes('://')
  assertTrue(`id=${JSON.stringify(maliciousId)} -> sigue siendo una única ruta interna inerte`, isSingleInternalPath, path)
}

console.log('\n=== Dos invitaciones distintas producen rutas distintas (no se pisan) ===')
const pathA = buildInvitationReturnPath('inv-A')
const pathB = buildInvitationReturnPath('inv-B')
assertTrue('Las rutas de dos invitaciones distintas son distintas entre sí', pathA !== pathB, { pathA, pathB })

console.log(`\n${failures === 0 ? 'TODOS LOS TESTS PASARON' : `${failures} TEST(S) FALLARON`}`)
process.exit(failures === 0 ? 0 : 1)
