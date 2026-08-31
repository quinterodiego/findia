/**
 * Fase DB-5 — import a Postgres. UNA sola transacción para las 6 entidades
 * (DB-5 §24): si cualquier insert falla, ROLLBACK total, no queda import
 * parcial. Inserts multi-fila por entidad (DB-5 §25), en bloques -- nunca
 * un INSERT por fila.
 *
 * Idempotencia (DB-5 §26): antes de escribir, verifica que las 6 tablas
 * estén VACÍAS. Si alguna tiene datos, ABORTA sin escribir nada -- no hay
 * modo "pisar datos existentes" en este script.
 */
import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { TransformedBatch } from './transform'

const BATCH_SIZE = 500

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function assertTargetTablesEmpty(): Promise<void> {
  const db = getDb()
  const checks: Array<[string, Promise<unknown[]>]> = [
    ['shared_groups', db.select({ id: schema.sharedGroups.id }).from(schema.sharedGroups).limit(1)],
    ['shared_group_members', db.select({ id: schema.sharedGroupMembers.id }).from(schema.sharedGroupMembers).limit(1)],
    ['shared_group_expenses', db.select({ id: schema.sharedGroupExpenses.id }).from(schema.sharedGroupExpenses).limit(1)],
    ['shared_group_splits', db.select({ id: schema.sharedGroupSplits.id }).from(schema.sharedGroupSplits).limit(1)],
    ['shared_group_settlements', db.select({ id: schema.sharedGroupSettlements.id }).from(schema.sharedGroupSettlements).limit(1)],
    ['shared_group_invitations', db.select({ id: schema.sharedGroupInvitations.id }).from(schema.sharedGroupInvitations).limit(1)],
  ]
  const results = await Promise.all(checks.map(([, p]) => p))
  const nonEmpty = checks.map(([name], i) => (results[i].length > 0 ? name : null)).filter(Boolean)
  if (nonEmpty.length > 0) {
    throw new Error(
      `Las siguientes tablas destino NO están vacías: ${nonEmpty.join(', ')}. DB-5 no importa sobre una base ya poblada -- abortando sin escribir nada.`
    )
  }
}

export interface ImportResult {
  inserted: { groups: number; members: number; expenses: number; splits: number; settlements: number; invitations: number }
}

/** Import atómico. Asume que `assertTargetTablesEmpty()` ya se llamó y pasó,
 * y que el batch viene de `transformSnapshot()` sobre un snapshot ya
 * validado como `importable: true`. Respeta el orden de FKs (DB-5 §23). */
export async function importBatch(batch: TransformedBatch): Promise<ImportResult> {
  const db = getDb()

  await db.transaction(async (tx) => {
    for (const group of chunk(batch.groups, BATCH_SIZE)) {
      if (group.length > 0) await tx.insert(schema.sharedGroups).values(group)
    }
    for (const members of chunk(batch.members, BATCH_SIZE)) {
      if (members.length > 0) await tx.insert(schema.sharedGroupMembers).values(members)
    }
    for (const expenses of chunk(batch.expenses, BATCH_SIZE)) {
      if (expenses.length > 0) await tx.insert(schema.sharedGroupExpenses).values(expenses)
    }
    for (const splits of chunk(batch.splits, BATCH_SIZE)) {
      if (splits.length > 0) await tx.insert(schema.sharedGroupSplits).values(splits)
    }
    for (const settlements of chunk(batch.settlements, BATCH_SIZE)) {
      if (settlements.length > 0) await tx.insert(schema.sharedGroupSettlements).values(settlements)
    }
    for (const invitations of chunk(batch.invitations, BATCH_SIZE)) {
      if (invitations.length > 0) await tx.insert(schema.sharedGroupInvitations).values(invitations)
    }
  })

  return {
    inserted: {
      groups: batch.groups.length,
      members: batch.members.length,
      expenses: batch.expenses.length,
      splits: batch.splits.length,
      settlements: batch.settlements.length,
      invitations: batch.invitations.length,
    },
  }
}
