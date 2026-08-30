'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ArrowLeft,
  Plus,
  Users,
  ChevronRight,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  UserPlus,
  MoreVertical,
  Receipt,
  Wallet,
  Check,
} from 'lucide-react'
import { useSharedGroups, SharedGroupsApiError, type SharedGroupExpenseWithSplits, type SharedGroupSummary } from '@/hooks/useSharedGroups'
import { calculateEqualSplit } from '@/lib/sharedGroupBalances'
import { formatCurrency, formatNumber } from '@/lib/formatNumber'
import { getLocalTodayISODate, formatCivilDate } from '@/lib/formatDate'
import { useToastContext } from '@/components/Toast'
import ConfirmModal from '@/components/ConfirmModal'
import type { SharedGroupMember, SharedGroupPairBalance, SharedGroupSettlement } from '@/types'

interface SharedGroupsModalProps {
  isOpen: boolean
  onClose: () => void
  /** Intención de entrada al abrir el modal, ej. desde el FAB "Agregar Gasto
   * compartido". `'add-expense'` hace que, apenas cargan los grupos, se
   * resuelva automáticamente hacia el flujo de cargar un gasto (grupo único
   * -> directo a Agregar gasto; varios grupos -> selector mínimo; 0 grupos ->
   * mismo comportamiento de siempre). Cualquier otro acceso (navbar, card
   * mobile, "Más") sigue sin pasar esta prop y abre el modal como siempre. */
  entryIntent?: 'add-expense'
}

type View = 'list' | 'create-group' | 'detail' | 'add-expense' | 'settle' | 'members' | 'select-group-for-expense'

const PRIMARY_BUTTON = 'bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 transition-opacity text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

// ============================================================================
// Helpers de formato — reutilizan lib/formatNumber.ts y lib/formatDate.ts
// existentes, sin introducir ninguna librería nueva.
// ============================================================================

function formatMoneyForCurrency(amount: number, currency: 'pesos' | 'usd'): string {
  if (currency === 'usd') return `USD ${formatNumber(amount, { maximumFractionDigits: 2 })}`
  return formatCurrency(amount, { maximumFractionDigits: 2 })
}

/** Mismo patrón de formateo de montos (punto de miles, coma decimal) ya usado
 * en CreditCardProjectionModal.tsx — no se introduce una convención nueva. */
function formatAmountForInput(value: number): string {
  if (!value) return ''
  const parts = value.toString().split('.')
  const integerPart = parts[0]
  const decimalPart = parts[1] || ''
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger
}

function parseAmount(value: string): number {
  if (!value || value.trim() === '') return 0
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? 0 : parsed
}

/** Nunca muestra el mensaje técnico crudo de un 500 (posible rate-limit de
 * Sheets) — los errores 400/403/404/409 de nuestras propias rutas ya son
 * mensajes de negocio legibles y se muestran tal cual. */
function friendlyErrorMessage(err: unknown): string {
  if (err instanceof SharedGroupsApiError) {
    // 429 (rate-limit real detectado) y 500/503 (infraestructura) comparten
    // el mismo mensaje amigable — nunca se muestra el texto técnico crudo.
    if (err.status === 429 || err.status === 500 || err.status === 503) {
      return 'No pudimos actualizar los datos en este momento. Intentá nuevamente en unos segundos.'
    }
    if (err.status === 401) return 'Tu sesión expiró. Iniciá sesión de nuevo.'
    return err.message
  }
  return 'Ocurrió un error inesperado.'
}

export default function SharedGroupsModal({ isOpen, onClose, entryIntent }: SharedGroupsModalProps) {
  const { data: session } = useSession()
  const { success: toastSuccess, error: toastError } = useToastContext()
  const hook = useSharedGroups()

  const [isMobile, setIsMobile] = useState(false)
  const [view, setView] = useState<View>('list')
  // Marca que, apenas `hook.groupDetail`/`hook.myMemberId` estén listos tras
  // abrir un grupo (no antes -- evita el mismo problema de estado parcial que
  // "Miembros (0)"), hay que saltar automáticamente a Agregar gasto.
  const [pendingAutoAddExpense, setPendingAutoAddExpense] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)

  // Crear grupo
  const [newGroupName, setNewGroupName] = useState('')

  // Renombrar grupo
  const [renamingGroup, setRenamingGroup] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false)

  // Alta/edición de gasto
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmountInput, setExpenseAmountInput] = useState('')
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [expenseSplitType, setExpenseSplitType] = useState<'equal' | 'amount'>('equal')
  const [expenseParticipantIds, setExpenseParticipantIds] = useState<string[]>([])
  const [expenseExactAmounts, setExpenseExactAmounts] = useState<Record<string, string>>({})
  const [expenseCurrency, setExpenseCurrency] = useState<'pesos' | 'usd'>('pesos')
  const [expenseDate, setExpenseDate] = useState(getLocalTodayISODate())
  const [showMoreExpenseOptions, setShowMoreExpenseOptions] = useState(false)
  const [showChangeSplit, setShowChangeSplit] = useState(false)
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState<string | null>(null)

  // Saldar
  const [settleStep, setSettleStep] = useState<'pick' | 'form'>('pick')
  const [settlePaidBy, setSettlePaidBy] = useState('')
  const [settlePaidTo, setSettlePaidTo] = useState('')
  const [settleAmountInput, setSettleAmountInput] = useState('')
  const [settleCurrency, setSettleCurrency] = useState<'pesos' | 'usd'>('pesos')
  const [settleDate, setSettleDate] = useState(getLocalTodayISODate())
  const [settleNotes, setSettleNotes] = useState('')
  const [settleMaxAmount, setSettleMaxAmount] = useState<number | null>(null)
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null)
  const [confirmDeleteSettlementId, setConfirmDeleteSettlementId] = useState<string | null>(null)

  // Miembros
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [showAddMemberForm, setShowAddMemberForm] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editMemberName, setEditMemberName] = useState('')
  const [editMemberEmail, setEditMemberEmail] = useState('')
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<string | null>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  /** Abre un grupo con la intención de terminar en Agregar gasto. Si el
   * grupo ya tiene 2+ miembros (dato que el summary de la lista ya trae, sin
   * pedirlo de nuevo) marca `pendingAutoAddExpense` para que el efecto de
   * abajo dispare `openAddExpense()` recién cuando `hook.groupDetail`/
   * `hook.myMemberId` estén realmente listos. Si tiene un solo miembro, se
   * respeta la regla existente: se abre el detalle normal, que ya guía a
   * "Agregar miembro" sin habilitar el gasto artificialmente. */
  function resolveGroupForAddExpense(summary: SharedGroupSummary) {
    setSelectedGroupId(summary.group.id)
    setView('detail')
    if (summary.members.length >= 2) {
      setPendingAutoAddExpense(true)
    }
    hook.openGroup(summary.group.id).catch((err) => {
      setPendingAutoAddExpense(false)
      toastError(friendlyErrorMessage(err))
    })
  }

  useEffect(() => {
    if (isOpen) {
      setView('list')
      setSelectedGroupId(null)
      setFormError(null)
      if (entryIntent === 'add-expense') {
        hook
          .fetchGroups()
          .then((groups) => {
            if (!groups || groups.length === 0) return // 0 grupos: mismo flujo de siempre (crear el primero)
            if (groups.length === 1) {
              resolveGroupForAddExpense(groups[0])
              return
            }
            setView('select-group-for-expense')
          })
          .catch(() => {})
      } else {
        hook.fetchGroups().catch(() => {})
      }
    } else {
      hook.closeGroup()
      setPendingAutoAddExpense(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Recién cuando el detalle del grupo terminó de cargar de verdad (mismo
  // criterio que arregló "Miembros (0)") se dispara el salto automático a
  // Agregar gasto -- openAddExpense() lee hook.members/hook.myMemberId, que
  // acá ya están actualizados porque el efecto corre en un render posterior.
  useEffect(() => {
    if (pendingAutoAddExpense && !hook.loadingDetail && hook.groupDetail && hook.myMemberId) {
      setPendingAutoAddExpense(false)
      openAddExpense()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoAddExpense, hook.loadingDetail, hook.groupDetail, hook.myMemberId])

  const activity = useMemo(() => {
    type Item =
      | { kind: 'expense'; date: string; createdAt: string; data: SharedGroupExpenseWithSplits }
      | { kind: 'settlement'; date: string; createdAt: string; data: SharedGroupSettlement }
    const items: Item[] = [
      ...hook.expenses.map((e) => ({ kind: 'expense' as const, date: e.date, createdAt: e.createdAt, data: e })),
      ...hook.settlements.map((s) => ({ kind: 'settlement' as const, date: s.date, createdAt: s.createdAt, data: s })),
    ]
    return items.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date)
      if (dateCompare !== 0) return dateCompare
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [hook.expenses, hook.settlements])

  if (!isOpen) return null

  const isCreator = !!session?.user?.id && hook.groupDetail?.createdBy === session.user.id
  const nameFor = (memberId: string): string => {
    if (memberId === hook.myMemberId) return 'Vos'
    return hook.members.find((m) => m.id === memberId)?.name || '—'
  }

  // ---------------------------------------------------------------------------
  // Navegación
  // ---------------------------------------------------------------------------

  async function handleOpenGroup(groupId: string) {
    setSelectedGroupId(groupId)
    setGroupMenuOpen(false)
    setView('detail')
    try {
      await hook.openGroup(groupId)
    } catch (err) {
      toastError(friendlyErrorMessage(err))
    }
  }

  function handleBackToList() {
    hook.refreshGroupsIfStale().catch(() => {})
    hook.closeGroup()
    setSelectedGroupId(null)
    setGroupMenuOpen(false)
    setView('list')
  }

  function handleBackToDetail() {
    setFormError(null)
    setView('detail')
  }

  // ---------------------------------------------------------------------------
  // Crear grupo
  // ---------------------------------------------------------------------------

  async function handleCreateGroup() {
    setFormError(null)
    const name = newGroupName.trim()
    if (!name) {
      setFormError('El nombre del grupo es requerido')
      return
    }
    try {
      const { group } = await hook.createGroup(name)
      setNewGroupName('')
      setSelectedGroupId(group.id)
      setView('detail')
      await hook.openGroup(group.id)
    } catch (err) {
      setFormError(friendlyErrorMessage(err))
    }
  }

  // ---------------------------------------------------------------------------
  // Grupo: renombrar / eliminar
  // ---------------------------------------------------------------------------

  async function handleRenameGroup() {
    if (!selectedGroupId) return
    const name = renameValue.trim()
    if (!name) return
    try {
      await hook.renameGroup(selectedGroupId, name)
      setRenamingGroup(false)
      toastSuccess('Grupo renombrado')
    } catch (err) {
      toastError(friendlyErrorMessage(err))
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroupId) return
    try {
      await hook.deleteGroup(selectedGroupId)
      toastSuccess('Grupo eliminado')
      handleBackToList()
    } catch (err) {
      toastError(friendlyErrorMessage(err))
    }
  }

  // ---------------------------------------------------------------------------
  // Alta / edición de gasto
  // ---------------------------------------------------------------------------

  function openAddExpense() {
    setEditingExpenseId(null)
    setExpenseDescription('')
    setExpenseAmountInput('')
    setExpensePaidBy(hook.myMemberId || hook.members[0]?.id || '')
    setExpenseSplitType('equal')
    setExpenseParticipantIds(hook.members.map((m) => m.id))
    setExpenseExactAmounts({})
    setExpenseCurrency('pesos')
    setExpenseDate(getLocalTodayISODate())
    setShowMoreExpenseOptions(false)
    setShowChangeSplit(false)
    setFormError(null)
    setView('add-expense')
  }

  function openEditExpense(expense: SharedGroupExpenseWithSplits) {
    setEditingExpenseId(expense.id)
    setExpenseDescription(expense.description)
    setExpenseAmountInput(formatAmountForInput(expense.amount))
    setExpensePaidBy(expense.paidByMemberId)
    const participantIds = expense.splits.map((s) => s.memberId)
    setExpenseParticipantIds(participantIds)
    const allEqual = (() => {
      if (expense.splits.length === 0) return true
      const perPerson = Math.round((expense.amount / expense.splits.length) * 100) / 100
      return expense.splits.every((s) => Math.abs(s.amount - perPerson) <= 0.02)
    })()
    setExpenseSplitType(allEqual ? 'equal' : 'amount')
    const amounts: Record<string, string> = {}
    expense.splits.forEach((s) => {
      amounts[s.memberId] = formatAmountForInput(s.amount)
    })
    setExpenseExactAmounts(amounts)
    setExpenseCurrency(expense.currency)
    setExpenseDate(expense.date)
    setShowMoreExpenseOptions(true)
    setShowChangeSplit(!allEqual)
    setFormError(null)
    setView('add-expense')
  }

  const expenseAmount = parseAmount(expenseAmountInput)
  const expenseExactTotalCents = expenseParticipantIds.reduce(
    (sum, id) => sum + Math.round(parseAmount(expenseExactAmounts[id] || '0') * 100),
    0
  )
  const expenseTargetCents = Math.round(expenseAmount * 100)
  const expenseExactDiffCents = expenseTargetCents - expenseExactTotalCents
  const expenseExactMatches = expenseSplitType !== 'amount' || expenseExactDiffCents === 0

  function toggleExpenseParticipant(memberId: string) {
    setExpenseParticipantIds((prev) => {
      const next = prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
      return next
    })
  }

  function switchToExactAmounts() {
    setExpenseSplitType('amount')
    if (Object.keys(expenseExactAmounts).length === 0 && expenseAmount > 0 && expenseParticipantIds.length > 0) {
      const initial = calculateEqualSplit(expenseAmount, expenseParticipantIds)
      const amounts: Record<string, string> = {}
      initial.forEach((s) => {
        amounts[s.memberId] = formatAmountForInput(s.amount)
      })
      setExpenseExactAmounts(amounts)
    }
  }

  async function handleSaveExpense() {
    setFormError(null)
    const description = expenseDescription.trim()
    if (!description) {
      setFormError('La descripción es requerida')
      return
    }
    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      setFormError('El monto debe ser mayor a $0')
      return
    }
    if (expenseParticipantIds.length === 0) {
      setFormError('Elegí al menos un participante')
      return
    }
    if (expenseSplitType === 'amount' && !expenseExactMatches) {
      setFormError('La suma de los montos exactos tiene que coincidir con el total')
      return
    }

    const payload = {
      description,
      amount: expenseAmount,
      currency: expenseCurrency,
      paidByMemberId: expensePaidBy || hook.myMemberId || '',
      date: expenseDate,
      splitType: expenseSplitType,
      ...(expenseSplitType === 'equal'
        ? { participantMemberIds: expenseParticipantIds }
        : { splits: expenseParticipantIds.map((id) => ({ memberId: id, amount: parseAmount(expenseExactAmounts[id] || '0') })) }),
    }

    try {
      if (editingExpenseId) {
        await hook.updateExpense(selectedGroupId!, editingExpenseId, payload)
        toastSuccess('Gasto actualizado')
      } else {
        await hook.createExpense(selectedGroupId!, payload)
        toastSuccess('Gasto agregado')
      }
      setView('detail')
    } catch (err) {
      setFormError(friendlyErrorMessage(err))
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    try {
      await hook.deleteExpense(selectedGroupId!, expenseId)
      toastSuccess('Gasto eliminado')
    } catch (err) {
      toastError(friendlyErrorMessage(err))
    } finally {
      setConfirmDeleteExpenseId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Saldar
  // ---------------------------------------------------------------------------

  function openSettle() {
    setSettleStep(hook.balance.length > 0 ? 'pick' : 'form')
    setEditingSettlementId(null)
    setSettlePaidBy(hook.myMemberId || '')
    setSettlePaidTo('')
    setSettleAmountInput('')
    setSettleCurrency('pesos')
    setSettleDate(getLocalTodayISODate())
    setSettleNotes('')
    setSettleMaxAmount(null)
    setFormError(null)
    setView('settle')
  }

  function pickDebt(b: SharedGroupPairBalance) {
    setSettlePaidBy(b.fromMemberId)
    setSettlePaidTo(b.toMemberId)
    setSettleCurrency(b.currency)
    setSettleAmountInput(formatAmountForInput(b.amount))
    setSettleMaxAmount(b.amount)
    setSettleStep('form')
  }

  function pickFreeSettlement() {
    setSettleMaxAmount(null)
    setSettlePaidBy(hook.myMemberId || hook.members[0]?.id || '')
    setSettlePaidTo(hook.members.find((m) => m.id !== hook.myMemberId)?.id || '')
    setSettleStep('form')
  }

  const settleAmount = parseAmount(settleAmountInput)
  const settleExceedsMax = settleMaxAmount !== null && Math.round(settleAmount * 100) > Math.round(settleMaxAmount * 100)

  async function handleSaveSettlement() {
    setFormError(null)
    if (!settlePaidBy || !settlePaidTo) {
      setFormError('Elegí quién pagó y quién recibió')
      return
    }
    if (settlePaidBy === settlePaidTo) {
      setFormError('El pagador y el receptor no pueden ser el mismo miembro')
      return
    }
    if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
      setFormError('El monto debe ser mayor a $0')
      return
    }
    if (settleExceedsMax) {
      setFormError('El monto no puede superar la deuda actual')
      return
    }

    const payload = {
      paidByMemberId: settlePaidBy,
      paidToMemberId: settlePaidTo,
      amount: settleAmount,
      currency: settleCurrency,
      date: settleDate,
      notes: settleNotes.trim() || undefined,
    }

    try {
      if (editingSettlementId) {
        await hook.updateSettlement(selectedGroupId!, editingSettlementId, payload)
        toastSuccess('Pago actualizado')
      } else {
        await hook.createSettlement(selectedGroupId!, payload)
        toastSuccess('Pago registrado')
      }
      setView('detail')
    } catch (err) {
      setFormError(friendlyErrorMessage(err))
    }
  }

  function openEditSettlement(settlement: SharedGroupSettlement) {
    setEditingSettlementId(settlement.id)
    setSettlePaidBy(settlement.paidByMemberId)
    setSettlePaidTo(settlement.paidToMemberId)
    setSettleAmountInput(formatAmountForInput(settlement.amount))
    setSettleCurrency(settlement.currency)
    setSettleDate(settlement.date)
    setSettleNotes(settlement.notes || '')
    setSettleMaxAmount(null)
    setSettleStep('form')
    setFormError(null)
    setView('settle')
  }

  async function handleDeleteSettlement(settlementId: string) {
    try {
      await hook.deleteSettlement(selectedGroupId!, settlementId)
      toastSuccess('Pago eliminado')
    } catch (err) {
      // §28: si el 409 es porque rompería un pago posterior, mostrar el motivo tal cual lo da el backend.
      toastError(friendlyErrorMessage(err))
    } finally {
      setConfirmDeleteSettlementId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Miembros
  // ---------------------------------------------------------------------------

  async function handleAddMember() {
    setFormError(null)
    const name = newMemberName.trim()
    if (!name) {
      setFormError('El nombre es requerido')
      return
    }
    try {
      await hook.addMember(selectedGroupId!, { name, email: newMemberEmail.trim() || undefined })
      setNewMemberName('')
      setNewMemberEmail('')
      setShowAddMemberForm(false)
      toastSuccess('Miembro agregado')
    } catch (err) {
      setFormError(friendlyErrorMessage(err))
    }
  }

  function startEditMember(member: SharedGroupMember) {
    setEditingMemberId(member.id)
    setEditMemberName(member.name)
    setEditMemberEmail(member.email || '')
    setFormError(null)
  }

  async function handleSaveEditMember() {
    if (!editingMemberId) return
    const name = editMemberName.trim()
    if (!name) {
      setFormError('El nombre es requerido')
      return
    }
    try {
      await hook.editMember(selectedGroupId!, editingMemberId, { name, email: editMemberEmail.trim() || undefined })
      setEditingMemberId(null)
      toastSuccess('Miembro actualizado')
    } catch (err) {
      setFormError(friendlyErrorMessage(err))
    }
  }

  async function handleDeleteMember(memberId: string) {
    try {
      await hook.deleteMember(selectedGroupId!, memberId)
      toastSuccess('Miembro eliminado')
    } catch (err) {
      // §26: si el backend responde 409 (movimientos asociados), mostrarlo tal cual, sin ocultarlo.
      toastError(friendlyErrorMessage(err))
    } finally {
      setConfirmDeleteMemberId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Actividad (expenses + settlements unificados, orden cronológico)
  // ---------------------------------------------------------------------------

  function expenseSecondaryLine(expense: SharedGroupExpenseWithSplits): string | null {
    const others = expense.splits.filter((s) => s.memberId !== expense.paidByMemberId)
    if (others.length === 0) return null
    if (others.length === 1) {
      const other = others[0]
      const amountText = formatMoneyForCurrency(other.amount, expense.currency)
      if (other.memberId === hook.myMemberId) {
        return `${nameFor(other.memberId)} debés ${amountText}`
      }
      if (expense.paidByMemberId === hook.myMemberId) {
        return `${nameFor(other.memberId)} te debe ${amountText}`
      }
      return `${nameFor(other.memberId)} debe ${amountText}`
    }
    return `Dividido entre ${others.length + 1} personas`
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const headerTitle =
    view === 'list'
      ? 'Gastos Compartidos'
      : view === 'create-group'
        ? 'Nuevo grupo'
        : view === 'add-expense'
          ? editingExpenseId
            ? 'Editar gasto'
            : 'Agregar gasto'
          : view === 'settle'
            ? 'Saldar'
            : view === 'members'
              ? 'Miembros'
              : view === 'select-group-for-expense'
                ? 'Agregar gasto compartido'
                : hook.groupDetail?.name || 'Grupo'

  const showBack = view !== 'list'

  function handleBack() {
    if (view === 'create-group' || view === 'select-group-for-expense') {
      setView('list')
    } else if (view === 'detail') {
      handleBackToList()
    } else {
      handleBackToDetail()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="shared-groups-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={isMobile ? { y: '100%' } : { y: 20, opacity: 0 }}
            animate={isMobile ? { y: 0 } : { y: 0, opacity: 1 }}
            exit={isMobile ? { y: '100%' } : { y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl h-[92vh] md:h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 min-w-0">
                {showBack && (
                  <button
                    onClick={handleBack}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer shrink-0"
                    aria-label="Volver"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                )}
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{headerTitle}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {view === 'detail' && isCreator && (
                  <div className="relative">
                    <button
                      onClick={() => setGroupMenuOpen((v) => !v)}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      aria-label="Más opciones del grupo"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    {groupMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-10 overflow-hidden"
                      >
                        <button
                          onClick={() => {
                            setRenameValue(hook.groupDetail?.name || '')
                            setRenamingGroup(true)
                            setGroupMenuOpen(false)
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" /> Renombrar grupo
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDeleteGroup(true)
                            setGroupMenuOpen(false)
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Eliminar grupo
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto">
              {view === 'list' && (
                <ListView
                  hook={hook}
                  onOpenGroup={handleOpenGroup}
                  onCreateGroup={() => {
                    setNewGroupName('')
                    setFormError(null)
                    setView('create-group')
                  }}
                />
              )}

              {view === 'create-group' && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nombre del grupo</label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Casa"
                      autoFocus
                      className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  {formError && <FormErrorBanner message={formError} />}
                  <button
                    onClick={handleCreateGroup}
                    disabled={hook.actionLoading || !newGroupName.trim()}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold ${PRIMARY_BUTTON}`}
                    style={{ minHeight: 44 }}
                  >
                    {hook.actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear grupo'}
                  </button>
                </div>
              )}

              {view === 'select-group-for-expense' && (
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">¿En qué grupo?</p>
                  <div className="space-y-2.5">
                    {hook.groups.map((summary) => (
                      <button
                        key={summary.group.id}
                        onClick={() => resolveGroupForAddExpense(summary)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer text-left"
                        style={{ minHeight: 44 }}
                      >
                        <span className="font-medium text-gray-900 dark:text-white truncate">{summary.group.name}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {view === 'detail' && (
                <DetailView
                  hook={hook}
                  onGoMembers={() => setView('members')}
                  onGoAddExpense={openAddExpense}
                  onGoSettle={openSettle}
                  onEditExpense={openEditExpense}
                  onDeleteExpenseRequest={setConfirmDeleteExpenseId}
                  onEditSettlement={openEditSettlement}
                  onDeleteSettlementRequest={setConfirmDeleteSettlementId}
                  currentUserId={session?.user?.id}
                  activity={activity}
                  expenseSecondaryLine={expenseSecondaryLine}
                  nameFor={nameFor}
                  onRetry={() => selectedGroupId && hook.openGroup(selectedGroupId).catch((err) => toastError(friendlyErrorMessage(err)))}
                />
              )}

              {view === 'add-expense' && (
                <AddExpenseView
                  hook={hook}
                  description={expenseDescription}
                  setDescription={setExpenseDescription}
                  amountInput={expenseAmountInput}
                  setAmountInput={setExpenseAmountInput}
                  paidBy={expensePaidBy}
                  setPaidBy={setExpensePaidBy}
                  splitType={expenseSplitType}
                  participantIds={expenseParticipantIds}
                  toggleParticipant={toggleExpenseParticipant}
                  switchToEqual={() => setExpenseSplitType('equal')}
                  switchToExact={switchToExactAmounts}
                  exactAmounts={expenseExactAmounts}
                  setExactAmount={(memberId, value) => setExpenseExactAmounts((prev) => ({ ...prev, [memberId]: value }))}
                  exactDiffCents={expenseExactDiffCents}
                  currency={expenseCurrency}
                  setCurrency={setExpenseCurrency}
                  date={expenseDate}
                  setDate={setExpenseDate}
                  showMoreOptions={showMoreExpenseOptions}
                  setShowMoreOptions={setShowMoreExpenseOptions}
                  showChangeSplit={showChangeSplit}
                  setShowChangeSplit={setShowChangeSplit}
                  nameFor={nameFor}
                  formError={formError}
                />
              )}

              {view === 'settle' && (
                <SettleView
                  hook={hook}
                  step={settleStep}
                  onPickDebt={pickDebt}
                  onPickFree={pickFreeSettlement}
                  onBackToPick={() => setSettleStep('pick')}
                  paidBy={settlePaidBy}
                  setPaidBy={setSettlePaidBy}
                  paidTo={settlePaidTo}
                  setPaidTo={setSettlePaidTo}
                  amountInput={settleAmountInput}
                  setAmountInput={setSettleAmountInput}
                  currency={settleCurrency}
                  setCurrency={setSettleCurrency}
                  date={settleDate}
                  setDate={setSettleDate}
                  notes={settleNotes}
                  setNotes={setSettleNotes}
                  maxAmount={settleMaxAmount}
                  exceedsMax={settleExceedsMax}
                  isEditing={!!editingSettlementId}
                  nameFor={nameFor}
                  formError={formError}
                />
              )}

              {view === 'members' && (
                <MembersView
                  hook={hook}
                  isCreator={isCreator}
                  showAddForm={showAddMemberForm}
                  setShowAddForm={setShowAddMemberForm}
                  newMemberName={newMemberName}
                  setNewMemberName={setNewMemberName}
                  newMemberEmail={newMemberEmail}
                  setNewMemberEmail={setNewMemberEmail}
                  editingMemberId={editingMemberId}
                  editMemberName={editMemberName}
                  setEditMemberName={setEditMemberName}
                  editMemberEmail={editMemberEmail}
                  setEditMemberEmail={setEditMemberEmail}
                  onStartEdit={startEditMember}
                  onCancelEdit={() => setEditingMemberId(null)}
                  onSaveEdit={handleSaveEditMember}
                  onDeleteRequest={setConfirmDeleteMemberId}
                  formError={formError}
                />
              )}
            </div>

            {/* Barra de acción inferior fija (por vista). En "list" solo se muestra
                con grupos existentes — con 0 grupos el empty state ya tiene su
                propio CTA "Crear mi primer grupo", y mostrar los dos duplicaría
                la acción. */}
            {view === 'list' && hook.groups.length > 0 && (
              <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setNewGroupName('')
                    setFormError(null)
                    setView('create-group')
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold ${PRIMARY_BUTTON}`}
                  style={{ minHeight: 44 }}
                >
                  <Plus className="w-5 h-5" /> Nuevo grupo
                </button>
              </div>
            )}

            {view === 'detail' && hook.groupDetail && (
              <div className="shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button
                  onClick={openAddExpense}
                  disabled={hook.members.length < 2 || activity.length === 0}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm ${PRIMARY_BUTTON}`}
                  style={{ minHeight: 44 }}
                >
                  <Receipt className="w-4 h-4" /> Gasto
                </button>
                <button
                  onClick={openSettle}
                  disabled={hook.balance.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  style={{ minHeight: 44 }}
                >
                  <Wallet className="w-4 h-4" /> Saldar
                </button>
              </div>
            )}

            {view === 'add-expense' && (
              <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleSaveExpense}
                  disabled={hook.actionLoading || !expenseDescription.trim() || !(expenseAmount > 0) || !expenseExactMatches}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold ${PRIMARY_BUTTON}`}
                  style={{ minHeight: 44 }}
                >
                  {hook.actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingExpenseId ? 'Guardar cambios' : 'Guardar gasto'}
                </button>
              </div>
            )}

            {view === 'settle' && settleStep === 'form' && (
              <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleSaveSettlement}
                  disabled={hook.actionLoading || !settlePaidBy || !settlePaidTo || !(settleAmount > 0) || settleExceedsMax}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold ${PRIMARY_BUTTON}`}
                  style={{ minHeight: 44 }}
                >
                  {hook.actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingSettlementId ? 'Guardar cambios' : 'Registrar pago'}
                </button>
              </div>
            )}

            {view === 'members' && (
              <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
                {!showAddMemberForm ? (
                  <button
                    onClick={() => {
                      setNewMemberName('')
                      setNewMemberEmail('')
                      setFormError(null)
                      setShowAddMemberForm(true)
                    }}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold ${PRIMARY_BUTTON}`}
                    style={{ minHeight: 44 }}
                  >
                    <UserPlus className="w-5 h-5" /> Agregar persona
                  </button>
                ) : (
                  <button
                    onClick={handleAddMember}
                    disabled={hook.actionLoading || !newMemberName.trim()}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold ${PRIMARY_BUTTON}`}
                    style={{ minHeight: 44 }}
                  >
                    {hook.actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Agregar'}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {renamingGroup && (
        <RenamePrompt
          key="rename-group-prompt"
          value={renameValue}
          onChange={setRenameValue}
          onCancel={() => setRenamingGroup(false)}
          onConfirm={handleRenameGroup}
          loading={hook.actionLoading}
        />
      )}

      <ConfirmModal
        key="confirm-delete-group"
        isOpen={confirmDeleteGroup}
        onClose={() => setConfirmDeleteGroup(false)}
        onConfirm={handleDeleteGroup}
        title="Eliminar grupo"
        message="Se van a eliminar el grupo, sus miembros, gastos y pagos registrados. Esta acción no se puede deshacer."
        confirmText="Sí, eliminar"
        type="danger"
      />

      <ConfirmModal
        key="confirm-delete-expense"
        isOpen={!!confirmDeleteExpenseId}
        onClose={() => setConfirmDeleteExpenseId(null)}
        onConfirm={() => confirmDeleteExpenseId && handleDeleteExpense(confirmDeleteExpenseId)}
        title="Eliminar gasto"
        message="¿Querés eliminar este gasto? Esta acción no se puede deshacer."
        confirmText="Sí, eliminar"
        type="danger"
      />

      <ConfirmModal
        key="confirm-delete-settlement"
        isOpen={!!confirmDeleteSettlementId}
        onClose={() => setConfirmDeleteSettlementId(null)}
        onConfirm={() => confirmDeleteSettlementId && handleDeleteSettlement(confirmDeleteSettlementId)}
        title="Eliminar pago"
        message="¿Querés eliminar este pago registrado?"
        confirmText="Sí, eliminar"
        type="danger"
      />

      <ConfirmModal
        key="confirm-delete-member"
        isOpen={!!confirmDeleteMemberId}
        onClose={() => setConfirmDeleteMemberId(null)}
        onConfirm={() => confirmDeleteMemberId && handleDeleteMember(confirmDeleteMemberId)}
        title="Eliminar miembro"
        message="¿Querés eliminar a este miembro del grupo?"
        confirmText="Sí, eliminar"
        type="danger"
      />
    </AnimatePresence>
  )
}

// ============================================================================
// Subcomponentes de vista (mismo archivo, por preferencia explícita del pedido)
// ============================================================================

function FormErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
    </div>
  )
}

function RenamePrompt({
  value,
  onChange,
  onCancel,
  onConfirm,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">Renombrar grupo</h3>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !value.trim()}
            className={`flex-1 py-2.5 rounded-xl font-semibold ${PRIMARY_BUTTON}`}
          >
            Guardar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

type HookApi = ReturnType<typeof useSharedGroups>

function ListView({
  hook,
  onOpenGroup,
  onCreateGroup,
}: {
  hook: HookApi
  onOpenGroup: (groupId: string) => void
  onCreateGroup: () => void
}) {
  if (hook.loadingGroups && hook.groups.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (hook.groupsError && hook.groups.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">{hook.groupsError}</p>
        <button
          onClick={() => hook.fetchGroups().catch(() => {})}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (hook.groups.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 gap-3 text-center">
        <div className="md:-mt-10 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center">
            <Users className="w-8 h-8 text-[#FF007A]" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-[240px]">Dividí gastos con tu pareja, familia o amigos.</p>
          <button
            onClick={onCreateGroup}
            className={`mt-2 px-5 py-3 rounded-xl font-semibold ${PRIMARY_BUTTON}`}
            style={{ minHeight: 44 }}
          >
            Crear mi primer grupo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2.5">
      {hook.groups.map(({ group, myMemberId, balances, members }) => {
        const myBalances = balances.filter((b) => b.fromMemberId === myMemberId || b.toMemberId === myMemberId)
        return (
          <button
            key={group.id}
            onClick={() => onOpenGroup(group.id)}
            className="w-full text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
            style={{ minHeight: 44 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{group.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {members.length} {members.length === 1 ? 'persona' : 'personas'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
            </div>
            <div className="mt-2.5 space-y-1">
              {myBalances.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Sin deudas pendientes</p>
              ) : (
                myBalances.map((b, i) => {
                  const iAmOwed = b.toMemberId === myMemberId
                  const otherId = iAmOwed ? b.fromMemberId : b.toMemberId
                  const otherName = members.find((m) => m.id === otherId)?.name || '—'
                  return (
                    <p
                      key={i}
                      className={`text-sm font-medium ${iAmOwed ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}
                    >
                      {iAmOwed ? `${otherName} te debe ` : `Vos debés a ${otherName} `}
                      {formatMoneyForCurrency(b.amount, b.currency)}
                    </p>
                  )
                })
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function DetailView({
  hook,
  onGoMembers,
  onGoAddExpense,
  onGoSettle,
  onEditExpense,
  onDeleteExpenseRequest,
  onEditSettlement,
  onDeleteSettlementRequest,
  currentUserId,
  activity,
  expenseSecondaryLine,
  nameFor,
  onRetry,
}: {
  hook: HookApi
  onGoMembers: () => void
  onGoAddExpense: () => void
  onGoSettle: () => void
  onEditExpense: (expense: SharedGroupExpenseWithSplits) => void
  onDeleteExpenseRequest: (id: string) => void
  onEditSettlement: (settlement: SharedGroupSettlement) => void
  onDeleteSettlementRequest: (id: string) => void
  currentUserId?: string
  activity: Array<
    | { kind: 'expense'; date: string; createdAt: string; data: SharedGroupExpenseWithSplits }
    | { kind: 'settlement'; date: string; createdAt: string; data: SharedGroupSettlement }
  >
  expenseSecondaryLine: (expense: SharedGroupExpenseWithSplits) => string | null
  nameFor: (memberId: string) => string
  onRetry: () => void
}) {
  if (hook.loadingDetail && !hook.groupDetail) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (hook.detailError && !hook.groupDetail) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">{hook.detailError}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
          style={{ minHeight: 44 }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      <button
        onClick={onGoMembers}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer"
        style={{ minHeight: 44 }}
      >
        <Users className="w-4 h-4" />
        Miembros ({hook.members.length})
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="space-y-2">
        {hook.balance.length === 0 ? (
          <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">Sin deudas pendientes</p>
        ) : (
          hook.balance.map((b, i) => {
            const iAmOwed = b.toMemberId === hook.myMemberId
            const iOwe = b.fromMemberId === hook.myMemberId
            const color = iAmOwed
              ? 'text-green-700 dark:text-green-400'
              : iOwe
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-gray-700 dark:text-gray-300'
            const label = iAmOwed
              ? `${nameFor(b.fromMemberId)} te debe`
              : iOwe
                ? `Vos debés a ${nameFor(b.toMemberId)}`
                : `${nameFor(b.fromMemberId)} le debe a ${nameFor(b.toMemberId)}`
            return (
              <p key={i} className={`text-xl font-bold ${color}`}>
                {label} {formatMoneyForCurrency(b.amount, b.currency)}
              </p>
            )
          })
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Actividad</h3>
        {activity.length === 0 ? (
          hook.members.length === 1 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Agregá a alguien para empezar a dividir gastos.</p>
              <button
                onClick={onGoMembers}
                className={`px-4 py-2.5 rounded-xl font-semibold text-sm ${PRIMARY_BUTTON}`}
                style={{ minHeight: 44 }}
              >
                Agregar miembro
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Aún no hay movimientos.</p>
              <button
                onClick={onGoAddExpense}
                className={`px-4 py-2.5 rounded-xl font-semibold text-sm ${PRIMARY_BUTTON}`}
                style={{ minHeight: 44 }}
              >
                Agregar primer gasto
              </button>
            </div>
          )
        ) : (
          <div className="space-y-2">
            {activity.map((item) => {
              if (item.kind === 'expense') {
                const expense = item.data
                const isAuthor = !!currentUserId && expense.createdBy === currentUserId
                const secondary = expenseSecondaryLine(expense)
                const payerLabel = expense.paidByMemberId === hook.myMemberId ? 'Pagaste vos' : `Pagó ${nameFor(expense.paidByMemberId)}`
                return (
                  <div
                    key={expense.id}
                    className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{expense.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {payerLabel} · {formatCivilDate(expense.date)}
                      </p>
                      {secondary && <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{secondary}</p>}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="font-semibold text-gray-900 dark:text-white">{formatMoneyForCurrency(expense.amount, expense.currency)}</span>
                      {isAuthor && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => onEditExpense(expense)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            aria-label="Editar gasto"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button
                            onClick={() => onDeleteExpenseRequest(expense.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            aria-label="Eliminar gasto"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              const settlement = item.data
              const isAuthor = !!currentUserId && settlement.createdBy === currentUserId
              return (
                <div
                  key={settlement.id}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {settlement.paidToMemberId === hook.myMemberId
                        ? `${nameFor(settlement.paidByMemberId)} te pagó`
                        : settlement.paidByMemberId === hook.myMemberId
                          ? `Le pagaste a ${nameFor(settlement.paidToMemberId)}`
                          : `${nameFor(settlement.paidByMemberId)} pagó a ${nameFor(settlement.paidToMemberId)}`}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatCivilDate(settlement.date)}</p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="font-semibold text-gray-900 dark:text-white">{formatMoneyForCurrency(settlement.amount, settlement.currency)}</span>
                    {isAuthor && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => onEditSettlement(settlement)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          aria-label="Editar pago"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={() => onDeleteSettlementRequest(settlement.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          aria-label="Eliminar pago"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* onGoSettle se usa desde la barra inferior fija del modal principal */}
      <span className="hidden" onClick={onGoSettle} />
    </div>
  )
}

function AddExpenseView({
  hook,
  description,
  setDescription,
  amountInput,
  setAmountInput,
  paidBy,
  setPaidBy,
  splitType,
  participantIds,
  toggleParticipant,
  switchToEqual,
  switchToExact,
  exactAmounts,
  setExactAmount,
  exactDiffCents,
  currency,
  setCurrency,
  date,
  setDate,
  showMoreOptions,
  setShowMoreOptions,
  showChangeSplit,
  setShowChangeSplit,
  nameFor,
  formError,
}: {
  hook: HookApi
  description: string
  setDescription: (v: string) => void
  amountInput: string
  setAmountInput: (v: string) => void
  paidBy: string
  setPaidBy: (v: string) => void
  splitType: 'equal' | 'amount'
  participantIds: string[]
  toggleParticipant: (memberId: string) => void
  switchToEqual: () => void
  switchToExact: () => void
  exactAmounts: Record<string, string>
  setExactAmount: (memberId: string, value: string) => void
  exactDiffCents: number
  currency: 'pesos' | 'usd'
  setCurrency: (v: 'pesos' | 'usd') => void
  date: string
  setDate: (v: string) => void
  showMoreOptions: boolean
  setShowMoreOptions: (v: boolean) => void
  showChangeSplit: boolean
  setShowChangeSplit: (v: boolean) => void
  nameFor: (memberId: string) => string
  formError: string | null
}) {
  const payerLabel = paidBy === hook.myMemberId ? 'Vos' : nameFor(paidBy)
  const splitLabel =
    splitType === 'amount'
      ? 'Montos exactos'
      : participantIds.length === hook.members.length
        ? 'Todos'
        : `${participantIds.length} de ${hook.members.length}`

  return (
    <div className="p-4 space-y-4">
      {formError && <FormErrorBanner message={formError} />}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Descripción</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Supermercado"
          autoFocus
          className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Monto</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="45.000"
            className="w-full pl-7 pr-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">Pagó</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{payerLabel}</span>
      </div>
      <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400">Dividir</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{splitLabel}</span>
      </div>

      <button
        onClick={() => setShowMoreOptions(!showMoreOptions)}
        className="w-full flex items-center justify-center gap-1 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
        style={{ minHeight: 44 }}
      >
        {showMoreOptions ? 'Ocultar opciones' : 'Más opciones'}
        <ChevronRight className={`w-4 h-4 transition-transform ${showMoreOptions ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {showMoreOptions && (
          <motion.div key="expense-more-options" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Moneda</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'pesos' | 'usd')}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="pesos">Pesos</option>
                  <option value="usd">USD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Quién pagó</label>
              <div className="space-y-1.5">
                {hook.members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaidBy(m.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                    style={{ minHeight: 44 }}
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-100">{m.id === hook.myMemberId ? 'Vos' : m.name}</span>
                    {paidBy === m.id && <Check className="w-4 h-4 text-[#FF007A]" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Participantes</label>
              <div className="space-y-1.5">
                {hook.members.map((m) => {
                  const checked = participantIds.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleParticipant(m.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                      style={{ minHeight: 44 }}
                    >
                      <span className="text-sm text-gray-800 dark:text-gray-100">{m.id === hook.myMemberId ? 'Vos' : m.name}</span>
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center border ${checked ? 'bg-[#FF007A] border-[#FF007A]' : 'border-gray-300 dark:border-gray-600'}`}
                      >
                        {checked && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => setShowChangeSplit(!showChangeSplit)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200"
              style={{ minHeight: 44 }}
            >
              Cambiar división
              <ChevronRight className={`w-4 h-4 transition-transform ${showChangeSplit ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {showChangeSplit && (
                <motion.div key="expense-change-split" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">
                  <button
                    onClick={switchToEqual}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                    style={{ minHeight: 44 }}
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-100">En partes iguales</span>
                    {splitType === 'equal' && <Check className="w-4 h-4 text-[#FF007A]" />}
                  </button>
                  <button
                    onClick={switchToExact}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                    style={{ minHeight: 44 }}
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-100">Montos exactos</span>
                    {splitType === 'amount' && <Check className="w-4 h-4 text-[#FF007A]" />}
                  </button>

                  {splitType === 'amount' && (
                    <div className="pt-2 space-y-2">
                      {participantIds.map((memberId) => (
                        <div key={memberId} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-700 dark:text-gray-200">{memberId === hook.myMemberId ? 'Vos' : nameFor(memberId)}</span>
                          <div className="relative w-32">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={exactAmounts[memberId] || ''}
                              onChange={(e) => setExactAmount(memberId, e.target.value)}
                              className="w-full pl-6 pr-2 py-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>
                      ))}
                      <p className={`text-xs font-medium text-right ${exactDiffCents === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {exactDiffCents === 0
                          ? 'La suma coincide con el total'
                          : exactDiffCents > 0
                            ? `Faltan ${formatCurrency(exactDiffCents / 100)}`
                            : `Sobran ${formatCurrency(-exactDiffCents / 100)}`}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SettleView({
  hook,
  step,
  onPickDebt,
  onPickFree,
  onBackToPick,
  paidBy,
  setPaidBy,
  paidTo,
  setPaidTo,
  amountInput,
  setAmountInput,
  currency,
  setCurrency,
  date,
  setDate,
  notes,
  setNotes,
  maxAmount,
  exceedsMax,
  isEditing,
  nameFor,
  formError,
}: {
  hook: HookApi
  step: 'pick' | 'form'
  onPickDebt: (b: SharedGroupPairBalance) => void
  onPickFree: () => void
  onBackToPick: () => void
  paidBy: string
  setPaidBy: (v: string) => void
  paidTo: string
  setPaidTo: (v: string) => void
  amountInput: string
  setAmountInput: (v: string) => void
  currency: 'pesos' | 'usd'
  setCurrency: (v: 'pesos' | 'usd') => void
  date: string
  setDate: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  maxAmount: number | null
  exceedsMax: boolean
  isEditing: boolean
  nameFor: (memberId: string) => string
  formError: string | null
}) {
  if (step === 'pick' && !isEditing) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Elegí qué pago querés registrar.</p>
        {hook.balance.map((b, i) => (
          <button
            key={i}
            onClick={() => onPickDebt(b)}
            className="w-full text-left p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer"
            style={{ minHeight: 44 }}
          >
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {b.toMemberId === hook.myMemberId
                ? `${nameFor(b.fromMemberId)} te debe ${formatMoneyForCurrency(b.amount, b.currency)}`
                : `${nameFor(b.fromMemberId)} debe ${formatMoneyForCurrency(b.amount, b.currency)} a ${nameFor(b.toMemberId)}`}
            </p>
          </button>
        ))}
        <button
          onClick={onPickFree}
          className="w-full text-left p-3.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-gray-400 cursor-pointer"
          style={{ minHeight: 44 }}
        >
          Registrar otro pago
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {formError && <FormErrorBanner message={formError} />}
      {!isEditing && (
        <button onClick={onBackToPick} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Elegir otra deuda
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">De</label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {hook.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === hook.myMemberId ? 'Vos' : m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">A</label>
          <select
            value={paidTo}
            onChange={(e) => setPaidTo(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {hook.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === hook.myMemberId ? 'Vos' : m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Monto</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="w-full pl-7 pr-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        {maxAmount !== null && (
          <p className={`text-xs mt-1 ${exceedsMax ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
            {exceedsMax ? `El monto no puede superar ${formatMoneyForCurrency(maxAmount, currency)}` : `Deuda actual: ${formatMoneyForCurrency(maxAmount, currency)}`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Moneda</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as 'pesos' | 'usd')}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="pesos">Pesos</option>
            <option value="usd">USD</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas (opcional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>
    </div>
  )
}

function MembersView({
  hook,
  isCreator,
  showAddForm,
  setShowAddForm,
  newMemberName,
  setNewMemberName,
  newMemberEmail,
  setNewMemberEmail,
  editingMemberId,
  editMemberName,
  setEditMemberName,
  editMemberEmail,
  setEditMemberEmail,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteRequest,
  formError,
}: {
  hook: HookApi
  isCreator: boolean
  showAddForm: boolean
  setShowAddForm: (v: boolean) => void
  newMemberName: string
  setNewMemberName: (v: string) => void
  newMemberEmail: string
  setNewMemberEmail: (v: string) => void
  editingMemberId: string | null
  editMemberName: string
  setEditMemberName: (v: string) => void
  editMemberEmail: string
  setEditMemberEmail: (v: string) => void
  onStartEdit: (member: SharedGroupMember) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDeleteRequest: (memberId: string) => void
  formError: string | null
}) {
  return (
    <div className="p-4 space-y-3">
      {formError && <FormErrorBanner message={formError} />}

      {showAddForm && (
        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nombre</label>
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email (opcional)</label>
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Podés agregarla aunque todavía no use FindIA.</p>
          <button onClick={() => setShowAddForm(false)} className="text-xs text-gray-500 dark:text-gray-400 underline cursor-pointer">
            Cancelar
          </button>
        </div>
      )}

      {hook.members.map((member) => {
        const isMe = member.id === hook.myMemberId
        const isEditing = editingMemberId === member.id
        const isGroupCreator = !!member.userId && member.userId === hook.groupDetail?.createdBy
        if (isEditing) {
          return (
            <div key={member.id} className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
              <input
                type="text"
                value={editMemberName}
                onChange={(e) => setEditMemberName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <input
                type="email"
                value={editMemberEmail}
                onChange={(e) => setEditMemberEmail(e.target.value)}
                placeholder="Email (opcional)"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:outline-none focus:ring-2 focus:ring-[#FF3A5F] focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={onCancelEdit}
                  className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button onClick={onSaveEdit} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${PRIMARY_BUTTON}`}>
                  Guardar
                </button>
              </div>
            </div>
          )
        }
        return (
          <div key={member.id} className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {isMe ? 'Vos' : member.name}
                {!member.userId && !isMe && (
                  <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">Sin cuenta FindIA</span>
                )}
              </p>
              {member.email && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isGroupCreator && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Creador
                </span>
              )}
              {isCreator && !isMe && (
                <>
                  <button onClick={() => onStartEdit(member)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" aria-label="Editar miembro">
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => onDeleteRequest(member.id)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    aria-label="Eliminar miembro"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
