/**
 * Fase DB-7A.1 — tests de `isPostgresConnectivityError`
 * (lib/repositories/sharedGroups/pgErrors.ts). Mezcla:
 *   A. fixtures puras (errores fabricados con la forma exacta de pg/Drizzle)
 *   B. UN intento de conexión real a un puerto local inválido/controlado,
 *      para confirmar el clasificador contra un error de conectividad
 *      genuino del driver `pg` -- no contra Neon (nunca se toca Neon
 *      staging ni production acá), y no contra Sheets (0 llamadas).
 *
 * Ejecutar con: npx tsx scripts/db7-pg-connectivity-classifier-tests.ts
 */
import { Pool } from 'pg'
import { isPostgresConnectivityError } from '../lib/repositories/sharedGroups/pgErrors'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

function drizzleWrapped(cause: unknown) {
  // Reproduce la forma real: DrizzleQueryError envuelve el error de `pg` en
  // `.cause`, nunca lo expone en el nivel superior (ver unwrapPgError).
  return Object.assign(new Error('Failed query: insert into ...'), { cause })
}

async function main() {
  // --- A. fixtures puras --------------------------------------------------

  check('ECONNREFUSED (top-level) -> connectivity', isPostgresConnectivityError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5432' }))
  check(
    'ECONNREFUSED envuelto en DrizzleQueryError.cause -> connectivity',
    isPostgresConnectivityError(drizzleWrapped({ code: 'ECONNREFUSED' }))
  )
  check('ENOTFOUND (DNS) -> connectivity', isPostgresConnectivityError({ code: 'ENOTFOUND' }))
  check('ECONNRESET -> connectivity', isPostgresConnectivityError({ code: 'ECONNRESET' }))
  check('ETIMEDOUT -> connectivity', isPostgresConnectivityError({ code: 'ETIMEDOUT' }))
  check('EAI_AGAIN -> connectivity', isPostgresConnectivityError({ code: 'EAI_AGAIN' }))
  check('EHOSTUNREACH -> connectivity', isPostgresConnectivityError({ code: 'EHOSTUNREACH' }))
  check('SQLSTATE 08006 (connection_failure) -> connectivity', isPostgresConnectivityError({ code: '08006' }))
  check(
    'SQLSTATE 08001 (sqlclient_unable_to_establish_sqlconnection) -> connectivity',
    isPostgresConnectivityError({ code: '08001' })
  )
  check('SQLSTATE 08003 (connection_does_not_exist) -> connectivity', isPostgresConnectivityError({ code: '08003' }))
  check('SQLSTATE 57P03 (cannot_connect_now) -> connectivity', isPostgresConnectivityError({ code: '57P03' }))
  check('SQLSTATE 53300 (too_many_connections) -> connectivity', isPostgresConnectivityError({ code: '53300' }))
  check(
    '"Connection terminated unexpectedly" sin .code -> connectivity',
    isPostgresConnectivityError(new Error('Connection terminated unexpectedly'))
  )
  check(
    '"timeout exceeded when trying to connect" sin .code -> connectivity',
    isPostgresConnectivityError(new Error('timeout exceeded when trying to connect'))
  )

  // --- errores de NEGOCIO/datos: NUNCA deben clasificarse como conectividad
  check(
    'unique violation (23505) NO es connectivity',
    !isPostgresConnectivityError({ code: '23505', constraint: 'shared_group_members_group_user_unique' })
  )
  check('foreign key violation (23503) NO es connectivity', !isPostgresConnectivityError({ code: '23503' }))
  check('check violation (23514) NO es connectivity', !isPostgresConnectivityError({ code: '23514' }))
  check(
    'Error de negocio ya traducido ("El monto debe ser...") NO es connectivity',
    !isPostgresConnectivityError(new Error('El monto debe ser un número finito mayor a 0'))
  )
  check('Error genérico sin .code ni frase de conectividad NO es connectivity', !isPostgresConnectivityError(new Error('algo salió mal')))
  check('undefined/null NO es connectivity', !isPostgresConnectivityError(undefined) && !isPostgresConnectivityError(null))

  // --- mensaje público nunca filtra SQL/host/constraint -------------------
  // (esto se prueba en el nivel de apiError.ts -- acá solo confirmamos que
  // el clasificador NO transforma el error, solo lo etiqueta true/false;
  // wrapPhase1Call/handleApiError son quienes garantizan el mensaje fijo.)
  check(
    'el clasificador no modifica el error original (solo lo etiqueta)',
    (() => {
      const original = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 10.0.0.5:5432' }
      isPostgresConnectivityError(original)
      return original.message === 'connect ECONNREFUSED 10.0.0.5:5432'
    })()
  )

  // --- B. conexión real a un puerto local inválido/controlado -------------
  // Puerto alto sin nada escuchando en localhost -- nunca toca Neon, nunca
  // toca Sheets. connectionTimeoutMillis bajo para no colgar el script si
  // algo raro respondiera.
  console.log('\n--- intento de conexión real (localhost:1, puerto sin listener) ---')
  const pool = new Pool({
    host: '127.0.0.1',
    port: 1,
    database: 'db7_classifier_test',
    user: 'db7_classifier_test',
    password: 'db7_classifier_test',
    connectionTimeoutMillis: 2000,
  })
  try {
    await pool.query('select 1')
    check('se esperaba que la conexión fallara (no debería haber nada escuchando en el puerto 1)', false)
  } catch (realError) {
    const isConnectivity = isPostgresConnectivityError(realError)
    console.log('  error real capturado:', (realError as Error)?.message)
    check('error real de conexión rechazada -> clasificado como connectivity', isConnectivity)
  } finally {
    await pool.end().catch(() => {})
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DEL CLASSIFIER PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
