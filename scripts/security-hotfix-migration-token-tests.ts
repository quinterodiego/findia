/**
 * Fase DB-8.0S — tests puros de `isAuthorizedMigrationRequest`
 * (lib/migrationAuth.ts). Sin Sheets, sin red, sin Postgres.
 *
 * Ejecutar con: npx tsx scripts/security-hotfix-migration-token-tests.ts
 */
import { NextRequest } from 'next/server'
import { isAuthorizedMigrationRequest } from '../lib/migrationAuth'

let failures = 0
function check(label: string, condition: boolean) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}`)
  if (!condition) failures++
}

function requestWithAuth(authHeader: string | null): NextRequest {
  const headers = new Headers()
  if (authHeader !== null) headers.set('authorization', authHeader)
  return new NextRequest('https://findia.vercel.app/api/migrations/add-subcategories', { headers })
}

function withEnv(value: string | undefined, fn: () => void) {
  const previous = process.env.MIGRATION_TOKEN
  if (value === undefined) delete process.env.MIGRATION_TOKEN
  else process.env.MIGRATION_TOKEN = value
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env.MIGRATION_TOKEN
    else process.env.MIGRATION_TOKEN = previous
  }
}

function main() {
  withEnv('real-secret-123', () => {
    check(
      'env presente + token correcto -> autorizado',
      isAuthorizedMigrationRequest(requestWithAuth('Bearer real-secret-123'))
    )
    check(
      'env presente + token incorrecto -> rechazado',
      !isAuthorizedMigrationRequest(requestWithAuth('Bearer wrong-token'))
    )
    check(
      'env presente + token incorrecto de distinta longitud -> rechazado',
      !isAuthorizedMigrationRequest(requestWithAuth('Bearer x'))
    )
    check(
      'env presente + header ausente -> rechazado',
      !isAuthorizedMigrationRequest(requestWithAuth(null))
    )
    check(
      'env presente + header vacío -> rechazado',
      !isAuthorizedMigrationRequest(requestWithAuth(''))
    )
    check(
      'env presente + header sin "Bearer " -> rechazado',
      !isAuthorizedMigrationRequest(requestWithAuth('real-secret-123'))
    )
    check(
      'nunca se acepta el viejo fallback hardcodeado, aunque alguien lo mande a mano',
      !isAuthorizedMigrationRequest(requestWithAuth('Bearer migration-secret-token'))
    )
  })

  withEnv(undefined, () => {
    check(
      'env ausente + cualquier token -> rechazado (fail-closed, sin fallback)',
      !isAuthorizedMigrationRequest(requestWithAuth('Bearer migration-secret-token'))
    )
    check(
      'env ausente + header ausente -> rechazado',
      !isAuthorizedMigrationRequest(requestWithAuth(null))
    )
  })

  withEnv('', () => {
    check(
      'env vacía ("") se trata como ausente -> rechazado, nunca "Bearer "',
      !isAuthorizedMigrationRequest(requestWithAuth('Bearer '))
    )
  })

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DEL TOKEN DE MIGRACIÓN PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
