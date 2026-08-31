/**
 * Fase DB-5 — tests sintéticos de validate.ts/transform.ts. Fixtures 100%
 * inventados, sin tocar Sheets ni Postgres (DB-5 §40).
 *
 * Ejecutar con: npx tsx scripts/db5-migration-tests.ts
 */
import { validateSnapshot } from './db5/validate'
import { transformSnapshot } from './db5/transform'
import type { SharedGroupsSnapshot } from './db5/types'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

function hasIssue(result: ReturnType<typeof validateSnapshot>, code: string): boolean {
  return result.issues.some((i) => i.code === code)
}

/** Snapshot mínimo 100% válido: 1 grupo, creador + participante, 1 expense
 * con 2 splits que suman exacto, 1 settlement válido, 1 invitation pending
 * para un tercer shadow member. */
function baseSnapshot(): SharedGroupsSnapshot {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    groups: [{ id: 'g1', name: 'Grupo Test', createdBy: 'u-owner', createdAt: now }],
    members: [
      { id: 'm-owner', groupId: 'g1', userId: 'u-owner', name: 'Owner', email: null, createdAt: now },
      { id: 'm-b', groupId: 'g1', userId: 'u-b', name: 'B', email: 'b@test.local', createdAt: now },
      { id: 'm-shadow', groupId: 'g1', userId: null, name: 'Shadow', email: 'shadow@test.local', createdAt: now },
    ],
    expenses: [
      { id: 'e1', groupId: 'g1', description: 'Cena', amountRaw: '100', currency: 'pesos', paidByMemberId: 'm-owner', date: '2026-01-01', createdBy: 'u-owner', createdAt: now },
    ],
    splits: [
      { id: 's1', expenseId: 'e1', memberId: 'm-owner', amountRaw: '50' },
      { id: 's2', expenseId: 'e1', memberId: 'm-b', amountRaw: '50' },
    ],
    settlements: [
      { id: 'st1', groupId: 'g1', paidByMemberId: 'm-b', paidToMemberId: 'm-owner', amountRaw: '20', currency: 'pesos', date: '2026-01-02', createdBy: 'u-owner', createdAt: now, notes: null },
    ],
    invitations: [
      { id: 'inv1', groupId: 'g1', memberId: 'm-shadow', invitedByUserId: 'u-owner', targetEmail: 'shadow@test.local', status: 'pending', tokenHash: 'abc123', createdAt: now, respondedAt: null },
    ],
  }
}

function main() {
  // --- valid snapshot ---
  {
    const result = validateSnapshot(baseSnapshot())
    check('valid snapshot: 0 críticos', result.criticalCount === 0, result.issues)
    check('valid snapshot: importable true', result.importable === true)
    const batch = transformSnapshot(baseSnapshot())
    check('transform: monto expense a 2 decimales', batch.expenses[0].amount === '100.00')
    check('transform: monto split a 2 decimales', batch.splits[0].amount === '50.00')
    check('transform: date se preserva tal cual (sin shift de timezone)', batch.expenses[0].date === '2026-01-01')
    check('transform: createdAt es Date', batch.groups[0].createdAt instanceof Date)
    check('transform: id se preserva EXACTO (sin uuid)', batch.groups[0].id === 'g1')
  }

  // --- duplicate ID ---
  {
    const snap = baseSnapshot()
    snap.members.push({ ...snap.members[0], id: snap.members[1].id })
    const result = validateSnapshot(snap)
    check('duplicate ID: detectado CRÍTICO', hasIssue(result, 'DUPLICATE_ID'))
    check('duplicate ID: NO importable', !result.importable)
  }

  // --- orphan member (groupId inexistente) ---
  {
    const snap = baseSnapshot()
    snap.members[0].groupId = 'no-existe'
    const result = validateSnapshot(snap)
    check('orphan member: detectado CRÍTICO', hasIssue(result, 'ORPHAN_GROUP'))
  }

  // --- orphan split (expenseId inexistente) ---
  {
    const snap = baseSnapshot()
    snap.splits[0].expenseId = 'no-existe'
    const result = validateSnapshot(snap)
    check('orphan split (expense): detectado CRÍTICO', hasIssue(result, 'ORPHAN_EXPENSE'))
  }

  // --- duplicate member email (normalizado) dentro del mismo grupo ---
  {
    const snap = baseSnapshot()
    snap.members.push({ id: 'm-dup-email', groupId: 'g1', userId: null, name: 'Dup', email: 'B@Test.Local', createdAt: '2026-01-01T00:00:00.000Z' })
    const result = validateSnapshot(snap)
    check('duplicate member email: detectado CRÍTICO', hasIssue(result, 'DUPLICATE_MEMBER_EMAIL'))
  }

  // --- duplicate member userId dentro del mismo grupo ---
  {
    const snap = baseSnapshot()
    snap.members.push({ id: 'm-dup-user', groupId: 'g1', userId: 'u-b', name: 'Dup', email: null, createdAt: '2026-01-01T00:00:00.000Z' })
    const result = validateSnapshot(snap)
    check('duplicate member userId: detectado CRÍTICO', hasIssue(result, 'DUPLICATE_MEMBER_USER_ID'))
  }

  // --- split total mismatch ---
  {
    const snap = baseSnapshot()
    snap.splits[1].amountRaw = '40' // 50 + 40 = 90 != 100
    const result = validateSnapshot(snap)
    check('split total mismatch: detectado CRÍTICO', hasIssue(result, 'SPLIT_SUM_MISMATCH'))
    const issue = result.issues.find((i) => i.code === 'SPLIT_SUM_MISMATCH')
    check('split total mismatch: difference correcta', issue?.ids.difference === '10.00')
  }

  // --- invalid amount ---
  {
    const snap = baseSnapshot()
    snap.expenses[0].amountRaw = 'no-es-un-numero'
    const result = validateSnapshot(snap)
    check('invalid amount: detectado CRÍTICO', hasIssue(result, 'INVALID_AMOUNT'))
  }

  // --- invalid currency ---
  {
    const snap = baseSnapshot()
    snap.expenses[0].currency = 'euros'
    const result = validateSnapshot(snap)
    check('invalid currency: detectado CRÍTICO', hasIssue(result, 'INVALID_CURRENCY'))
  }

  // --- invalid date ---
  {
    const snap = baseSnapshot()
    snap.expenses[0].date = '31/13/2026'
    const result = validateSnapshot(snap)
    check('invalid date: detectado CRÍTICO', hasIssue(result, 'INVALID_DATE'))
  }

  // --- same payer/payee ---
  {
    const snap = baseSnapshot()
    snap.settlements[0].paidToMemberId = snap.settlements[0].paidByMemberId
    const result = validateSnapshot(snap)
    check('same payer/payee: detectado CRÍTICO', hasIssue(result, 'SAME_PAYER_PAYEE'))
  }

  // --- duplicate pending invitation ---
  {
    const snap = baseSnapshot()
    snap.invitations.push({ ...snap.invitations[0], id: 'inv2' })
    const result = validateSnapshot(snap)
    check('duplicate pending invitation: detectado CRÍTICO', hasIssue(result, 'DUPLICATE_PENDING'))
    check('duplicate pending invitation: NO importable', !result.importable)
  }

  // --- respondedAt inconsistente ---
  {
    const snap = baseSnapshot()
    snap.invitations[0].respondedAt = '2026-01-05T00:00:00.000Z' // pending con respondedAt
    const resultA = validateSnapshot(snap)
    check('respondedAt en pending: WARNING', hasIssue(resultA, 'PENDING_WITH_RESPONDED_AT'))

    const snap2 = baseSnapshot()
    snap2.invitations[0].status = 'accepted'
    snap2.invitations[0].respondedAt = null // terminal sin respondedAt
    const resultB = validateSnapshot(snap2)
    check('terminal sin respondedAt: WARNING', hasIssue(resultB, 'TERMINAL_WITHOUT_RESPONDED_AT'))
  }

  // --- normalization warning (email no normalizado) ---
  {
    const snap = baseSnapshot()
    snap.members[1].email = 'B@Test.Local  '.trim() // trim ok, pero mayúsculas
    const result = validateSnapshot(snap)
    check('email no normalizado: WARNING (no crítico)', hasIssue(result, 'EMAIL_NOT_NORMALIZED'))
    check('email no normalizado: sigue siendo importable (es warning)', result.importable === true)
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE DB-5 (VALIDATE/TRANSFORM) PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
