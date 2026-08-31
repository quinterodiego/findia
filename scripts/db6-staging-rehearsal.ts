/**
 * Fase DB-6 — ensayo de staging. Envoltorio de GUARD RAILS sobre el
 * migration tool de DB-5 (scripts/db5/**), reutilizado tal cual -- no se
 * reescribe ninguna lógica de lectura/validación/transformación/import/
 * verificación.
 *
 * Diferencias deliberadas respecto de correr scripts/db5/run.ts directo:
 *
 *   1. Lee `DATABASE_URL_STAGING`, NUNCA `DATABASE_URL` -- variable separada
 *      a propósito (DB-6 §3) para que sea imposible confundir esto con una
 *      futura `DATABASE_URL` de producción. Si `DATABASE_URL_STAGING` no
 *      está seteada, ABORTA antes de tocar nada.
 *   2. Exige el flag `--staging` explícito ADEMÁS de `--dry-run`/`--import`/
 *      `--verify` -- un simple `npx tsx scripts/db6-staging-rehearsal.ts`
 *      sin flags no hace nada.
 *   3. Antes de cualquier escritura, imprime host+database (NUNCA la
 *      password ni la connection string completa) para que quede visible
 *      contra qué se está por escribir.
 *   4. Nunca toca `DATABASE_URL` del proceso hasta después de haber
 *      validado los 2 puntos anteriores -- si algo aborta antes, ninguna
 *      función de lib/db/client.ts llega a intentar conectarse.
 *
 * Ejecutar con:
 *   DATABASE_URL_STAGING=postgresql://...neon.tech/... npx tsx -r dotenv/config scripts/db6-staging-rehearsal.ts --staging --dry-run dotenv_config_path=.env.local
 *   DATABASE_URL_STAGING=postgresql://...neon.tech/... npx tsx -r dotenv/config scripts/db6-staging-rehearsal.ts --staging --import dotenv_config_path=.env.local
 *   DATABASE_URL_STAGING=postgresql://...neon.tech/... npx tsx -r dotenv/config scripts/db6-staging-rehearsal.ts --staging --verify dotenv_config_path=.env.local
 */
import { readSharedGroupsSnapshot } from './db5/read'
import { validateSnapshot } from './db5/validate'
import { transformSnapshot } from './db5/transform'
import { assertTargetTablesEmpty, importBatch } from './db5/importer'
import { verifyImport } from './db5/verify'
import { printAuditReport, printVerifyReport } from './db5/report'

type Mode = 'dry-run' | 'import' | 'verify'

function parseArgs(): { mode: Mode; hasStagingFlag: boolean } {
  const args = process.argv.slice(2)
  const hasStagingFlag = args.includes('--staging')
  const mode: Mode = args.includes('--import') ? 'import' : args.includes('--verify') ? 'verify' : 'dry-run'
  return { mode, hasStagingFlag }
}

/** Nunca imprime la password ni la query string (que podría traer
 * `sslmode`/opciones, pero nunca credenciales en Postgres URLs estándar de
 * todos modos -- igual se recorta por las dudas). */
function describeTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    return `host=${url.hostname} database=${url.pathname.replace(/^\//, '')} port=${url.port || '5432'}`
  } catch {
    return '(no se pudo parsear la connection string para describirla -- por seguridad no se imprime)'
  }
}

async function main() {
  const { mode, hasStagingFlag } = parseArgs()

  if (!hasStagingFlag) {
    console.error('Falta el flag --staging. Este script requiere confirmación explícita, no corre con solo --dry-run/--import/--verify.')
    process.exit(1)
  }

  const stagingUrl = process.env.DATABASE_URL_STAGING
  if (!stagingUrl) {
    console.error('Falta DATABASE_URL_STAGING. Este script NUNCA lee DATABASE_URL a secas -- seteá DATABASE_URL_STAGING explícitamente.')
    process.exit(1)
  }

  console.log(`[DB-6 STAGING] Target: ${describeTarget(stagingUrl)}`)
  console.log(`[DB-6 STAGING] Modo: ${mode}`)

  // Recién ACÁ, después de los 2 guards de arriba, se habilita la conexión
  // -- lib/db/client.ts lee DATABASE_URL, así que se la seteamos a partir
  // de la variable staging (nunca al revés).
  process.env.DATABASE_URL = stagingUrl

  const { closePool } = await import('@/lib/db/client')

  let stage = 'starting'
  let poolOpened = false
  try {
    stage = '[1/6] Reading Sheets (READ ONLY, producción)'
    console.log(stage)
    const { snapshot } = await readSharedGroupsSnapshot()

    stage = '[2/6] Validating'
    console.log(stage)
    const validation = validateSnapshot(snapshot)

    stage = '[3/6] Transforming'
    console.log(stage)
    const batch = validation.importable ? transformSnapshot(snapshot) : null

    if (mode === 'dry-run') {
      printAuditReport(snapshot, validation)
      console.log('\n[DRY RUN STAGING] No se abrió conexión a Postgres staging. No se escribió nada.')
      process.exit(validation.importable ? 0 : 1)
    }

    if (mode === 'verify') {
      poolOpened = true
      stage = '[5/6] Verifying (staging)'
      console.log(stage)
      const verifyResult = await verifyImport(snapshot)
      stage = '[6/6] Report'
      printAuditReport(snapshot, validation)
      printVerifyReport(verifyResult)
      await closePool()
      process.exit(verifyResult.ok ? 0 : 1)
    }

    // mode === 'import'
    if (!validation.importable) {
      printAuditReport(snapshot, validation)
      console.error(`\n${validation.criticalCount} error(es) CRÍTICO(S) -- abortando import de staging. No se escribió nada.`)
      process.exit(1)
    }

    poolOpened = true
    stage = '[4/6] Importing (staging)'
    console.log(stage)
    await assertTargetTablesEmpty()
    const importResult = await importBatch(batch!)
    console.log(`Import OK -- filas insertadas: ${JSON.stringify(importResult.inserted)}`)

    stage = '[5/6] Verifying (staging)'
    console.log(stage)
    const verifyResult = await verifyImport(snapshot)

    stage = '[6/6] Report'
    printAuditReport(snapshot, validation)
    printVerifyReport(verifyResult)

    await closePool()
    process.exit(verifyResult.ok ? 0 : 1)
  } catch (error) {
    const message = (error as Error)?.message || String(error)
    const isRateLimit = message.toLowerCase().includes('quota') || message.includes('429')
    console.error(`\n${isRateLimit ? '429 REAL de Google Sheets' : 'Error'} durante la etapa: ${stage}`)
    console.error(message)
    if (isRateLimit) console.error('DETENIENDO -- no se reintenta.')
    if (poolOpened) {
      try {
        await closePool()
      } catch {
        // no-op: ya estamos abortando
      }
    }
    process.exit(1)
  }
}

main()
