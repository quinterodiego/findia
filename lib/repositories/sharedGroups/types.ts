/**
 * Fase DB-3 — frontera de persistencia para Gastos Compartidos V2.
 *
 * Esta interfaz representa EXACTAMENTE las operaciones que los handlers de
 * `app/api/shared-groups/**` y `app/api/shared-group-invitations/**` ya
 * usaban directamente desde `lib/googleSheets.ts` (30 funciones, auditadas
 * una por una contra los imports reales de cada `handlers.ts` -- ver
 * reporte de la fase). No es una API teórica: cada método corresponde 1:1 a
 * una función que YA se llamaba desde algún handler antes de esta fase.
 *
 * Lo que NO está acá, a propósito:
 * - `getUserByEmail` (Users es otro bounded area, sigue en Sheets, sigue
 *   importándose aparte donde haga falta -- ver `members` handler).
 * - Envío de emails (`sendSharedGroupInvitationNotification`) -- side
 *   effect de aplicación, no persistencia.
 * - Lógica de dominio pura (`computeGroupBalances`, `calculateEqualSplit`,
 *   `findFirstSettlementBrokenByReplay`, `canDirectlyLinkUser`,
 *   `validateInvitationTransition`, `normalizeInvitationEmail`, etc.) --
 *   ya vive fuera de `lib/googleSheets.ts` (en `lib/sharedGroupBalances.ts`,
 *   `lib/userIdentity.ts`, `lib/sharedGroupInvitations.ts`) y sigue ahí sin
 *   moverse.
 * - Helpers internos de orquestación de Sheets que ningún handler llama
 *   directamente (`createSharedGroupSplits`, `deleteSharedGroupSplits`,
 *   `getAllSharedGroupInvitations`, `getSharedGroupSplits`,
 *   `getSharedGroupsByUser`, `deleteSharedGroup` sin cascada) -- siguen
 *   siendo detalle interno de la implementación Sheets del repositorio,
 *   nunca parte del contrato público.
 *
 * IMPORTANTE: esta interfaz NO "arregla" nada. Las operaciones multi-step
 * (crear grupo + creator member con compensating delete, crear expense +
 * splits con compensating delete, cascada de borrado de grupo, etc.) siguen
 * teniendo EXACTAMENTE el mismo comportamiento no-transaccional que ya
 * tenían -- eso se evalúa recién en DB-4, para la implementación Postgres.
 */
import type {
  SharedGroup,
  SharedGroupMember,
  SharedGroupExpense,
  SharedGroupSplit,
  SharedGroupSettlement,
  SharedGroupInvitation,
  SharedGroupInvitationWithDetails,
  SharedGroupPairBalance,
} from '@/types'

export type SharedGroupCurrency = 'pesos' | 'usd'

export interface SharedGroupSummaryItem {
  group: SharedGroup
  myMemberId: string
  balances: SharedGroupPairBalance[]
  members: Array<{ id: string; name: string }>
}

export interface SharedGroupBalanceInputs {
  members: SharedGroupMember[]
  expenses: SharedGroupExpense[]
  splits: SharedGroupSplit[]
  settlements: SharedGroupSettlement[]
}

export interface CreateSharedGroupExpenseData {
  description: string
  amount: number
  currency: SharedGroupCurrency
  paidByMemberId: string
  date: string
  splits: { memberId: string; amount: number }[]
}

export interface UpdateSharedGroupExpenseData {
  description?: string
  amount?: number
  currency?: SharedGroupCurrency
  paidByMemberId?: string
  date?: string
  splits?: { memberId: string; amount: number }[]
}

export interface CreateSharedGroupSettlementData {
  paidByMemberId: string
  paidToMemberId: string
  amount: number
  currency: SharedGroupCurrency
  date: string
  notes?: string
}

export interface UpdateSharedGroupSettlementData {
  paidByMemberId?: string
  paidToMemberId?: string
  amount?: number
  currency?: SharedGroupCurrency
  date?: string
  notes?: string
}

export interface SharedGroupsRepository {
  // --- groups ---------------------------------------------------------
  createGroup(
    userId: string,
    data: { name: string; creatorName: string; creatorEmail?: string }
  ): Promise<{ group: SharedGroup; creatorMember: SharedGroupMember }>
  getGroupById(groupId: string): Promise<SharedGroup | null>
  getGroupsSummaryForUser(userId: string): Promise<SharedGroupSummaryItem[]>
  updateGroup(groupId: string, userId: string, data: { name: string }): Promise<SharedGroup>
  deleteGroupCascade(groupId: string, userId: string): Promise<void>

  // --- members ---------------------------------------------------------
  getMembers(groupId: string): Promise<SharedGroupMember[]>
  getMemberForUser(groupId: string, userId: string): Promise<SharedGroupMember | null>
  createMember(groupId: string, data: { name: string; userId?: string; email?: string }): Promise<SharedGroupMember>
  updateMember(memberId: string, data: { name?: string; userId?: string; email?: string }): Promise<SharedGroupMember>
  linkMemberToUser(memberId: string, userId: string): Promise<SharedGroupMember>
  deleteMember(memberId: string): Promise<void>
  isMemberReferenced(groupId: string, memberId: string): Promise<boolean>

  // --- expenses ---------------------------------------------------------
  getExpenses(groupId: string): Promise<SharedGroupExpense[]>
  getSplitsForExpenseIds(expenseIds: string[]): Promise<SharedGroupSplit[]>
  createExpense(
    groupId: string,
    userId: string,
    data: CreateSharedGroupExpenseData
  ): Promise<{ expense: SharedGroupExpense; splits: SharedGroupSplit[] }>
  updateExpense(expenseId: string, userId: string, data: UpdateSharedGroupExpenseData): Promise<SharedGroupExpense>
  deleteExpense(expenseId: string, userId: string): Promise<void>

  // --- settlements ---------------------------------------------------------
  getSettlements(groupId: string): Promise<SharedGroupSettlement[]>
  getBalanceInputs(groupId: string): Promise<SharedGroupBalanceInputs>
  createSettlement(groupId: string, userId: string, data: CreateSharedGroupSettlementData): Promise<SharedGroupSettlement>
  updateSettlement(settlementId: string, userId: string, data: UpdateSharedGroupSettlementData): Promise<SharedGroupSettlement>
  deleteSettlement(settlementId: string, userId: string): Promise<void>

  // --- invitations ---------------------------------------------------------
  getInvitationById(invitationId: string): Promise<SharedGroupInvitation | null>
  getInvitationsByGroup(groupId: string): Promise<SharedGroupInvitation[]>
  getInvitationsByMember(groupId: string, memberId: string): Promise<SharedGroupInvitation[]>
  getInvitationsByTargetEmail(targetEmail: string): Promise<SharedGroupInvitation[]>
  getInvitationsWithDetailsForTargetEmail(targetEmail: string): Promise<SharedGroupInvitationWithDetails[]>
  createInvitation(
    groupId: string,
    memberId: string,
    invitedByUserId: string,
    targetEmail: string
  ): Promise<{ invitation: SharedGroupInvitation; token: string }>
  updateInvitationStatus(invitationId: string, newStatus: SharedGroupInvitation['status']): Promise<SharedGroupInvitation>
  deleteInvitation(invitationId: string): Promise<void>

  // --- operaciones compuestas (Fase DB-4.1) ---------------------------------
  // Cada una reemplaza una secuencia de 2-3 llamadas que el handler hacía por
  // separado (ver lib/repositories/sharedGroups/postgresRepository.ts y
  // sheetsRepository.ts para el detalle exacto de cada implementación):
  //   - Postgres: 1 transacción real, todo o nada.
  //   - Sheets: mismo orden seguro que ya usaba el handler, best-effort,
  //     sin transacción real (Sheets no la soporta).

  /**
   * Transición pending->accepted de una invitación + link del member al
   * userId, como una sola operación. El handler sigue validando token/CANAL
   * B/email/permisos ANTES de llamar esto -- acá adentro solo vive la lógica
   * de estado que YA pertenecía a linkMemberToUser/updateInvitationStatus
   * (idempotencia si ya está aceptada por el mismo userId, conflicto si es
   * por otro). Nunca mueve verificaciones de auth/sesión al repository.
   */
  acceptInvitationAndLinkMember(invitationId: string, userId: string): Promise<{ invitation: SharedGroupInvitation; member: SharedGroupMember }>

  /**
   * Link de un member (shadow -> real) + cancelación de su(s) invitación(es)
   * pending, como una sola operación (member-first direct-link, Fase
   * 4.4.1-B). Cancela TODAS las invitations pending de ese member -- en
   * Postgres el unique index parcial garantiza que nunca hay más de una; en
   * Sheets, si datos históricos dejaran más de una por una corrupción/race
   * pasada, se cancelan todas (nunca se tocan estados terminales).
   */
  linkMemberAndCancelPendingInvitation(
    memberId: string,
    userId: string
  ): Promise<{ member: SharedGroupMember; cancelledInvitationIds: string[] }>
}
