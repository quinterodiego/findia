/**
 * Fase DB-8.1 — tests puros de `resolvePushSubscriptionsStorage`. Sin Neon,
 * sin Sheets, sin Docker -- solo lógica. Mismo patrón que
 * scripts/db6-storage-switch-tests.ts (Shared Groups V2), env vars propias.
 *
 * Ejecutar con: npx tsx scripts/db8-1-storage-switch-tests.ts
 */
import { resolvePushSubscriptionsStorage } from '../lib/repositories/pushSubscriptions'

let failures = 0
function check(label: string, condition: boolean) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}`)
  if (!condition) failures++
}

function main() {
  check('ausente -> sheets', resolvePushSubscriptionsStorage({}) === 'sheets')
  check('valor desconocido -> sheets', resolvePushSubscriptionsStorage({ PUSH_SUBSCRIPTIONS_STORAGE: 'mysql' }) === 'sheets')
  check(
    'postgres + sin VERCEL_ENV (local/CI) -> postgres',
    resolvePushSubscriptionsStorage({ PUSH_SUBSCRIPTIONS_STORAGE: 'postgres' }) === 'postgres'
  )
  check(
    'postgres + VERCEL_ENV=preview -> postgres',
    resolvePushSubscriptionsStorage({ PUSH_SUBSCRIPTIONS_STORAGE: 'postgres', VERCEL_ENV: 'preview' }) === 'postgres'
  )
  check(
    'postgres + VERCEL_ENV=production + flag ausente -> sheets (bloqueado)',
    resolvePushSubscriptionsStorage({ PUSH_SUBSCRIPTIONS_STORAGE: 'postgres', VERCEL_ENV: 'production' }) === 'sheets'
  )
  check(
    'postgres + VERCEL_ENV=production + flag "true" -> postgres',
    resolvePushSubscriptionsStorage({
      PUSH_SUBSCRIPTIONS_STORAGE: 'postgres',
      VERCEL_ENV: 'production',
      PUSH_SUBSCRIPTIONS_POSTGRES_PRODUCTION_ENABLED: 'true',
    }) === 'postgres'
  )
  check(
    'DATABASE_URL presente por sí sola NUNCA activa postgres',
    resolvePushSubscriptionsStorage({ DATABASE_URL: 'postgresql://x' }) === 'sheets'
  )
  check(
    'el flag de SHARED_GROUPS no interfiere -- son env vars completamente separadas',
    resolvePushSubscriptionsStorage({ SHARED_GROUPS_STORAGE: 'postgres', SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED: 'true', VERCEL_ENV: 'production' }) === 'sheets'
  )

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DEL SWITCH PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
