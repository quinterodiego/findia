/**
 * Schema Drizzle de Gastos Compartidos V2 (Fase DB-2) + PushSubscriptions
 * (Fase DB-8.1). Ningún otro módulo de FINDIA se migra en estas fases.
 * FINDIA sigue leyendo/escribiendo Google Sheets para todo lo demás.
 *
 * Decisiones de la auditoría DB-1, con las correcciones pedidas:
 *
 * - IDs: se preservan tal cual como `text` (los mismos strings que ya usa
 *   `lib/googleSheets.ts`, ej. `${Date.now()}-${random}`). NO se convierten
 *   a uuid en esta migración -- minimiza riesgo, evita remapping, preserva
 *   links de invitación ya emitidos, y separa la migración de storage de
 *   una eventual migración de identidad (que podría evaluarse aparte en el
 *   futuro si alguna vez aporta un beneficio real).
 *
 * - `userId`/`createdBy`/`invitedByUserId`: quedan como `text` SIN
 *   `.references()` hacia una tabla `users` -- Users sigue viviendo en
 *   Sheets en esta fase (ver auditoría DB-1 §11: no se reabre la
 *   arquitectura de identidad). La integridad de esa referencia sigue
 *   validándose en la capa de aplicación, igual que hoy.
 *
 * - Constraints únicos parciales (member por userId, member por email,
 *   invitation pending única): implementados con `uniqueIndex(...).where(...)`
 *   -- NUNCA como `unique()` inline con WHERE, que Postgres no soporta así.
 */
import { sql } from 'drizzle-orm'
import { pgTable, pgEnum, text, numeric, timestamp, date, uniqueIndex, index, check } from 'drizzle-orm/pg-core'

export const currencyEnum = pgEnum('currency', ['pesos', 'usd'])
export const invitationStatusEnum = pgEnum('invitation_status', ['pending', 'accepted', 'rejected', 'cancelled'])

export const sharedGroups = pgTable('shared_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull(), // soft reference a Users (Sheets) -- sin FK
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sharedGroupMembers = pgTable(
  'shared_group_members',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => sharedGroups.id, { onDelete: 'cascade' }),
    userId: text('user_id'), // soft reference a Users (Sheets) -- sin FK; null = shadow member
    name: text('name').notNull(),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Un mismo userId no puede estar vinculado dos veces al mismo grupo.
    uniqueIndex('shared_group_members_group_user_unique')
      .on(table.groupId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    // Mismo email normalizado no puede repetirse dos veces en el mismo grupo.
    uniqueIndex('shared_group_members_group_email_unique')
      .on(table.groupId, sql`lower(${table.email})`)
      .where(sql`${table.email} IS NOT NULL`),
    index('shared_group_members_user_id_idx').on(table.userId).where(sql`${table.userId} IS NOT NULL`),
  ]
)

export const sharedGroupExpenses = pgTable(
  'shared_group_expenses',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => sharedGroups.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum('currency').notNull(),
    paidByMemberId: text('paid_by_member_id')
      .notNull()
      .references(() => sharedGroupMembers.id, { onDelete: 'restrict' }),
    date: date('date').notNull(),
    createdBy: text('created_by').notNull(), // soft reference a Users (Sheets)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('shared_group_expenses_group_date_idx').on(table.groupId, table.date),
    check('shared_group_expenses_amount_positive', sql`${table.amount} > 0`),
  ]
)

export const sharedGroupSplits = pgTable(
  'shared_group_splits',
  {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
      .notNull()
      .references(() => sharedGroupExpenses.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => sharedGroupMembers.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    index('shared_group_splits_expense_id_idx').on(table.expenseId),
    index('shared_group_splits_member_id_idx').on(table.memberId),
    check('shared_group_splits_amount_positive', sql`${table.amount} > 0`),
  ]
)

export const sharedGroupSettlements = pgTable(
  'shared_group_settlements',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => sharedGroups.id, { onDelete: 'cascade' }),
    paidByMemberId: text('paid_by_member_id')
      .notNull()
      .references(() => sharedGroupMembers.id, { onDelete: 'restrict' }),
    paidToMemberId: text('paid_to_member_id')
      .notNull()
      .references(() => sharedGroupMembers.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum('currency').notNull(),
    date: date('date').notNull(),
    createdBy: text('created_by').notNull(), // soft reference a Users (Sheets)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
  },
  (table) => [
    index('shared_group_settlements_group_date_idx').on(table.groupId, table.date),
    check('shared_group_settlements_amount_positive', sql`${table.amount} > 0`),
    check('shared_group_settlements_parties_distinct', sql`${table.paidByMemberId} <> ${table.paidToMemberId}`),
  ]
)

export const sharedGroupInvitations = pgTable(
  'shared_group_invitations',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => sharedGroups.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => sharedGroupMembers.id, { onDelete: 'cascade' }),
    invitedByUserId: text('invited_by_user_id').notNull(), // soft reference a Users (Sheets)
    targetEmail: text('target_email').notNull(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (table) => [
    // Como máximo una invitación pending por member, a nivel de base.
    uniqueIndex('shared_group_invitations_member_pending_unique')
      .on(table.memberId)
      .where(sql`${table.status} = 'pending'`),
    index('shared_group_invitations_target_email_status_idx').on(table.targetEmail, table.status),
    index('shared_group_invitations_group_member_status_idx').on(table.groupId, table.memberId, table.status),
  ]
)

/**
 * Fase DB-8.1 -- PushSubscriptions. El endpoint de push (emitido por el
 * servicio de push del navegador, ej. FCM) identifica de forma GLOBAL una
 * suscripción -- no está scopeado a un usuario de FINDIA. Confirmado por el
 * comportamiento ya existente en `lib/pushService.ts`: re-suscribirse con el
 * mismo endpoint (mismo browser/dispositivo, sea el mismo usuario u otro que
 * inició sesión después) siempre reemplaza la fila anterior de ese endpoint,
 * nunca convive con ella. `UNIQUE(endpoint)` + upsert reproduce exactamente
 * ese comportamiento de forma atómica, eliminando el patrón anterior de
 * leer-toda-la-hoja → borrar-todo → reescribir-sobrevivientes.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // soft reference a Users (Sheets) -- sin FK
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
    index('push_subscriptions_user_id_idx').on(table.userId),
  ]
)
