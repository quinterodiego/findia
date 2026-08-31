/**
 * Fase DB-5 — test de import contra Postgres local descartable (DB-5 §41).
 * Fixture sintético (no Sheets), valida -> transforma -> importa -> verifica
 * paridad 100%. Después prueba rollback: un batch con una fila que viola una
 * FK real -> el import completo falla -> la base queda vacía.
 *
 * Ejecutar con:
 *   DATABASE_URL=postgresql://postgres:findia_test@localhost:PUERTO/DB npx tsx scripts/db5-import-test.ts
 */
import { validateSnapshot } from './db5/validate'
import { transformSnapshot } from './db5/transform'
import { assertTargetTablesEmpty, importBatch } from './db5/importer'
import { verifyImport } from './db5/verify'
import { getDb, closePool } from '../lib/db/client'
import * as schema from '../lib/db/schema'
import type { SharedGroupsSnapshot } from './db5/types'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

function validFixture(): SharedGroupsSnapshot {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    groups: [{ id: 'import-g1', name: 'Import Test Group', createdBy: 'import-u-owner', createdAt: now }],
    members: [
      { id: 'import-m-owner', groupId: 'import-g1', userId: 'import-u-owner', name: 'Owner', email: null, createdAt: now },
      { id: 'import-m-b', groupId: 'import-g1', userId: 'import-u-b', name: 'B', email: 'importb@test.local', createdAt: now },
    ],
    expenses: [
      { id: 'import-e1', groupId: 'import-g1', description: 'Cena', amountRaw: '100', currency: 'pesos', paidByMemberId: 'import-m-owner', date: '2026-01-01', createdBy: 'import-u-owner', createdAt: now },
    ],
    splits: [
      { id: 'import-s1', expenseId: 'import-e1', memberId: 'import-m-owner', amountRaw: '50' },
      { id: 'import-s2', expenseId: 'import-e1', memberId: 'import-m-b', amountRaw: '50' },
    ],
    settlements: [
      { id: 'import-st1', groupId: 'import-g1', paidByMemberId: 'import-m-b', paidToMemberId: 'import-m-owner', amountRaw: '20', currency: 'pesos', date: '2026-01-02', createdBy: 'import-u-owner', createdAt: now, notes: null },
    ],
    invitations: [
      { id: 'import-inv1', groupId: 'import-g1', memberId: 'import-m-b', invitedByUserId: 'import-u-owner', targetEmail: 'importb@test.local', status: 'accepted', tokenHash: 'deadbeef', createdAt: now, respondedAt: now },
    ],
  }
}

async function allTablesEmpty(): Promise<boolean> {
  const db = getDb()
  const [g, m, e, s, st, inv] = await Promise.all([
    db.select({ id: schema.sharedGroups.id }).from(schema.sharedGroups).limit(1),
    db.select({ id: schema.sharedGroupMembers.id }).from(schema.sharedGroupMembers).limit(1),
    db.select({ id: schema.sharedGroupExpenses.id }).from(schema.sharedGroupExpenses).limit(1),
    db.select({ id: schema.sharedGroupSplits.id }).from(schema.sharedGroupSplits).limit(1),
    db.select({ id: schema.sharedGroupSettlements.id }).from(schema.sharedGroupSettlements).limit(1),
    db.select({ id: schema.sharedGroupInvitations.id }).from(schema.sharedGroupInvitations).limit(1),
  ])
  return [g, m, e, s, st, inv].every((r) => r.length === 0)
}

async function main() {
  // --- import feliz: fixture válido -> import -> verify -> 100% match ---
  {
    check('pre-condición: tablas destino vacías', await allTablesEmpty())

    const snapshot = validFixture()
    const validation = validateSnapshot(snapshot)
    check('fixture válido: importable', validation.importable, validation.issues)

    await assertTargetTablesEmpty()
    const batch = transformSnapshot(snapshot)
    const importResult = await importBatch(batch)
    check('import: 1 grupo insertado', importResult.inserted.groups === 1)
    check('import: 2 members insertados', importResult.inserted.members === 2)
    check('import: 1 expense insertado', importResult.inserted.expenses === 1)
    check('import: 2 splits insertados', importResult.inserted.splits === 2)
    check('import: 1 settlement insertado', importResult.inserted.settlements === 1)
    check('import: 1 invitation insertada', importResult.inserted.invitations === 1)

    const verifyResult = await verifyImport(snapshot)
    check('verify: ok', verifyResult.ok, verifyResult.issues)
    check('verify: counts coinciden exacto', Object.values(verifyResult.counts).every((c) => c.snapshot === c.postgres))
    check('verify: 0 issues', verifyResult.issues.length === 0, verifyResult.issues)

    // limpiar antes del test de rollback (necesita las tablas vacías de nuevo)
    await getDb().delete(schema.sharedGroupInvitations)
    await getDb().delete(schema.sharedGroupSettlements)
    await getDb().delete(schema.sharedGroupSplits)
    await getDb().delete(schema.sharedGroupExpenses)
    await getDb().delete(schema.sharedGroupMembers)
    await getDb().delete(schema.sharedGroups)
    check('cleanup post-import: tablas vacías de nuevo', await allTablesEmpty())
  }

  // --- rollback: un split referencia un memberId que NO existe -> FK real
  // rechaza el insert -> el import completo (incluido el group/expense ya
  // "insertados" antes en la misma transacción) debe revertir. ---
  {
    const snapshot = validFixture()
    const batch = transformSnapshot(snapshot)
    // Corromper a propósito: un split de un memberId inexistente.
    batch.splits[1] = { ...batch.splits[1], memberId: 'no-existe-en-absoluto' }

    let threw = false
    try {
      await importBatch(batch)
    } catch {
      threw = true
    }
    check('rollback: import lanzó error (FK real)', threw)
    check('rollback: la base quedó COMPLETAMENTE vacía (nada de group/members/expense quedó)', await allTablesEmpty())
  }

  // --- idempotencia: import sobre una base NO vacía debe abortar ---
  {
    const snapshot = validFixture()
    const batch = transformSnapshot(snapshot)
    await importBatch(batch) // deja la base con datos
    let threw = false
    try {
      await assertTargetTablesEmpty()
    } catch {
      threw = true
    }
    check('idempotencia: assertTargetTablesEmpty aborta si ya hay datos', threw)

    // cleanup final
    await getDb().delete(schema.sharedGroupInvitations)
    await getDb().delete(schema.sharedGroupSettlements)
    await getDb().delete(schema.sharedGroupSplits)
    await getDb().delete(schema.sharedGroupExpenses)
    await getDb().delete(schema.sharedGroupMembers)
    await getDb().delete(schema.sharedGroups)
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE IMPORT DE DB-5 PASARON' : `${failures} TEST(S) FALLARON`}`)
  await closePool()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('Error fatal:', e)
  await closePool()
  process.exit(1)
})
