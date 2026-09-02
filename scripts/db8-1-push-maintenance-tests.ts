/**
 * Fase DB-8.1 (cutover) — tests puros del predicado de maintenance freeze
 * de PushSubscriptions (lib/pushSubscriptionsMaintenance.ts). Sin Next.js
 * runtime, sin HTTP real, sin Sheets, sin Postgres.
 *
 * Ejecutar con: npx tsx scripts/db8-1-push-maintenance-tests.ts
 */
import { shouldBlockForMaintenance } from '../lib/pushSubscriptionsMaintenance'

let failures = 0
function check(label: string, condition: boolean) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}`)
  if (!condition) failures++
}

const ON = { PUSH_SUBSCRIPTIONS_MAINTENANCE_MODE: 'true' }
const OFF = { PUSH_SUBSCRIPTIONS_MAINTENANCE_MODE: 'false' }
const ABSENT = {}

function main() {
  // --- OFF: nada se bloquea ---
  check('OFF + POST /api/push/subscribe -> permitido', !shouldBlockForMaintenance('POST', '/api/push/subscribe', OFF))
  check('OFF + DELETE /api/push/subscribe -> permitido', !shouldBlockForMaintenance('DELETE', '/api/push/subscribe', OFF))
  check('flag ausente equivale a OFF', !shouldBlockForMaintenance('POST', '/api/push/subscribe', ABSENT))

  // --- ON: solo subscribe/unsubscribe se bloquean ---
  check('ON + POST /api/push/subscribe -> bloqueado', shouldBlockForMaintenance('POST', '/api/push/subscribe', ON))
  check('ON + DELETE /api/push/subscribe -> bloqueado', shouldBlockForMaintenance('DELETE', '/api/push/subscribe', ON))
  check('ON + GET /api/push/subscribe -> permitido (GET nunca se bloquea)', !shouldBlockForMaintenance('GET', '/api/push/subscribe', ON))
  check('ON + GET /api/push/vapid-public-key -> permitido', !shouldBlockForMaintenance('GET', '/api/push/vapid-public-key', ON))
  check(
    'ON + POST /api/push/send -> permitido (fuera de alcance a propósito, ver comentario en el módulo)',
    !shouldBlockForMaintenance('POST', '/api/push/send', ON)
  )

  // --- fuera de alcance: nunca se toca, ni con maintenance ON ---
  check('ON + POST /api/shared-groups -> permitido (dominio distinto)', !shouldBlockForMaintenance('POST', '/api/shared-groups', ON))
  check('ON + POST /api/shared-expenses -> permitido', !shouldBlockForMaintenance('POST', '/api/shared-expenses', ON))
  check('ON + POST /api/auth/callback/credentials -> permitido', !shouldBlockForMaintenance('POST', '/api/auth/callback/credentials', ON))
  check('ON + POST /api/expenses -> permitido', !shouldBlockForMaintenance('POST', '/api/expenses', ON))
  check(
    'ON + prefijo parecido pero no exacto (/api/push/subscribe-legacy) -> permitido',
    !shouldBlockForMaintenance('POST', '/api/push/subscribe-legacy', ON)
  )

  // --- confirmar aislamiento total del flag de Shared Groups ---
  check(
    'SHARED_GROUPS_MAINTENANCE_MODE=true NO activa el freeze de PushSubscriptions',
    !shouldBlockForMaintenance('POST', '/api/push/subscribe', { SHARED_GROUPS_MAINTENANCE_MODE: 'true' })
  )

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE MAINTENANCE DE PUSHSUBSCRIPTIONS PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
