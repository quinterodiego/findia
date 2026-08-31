/**
 * Tests puros de Fase 4.3 — contenido del email de invitación y armado del
 * link (lib/email.ts#buildSharedGroupInvitationEmail,
 * app/api/shared-groups/_lib/invitationUrl.ts). Sin red, sin SMTP, sin
 * Google Sheets — corre en milisegundos.
 *
 * Ejecutar con: npx tsx scripts/test-shared-group-invitation-email-pure.ts
 */
import { buildSharedGroupInvitationEmail } from '../lib/email'
import { buildSharedGroupInvitationUrl } from '../app/api/shared-groups/_lib/invitationUrl'

let failures = 0
function assertTrue(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

console.log('\n=== buildSharedGroupInvitationUrl ===')
const url = buildSharedGroupInvitationUrl('inv-123', 'plain-token-abc')
assertTrue('La URL contiene el invitation id', url.includes('inv-123'), url)
assertTrue('La URL contiene el token', url.includes('plain-token-abc'), url)
assertTrue('La URL apunta a una página real, no a /api/', url.includes('/shared-group-invitation/') && !url.includes('/api/'))

console.log('\n=== buildSharedGroupInvitationEmail: contenido básico ===')
const { subject, html } = buildSharedGroupInvitationEmail('Diego', 'Casa', url)
assertTrue('El asunto incluye el nombre del invitador', subject.includes('Diego'), subject)
assertTrue('El HTML incluye el nombre del invitador', html.includes('Diego'))
assertTrue('El HTML incluye el nombre del grupo', html.includes('Casa'))
assertTrue('El HTML incluye el link de invitación completo', html.includes(url))
assertTrue('El CTA dice "Ver invitación"', html.includes('Ver invitación'))

console.log('\n=== Sin lenguaje técnico expuesto en el email ===')
const htmlLower = html.toLowerCase()
for (const forbidden of ['sharedgroup', 'shadow member', 'userid', 'tokenhash', '>token<', 'member.']) {
  assertTrue(`El HTML NO contiene "${forbidden}"`, !htmlLower.includes(forbidden))
}
// El propio link SÍ contiene la palabra "token" como nombre de query param
// (?token=...) -- eso es esperado y no es "lenguaje técnico visible", así
// que no lo chequeamos como prohibido dentro del propio href.

console.log('\n=== Escaping de nombres (XSS) ===')
const malicious = buildSharedGroupInvitationEmail('<script>alert(1)</script>', '"><img src=x onerror=alert(2)>', url)
assertTrue('El nombre del invitador queda escapado en el HTML', !malicious.html.includes('<script>alert(1)</script>'))
assertTrue('El nombre del grupo queda escapado en el HTML', !malicious.html.includes('<img src=x onerror=alert(2)>'))
assertTrue('El HTML sigue conteniendo el texto escapado del invitador', malicious.html.includes('&lt;script&gt;'))
assertTrue('El HTML sigue conteniendo el texto escapado del grupo', malicious.html.includes('&lt;img'))

console.log(`\n${failures === 0 ? 'TODOS LOS TESTS PASARON' : `${failures} TEST(S) FALLARON`}`)
process.exit(failures === 0 ? 0 : 1)
