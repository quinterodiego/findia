/**
 * Fase DB-6 — tests puros de `resolveSharedGroupsStorage` (el switch
 * Sheets/Postgres). Sin Neon, sin Sheets, sin Docker -- solo lógica.
 *
 * Ejecutar con: npx tsx scripts/db6-storage-switch-tests.ts
 */
import { resolveSharedGroupsStorage } from '../lib/repositories/sharedGroups'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

function main() {
  check('ausente -> sheets', resolveSharedGroupsStorage({}) === 'sheets')
  check('valor desconocido -> sheets', resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'mysql' }) === 'sheets')
  check('vacío -> sheets', resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: '' }) === 'sheets')
  check('"Postgres" (mayúscula) -> sheets (case-sensitive a propósito)', resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'Postgres' }) === 'sheets')
  check(
    'postgres + sin VERCEL_ENV (ej. local/CI) -> postgres',
    resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'postgres' }) === 'postgres'
  )
  check(
    'postgres + VERCEL_ENV=development -> postgres',
    resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'postgres', VERCEL_ENV: 'development' }) === 'postgres'
  )
  check(
    'postgres + VERCEL_ENV=preview -> postgres',
    resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'postgres', VERCEL_ENV: 'preview' }) === 'postgres'
  )
  check(
    'postgres + VERCEL_ENV=production -> SIEMPRE sheets (guard duro, no configurable)',
    resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'postgres', VERCEL_ENV: 'production' }) === 'sheets'
  )
  check(
    'DATABASE_URL presente por sí sola NUNCA activa postgres',
    resolveSharedGroupsStorage({ DATABASE_URL: 'postgresql://x' }) === 'sheets'
  )

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DEL SWITCH PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
