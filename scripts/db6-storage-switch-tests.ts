/**
 * Fase DB-6 — tests puros de `resolveSharedGroupsStorage` (el switch
 * Sheets/Postgres). Sin Neon, sin Sheets, sin Docker -- solo lógica.
 * Extendido en DB-7A.1 con la matriz completa de la puerta de activación
 * productiva (SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED).
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
    'postgres + VERCEL_ENV=production, sin el flag productivo -> sheets (ver matriz DB-7A.1 más abajo)',
    resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'postgres', VERCEL_ENV: 'production' }) === 'sheets'
  )
  check(
    'DATABASE_URL presente por sí sola NUNCA activa postgres',
    resolveSharedGroupsStorage({ DATABASE_URL: 'postgresql://x' }) === 'sheets'
  )

  // --- DB-7A.1: matriz completa de la puerta productiva ------------------

  check('development + sheets', resolveSharedGroupsStorage({ VERCEL_ENV: 'development' }) === 'sheets')
  check(
    'development + postgres (sin flag productivo -- no aplica fuera de production)',
    resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'postgres', VERCEL_ENV: 'development' }) === 'postgres'
  )
  check('preview + sheets', resolveSharedGroupsStorage({ VERCEL_ENV: 'preview' }) === 'sheets')
  check(
    'preview + postgres (el flag productivo NO es requerido en preview)',
    resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'postgres', VERCEL_ENV: 'preview' }) === 'postgres'
  )
  check(
    'production + sheets (storage ausente, flag productivo irrelevante)',
    resolveSharedGroupsStorage({ VERCEL_ENV: 'production', SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED: 'true' }) === 'sheets'
  )
  check(
    'production + postgres + flag ausente -> sheets (bloqueado)',
    resolveSharedGroupsStorage({ SHARED_GROUPS_STORAGE: 'postgres', VERCEL_ENV: 'production' }) === 'sheets'
  )
  check(
    'production + postgres + flag "false" -> sheets (bloqueado)',
    resolveSharedGroupsStorage({
      SHARED_GROUPS_STORAGE: 'postgres',
      VERCEL_ENV: 'production',
      SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED: 'false',
    }) === 'sheets'
  )
  check(
    'production + postgres + flag con typo/valor no exacto -> sheets (bloqueado, comportamiento seguro)',
    resolveSharedGroupsStorage({
      SHARED_GROUPS_STORAGE: 'postgres',
      VERCEL_ENV: 'production',
      SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED: 'True',
    }) === 'sheets'
  )
  check(
    'production + postgres + flag "true" -> postgres (única combinación que activa producción)',
    resolveSharedGroupsStorage({
      SHARED_GROUPS_STORAGE: 'postgres',
      VERCEL_ENV: 'production',
      SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED: 'true',
    }) === 'postgres'
  )
  check(
    'DATABASE_URL presente pero SHARED_GROUPS_STORAGE ausente, incluso en production -> sheets',
    resolveSharedGroupsStorage({ DATABASE_URL: 'postgresql://x', VERCEL_ENV: 'production' }) === 'sheets'
  )

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DEL SWITCH PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
