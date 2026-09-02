/**
 * Fase DB-8.1 — contract tests de PostgresPushSubscriptionsRepository contra
 * un Postgres real (Docker local descartable). Confirma que el patrón
 * INSERT...ON CONFLICT/DELETE-por-clave elimina la race condition de
 * clear+rewrite que tenía la versión Sheets.
 *
 * Ejecutar con: DATABASE_URL=postgresql://... npx tsx scripts/db8-1-postgres-contract-tests.ts
 */
import { eq } from 'drizzle-orm'
import { PostgresPushSubscriptionsRepository } from '../lib/repositories/pushSubscriptions/postgresRepository'
import { getDb } from '../lib/db/client'
import * as schema from '../lib/db/schema'
import { closePool } from '../lib/db/client'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

const repo = new PostgresPushSubscriptionsRepository()
const db = getDb()

async function allRows() {
  return db.select().from(schema.pushSubscriptions)
}

async function main() {
  console.log('\n--- create/subscribe ---')
  await repo.subscribe('user-a', { endpoint: 'https://push.example/ep-1', p256dh: 'p256dh-1', auth: 'auth-1' })
  let subs = await repo.getSubscriptionsForUser('user-a')
  check('subscribe: aparece para el usuario', subs.length === 1 && subs[0].endpoint === 'https://push.example/ep-1')

  console.log('\n--- idempotent re-subscribe (mismo endpoint, mismo usuario) ---')
  await repo.subscribe('user-a', { endpoint: 'https://push.example/ep-1', p256dh: 'p256dh-1-updated', auth: 'auth-1-updated' })
  subs = await repo.getSubscriptionsForUser('user-a')
  check('re-subscribe: sigue habiendo 1 sola fila para ese endpoint (no duplica)', subs.length === 1)
  check('re-subscribe: las keys se actualizaron', subs[0].p256dh === 'p256dh-1-updated' && subs[0].auth === 'auth-1-updated')

  console.log('\n--- duplicate endpoint entre USUARIOS distintos (re-login en el mismo browser) ---')
  await repo.subscribe('user-b', { endpoint: 'https://push.example/ep-1', p256dh: 'p256dh-b', auth: 'auth-b' })
  const subsA = await repo.getSubscriptionsForUser('user-a')
  const subsB = await repo.getSubscriptionsForUser('user-b')
  check('el endpoint pasó a pertenecer a user-b', subsB.length === 1 && subsB[0].endpoint === 'https://push.example/ep-1')
  check('user-a ya no tiene ese endpoint (reemplazado, no duplicado)', subsA.length === 0)
  const total = await allRows()
  check('nunca hay 2 filas para el mismo endpoint', total.filter((r) => r.endpoint === 'https://push.example/ep-1').length === 1)

  console.log('\n--- get by user (aislamiento entre usuarios) ---')
  await repo.subscribe('user-a', { endpoint: 'https://push.example/ep-2', p256dh: 'p256dh-2', auth: 'auth-2' })
  const subsAAfter = await repo.getSubscriptionsForUser('user-a')
  check('user-a ve solo sus propios endpoints', subsAAfter.length === 1 && subsAAfter[0].endpoint === 'https://push.example/ep-2')

  console.log('\n--- unsubscribe ---')
  await repo.unsubscribe('https://push.example/ep-2')
  check('unsubscribe: la fila desaparece', (await repo.getSubscriptionsForUser('user-a')).length === 0)

  console.log('\n--- unsubscribe de un endpoint inexistente (cleanup de 410) ---')
  let unsubError: unknown = null
  try {
    await repo.unsubscribe('https://push.example/never-existed')
  } catch (e) {
    unsubError = e
  }
  check('unsubscribe de endpoint inexistente: no-op, no lanza', unsubError === null)

  console.log('\n--- concurrencia: 5 subscribes concurrentes a endpoints DISTINTOS ---')
  const concurrentEndpoints = Array.from({ length: 5 }, (_, i) => `https://push.example/concurrent-${i}`)
  await Promise.all(
    concurrentEndpoints.map((endpoint) => repo.subscribe('user-c', { endpoint, p256dh: 'p', auth: 'a' }))
  )
  const subsC = await repo.getSubscriptionsForUser('user-c')
  check(
    'concurrencia: las 5 suscripciones sobreviven, ninguna se pierde (el bug de Sheets era exactamente esto)',
    subsC.length === 5,
    subsC.length
  )

  console.log('\n--- race: subscribe y unsubscribe concurrentes sobre el MISMO endpoint ---')
  const raceEndpoint = 'https://push.example/race-1'
  await repo.subscribe('user-d', { endpoint: raceEndpoint, p256dh: 'p', auth: 'a' })
  const raceResults = await Promise.allSettled([
    repo.subscribe('user-d', { endpoint: raceEndpoint, p256dh: 'p2', auth: 'a2' }),
    repo.unsubscribe(raceEndpoint),
  ])
  check('race: ambas operaciones terminan sin excepción', raceResults.every((r) => r.status === 'fulfilled'))
  const raceRows = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, raceEndpoint))
  check(
    'race: el resultado es determinista -- 0 filas (ganó el unsubscribe) o exactamente 1 (ganó el subscribe), nunca un estado corrupto/duplicado',
    raceRows.length === 0 || raceRows.length === 1,
    raceRows.length
  )

  console.log(`\n${failures === 0 ? 'TODOS LOS CONTRACT TESTS DE DB-8.1 PASARON' : `${failures} TEST(S) FALLARON`}`)
}

main()
  .then(async () => {
    await closePool()
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch(async (e) => {
    console.error('Error fatal:', e)
    await closePool().catch(() => {})
    process.exit(1)
  })
