/**
 * Fase DB-5 — CLI de migración/validación de Shared Groups V2.
 *
 *   npx tsx scripts/db5/run.ts --dry-run   (default si no se pasa ningún flag)
 *   npx tsx scripts/db5/run.ts --import
 *   npx tsx scripts/db5/run.ts --verify
 *
 * --dry-run:  lee Sheets, valida, transforma en memoria, imprime el
 *             reporte. NUNCA escribe Postgres (ni siquiera abre conexión).
 * --import:   repite lectura+validación (nunca confía en un dry-run previo),
 *             aborta si hay errores CRÍTICOS o si las tablas destino no
 *             están vacías, importa TODO en una transacción, y verifica.
 * --verify:   compara el snapshot actual de Sheets contra lo que YA esté en
 *             Postgres, sin importar nada (útil para re-chequear sin
 *             volver a correr el import).
 *
 * Ante 429 de Sheets: se detiene inmediatamente, reporta la etapa exacta,
 * no reintenta, exit code != 0. Nunca dual-write, nunca toca `getSharedGroupsRepository()`.
 */
import { readSharedGroupsSnapshot } from './read'
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
    stage = '[1/6] Reading Sheets'
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
      console.log('\n[DRY RUN] No se abrió conexión a Postgres. No se escribió nada.')
      process.exit(validation.importable ? 0 : 1)
    }

    if (mode === 'verify') {
      poolOpened = true
      stage = '[5/6] Verifying'
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
      console.error(`\n${validation.criticalCount} error(es) CRÍTICO(S) -- abortando import. No se escribió nada en Postgres.`)
      process.exit(1)
    }

    poolOpened = true
    stage = '[4/6] Importing'
    console.log(stage)
    await assertTargetTablesEmpty()
    const importResult = await importBatch(batch!)
    console.log(`Import OK -- filas insertadas: ${JSON.stringify(importResult.inserted)}`)

    stage = '[5/6] Verifying'
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
