/**
 * Fase DB-5 — tipos del snapshot lógico y del reporte de validación.
 * Nada acá hace I/O -- son solo shapes, reutilizables por read/validate/
 * transform/import/verify/tests.
 *
 * Los campos de monto se guardan como `amountRaw: string` (el valor TAL
 * CUAL viene de Sheets, antes de cualquier parseFloat) para que la
 * validación de precisión (DB-5 §20) pueda inspeccionar el string crudo en
 * vez de un float ya coercionado, que podría ocultar un dato corrupto.
 */

export interface SnapshotGroup {
  id: string
  name: string
  createdBy: string
  createdAt: string
}

export interface SnapshotMember {
  id: string
  groupId: string
  userId: string | null
  name: string
  email: string | null
  createdAt: string
}

export interface SnapshotExpense {
  id: string
  groupId: string
  description: string
  amountRaw: string
  currency: string
  paidByMemberId: string
  date: string
  createdBy: string
  createdAt: string
}

export interface SnapshotSplit {
  id: string
  expenseId: string
  memberId: string
  amountRaw: string
}

export interface SnapshotSettlement {
  id: string
  groupId: string
  paidByMemberId: string
  paidToMemberId: string
  amountRaw: string
  currency: string
  date: string
  createdBy: string
  createdAt: string
  notes: string | null
}

export interface SnapshotInvitation {
  id: string
  groupId: string
  memberId: string
  invitedByUserId: string
  targetEmail: string
  status: string
  tokenHash: string
  createdAt: string
  respondedAt: string | null
}

export interface SharedGroupsSnapshot {
  groups: SnapshotGroup[]
  members: SnapshotMember[]
  expenses: SnapshotExpense[]
  splits: SnapshotSplit[]
  settlements: SnapshotSettlement[]
  invitations: SnapshotInvitation[]
}

export type Severity = 'CRITICAL' | 'WARNING'

export interface Issue {
  severity: Severity
  code: string
  entity: 'group' | 'member' | 'expense' | 'split' | 'settlement' | 'invitation'
  ids: Record<string, string>
  message: string
}

export interface ValidationResult {
  issues: Issue[]
  criticalCount: number
  warningCount: number
  importable: boolean
}
