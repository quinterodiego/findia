/**
 * Fase DB-5 — verificación post-import. Lee Postgres en bloque (6 queries
 * totales, sin N+1 -- DB-5 §33) y compara contra el snapshot original YA EN
 * MEMORIA (nunca vuelve a leer Sheets). Compara: counts, IDs, relaciones,
 * balances (mismo `computeGroupBalances` que usa la app) e invitations
 * campo a campo -- nunca imprime tokenHash completo, solo "matches: YES/NO".
 */
import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { computeGroupBalances } from '@/lib/sharedGroupBalances'
import type { SharedGroupPairBalance } from '@/types'
import { parseAmountRaw } from './money'
import type { SharedGroupsSnapshot } from './types'

export interface VerifyIssue {
  severity: 'CRITICAL' | 'WARNING'
  code: string
  message: string
}

export interface VerifyResult {
  issues: VerifyIssue[]
  ok: boolean
  counts: {
    groups: { snapshot: number; postgres: number }
    members: { snapshot: number; postgres: number }
    expenses: { snapshot: number; postgres: number }
    splits: { snapshot: number; postgres: number }
    settlements: { snapshot: number; postgres: number }
    invitations: { snapshot: number; postgres: number }
  }
}

function critical(code: string, message: string): VerifyIssue {
  return { severity: 'CRITICAL', code, message }
}

function balancesEqual(a: SharedGroupPairBalance[], b: SharedGroupPairBalance[]): boolean {
  if (a.length !== b.length) return false
  const key = (x: SharedGroupPairBalance) => `${x.fromMemberId}|${x.toMemberId}|${x.currency}|${x.amount.toFixed(2)}`
  const setA = new Set(a.map(key))
  const setB = new Set(b.map(key))
  if (setA.size !== setB.size) return false
  for (const k of setA) if (!setB.has(k)) return false
  return true
}

export async function verifyImport(snapshot: SharedGroupsSnapshot): Promise<VerifyResult> {
  const db = getDb()
  const issues: VerifyIssue[] = []

  const [pgGroups, pgMembers, pgExpenses, pgSplits, pgSettlements, pgInvitations] = await Promise.all([
    db.select().from(schema.sharedGroups),
    db.select().from(schema.sharedGroupMembers),
    db.select().from(schema.sharedGroupExpenses),
    db.select().from(schema.sharedGroupSplits),
    db.select().from(schema.sharedGroupSettlements),
    db.select().from(schema.sharedGroupInvitations),
  ])

  const counts = {
    groups: { snapshot: snapshot.groups.length, postgres: pgGroups.length },
    members: { snapshot: snapshot.members.length, postgres: pgMembers.length },
    expenses: { snapshot: snapshot.expenses.length, postgres: pgExpenses.length },
    splits: { snapshot: snapshot.splits.length, postgres: pgSplits.length },
    settlements: { snapshot: snapshot.settlements.length, postgres: pgSettlements.length },
    invitations: { snapshot: snapshot.invitations.length, postgres: pgInvitations.length },
  }
  for (const [name, c] of Object.entries(counts)) {
    if (c.snapshot !== c.postgres) issues.push(critical('COUNT_MISMATCH', `${name}: snapshot=${c.snapshot} postgres=${c.postgres}`))
  }

  // IDs presentes -- sin remapping (Correción DB-1), comparación directa de sets.
  function checkIds(name: string, snapshotIds: string[], pgIds: string[]) {
    const pgSet = new Set(pgIds)
    const missing = snapshotIds.filter((id) => !pgSet.has(id))
    if (missing.length > 0) issues.push(critical('MISSING_IDS', `${name}: ${missing.length} ids del snapshot no están en Postgres (ej. ${missing.slice(0, 3).join(', ')})`))
  }
  checkIds('groups', snapshot.groups.map((g) => g.id), pgGroups.map((g) => g.id))
  checkIds('members', snapshot.members.map((m) => m.id), pgMembers.map((m) => m.id))
  checkIds('expenses', snapshot.expenses.map((e) => e.id), pgExpenses.map((e) => e.id))
  checkIds('splits', snapshot.splits.map((s) => s.id), pgSplits.map((s) => s.id))
  checkIds('settlements', snapshot.settlements.map((s) => s.id), pgSettlements.map((s) => s.id))
  checkIds('invitations', snapshot.invitations.map((i) => i.id), pgInvitations.map((i) => i.id))

  // Balance parity, por grupo -- mismo computeGroupBalances de siempre.
  for (const group of snapshot.groups) {
    const snapMembers = snapshot.members.filter((m) => m.groupId === group.id)
    const snapExpenses = snapshot.expenses.filter((e) => e.groupId === group.id)
    const snapExpenseIds = new Set(snapExpenses.map((e) => e.id))
    const snapSplits = snapshot.splits.filter((s) => snapExpenseIds.has(s.expenseId))
    const snapSettlements = snapshot.settlements.filter((s) => s.groupId === group.id)

    const snapshotBalances = computeGroupBalances(
      snapMembers.map((m) => ({ id: m.id })),
      snapExpenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency as 'pesos' | 'usd' })),
      snapSplits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: parseAmountRaw(s.amountRaw).value })),
      snapSettlements.map((s) => ({ paidByMemberId: s.paidByMemberId, paidToMemberId: s.paidToMemberId, amount: parseAmountRaw(s.amountRaw).value, currency: s.currency as 'pesos' | 'usd' }))
    )

    const pgGroupMembers = pgMembers.filter((m) => m.groupId === group.id)
    const pgGroupExpenses = pgExpenses.filter((e) => e.groupId === group.id)
    const pgExpenseIds = new Set(pgGroupExpenses.map((e) => e.id))
    const pgGroupSplits = pgSplits.filter((s) => pgExpenseIds.has(s.expenseId))
    const pgGroupSettlements = pgSettlements.filter((s) => s.groupId === group.id)

    const postgresBalances = computeGroupBalances(
      pgGroupMembers.map((m) => ({ id: m.id })),
      pgGroupExpenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency })),
      pgGroupSplits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: Number(s.amount) })),
      pgGroupSettlements.map((s) => ({ paidByMemberId: s.paidByMemberId, paidToMemberId: s.paidToMemberId, amount: Number(s.amount), currency: s.currency }))
    )

    if (!balancesEqual(snapshotBalances, postgresBalances)) {
      issues.push(critical('BALANCE_MISMATCH', `group ${group.id}: balances de Sheets y Postgres no coinciden`))
    }
  }

  // Invitation parity -- campo a campo, tokenHash solo YES/NO.
  const pgInvitationById = new Map(pgInvitations.map((i) => [i.id, i]))
  for (const inv of snapshot.invitations) {
    const pg = pgInvitationById.get(inv.id)
    if (!pg) continue // ya reportado como MISSING_IDS
    if (pg.status !== inv.status) issues.push(critical('INVITATION_STATUS_MISMATCH', `invitation ${inv.id}: status snapshot=${inv.status} postgres=${pg.status}`))
    if (pg.memberId !== inv.memberId) issues.push(critical('INVITATION_MEMBER_MISMATCH', `invitation ${inv.id}: memberId no coincide`))
    if (pg.groupId !== inv.groupId) issues.push(critical('INVITATION_GROUP_MISMATCH', `invitation ${inv.id}: groupId no coincide`))
    if (pg.targetEmail !== inv.targetEmail) issues.push(critical('INVITATION_EMAIL_MISMATCH', `invitation ${inv.id}: targetEmail no coincide`))
    if (pg.tokenHash !== inv.tokenHash) issues.push(critical('INVITATION_TOKEN_HASH_MISMATCH', `invitation ${inv.id}: tokenHash matches: NO`))
  }

  return { issues, ok: issues.filter((i) => i.severity === 'CRITICAL').length === 0, counts }
}
