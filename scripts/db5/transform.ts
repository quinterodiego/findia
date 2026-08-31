/**
 * Fase DB-5 — transformación pura: snapshot (shapes de Sheets) -> filas
 * listas para `db.insert(...)` con el schema de Drizzle (DB-2). Nunca hace
 * I/O. Se llama SOLO después de que `validateSnapshot` dio `importable: true`
 * -- no vuelve a validar nada acá (DB-5 §38: no auto-fix, no reparación).
 *
 * Reglas de transformación (DB-5 §19-22):
 * - IDs: se preservan EXACTAMENTE tal cual (Correción DB-1: sin UUID, sin
 *   remapping).
 * - Montos: `toSafeDecimalString` (centavos enteros -> 2 decimales fijos),
 *   nunca `toFixed()` directo sobre el valor crudo.
 * - `date` (civil, expenses/settlements): se pasa el string YYYY-MM-DD tal
 *   cual -- nunca se construye un `Date` ni se aplica ninguna conversión de
 *   timezone (evita el desplazamiento de día que causaría interpretar esa
 *   fecha como UTC).
 * - `createdAt`/`respondedAt` (timestamptz): sí son instantes reales, se
 *   convierten a `Date` (mismo formato que ya esperan los `.set()` de
 *   `postgresRepository.ts`).
 * - Email: NO se fuerza normalización de `SharedGroupMember.email` (se
 *   preserva tal cual está en Sheets, igual que hoy -- la comparación
 *   case-insensitive ya la da el índice único `lower(email)` de Postgres,
 *   sin necesidad de reescribir el valor). `targetEmail` de invitations NO
 *   se re-normaliza tampoco: ya se persiste normalizado desde que se creó
 *   (Fase 4.1), re-normalizarlo ahora no cambiaría nada y evita cualquier
 *   riesgo de alterar semántica de seguridad/token (DB-5 §22/§29).
 * - `tokenHash`: se copia EXACTAMENTE, nunca se rehashea ni se regenera.
 */
import { toSafeDecimalString } from './money'
import type { SharedGroupsSnapshot } from './types'
import type * as schema from '@/lib/db/schema'

type GroupInsert = typeof schema.sharedGroups.$inferInsert
type MemberInsert = typeof schema.sharedGroupMembers.$inferInsert
type ExpenseInsert = typeof schema.sharedGroupExpenses.$inferInsert
type SplitInsert = typeof schema.sharedGroupSplits.$inferInsert
type SettlementInsert = typeof schema.sharedGroupSettlements.$inferInsert
type InvitationInsert = typeof schema.sharedGroupInvitations.$inferInsert

export interface TransformedBatch {
  groups: GroupInsert[]
  members: MemberInsert[]
  expenses: ExpenseInsert[]
  splits: SplitInsert[]
  settlements: SettlementInsert[]
  invitations: InvitationInsert[]
}

export function transformSnapshot(snapshot: SharedGroupsSnapshot): TransformedBatch {
  return {
    groups: snapshot.groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdBy: g.createdBy,
      createdAt: new Date(g.createdAt),
    })),
    members: snapshot.members.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      userId: m.userId,
      name: m.name,
      email: m.email,
      createdAt: new Date(m.createdAt),
    })),
    expenses: snapshot.expenses.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      description: e.description,
      amount: toSafeDecimalString(Number(e.amountRaw)),
      currency: e.currency as 'pesos' | 'usd',
      paidByMemberId: e.paidByMemberId,
      date: e.date,
      createdBy: e.createdBy,
      createdAt: new Date(e.createdAt),
    })),
    splits: snapshot.splits.map((s) => ({
      id: s.id,
      expenseId: s.expenseId,
      memberId: s.memberId,
      amount: toSafeDecimalString(Number(s.amountRaw)),
    })),
    settlements: snapshot.settlements.map((s) => ({
      id: s.id,
      groupId: s.groupId,
      paidByMemberId: s.paidByMemberId,
      paidToMemberId: s.paidToMemberId,
      amount: toSafeDecimalString(Number(s.amountRaw)),
      currency: s.currency as 'pesos' | 'usd',
      date: s.date,
      createdBy: s.createdBy,
      createdAt: new Date(s.createdAt),
      notes: s.notes,
    })),
    invitations: snapshot.invitations.map((inv) => ({
      id: inv.id,
      groupId: inv.groupId,
      memberId: inv.memberId,
      invitedByUserId: inv.invitedByUserId,
      targetEmail: inv.targetEmail,
      status: inv.status as 'pending' | 'accepted' | 'rejected' | 'cancelled',
      tokenHash: inv.tokenHash,
      createdAt: new Date(inv.createdAt),
      respondedAt: inv.respondedAt ? new Date(inv.respondedAt) : null,
    })),
  }
}
