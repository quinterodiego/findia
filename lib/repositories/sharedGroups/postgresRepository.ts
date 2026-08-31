/**
 * Fase DB-4 — implementación Postgres de SharedGroupsRepository.
 *
 * Implementa el contrato completo definido en DB-3 (types.ts), sin ningún
 * método parcial ni `throw new Error("not implemented")`. Reproduce EXACTAMENTE
 * las reglas de negocio, mensajes de error y formas de retorno de la
 * implementación Sheets (sheetsRepository.ts / lib/googleSheets.ts) -- las
 * diferencias deliberadas (dónde Postgres gana atomicidad real) están
 * documentadas método por método y en el reporte de la fase.
 *
 * NO se usa todavía en producción -- `getSharedGroupsRepository()` (index.ts)
 * sigue devolviendo la implementación Sheets. Esta clase solo se instancia
 * desde los contract tests de esta fase.
 */
import { and, eq, inArray, or, isNull, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { translatePgError, unwrapPgError } from './pgErrors'
import { parseCivilDate } from '@/lib/formatDate'
import {
  validateSharedGroupExpenseInput,
  validateSettlementAgainstBalance,
  computeGroupBalances,
  type Currency,
} from '@/lib/sharedGroupBalances'
import {
  normalizeInvitationEmail,
  generateInvitationToken,
  hashInvitationToken,
  validateInvitationTransition,
} from '@/lib/sharedGroupInvitations'
import type {
  SharedGroup,
  SharedGroupMember,
  SharedGroupExpense,
  SharedGroupSplit,
  SharedGroupSettlement,
  SharedGroupInvitation,
  SharedGroupInvitationWithDetails,
} from '@/types'
import type {
  SharedGroupsRepository,
  SharedGroupSummaryItem,
  SharedGroupBalanceInputs,
  CreateSharedGroupExpenseData,
  UpdateSharedGroupExpenseData,
  CreateSharedGroupSettlementData,
  UpdateSharedGroupSettlementData,
} from './types'

// ============================================================================
// IDs -- mismo mecanismo que lib/googleSheets.ts (Correción DB-1: sin UUID,
// sin legacy_id, para preservar compatibilidad de IDs durante la convivencia).
// ============================================================================
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============================================================================
// Conversión de tipos Postgres -> shapes exactos de types/index.ts
// (numeric llega como string por defecto en Drizzle/pg -- nunca se confía en
// que sea number; date/timestamp pueden llegar como Date según el driver).
// ============================================================================
function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}
function toDateStr(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}
function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : parseFloat(value)
}

function mapGroup(row: typeof schema.sharedGroups.$inferSelect): SharedGroup {
  return { id: row.id, name: row.name, createdBy: row.createdBy, createdAt: toIso(row.createdAt) }
}
function mapMember(row: typeof schema.sharedGroupMembers.$inferSelect): SharedGroupMember {
  return {
    id: row.id,
    groupId: row.groupId,
    userId: row.userId ?? undefined,
    name: row.name,
    email: row.email ?? undefined,
    createdAt: toIso(row.createdAt),
  }
}
function mapExpense(row: typeof schema.sharedGroupExpenses.$inferSelect): SharedGroupExpense {
  return {
    id: row.id,
    groupId: row.groupId,
    description: row.description,
    amount: toNumber(row.amount),
    currency: row.currency,
    paidByMemberId: row.paidByMemberId,
    date: toDateStr(row.date),
    createdBy: row.createdBy,
    createdAt: toIso(row.createdAt),
  }
}
function mapSplit(row: typeof schema.sharedGroupSplits.$inferSelect): SharedGroupSplit {
  return { id: row.id, expenseId: row.expenseId, memberId: row.memberId, amount: toNumber(row.amount) }
}
function mapSettlement(row: typeof schema.sharedGroupSettlements.$inferSelect): SharedGroupSettlement {
  return {
    id: row.id,
    groupId: row.groupId,
    paidByMemberId: row.paidByMemberId,
    paidToMemberId: row.paidToMemberId,
    amount: toNumber(row.amount),
    currency: row.currency,
    date: toDateStr(row.date),
    createdBy: row.createdBy,
    createdAt: toIso(row.createdAt),
    notes: row.notes ?? undefined,
  }
}
function mapInvitation(row: typeof schema.sharedGroupInvitations.$inferSelect): SharedGroupInvitation {
  return {
    id: row.id,
    groupId: row.groupId,
    memberId: row.memberId,
    invitedByUserId: row.invitedByUserId,
    targetEmail: row.targetEmail,
    status: row.status,
    tokenHash: row.tokenHash,
    createdAt: toIso(row.createdAt),
    respondedAt: row.respondedAt ? toIso(row.respondedAt) : undefined,
  }
}

export class PostgresSharedGroupsRepository implements SharedGroupsRepository {
  private db = getDb()

  // ==========================================================================
  // groups
  // ==========================================================================

  /**
   * TRANSACCIÓN REAL (a diferencia de Sheets, que crea el grupo y el creator
   * member en 2 escrituras separadas con un compensating-delete best-effort
   * si la segunda falla -- ver createSharedGroup en lib/googleSheets.ts).
   * Acá, si falla cualquiera de las dos inserciones, Postgres hace ROLLBACK
   * completo: el grupo tampoco queda persistido. Sin compensating delete.
   */
  async createGroup(
    userId: string,
    data: { name: string; creatorName: string; creatorEmail?: string }
  ): Promise<{ group: SharedGroup; creatorMember: SharedGroupMember }> {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('El nombre del grupo no puede estar vacío')
    }
    if (!data.creatorName || data.creatorName.trim().length === 0) {
      throw new Error('Falta el nombre del creador para agregarlo como miembro')
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [groupRow] = await tx
          .insert(schema.sharedGroups)
          .values({ id: generateId(), name: data.name.trim(), createdBy: userId })
          .returning()
        const [memberRow] = await tx
          .insert(schema.sharedGroupMembers)
          .values({
            id: generateId(),
            groupId: groupRow.id,
            userId,
            name: data.creatorName.trim(),
            email: data.creatorEmail || null,
          })
          .returning()
        return { group: mapGroup(groupRow), creatorMember: mapMember(memberRow) }
      })
    } catch (error) {
      throw translatePgError(error)
    }
  }

  async getGroupById(groupId: string): Promise<SharedGroup | null> {
    const [row] = await this.db.select().from(schema.sharedGroups).where(eq(schema.sharedGroups.id, groupId))
    return row ? mapGroup(row) : null
  }

  /**
   * Devuelve exactamente la misma estructura que getSharedGroupsSummaryForUser
   * (Sheets), pero con lecturas indexadas y acotadas a los grupos del usuario
   * -- no lee las 6 tablas completas como el equivalente Sheets (que hace 5
   * lecturas de hoja entera, ya optimizado ahí para evitar N+1 por grupo).
   * El algoritmo de balance (computeGroupBalances) es el mismo helper puro,
   * sin reimplementar nada.
   */
  async getGroupsSummaryForUser(userId: string): Promise<SharedGroupSummaryItem[]> {
    const myMemberships = await this.db
      .select()
      .from(schema.sharedGroupMembers)
      .where(eq(schema.sharedGroupMembers.userId, userId))
    if (myMemberships.length === 0) return []

    const groupIds = [...new Set(myMemberships.map((m) => m.groupId))]

    const [groups, allMembers, allExpenses, allSettlements] = await Promise.all([
      this.db.select().from(schema.sharedGroups).where(inArray(schema.sharedGroups.id, groupIds)),
      this.db.select().from(schema.sharedGroupMembers).where(inArray(schema.sharedGroupMembers.groupId, groupIds)),
      this.db.select().from(schema.sharedGroupExpenses).where(inArray(schema.sharedGroupExpenses.groupId, groupIds)),
      this.db.select().from(schema.sharedGroupSettlements).where(inArray(schema.sharedGroupSettlements.groupId, groupIds)),
    ])

    const expenseIds = allExpenses.map((e) => e.id)
    const allSplits =
      expenseIds.length > 0
        ? await this.db.select().from(schema.sharedGroupSplits).where(inArray(schema.sharedGroupSplits.expenseId, expenseIds))
        : []

    const summaries: SharedGroupSummaryItem[] = []
    for (const membership of myMemberships) {
      const groupRow = groups.find((g) => g.id === membership.groupId)
      if (!groupRow) continue // membresía huérfana -- mismo criterio defensivo que Sheets

      const groupMembers = allMembers.filter((m) => m.groupId === groupRow.id)
      const groupExpenses = allExpenses.filter((e) => e.groupId === groupRow.id)
      const groupExpenseIds = new Set(groupExpenses.map((e) => e.id))
      const groupSplits = allSplits.filter((s) => groupExpenseIds.has(s.expenseId))
      const groupSettlements = allSettlements.filter((s) => s.groupId === groupRow.id)

      const balances = computeGroupBalances(
        groupMembers.map((m) => ({ id: m.id })),
        groupExpenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency as Currency })),
        groupSplits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: toNumber(s.amount) })),
        groupSettlements.map((s) => ({
          paidByMemberId: s.paidByMemberId,
          paidToMemberId: s.paidToMemberId,
          amount: toNumber(s.amount),
          currency: s.currency as Currency,
        }))
      )

      summaries.push({
        group: mapGroup(groupRow),
        myMemberId: membership.id,
        balances,
        members: groupMembers.map((m) => ({ id: m.id, name: m.name })),
      })
    }

    return summaries
  }

  async updateGroup(groupId: string, userId: string, data: { name: string }): Promise<SharedGroup> {
    const name = data.name?.trim()
    if (!name) throw new Error('El nombre del grupo no puede estar vacío')

    let row: typeof schema.sharedGroups.$inferSelect | undefined
    try {
      ;[row] = await this.db
        .update(schema.sharedGroups)
        .set({ name })
        .where(and(eq(schema.sharedGroups.id, groupId), eq(schema.sharedGroups.createdBy, userId)))
        .returning()
    } catch (error) {
      throw translatePgError(error)
    }
    if (!row) throw new Error('Grupo no encontrado o no tenés permisos para modificarlo')
    return mapGroup(row)
  }

  /**
   * Un único DELETE. La cascada real (splits -> expenses -> settlements ->
   * members -> invitations) la hacen los `ON DELETE CASCADE` del schema
   * (Fase DB-2) -- no hay 5 pasos secuenciales no-transaccionales como
   * deleteSharedGroupCascade en Sheets, ni riesgo de cascada parcial.
   */
  async deleteGroupCascade(groupId: string, userId: string): Promise<void> {
    const [row] = await this.db
      .delete(schema.sharedGroups)
      .where(and(eq(schema.sharedGroups.id, groupId), eq(schema.sharedGroups.createdBy, userId)))
      .returning()
    if (row) return

    const [existing] = await this.db.select().from(schema.sharedGroups).where(eq(schema.sharedGroups.id, groupId))
    if (!existing) throw new Error('Grupo no encontrado')
    throw new Error('Solo el creador del grupo puede eliminarlo')
  }

  // ==========================================================================
  // members
  // ==========================================================================

  async getMembers(groupId: string): Promise<SharedGroupMember[]> {
    return (await this.db.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.groupId, groupId))).map(mapMember)
  }

  async getMemberForUser(groupId: string, userId: string): Promise<SharedGroupMember | null> {
    const [row] = await this.db
      .select()
      .from(schema.sharedGroupMembers)
      .where(and(eq(schema.sharedGroupMembers.groupId, groupId), eq(schema.sharedGroupMembers.userId, userId)))
    return row ? mapMember(row) : null
  }

  async createMember(groupId: string, data: { name: string; userId?: string; email?: string }): Promise<SharedGroupMember> {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('El nombre del miembro no puede estar vacío')
    }
    let row: typeof schema.sharedGroupMembers.$inferSelect
    try {
      ;[row] = await this.db
        .insert(schema.sharedGroupMembers)
        .values({ id: generateId(), groupId, userId: data.userId || null, name: data.name.trim(), email: data.email || null })
        .returning()
    } catch (error) {
      throw translatePgError(error)
    }
    return mapMember(row)
  }

  async updateMember(memberId: string, data: { name?: string; userId?: string; email?: string }): Promise<SharedGroupMember> {
    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new Error('El nombre del miembro no puede estar vacío')
    }
    const patch: Partial<typeof schema.sharedGroupMembers.$inferInsert> = {}
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.userId !== undefined) patch.userId = data.userId || null
    if (data.email !== undefined) patch.email = data.email || null

    let row: typeof schema.sharedGroupMembers.$inferSelect | undefined
    try {
      if (Object.keys(patch).length === 0) {
        ;[row] = await this.db.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.id, memberId))
      } else {
        ;[row] = await this.db
          .update(schema.sharedGroupMembers)
          .set(patch)
          .where(eq(schema.sharedGroupMembers.id, memberId))
          .returning()
      }
    } catch (error) {
      throw translatePgError(error)
    }
    if (!row) throw new Error('Miembro no encontrado')
    return mapMember(row)
  }

  /**
   * Atómico de verdad: el UPDATE solo linkea si la fila SIGUE sin userId en
   * el momento de escribir (WHERE user_id IS NULL), en vez de leer-y-luego-
   * escribir como en Sheets (ventana TOCTOU). Idempotente: si ya está
   * vinculado al mismo userId, no-op. Si está vinculado a otro, conflicto.
   */
  async linkMemberToUser(memberId: string, userId: string): Promise<SharedGroupMember> {
    const [current] = await this.db.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.id, memberId))
    if (!current) throw new Error('Miembro no encontrado')
    if (current.userId === userId) return mapMember(current)
    if (current.userId) throw new Error('Este miembro ya está vinculado a otra cuenta')

    let row: typeof schema.sharedGroupMembers.$inferSelect | undefined
    try {
      ;[row] = await this.db
        .update(schema.sharedGroupMembers)
        .set({ userId })
        .where(and(eq(schema.sharedGroupMembers.id, memberId), isNull(schema.sharedGroupMembers.userId)))
        .returning()
    } catch (error) {
      throw translatePgError(error)
    }
    if (row) return mapMember(row)

    // Ganó otra escritura concurrente entre el read de arriba y este UPDATE.
    const [fresh] = await this.db.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.id, memberId))
    if (fresh?.userId === userId) return mapMember(fresh)
    throw new Error('Este miembro ya está vinculado a otra cuenta')
  }

  /** Si el member está referenciado (expenses/splits/settlements), el propio
   * `ON DELETE RESTRICT` del schema rechaza el DELETE -- no hace falta
   * chequearlo a mano acá (el handler igual llama isMemberReferenced antes,
   * por UX; esto es la garantía final de integridad, no la única). */
  async deleteMember(memberId: string): Promise<void> {
    let row: typeof schema.sharedGroupMembers.$inferSelect | undefined
    try {
      ;[row] = await this.db.delete(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.id, memberId)).returning()
    } catch (error) {
      const pgError = unwrapPgError(error)
      if (pgError.code === '23503') throw new Error('No podés eliminar este miembro porque tiene movimientos asociados')
      throw translatePgError(error)
    }
    if (!row) throw new Error('Miembro no encontrado')
  }

  async isMemberReferenced(groupId: string, memberId: string): Promise<boolean> {
    void groupId // el memberId ya identifica un único grupo -- no hace falta filtrar dos veces
    const [expenseRow] = await this.db
      .select({ id: schema.sharedGroupExpenses.id })
      .from(schema.sharedGroupExpenses)
      .where(eq(schema.sharedGroupExpenses.paidByMemberId, memberId))
      .limit(1)
    if (expenseRow) return true

    const [splitRow] = await this.db
      .select({ id: schema.sharedGroupSplits.id })
      .from(schema.sharedGroupSplits)
      .where(eq(schema.sharedGroupSplits.memberId, memberId))
      .limit(1)
    if (splitRow) return true

    const [settlementRow] = await this.db
      .select({ id: schema.sharedGroupSettlements.id })
      .from(schema.sharedGroupSettlements)
      .where(or(eq(schema.sharedGroupSettlements.paidByMemberId, memberId), eq(schema.sharedGroupSettlements.paidToMemberId, memberId)))
      .limit(1)
    return !!settlementRow
  }

  // ==========================================================================
  // expenses
  // ==========================================================================

  async getExpenses(groupId: string): Promise<SharedGroupExpense[]> {
    return (await this.db.select().from(schema.sharedGroupExpenses).where(eq(schema.sharedGroupExpenses.groupId, groupId))).map(mapExpense)
  }

  async getSplitsForExpenseIds(expenseIds: string[]): Promise<SharedGroupSplit[]> {
    if (expenseIds.length === 0) return []
    return (await this.db.select().from(schema.sharedGroupSplits).where(inArray(schema.sharedGroupSplits.expenseId, expenseIds))).map(mapSplit)
  }

  /**
   * TRANSACCIÓN REAL: INSERT expense + INSERT splits (multi-fila) en la misma
   * transacción. Si el insert de splits falla por cualquier motivo (ej. un
   * memberId referenciando un member borrado en el medio), Postgres hace
   * ROLLBACK del expense también -- sin el compensating-delete best-effort
   * que usa createSharedGroupExpense en Sheets (deleteSharedGroupExpenseRowOnly).
   */
  async createExpense(
    groupId: string,
    userId: string,
    data: CreateSharedGroupExpenseData
  ): Promise<{ expense: SharedGroupExpense; splits: SharedGroupSplit[] }> {
    const members = await this.getMembers(groupId)
    if (members.length === 0) throw new Error('El grupo no tiene miembros — no se puede cargar un gasto')
    const validMemberIds = members.map((m) => m.id)

    const validation = validateSharedGroupExpenseInput(
      { description: data.description, amount: data.amount, currency: data.currency, paidByMemberId: data.paidByMemberId, splits: data.splits },
      validMemberIds
    )
    if (!validation.valid) throw new Error(validation.error)
    if (!parseCivilDate(data.date)) throw new Error('La fecha del gasto no es válida (se espera formato YYYY-MM-DD)')

    const expenseId = generateId()
    try {
      return await this.db.transaction(async (tx) => {
        const [expenseRow] = await tx
          .insert(schema.sharedGroupExpenses)
          .values({
            id: expenseId,
            groupId,
            description: data.description.trim(),
            amount: String(data.amount),
            currency: data.currency,
            paidByMemberId: data.paidByMemberId,
            date: data.date,
            createdBy: userId,
          })
          .returning()

        const splitRows = await tx
          .insert(schema.sharedGroupSplits)
          .values(data.splits.map((s) => ({ id: generateId(), expenseId, memberId: s.memberId, amount: String(s.amount) })))
          .returning()

        return { expense: mapExpense(expenseRow), splits: splitRows.map(mapSplit) }
      })
    } catch (error) {
      throw translatePgError(error)
    }
  }

  async updateExpense(expenseId: string, userId: string, data: UpdateSharedGroupExpenseData): Promise<SharedGroupExpense> {
    if (data.amount !== undefined && !data.splits) {
      throw new Error('Para cambiar el monto también hay que pasar los nuevos splits')
    }

    const [current] = await this.db
      .select()
      .from(schema.sharedGroupExpenses)
      .where(and(eq(schema.sharedGroupExpenses.id, expenseId), eq(schema.sharedGroupExpenses.createdBy, userId)))
    if (!current) throw new Error('Gasto no encontrado o no tenés permisos para modificarlo')

    const description = data.description !== undefined ? data.description.trim() : current.description
    const amount = data.amount !== undefined ? data.amount : toNumber(current.amount)
    const currency = data.currency !== undefined ? data.currency : current.currency
    const paidByMemberId = data.paidByMemberId !== undefined ? data.paidByMemberId : current.paidByMemberId
    const date = data.date !== undefined ? data.date : current.date

    if (description.trim().length === 0) throw new Error('La descripción no puede estar vacía')
    if (data.date !== undefined && !parseCivilDate(data.date)) {
      throw new Error('La fecha del gasto no es válida (se espera formato YYYY-MM-DD)')
    }

    const members = await this.getMembers(current.groupId)
    const validMemberIds = members.map((m) => m.id)

    if (data.splits) {
      const validation = validateSharedGroupExpenseInput({ description, amount, currency, paidByMemberId, splits: data.splits }, validMemberIds)
      if (!validation.valid) throw new Error(validation.error)
    } else if (!validMemberIds.includes(paidByMemberId)) {
      throw new Error('El pagador debe ser un miembro del grupo')
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [updatedRow] = await tx
          .update(schema.sharedGroupExpenses)
          .set({ description, amount: String(amount), currency, paidByMemberId, date })
          .where(eq(schema.sharedGroupExpenses.id, expenseId))
          .returning()

        if (data.splits) {
          await tx.delete(schema.sharedGroupSplits).where(eq(schema.sharedGroupSplits.expenseId, expenseId))
          await tx
            .insert(schema.sharedGroupSplits)
            .values(data.splits.map((s) => ({ id: generateId(), expenseId, memberId: s.memberId, amount: String(s.amount) })))
        }

        return mapExpense(updatedRow)
      })
    } catch (error) {
      throw translatePgError(error)
    }
  }

  /** Splits desaparecen solos vía ON DELETE CASCADE -- sin llamada separada. */
  async deleteExpense(expenseId: string, userId: string): Promise<void> {
    const [row] = await this.db
      .delete(schema.sharedGroupExpenses)
      .where(and(eq(schema.sharedGroupExpenses.id, expenseId), eq(schema.sharedGroupExpenses.createdBy, userId)))
      .returning()
    if (!row) throw new Error('Gasto no encontrado o no tenés permisos para eliminarlo')
  }

  // ==========================================================================
  // settlements
  // ==========================================================================

  async getSettlements(groupId: string): Promise<SharedGroupSettlement[]> {
    return (await this.db.select().from(schema.sharedGroupSettlements).where(eq(schema.sharedGroupSettlements.groupId, groupId))).map(
      mapSettlement
    )
  }

  async getBalanceInputs(groupId: string): Promise<SharedGroupBalanceInputs> {
    const [members, expenses, settlements] = await Promise.all([this.getMembers(groupId), this.getExpenses(groupId), this.getSettlements(groupId)])
    const splits = await this.getSplitsForExpenseIds(expenses.map((e) => e.id))
    return { members, expenses, splits, settlements }
  }

  /**
   * Estrategia de concurrencia (DB-1 §12 / DB-4 §12): advisory lock
   * transaccional por grupo (`pg_advisory_xact_lock(hashtext(groupId))`),
   * tomado ANTES de leer members/expenses/splits/settlements y liberado
   * automáticamente al COMMIT/ROLLBACK. Serializa cualquier par de
   * createSettlement/updateSettlement concurrentes del MISMO grupo -- el
   * segundo espera a que el primero termine su transacción antes de leer el
   * balance, así que nunca dos settlements validan contra el mismo balance
   * viejo. No se creó una arquitectura de ledger nueva: es el mismo cálculo
   * de balance de siempre (computeGroupBalances), solo que ahora corre
   * dentro de una sección crítica real.
   */
  async createSettlement(groupId: string, userId: string, data: CreateSharedGroupSettlementData): Promise<SharedGroupSettlement> {
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error('El monto del pago debe ser un número finito mayor a 0')
    if (data.currency !== 'pesos' && data.currency !== 'usd') throw new Error("La moneda debe ser 'pesos' o 'usd'")
    if (data.paidByMemberId === data.paidToMemberId) throw new Error('El pagador y el receptor del pago no pueden ser el mismo miembro')
    if (!parseCivilDate(data.date)) throw new Error('La fecha del pago no es válida (se espera formato YYYY-MM-DD)')

    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${groupId})::bigint)`)

        const members = await tx.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.groupId, groupId))
        const validMemberIds = members.map((m) => m.id)
        if (!validMemberIds.includes(data.paidByMemberId) || !validMemberIds.includes(data.paidToMemberId)) {
          throw new Error('El pagador y el receptor deben ser miembros del grupo')
        }

        const expenses = await tx.select().from(schema.sharedGroupExpenses).where(eq(schema.sharedGroupExpenses.groupId, groupId))
        const expenseIds = expenses.map((e) => e.id)
        const splits =
          expenseIds.length > 0 ? await tx.select().from(schema.sharedGroupSplits).where(inArray(schema.sharedGroupSplits.expenseId, expenseIds)) : []
        const existingSettlements = await tx.select().from(schema.sharedGroupSettlements).where(eq(schema.sharedGroupSettlements.groupId, groupId))

        const currentBalances = computeGroupBalances(
          members.map((m) => ({ id: m.id })),
          expenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency as Currency })),
          splits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: toNumber(s.amount) })),
          existingSettlements.map((s) => ({
            paidByMemberId: s.paidByMemberId,
            paidToMemberId: s.paidToMemberId,
            amount: toNumber(s.amount),
            currency: s.currency as Currency,
          }))
        )

        const validation = validateSettlementAgainstBalance(currentBalances, data)
        if (!validation.valid) throw new Error(validation.error)

        const [row] = await tx
          .insert(schema.sharedGroupSettlements)
          .values({
            id: generateId(),
            groupId,
            paidByMemberId: data.paidByMemberId,
            paidToMemberId: data.paidToMemberId,
            amount: String(data.amount),
            currency: data.currency,
            date: data.date,
            createdBy: userId,
            notes: data.notes || null,
          })
          .returning()

        return mapSettlement(row)
      })
    } catch (error) {
      throw translatePgError(error)
    }
  }

  /** Mismo advisory lock por grupo que createSettlement -- ver ahí. */
  async updateSettlement(settlementId: string, userId: string, data: UpdateSharedGroupSettlementData): Promise<SharedGroupSettlement> {
    if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount <= 0)) {
      throw new Error('El monto del pago debe ser un número finito mayor a 0')
    }
    if (data.date !== undefined && !parseCivilDate(data.date)) {
      throw new Error('La fecha del pago no es válida (se espera formato YYYY-MM-DD)')
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(schema.sharedGroupSettlements)
          .where(and(eq(schema.sharedGroupSettlements.id, settlementId), eq(schema.sharedGroupSettlements.createdBy, userId)))
        if (!current) throw new Error('Pago no encontrado o no tenés permisos para modificarlo')

        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${current.groupId})::bigint)`)

        const paidByMemberId = data.paidByMemberId !== undefined ? data.paidByMemberId : current.paidByMemberId
        const paidToMemberId = data.paidToMemberId !== undefined ? data.paidToMemberId : current.paidToMemberId
        const amount = data.amount !== undefined ? data.amount : toNumber(current.amount)
        const currency = data.currency !== undefined ? data.currency : current.currency
        const date = data.date !== undefined ? data.date : current.date
        const notes = data.notes !== undefined ? data.notes : current.notes ?? undefined

        if (!Number.isFinite(amount) || amount <= 0) throw new Error('El monto del pago debe ser un número finito mayor a 0')
        if (paidByMemberId === paidToMemberId) throw new Error('El pagador y el receptor del pago no pueden ser el mismo miembro')

        const financialFieldsChanged =
          data.amount !== undefined || data.currency !== undefined || data.paidByMemberId !== undefined || data.paidToMemberId !== undefined

        if (financialFieldsChanged) {
          const members = await tx.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.groupId, current.groupId))
          const validMemberIds = members.map((m) => m.id)
          if (!validMemberIds.includes(paidByMemberId) || !validMemberIds.includes(paidToMemberId)) {
            throw new Error('El pagador y el receptor deben ser miembros del grupo')
          }

          const expenses = await tx.select().from(schema.sharedGroupExpenses).where(eq(schema.sharedGroupExpenses.groupId, current.groupId))
          const expenseIds = expenses.map((e) => e.id)
          const splits =
            expenseIds.length > 0
              ? await tx.select().from(schema.sharedGroupSplits).where(inArray(schema.sharedGroupSplits.expenseId, expenseIds))
              : []
          const otherSettlements = (
            await tx.select().from(schema.sharedGroupSettlements).where(eq(schema.sharedGroupSettlements.groupId, current.groupId))
          ).filter((s) => s.id !== settlementId)

          const balancesWithoutThisSettlement = computeGroupBalances(
            members.map((m) => ({ id: m.id })),
            expenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency as Currency })),
            splits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: toNumber(s.amount) })),
            otherSettlements.map((s) => ({
              paidByMemberId: s.paidByMemberId,
              paidToMemberId: s.paidToMemberId,
              amount: toNumber(s.amount),
              currency: s.currency as Currency,
            }))
          )

          const validation = validateSettlementAgainstBalance(balancesWithoutThisSettlement, { paidByMemberId, paidToMemberId, amount, currency })
          if (!validation.valid) throw new Error(validation.error)
        }

        const [updatedRow] = await tx
          .update(schema.sharedGroupSettlements)
          .set({ paidByMemberId, paidToMemberId, amount: String(amount), currency, date, notes: notes || null })
          .where(eq(schema.sharedGroupSettlements.id, settlementId))
          .returning()

        return mapSettlement(updatedRow)
      })
    } catch (error) {
      throw translatePgError(error)
    }
  }

  /** Sin revalidación retroactiva acá -- igual que Sheets, esa lógica
   * (findFirstSettlementBrokenByReplay) vive en el handler, no en el repository. */
  async deleteSettlement(settlementId: string, userId: string): Promise<void> {
    const [row] = await this.db
      .delete(schema.sharedGroupSettlements)
      .where(and(eq(schema.sharedGroupSettlements.id, settlementId), eq(schema.sharedGroupSettlements.createdBy, userId)))
      .returning()
    if (!row) throw new Error('Pago no encontrado o no tenés permisos para eliminarlo')
  }

  // ==========================================================================
  // invitations
  // ==========================================================================

  async getInvitationById(invitationId: string): Promise<SharedGroupInvitation | null> {
    const [row] = await this.db.select().from(schema.sharedGroupInvitations).where(eq(schema.sharedGroupInvitations.id, invitationId))
    return row ? mapInvitation(row) : null
  }

  async getInvitationsByGroup(groupId: string): Promise<SharedGroupInvitation[]> {
    return (await this.db.select().from(schema.sharedGroupInvitations).where(eq(schema.sharedGroupInvitations.groupId, groupId))).map(mapInvitation)
  }

  async getInvitationsByMember(groupId: string, memberId: string): Promise<SharedGroupInvitation[]> {
    return (
      await this.db
        .select()
        .from(schema.sharedGroupInvitations)
        .where(and(eq(schema.sharedGroupInvitations.groupId, groupId), eq(schema.sharedGroupInvitations.memberId, memberId)))
    ).map(mapInvitation)
  }

  async getInvitationsByTargetEmail(targetEmail: string): Promise<SharedGroupInvitation[]> {
    const normalized = normalizeInvitationEmail(targetEmail)
    return (await this.db.select().from(schema.sharedGroupInvitations).where(eq(schema.sharedGroupInvitations.targetEmail, normalized))).map(
      mapInvitation
    )
  }

  /** 1 sola query con LEFT JOIN en vez de 1+2 lecturas completas de hoja
   * (Sheets) -- misma forma de retorno, groupName/inviterName con el mismo
   * fallback ('Grupo'/'Alguien') que la versión Sheets. */
  async getInvitationsWithDetailsForTargetEmail(targetEmail: string): Promise<SharedGroupInvitationWithDetails[]> {
    const normalized = normalizeInvitationEmail(targetEmail)
    const rows = await this.db
      .select({
        invitation: schema.sharedGroupInvitations,
        groupName: schema.sharedGroups.name,
        inviterName: schema.sharedGroupMembers.name,
      })
      .from(schema.sharedGroupInvitations)
      .leftJoin(schema.sharedGroups, eq(schema.sharedGroups.id, schema.sharedGroupInvitations.groupId))
      .leftJoin(
        schema.sharedGroupMembers,
        and(
          eq(schema.sharedGroupMembers.groupId, schema.sharedGroupInvitations.groupId),
          eq(schema.sharedGroupMembers.userId, schema.sharedGroupInvitations.invitedByUserId)
        )
      )
      .where(and(eq(schema.sharedGroupInvitations.targetEmail, normalized), eq(schema.sharedGroupInvitations.status, 'pending')))

    return rows.map((r) => ({
      ...mapInvitation(r.invitation),
      groupName: r.groupName || 'Grupo',
      inviterName: r.inviterName || 'Alguien',
    }))
  }

  async createInvitation(
    groupId: string,
    memberId: string,
    invitedByUserId: string,
    targetEmail: string
  ): Promise<{ invitation: SharedGroupInvitation; token: string }> {
    const [group] = await this.db.select().from(schema.sharedGroups).where(eq(schema.sharedGroups.id, groupId))
    if (!group) throw new Error('Grupo no encontrado')

    const [member] = await this.db
      .select()
      .from(schema.sharedGroupMembers)
      .where(and(eq(schema.sharedGroupMembers.id, memberId), eq(schema.sharedGroupMembers.groupId, groupId)))
    if (!member) throw new Error('El miembro no pertenece a este grupo')

    const normalizedEmail = normalizeInvitationEmail(targetEmail)
    if (!normalizedEmail) throw new Error('El email de la invitación es requerido')

    const token = generateInvitationToken()
    const tokenHash = hashInvitationToken(token)

    let row: typeof schema.sharedGroupInvitations.$inferSelect
    try {
      ;[row] = await this.db
        .insert(schema.sharedGroupInvitations)
        .values({ id: generateId(), groupId, memberId, invitedByUserId, targetEmail: normalizedEmail, status: 'pending', tokenHash })
        .returning()
    } catch (error) {
      // El unique index parcial (member_id) WHERE status='pending' es la
      // garantía final -- el handler ya hace su propio chequeo antes (Fase
      // 4.2), esto solo cubre la carrera que ese chequeo no puede evitar
      // (DB-4 §24.C). El mensaje coincide con canCreateInvitation.
      throw translatePgError(error)
    }
    return { invitation: mapInvitation(row), token }
  }

  /**
   * Transición atómica: UPDATE ... WHERE status='pending' RETURNING. Si 0
   * filas, NO hubo ventana SELECT-luego-UPDATE (DB-4 §16) -- se relee para
   * dar el mismo mensaje que validateInvitationTransition (o "no encontrada"
   * si directamente no existe). Esto es lo que garantiza que, ante un
   * accept y un cancel concurrentes sobre la misma invitación, exactamente
   * uno gane (DB-4 §24.D).
   */
  async updateInvitationStatus(invitationId: string, newStatus: SharedGroupInvitation['status']): Promise<SharedGroupInvitation> {
    const [row] = await this.db
      .update(schema.sharedGroupInvitations)
      .set({ status: newStatus, respondedAt: new Date() })
      .where(and(eq(schema.sharedGroupInvitations.id, invitationId), eq(schema.sharedGroupInvitations.status, 'pending')))
      .returning()
    if (row) return mapInvitation(row)

    const [current] = await this.db.select().from(schema.sharedGroupInvitations).where(eq(schema.sharedGroupInvitations.id, invitationId))
    if (!current) throw new Error('Invitación no encontrada')
    const transition = validateInvitationTransition(current.status, newStatus)
    throw new Error(transition.error)
  }

  /** No-op silencioso si no existe -- mismo comportamiento que
   * deleteSharedGroupInvitation en Sheets (pensado para poder llamarse desde
   * una cascada sin pre-chequear existencia). */
  async deleteInvitation(invitationId: string): Promise<void> {
    await this.db.delete(schema.sharedGroupInvitations).where(eq(schema.sharedGroupInvitations.id, invitationId))
  }

  // ==========================================================================
  // operaciones compuestas (Fase DB-4.1) -- transacción real
  // ==========================================================================

  /**
   * TRANSACCIÓN REAL. Reemplaza la secuencia
   * `linkMemberToUser` + `updateInvitationStatus('accepted')` que antes hacía
   * el handler en dos llamadas separadas (DB-4 §30, hallazgo documentado).
   *
   * El handler sigue validando token/CANAL B/email/permisos ANTES de llamar
   * esto -- acá adentro solo vive la lógica de estado que YA pertenecía a
   * linkMemberToUser/updateInvitationStatus (idempotencia, conflicto),
   * ahora atómica: si cualquier paso falla, TODO hace rollback (nunca queda
   * "invitation accepted + member no linkeado" ni "member linkeado +
   * invitation pending").
   *
   * Idempotente: si ya está accepted y el member ya es de este userId,
   * devuelve el estado actual sin escribir nada.
   */
  async acceptInvitationAndLinkMember(
    invitationId: string,
    userId: string
  ): Promise<{ invitation: SharedGroupInvitation; member: SharedGroupMember }> {
    try {
      return await this.db.transaction(async (tx) => {
        const [current] = await tx.select().from(schema.sharedGroupInvitations).where(eq(schema.sharedGroupInvitations.id, invitationId))
        if (!current) throw new Error('Invitación no encontrada')

        if (current.status === 'accepted') {
          const [memberRow] = await tx.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.id, current.memberId))
          if (memberRow?.userId === userId) {
            return { invitation: mapInvitation(current), member: mapMember(memberRow) }
          }
          throw new Error('Esta invitación ya fue aceptada')
        }

        const [invitationRow] = await tx
          .update(schema.sharedGroupInvitations)
          .set({ status: 'accepted', respondedAt: new Date() })
          .where(and(eq(schema.sharedGroupInvitations.id, invitationId), eq(schema.sharedGroupInvitations.status, 'pending')))
          .returning()
        if (!invitationRow) throw new Error(`No se puede pasar de "${current.status}" a "accepted"`)

        const [memberCurrent] = await tx.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.id, current.memberId))
        if (!memberCurrent) throw new Error('El miembro de esta invitación ya no existe')

        let memberRow = memberCurrent
        if (memberCurrent.userId !== userId) {
          if (memberCurrent.userId) throw new Error('Este miembro ya está vinculado a otra cuenta')
          const [updated] = await tx
            .update(schema.sharedGroupMembers)
            .set({ userId })
            .where(and(eq(schema.sharedGroupMembers.id, current.memberId), isNull(schema.sharedGroupMembers.userId)))
            .returning()
          if (!updated) throw new Error('Este miembro ya está vinculado a otra cuenta')
          memberRow = updated
        }

        return { invitation: mapInvitation(invitationRow), member: mapMember(memberRow) }
      })
    } catch (error) {
      throw translatePgError(error)
    }
  }

  /**
   * TRANSACCIÓN REAL. Reemplaza `linkMemberToUser` + buscar pending +
   * `updateInvitationStatus('cancelled')` (member-first direct-link, Fase
   * 4.4.1-B). Cancela TODAS las invitations pending de ese member en la
   * misma transacción -- el unique index parcial garantiza que en Postgres
   * nunca hay más de una, pero la query no asume eso (`WHERE status =
   * 'pending'`, sin LIMIT), así que sigue siendo correcta si esa garantía
   * cambiara. Nunca toca invitations en estado terminal.
   */
  async linkMemberAndCancelPendingInvitation(
    memberId: string,
    userId: string
  ): Promise<{ member: SharedGroupMember; cancelledInvitationIds: string[] }> {
    try {
      return await this.db.transaction(async (tx) => {
        const [current] = await tx.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.id, memberId))
        if (!current) throw new Error('Miembro no encontrado')

        let memberRow = current
        if (current.userId !== userId) {
          if (current.userId) throw new Error('Este miembro ya está vinculado a otra cuenta')
          const [updated] = await tx
            .update(schema.sharedGroupMembers)
            .set({ userId })
            .where(and(eq(schema.sharedGroupMembers.id, memberId), isNull(schema.sharedGroupMembers.userId)))
            .returning()
          if (!updated) throw new Error('Este miembro ya está vinculado a otra cuenta')
          memberRow = updated
        }

        const cancelledRows = await tx
          .update(schema.sharedGroupInvitations)
          .set({ status: 'cancelled', respondedAt: new Date() })
          .where(and(eq(schema.sharedGroupInvitations.memberId, memberId), eq(schema.sharedGroupInvitations.status, 'pending')))
          .returning({ id: schema.sharedGroupInvitations.id })

        return { member: mapMember(memberRow), cancelledInvitationIds: cancelledRows.map((r) => r.id) }
      })
    } catch (error) {
      throw translatePgError(error)
    }
  }
}

export function createPostgresSharedGroupsRepository(): SharedGroupsRepository {
  return new PostgresSharedGroupsRepository()
}
