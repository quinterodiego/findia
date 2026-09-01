/**
 * Fase DB-7A.1 — check operacional READ-ONLY para que DB-7B lo corra el día
 * del cutover (o cuantas veces haga falta antes) y confirme el estado real
 * de la configuración, sin escribir NADA.
 *
 * Qué hace:
 *   1. Imprime qué backend elegiría `resolveSharedGroupsStorage()` con el
 *      env actual, y el estado del maintenance freeze -- sin imprimir
 *      ningún valor de env var, solo presente/ausente y el resultado.
 *   2. Si `DATABASE_URL` está presente, corre `assertTargetTablesEmpty()`
 *      (de scripts/db5/importer.ts, sin modificarla) para confirmar que las
 *      6 tablas de Shared Groups V2 siguen vacías -- exactamente el mismo
 *      guard que usará el import real, corrido acá solo para observar el
 *      resultado antes de tiempo.
 *
 * Qué NUNCA hace: truncar, importar, migrar, cambiar env vars, ni un solo
 * INSERT/UPDATE/DELETE. No es un "one-click cutover" -- es una lectura.
 *
 * Ejecutar con: npx tsx scripts/db7-preflight-check.ts
 * (con las env vars que se quieran auditar ya seteadas en el shell/entorno)
 */
import { resolveSharedGroupsStorage } from '../lib/repositories/sharedGroups'
import { isMaintenanceModeEnabled } from '../lib/sharedGroupsMaintenance'
import { isPostgresConnectivityError } from '../lib/repositories/sharedGroups/pgErrors'

function presence(name: string): string {
  return process.env[name] !== undefined ? 'presente' : 'ausente'
}

async function main() {
  console.log('=== DB-7 preflight check (read-only) ===\n')

  console.log('--- env vars relevantes (solo presente/ausente, nunca el valor) ---')
  console.log(`DATABASE_URL:                              ${presence('DATABASE_URL')}`)
  console.log(`SHARED_GROUPS_STORAGE:                     ${presence('SHARED_GROUPS_STORAGE')}`)
  console.log(`SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED:  ${presence('SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED')}`)
  console.log(`SHARED_GROUPS_MAINTENANCE_MODE:             ${presence('SHARED_GROUPS_MAINTENANCE_MODE')}`)
  console.log(`VERCEL_ENV:                                 ${process.env.VERCEL_ENV || '(ausente)'}`)

  const storage = resolveSharedGroupsStorage()
  const maintenance = isMaintenanceModeEnabled()
  console.log(`\n--- resolución ---`)
  console.log(`Backend que se usaría ahora mismo: ${storage.toUpperCase()}`)
  console.log(`Maintenance freeze:                ${maintenance ? 'ACTIVO (writes V2 bloqueados)' : 'inactivo'}`)

  if (!process.env.DATABASE_URL) {
    console.log('\nDATABASE_URL ausente -- se omite el chequeo de tablas vacías (no hay a qué conectarse).')
    process.exit(0)
  }

  console.log('\n--- chequeo de tablas destino (Postgres) ---')
  try {
    const { assertTargetTablesEmpty } = await import('./db5/importer')
    await assertTargetTablesEmpty()
    console.log('Las 6 tablas de Shared Groups V2 están vacías. Listo para un import (DB-5) si correspondiera.')
    const { closePool } = await import('../lib/db/client')
    await closePool()
    process.exit(0)
  } catch (error) {
    if (isPostgresConnectivityError(error)) {
      console.error('No se pudo conectar a Postgres (error de conectividad, no de datos). Revisar DATABASE_URL/red antes de continuar.')
    } else {
      console.error((error as Error)?.message || String(error))
    }
    process.exit(1)
  }
}

main()
