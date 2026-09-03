/**
 * Fase DB-8.2 — CLI de migración/validación de Categories + Subcategories.
 *
 *   npx tsx scripts/db8-2/run.ts --dry-run   (default)
 *   npx tsx scripts/db8-2/run.ts --import
 *   npx tsx scripts/db8-2/run.ts --verify
 *
 * Mismo contrato que scripts/db5/run.ts y scripts/db8-1/run.ts.
 */
import { readCategoriesSnapshot } from './read'
import { validateSnapshot } from './validate'
import { transformSnapshot } from './transform'
import { assertTargetTablesEmpty, importBatch } from './importer'
import { verifyImport } from './verify'
import { printAuditReport, printVerifyReport } from './report'
import { closePool } from '@/lib/db/client'

type Mode = 'dry-run' | 'import' | 'verify'

function parseMode(): Mode {
  const args = process.argv.slice(2)
  if (args.includes('--import')) return 'import'
  if (args.includes('--verify')) return 'verify'
  return 'dry-run'
}

async function main() {
  const mode = parseMode()
  let stage = 'starting'
  let poolOpened = false

  try {
    stage = '[1/5] Reading Sheets (2 llamadas en paralelo, una por hoja)'
    console.log(stage)
    const { snapshot } = await readCategoriesSnapshot()

    stage = '[2/5] Validating'
    console.log(stage)
    const validation = validateSnapshot(snapshot)

    stage = '[3/5] Transforming'
    console.log(stage)
    const batch = validation.importable ? transformSnapshot(snapshot) : null

    if (mode === 'dry-run') {
      printAuditReport(snapshot, validation)
      console.log('\n[DRY RUN] No se abrió conexión a Postgres. No se escribió nada.')
      process.exit(validation.importable ? 0 : 1)
    }

    if (mode === 'verify') {
      poolOpened = true
      stage = '[4/5] Verifying'
      console.log(stage)
      const verifyResult = await verifyImport(snapshot)
      printAuditReport(snapshot, validation)
      printVerifyReport(verifyResult)
      await closePool()
      process.exit(verifyResult.ok ? 0 : 1)
    }

    if (!validation.importable) {
      printAuditReport(snapshot, validation)
      console.error(`\n${validation.criticalCount} error(es) CRÍTICO(S) -- abortando import. No se escribió nada en Postgres.`)
      process.exit(1)
    }

    poolOpened = true
    stage = '[4/5] Importing'
    console.log(stage)
    await assertTargetTablesEmpty()
    const importResult = await importBatch(batch!)
    console.log(`Import OK -- filas insertadas: ${JSON.stringify(importResult.inserted)}`)

    stage = '[5/5] Verifying'
    console.log(stage)
    const verifyResult = await verifyImport(snapshot)

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
        // no-op
      }
    }
    process.exit(1)
  }
}

main()
