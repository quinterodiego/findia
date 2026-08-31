/**
 * Fase DB-5 — validación pura del snapshot. Nunca toca Sheets ni Postgres,
 * nunca corrige nada (DB-5 §38: solo diagnostica). Testeable 100% con
 * fixtures sintéticos.
 */
import { parseCivilDate } from '@/lib/formatDate'
import { normalizeInvitationEmail } from '@/lib/sharedGroupInvitations'
import { computeGroupBalances } from '@/lib/sharedGroupBalances'
import { parseAmountRaw, toCents } from './money'
import type { Issue, SharedGroupsSnapshot, ValidationResult } from './types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_CURRENCIES = new Set(['pesos', 'usd'])
const VALID_STATUSES = new Set(['pending', 'accepted', 'rejected', 'cancelled'])

function isValidTimestamp(value: string): boolean {
  return !!value && !isNaN(Date.parse(value))
}

function critical(entity: Issue['entity'], code: string, ids: Record<string, string>, message: string): Issue {
  return { severity: 'CRITICAL', code, entity, ids, message }
}
function warning(entity: Issue['entity'], code: string, ids: Record<string, string>, message: string): Issue {
  return { severity: 'WARNING', code, entity, ids, message }
}

export function validateSnapshot(snapshot: SharedGroupsSnapshot): ValidationResult {
  const issues: Issue[] = []
  const { groups, members, expenses, splits, settlements, invitations } = snapshot

  // --- IDs: vacío / duplicado / whitespace, por entidad -----------------
  function checkIds(entity: Issue['entity'], rows: { id: string }[]) {
    const seen = new Map<string, number>()
    for (const row of rows) {
      if (!row.id || row.id.trim() === '') {
        issues.push(critical(entity, 'EMPTY_ID', {}, `${entity} con id vacío`))
        continue
      }
      if (row.id !== row.id.trim()) {
        issues.push(warning(entity, 'ID_WHITESPACE', { id: row.id }, `${entity}.id tiene espacios inesperados: "${row.id}"`))
      }
      seen.set(row.id, (seen.get(row.id) || 0) + 1)
    }
    for (const [id, count] of seen) {
      if (count > 1) issues.push(critical(entity, 'DUPLICATE_ID', { id }, `${entity}.id duplicado (${count} filas): ${id}`))
    }
  }
  checkIds('group', groups)
  checkIds('member', members)
  checkIds('expense', expenses)
  checkIds('split', splits)
  checkIds('settlement', settlements)
  checkIds('invitation', invitations)

  const groupIds = new Set(groups.map((g) => g.id))
  const memberById = new Map(members.map((m) => [m.id, m]))
  const expenseById = new Map(expenses.map((e) => [e.id, e]))

  // --- GROUPS -------------------------------------------------------------
  for (const g of groups) {
    if (!g.name || g.name.trim() === '') issues.push(critical('group', 'EMPTY_NAME', { id: g.id }, 'name vacío'))
    if (!g.createdBy || g.createdBy.trim() === '') issues.push(critical('group', 'EMPTY_CREATED_BY', { id: g.id }, 'createdBy vacío'))
    if (!isValidTimestamp(g.createdAt)) issues.push(critical('group', 'INVALID_CREATED_AT', { id: g.id }, `createdAt inválido: "${g.createdAt}"`))
  }

  // --- MEMBERS --------------------------------------------------------------
  const membersByGroup = new Map<string, typeof members>()
  for (const m of members) {
    if (!groupIds.has(m.groupId)) {
      issues.push(critical('member', 'ORPHAN_GROUP', { id: m.id, groupId: m.groupId }, `member.groupId no existe: ${m.groupId}`))
    }
    if (!m.name || m.name.trim() === '') issues.push(critical('member', 'EMPTY_NAME', { id: m.id }, 'name vacío'))
    if (!isValidTimestamp(m.createdAt)) issues.push(critical('member', 'INVALID_CREATED_AT', { id: m.id }, `createdAt inválido: "${m.createdAt}"`))
    if (m.email) {
      const normalized = normalizeInvitationEmail(m.email)
      if (normalized !== m.email) {
        issues.push(warning('member', 'EMAIL_NOT_NORMALIZED', { id: m.id }, `email "${m.email}" difiere de su forma normalizada "${normalized}"`))
      }
    }
    const arr = membersByGroup.get(m.groupId) || []
    arr.push(m)
    membersByGroup.set(m.groupId, arr)
  }
  for (const [groupId, groupMembers] of membersByGroup) {
    const userIdSeen = new Map<string, string[]>()
    const emailSeen = new Map<string, string[]>()
    for (const m of groupMembers) {
      if (m.userId) userIdSeen.set(m.userId, [...(userIdSeen.get(m.userId) || []), m.id])
      if (m.email) {
        const key = normalizeInvitationEmail(m.email)
        emailSeen.set(key, [...(emailSeen.get(key) || []), m.id])
      }
    }
    for (const [userId, ids] of userIdSeen) {
      if (ids.length > 1) {
        issues.push(critical('member', 'DUPLICATE_MEMBER_USER_ID', { groupId, userId, memberIds: ids.join(',') }, `userId duplicado dentro del grupo (${ids.length} members): ${userId}`))
      }
    }
    for (const [email, ids] of emailSeen) {
      if (ids.length > 1) {
        issues.push(critical('member', 'DUPLICATE_MEMBER_EMAIL', { groupId, email, memberIds: ids.join(',') }, `email normalizado duplicado dentro del grupo (${ids.length} members): ${email}`))
      }
    }
  }

  // --- EXPENSES -------------------------------------------------------------
  for (const e of expenses) {
    if (!groupIds.has(e.groupId)) issues.push(critical('expense', 'ORPHAN_GROUP', { id: e.id, groupId: e.groupId }, `expense.groupId no existe: ${e.groupId}`))
    const payer = memberById.get(e.paidByMemberId)
    if (!payer) {
      issues.push(critical('expense', 'ORPHAN_PAYER', { id: e.id, paidByMemberId: e.paidByMemberId }, `paidByMemberId no existe: ${e.paidByMemberId}`))
    } else if (payer.groupId !== e.groupId) {
      issues.push(critical('expense', 'PAYER_WRONG_GROUP', { id: e.id, paidByMemberId: e.paidByMemberId, groupId: e.groupId }, 'paidByMemberId pertenece a otro grupo'))
    }
    if (!e.description || e.description.trim() === '') issues.push(critical('expense', 'EMPTY_DESCRIPTION', { id: e.id }, 'description vacía'))
    const amount = parseAmountRaw(e.amountRaw)
    if (!amount.valid || amount.value <= 0) {
      issues.push(critical('expense', 'INVALID_AMOUNT', { id: e.id }, `amount inválido: "${e.amountRaw}"`))
    } else if (amount.hasExtraPrecision) {
      issues.push(warning('expense', 'AMOUNT_EXTRA_PRECISION', { id: e.id }, `amount con más de 2 decimales: "${e.amountRaw}"`))
    }
    if (!VALID_CURRENCIES.has(e.currency)) issues.push(critical('expense', 'INVALID_CURRENCY', { id: e.id }, `currency inválida: "${e.currency}"`))
    if (!parseCivilDate(e.date)) issues.push(critical('expense', 'INVALID_DATE', { id: e.id }, `date inválida: "${e.date}"`))
    if (!e.createdBy || e.createdBy.trim() === '') issues.push(critical('expense', 'EMPTY_CREATED_BY', { id: e.id }, 'createdBy vacío'))
    if (!isValidTimestamp(e.createdAt)) issues.push(critical('expense', 'INVALID_CREATED_AT', { id: e.id }, `createdAt inválido: "${e.createdAt}"`))
  }

  // --- SPLITS -------------------------------------------------------------
  const splitsByExpense = new Map<string, typeof splits>()
  for (const s of splits) {
    const expense = expenseById.get(s.expenseId)
    if (!expense) {
      issues.push(critical('split', 'ORPHAN_EXPENSE', { id: s.id, expenseId: s.expenseId }, `expenseId no existe: ${s.expenseId}`))
    }
    const member = memberById.get(s.memberId)
    if (!member) {
      issues.push(critical('split', 'ORPHAN_MEMBER', { id: s.id, memberId: s.memberId }, `memberId no existe: ${s.memberId}`))
    } else if (expense && member.groupId !== expense.groupId) {
      issues.push(critical('split', 'MEMBER_WRONG_GROUP', { id: s.id, memberId: s.memberId, expenseId: s.expenseId }, 'memberId pertenece a otro grupo que el expense'))
    }
    const amount = parseAmountRaw(s.amountRaw)
    if (!amount.valid || amount.value <= 0) {
      issues.push(critical('split', 'INVALID_AMOUNT', { id: s.id }, `amount inválido: "${s.amountRaw}"`))
    } else if (amount.hasExtraPrecision) {
      issues.push(warning('split', 'AMOUNT_EXTRA_PRECISION', { id: s.id }, `amount con más de 2 decimales: "${s.amountRaw}"`))
    }
    if (expense) {
      const arr = splitsByExpense.get(s.expenseId) || []
      arr.push(s)
      splitsByExpense.set(s.expenseId, arr)
    }
  }
  for (const [expenseId, expenseSplits] of splitsByExpense) {
    const expense = expenseById.get(expenseId)!
    const expenseAmount = parseAmountRaw(expense.amountRaw)
    if (!expenseAmount.valid) continue // ya reportado como INVALID_AMOUNT arriba
    const sumCents = expenseSplits.reduce((sum, s) => {
      const a = parseAmountRaw(s.amountRaw)
      return sum + (a.valid ? toCents(a.value) : 0)
    }, 0)
    const expenseCents = toCents(expenseAmount.value)
    if (sumCents !== expenseCents) {
      issues.push(
        critical(
          'split',
          'SPLIT_SUM_MISMATCH',
          { expenseId, expenseAmount: (expenseCents / 100).toFixed(2), splitTotal: (sumCents / 100).toFixed(2), difference: ((expenseCents - sumCents) / 100).toFixed(2) },
          `suma de splits (${(sumCents / 100).toFixed(2)}) !== expense.amount (${(expenseCents / 100).toFixed(2)}) para expense ${expenseId}`
        )
      )
    }
  }

  // --- SETTLEMENTS -------------------------------------------------------------
  const settlementsByGroup = new Map<string, typeof settlements>()
  for (const s of settlements) {
    if (!groupIds.has(s.groupId)) issues.push(critical('settlement', 'ORPHAN_GROUP', { id: s.id, groupId: s.groupId }, `settlement.groupId no existe: ${s.groupId}`))
    const payer = memberById.get(s.paidByMemberId)
    const payee = memberById.get(s.paidToMemberId)
    if (!payer) issues.push(critical('settlement', 'ORPHAN_PAYER', { id: s.id, paidByMemberId: s.paidByMemberId }, `paidByMemberId no existe: ${s.paidByMemberId}`))
    if (!payee) issues.push(critical('settlement', 'ORPHAN_PAYEE', { id: s.id, paidToMemberId: s.paidToMemberId }, `paidToMemberId no existe: ${s.paidToMemberId}`))
    if (payer && payer.groupId !== s.groupId) issues.push(critical('settlement', 'PAYER_WRONG_GROUP', { id: s.id }, 'paidByMemberId pertenece a otro grupo'))
    if (payee && payee.groupId !== s.groupId) issues.push(critical('settlement', 'PAYEE_WRONG_GROUP', { id: s.id }, 'paidToMemberId pertenece a otro grupo'))
    if (s.paidByMemberId === s.paidToMemberId) issues.push(critical('settlement', 'SAME_PAYER_PAYEE', { id: s.id }, 'paidByMemberId === paidToMemberId'))
    const amount = parseAmountRaw(s.amountRaw)
    if (!amount.valid || amount.value <= 0) {
      issues.push(critical('settlement', 'INVALID_AMOUNT', { id: s.id }, `amount inválido: "${s.amountRaw}"`))
    } else if (amount.hasExtraPrecision) {
      issues.push(warning('settlement', 'AMOUNT_EXTRA_PRECISION', { id: s.id }, `amount con más de 2 decimales: "${s.amountRaw}"`))
    }
    if (!VALID_CURRENCIES.has(s.currency)) issues.push(critical('settlement', 'INVALID_CURRENCY', { id: s.id }, `currency inválida: "${s.currency}"`))
    if (!parseCivilDate(s.date)) issues.push(critical('settlement', 'INVALID_DATE', { id: s.id }, `date inválida: "${s.date}"`))
    if (!s.createdBy || s.createdBy.trim() === '') issues.push(critical('settlement', 'EMPTY_CREATED_BY', { id: s.id }, 'createdBy vacío'))
    if (!isValidTimestamp(s.createdAt)) issues.push(critical('settlement', 'INVALID_CREATED_AT', { id: s.id }, `createdAt inválido: "${s.createdAt}"`))

    if (groupIds.has(s.groupId)) {
      const arr = settlementsByGroup.get(s.groupId) || []
      arr.push(s)
      settlementsByGroup.set(s.groupId, arr)
    }
  }
  // Overpayment histórico -- replay cronológico por grupo, mismo motor de
  // balances que ya usa la app (computeGroupBalances). Solo WARNING: no
  // bloquea el schema de Postgres, es una señal de calidad de datos.
  for (const [groupId, groupSettlements] of settlementsByGroup) {
    const groupMembers = membersByGroup.get(groupId) || []
    const groupExpenses = expenses.filter((e) => e.groupId === groupId)
    const groupSplits = groupExpenses.flatMap((e) => splitsByExpense.get(e.id) || [])
    const sorted = [...groupSettlements].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (let i = 0; i < sorted.length; i++) {
      const candidate = sorted[i]
      const prior = sorted.slice(0, i)
      const balances = computeGroupBalances(
        groupMembers.map((m) => ({ id: m.id })),
        groupExpenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency as 'pesos' | 'usd' })),
        groupSplits.map((sp) => ({ expenseId: sp.expenseId, memberId: sp.memberId, amount: parseAmountRaw(sp.amountRaw).value })),
        prior.map((s) => ({ paidByMemberId: s.paidByMemberId, paidToMemberId: s.paidToMemberId, amount: parseAmountRaw(s.amountRaw).value, currency: s.currency as 'pesos' | 'usd' }))
      )
      const owed = balances.find((b) => b.fromMemberId === candidate.paidByMemberId && b.toMemberId === candidate.paidToMemberId && b.currency === candidate.currency)
      const owedCents = owed ? toCents(owed.amount) : 0
      const candidateCents = toCents(parseAmountRaw(candidate.amountRaw).value)
      if (candidateCents > owedCents) {
        issues.push(
          warning(
            'settlement',
            'HISTORICAL_OVERPAYMENT',
            { id: candidate.id, groupId, owed: (owedCents / 100).toFixed(2), paid: (candidateCents / 100).toFixed(2) },
            `settlement ${candidate.id} paga ${(candidateCents / 100).toFixed(2)} pero la deuda en ese momento era ${(owedCents / 100).toFixed(2)}`
          )
        )
      }
    }
  }

  // --- INVITATIONS -------------------------------------------------------------
  const pendingByMember = new Map<string, string[]>()
  for (const inv of invitations) {
    if (!groupIds.has(inv.groupId)) issues.push(critical('invitation', 'ORPHAN_GROUP', { id: inv.id, groupId: inv.groupId }, `invitation.groupId no existe: ${inv.groupId}`))
    const member = memberById.get(inv.memberId)
    if (!member) {
      issues.push(critical('invitation', 'ORPHAN_MEMBER', { id: inv.id, memberId: inv.memberId }, `memberId no existe: ${inv.memberId}`))
    } else if (member.groupId !== inv.groupId) {
      issues.push(critical('invitation', 'MEMBER_WRONG_GROUP', { id: inv.id }, 'memberId pertenece a otro grupo'))
    }
    if (!inv.invitedByUserId || inv.invitedByUserId.trim() === '') issues.push(critical('invitation', 'EMPTY_INVITED_BY', { id: inv.id }, 'invitedByUserId vacío'))
    if (!inv.targetEmail || !EMAIL_REGEX.test(inv.targetEmail)) issues.push(critical('invitation', 'INVALID_TARGET_EMAIL', { id: inv.id }, `targetEmail inválido: "${inv.targetEmail}"`))
    if (!VALID_STATUSES.has(inv.status)) issues.push(critical('invitation', 'INVALID_STATUS', { id: inv.id }, `status inválido: "${inv.status}"`))
    if (!inv.tokenHash || inv.tokenHash.trim() === '') issues.push(critical('invitation', 'MISSING_TOKEN_HASH', { id: inv.id }, 'tokenHash ausente'))
    if (!isValidTimestamp(inv.createdAt)) issues.push(critical('invitation', 'INVALID_CREATED_AT', { id: inv.id }, `createdAt inválido: "${inv.createdAt}"`))

    if (inv.status === 'pending' && inv.respondedAt) {
      issues.push(warning('invitation', 'PENDING_WITH_RESPONDED_AT', { id: inv.id }, 'invitation pending pero respondedAt tiene valor'))
    }
    if (inv.status !== 'pending' && !inv.respondedAt) {
      issues.push(warning('invitation', 'TERMINAL_WITHOUT_RESPONDED_AT', { id: inv.id }, `invitation ${inv.status} sin respondedAt`))
    }

    if (inv.status === 'pending') {
      pendingByMember.set(inv.memberId, [...(pendingByMember.get(inv.memberId) || []), inv.id])
    }
  }
  for (const [memberId, ids] of pendingByMember) {
    if (ids.length > 1) {
      const member = memberById.get(memberId)
      issues.push(
        critical(
          'invitation',
          'DUPLICATE_PENDING',
          { groupId: member?.groupId || '', memberId, invitationIds: ids.join(',') },
          `más de una invitation pending para el member ${memberId} (${ids.length}): ${ids.join(', ')} -- Postgres no lo permitiría (unique index parcial)`
        )
      )
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length
  return { issues, criticalCount, warningCount, importable: criticalCount === 0 }
}
