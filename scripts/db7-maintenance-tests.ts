/**
 * Fase DB-7A.1 — tests puros del predicado de maintenance freeze
 * (`shouldBlockForMaintenance` en lib/sharedGroupsMaintenance.ts). Sin
 * Next.js runtime, sin HTTP real, sin Sheets, sin Neon -- solo lógica.
 *
 * Ejecutar con: npx tsx scripts/db7-maintenance-tests.ts
 */
import { shouldBlockForMaintenance } from '../lib/sharedGroupsMaintenance'

let failures = 0
function check(label: string, condition: boolean) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}`)
  if (!condition) failures++
}

const ON = { SHARED_GROUPS_MAINTENANCE_MODE: 'true' }
const OFF = { SHARED_GROUPS_MAINTENANCE_MODE: 'false' }
const ABSENT = {}

function main() {
  // --- maintenance OFF: nada se bloquea, sea cual sea el método/ruta -----
  check('OFF + GET /api/shared-groups -> permitido', !shouldBlockForMaintenance('GET', '/api/shared-groups', OFF))
  check('OFF + POST /api/shared-groups -> permitido', !shouldBlockForMaintenance('POST', '/api/shared-groups', OFF))
  check(
    'OFF + PATCH /api/shared-groups/1/members/2 -> permitido',
    !shouldBlockForMaintenance('PATCH', '/api/shared-groups/1/members/2', OFF)
  )
  check(
    'OFF + DELETE /api/shared-group-invitations/1 -> permitido',
    !shouldBlockForMaintenance('DELETE', '/api/shared-group-invitations/1', OFF)
  )
  check(
    'flag ausente (nunca configurada) equivale a OFF',
    !shouldBlockForMaintenance('POST', '/api/shared-groups', ABSENT)
  )

  // --- maintenance ON: GET sigue abierto, todo lo demás se bloquea -------
  check('ON + GET /api/shared-groups -> permitido', !shouldBlockForMaintenance('GET', '/api/shared-groups', ON))
  check(
    'ON + GET /api/shared-groups/1/balance -> permitido',
    !shouldBlockForMaintenance('GET', '/api/shared-groups/1/balance', ON)
  )
  check('ON + POST /api/shared-groups -> bloqueado', shouldBlockForMaintenance('POST', '/api/shared-groups', ON))
  check(
    'ON + PUT /api/shared-groups/1 -> bloqueado',
    shouldBlockForMaintenance('PUT', '/api/shared-groups/1', ON)
  )
  check(
    'ON + PATCH /api/shared-groups/1/members/2 -> bloqueado',
    shouldBlockForMaintenance('PATCH', '/api/shared-groups/1/members/2', ON)
  )
  check(
    'ON + DELETE /api/shared-groups/1/expenses/2 -> bloqueado',
    shouldBlockForMaintenance('DELETE', '/api/shared-groups/1/expenses/2', ON)
  )
  check(
    'ON + POST /api/shared-groups/1/invitations (SEND) -> bloqueado',
    shouldBlockForMaintenance('POST', '/api/shared-groups/1/invitations', ON)
  )
  check(
    'ON + POST /api/shared-group-invitations/1/accept -> bloqueado',
    shouldBlockForMaintenance('POST', '/api/shared-group-invitations/1/accept', ON)
  )
  check(
    'ON + POST /api/shared-group-invitations/1/reject -> bloqueado',
    shouldBlockForMaintenance('POST', '/api/shared-group-invitations/1/reject', ON)
  )
  check(
    'ON + DELETE /api/shared-group-invitations/1 (cancel) -> bloqueado',
    shouldBlockForMaintenance('DELETE', '/api/shared-group-invitations/1', ON)
  )
  check(
    'ON + POST /api/shared-groups/1/members (direct-link) -> bloqueado',
    shouldBlockForMaintenance('POST', '/api/shared-groups/1/members', ON)
  )
  check(
    'ON + POST /api/shared-groups/1/settlements -> bloqueado',
    shouldBlockForMaintenance('POST', '/api/shared-groups/1/settlements', ON)
  )

  // --- fuera de alcance: nunca se toca, ni siquiera con maintenance ON ---
  check(
    'ON + POST /api/shared-expenses (legacy, distinto) -> permitido',
    !shouldBlockForMaintenance('POST', '/api/shared-expenses', ON)
  )
  check(
    'ON + POST /api/shared-expenses/1/settle (legacy) -> permitido',
    !shouldBlockForMaintenance('POST', '/api/shared-expenses/1/settle', ON)
  )
  check(
    'ON + POST /api/auth/callback/credentials -> permitido',
    !shouldBlockForMaintenance('POST', '/api/auth/callback/credentials', ON)
  )
  check('ON + POST /api/expenses (personales) -> permitido', !shouldBlockForMaintenance('POST', '/api/expenses', ON))
  check(
    'ON + POST /api/credit-cards -> permitido',
    !shouldBlockForMaintenance('POST', '/api/credit-cards', ON)
  )
  check(
    'ON + prefijo parecido pero no exacto (/api/shared-groups-legacy) -> permitido',
    !shouldBlockForMaintenance('POST', '/api/shared-groups-legacy', ON)
  )

  // --- caso puntual: invitation accept durante freeze, token intacto -----
  // El middleware corta ANTES del handler -- shouldBlockForMaintenance
  // devolver true acá es exactamente lo que garantiza que el handler
  // (y por lo tanto updateInvitationStatus/acceptInvitationAndLinkMember)
  // nunca se ejecuta, así que el token/estado de la invitación no cambia.
  check(
    'invitation pending + maintenance ON + POST accept -> se corta antes del handler (bloqueado)',
    shouldBlockForMaintenance('POST', '/api/shared-group-invitations/inv-123/accept', ON)
  )

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE MAINTENANCE PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
