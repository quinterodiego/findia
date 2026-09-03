/**
 * Fase DB-8.2 — tests puros de `resolveCategoriesStorage`. Sin Neon, sin
 * Sheets, sin Docker -- solo lógica.
 *
 * Ejecutar con: npx tsx scripts/db8-2-storage-switch-tests.ts
 */
import { resolveCategoriesStorage } from '../lib/repositories/categories'

let failures = 0
function check(label: string, condition: boolean) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}`)
  if (!condition) failures++
}

function main() {
  check('ausente -> sheets', resolveCategoriesStorage({}) === 'sheets')
  check('valor desconocido -> sheets', resolveCategoriesStorage({ CATEGORIES_STORAGE: 'mysql' }) === 'sheets')
  check('postgres + sin VERCEL_ENV -> postgres', resolveCategoriesStorage({ CATEGORIES_STORAGE: 'postgres' }) === 'postgres')
  check('postgres + VERCEL_ENV=preview -> postgres', resolveCategoriesStorage({ CATEGORIES_STORAGE: 'postgres', VERCEL_ENV: 'preview' }) === 'postgres')
  check(
    'postgres + VERCEL_ENV=production + flag ausente -> sheets (bloqueado)',
    resolveCategoriesStorage({ CATEGORIES_STORAGE: 'postgres', VERCEL_ENV: 'production' }) === 'sheets'
  )
  check(
    'postgres + VERCEL_ENV=production + flag "true" -> postgres',
    resolveCategoriesStorage({ CATEGORIES_STORAGE: 'postgres', VERCEL_ENV: 'production', CATEGORIES_POSTGRES_PRODUCTION_ENABLED: 'true' }) === 'postgres'
  )
  check('DATABASE_URL presente por sí sola NUNCA activa postgres', resolveCategoriesStorage({ DATABASE_URL: 'postgresql://x' }) === 'sheets')
  check(
    'flags de otros dominios (Shared Groups/PushSubscriptions) no interfieren',
    resolveCategoriesStorage({
      SHARED_GROUPS_STORAGE: 'postgres',
      SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED: 'true',
      PUSH_SUBSCRIPTIONS_STORAGE: 'postgres',
      PUSH_SUBSCRIPTIONS_POSTGRES_PRODUCTION_ENABLED: 'true',
      VERCEL_ENV: 'production',
    }) === 'sheets'
  )

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DEL SWITCH PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
