/**
 * Fase DB-5 — lectura READ-ONLY de las 6 hojas de Shared Groups V2.
 *
 * Cliente `googleapis` propio (mismo patrón que scripts/seed-mock-data.ts),
 * NO importa nada de `lib/googleSheets.ts` -- así queda garantizado que esta
 * lectura nunca puede disparar un `createSheetIfNotExists`/migración de
 * headers/append/update/clear/delete por accidente (DB-5 §43): el único
 * método que se llama en todo este archivo es `spreadsheets.values.get`.
 *
 * Exactamente 6 lecturas (una por hoja), en paralelo, sin por-fila, sin
 * per-group, sin N+1 (DB-5 §7/§9). El snapshot resultante es el ÚNICO dato
 * que usan validate/transform/import/verify -- no se vuelve a leer Sheets
 * en el mismo run.
 */
import { google } from 'googleapis'
import type { SharedGroupsSnapshot, SnapshotGroup, SnapshotMember, SnapshotExpense, SnapshotSplit, SnapshotSettlement, SnapshotInvitation } from './types'

const SHEETS = {
  GROUPS: 'SharedGroups',
  MEMBERS: 'SharedGroupMembers',
  EXPENSES: 'SharedGroupExpenses',
  SPLITS: 'SharedGroupSplits',
  SETTLEMENTS: 'SharedGroupSettlements',
  INVITATIONS: 'SharedGroupInvitations',
} as const

function getClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

function rowToGroup(row: string[]): SnapshotGroup {
  return { id: row[0] ?? '', name: row[1] ?? '', createdBy: row[2] ?? '', createdAt: row[3] ?? '' }
}
function rowToMember(row: string[]): SnapshotMember {
  return {
    id: row[0] ?? '',
    groupId: row[1] ?? '',
    userId: orNull(row[2]),
    name: row[3] ?? '',
    email: orNull(row[4]),
    createdAt: row[5] ?? '',
  }
}
function rowToExpense(row: string[]): SnapshotExpense {
  return {
    id: row[0] ?? '',
    groupId: row[1] ?? '',
    description: row[2] ?? '',
    amountRaw: row[3] ?? '',
    currency: row[4] ?? '',
    paidByMemberId: row[5] ?? '',
    date: row[6] ?? '',
    createdBy: row[7] ?? '',
    createdAt: row[8] ?? '',
  }
}
function rowToSplit(row: string[]): SnapshotSplit {
  return { id: row[0] ?? '', expenseId: row[1] ?? '', memberId: row[2] ?? '', amountRaw: row[3] ?? '' }
}
function rowToSettlement(row: string[]): SnapshotSettlement {
  return {
    id: row[0] ?? '',
    groupId: row[1] ?? '',
    paidByMemberId: row[2] ?? '',
    paidToMemberId: row[3] ?? '',
    amountRaw: row[4] ?? '',
    currency: row[5] ?? '',
    date: row[6] ?? '',
    createdBy: row[7] ?? '',
    createdAt: row[8] ?? '',
    notes: orNull(row[9]),
  }
}
function rowToInvitation(row: string[]): SnapshotInvitation {
  return {
    id: row[0] ?? '',
    groupId: row[1] ?? '',
    memberId: row[2] ?? '',
    invitedByUserId: row[3] ?? '',
    targetEmail: row[4] ?? '',
    status: row[5] ?? '',
    tokenHash: row[6] ?? '',
    createdAt: row[7] ?? '',
    respondedAt: orNull(row[8]),
  }
}

export interface ReadResult {
  snapshot: SharedGroupsSnapshot
  readCount: number
}

/** Lee las 6 hojas UNA vez cada una, en paralelo. Si alguna hoja todavía no
 * existe, Sheets devuelve un 400 "Unable to parse range" -- se trata como
 * "hoja vacía", igual que `safeGetValues` en lib/googleSheets.ts (nunca se
 * enmascara un 429/5xx real, eso se relanza tal cual). */
export async function readSharedGroupsSnapshot(): Promise<ReadResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID
  if (!spreadsheetId) throw new Error('Falta GOOGLE_SHEETS_ID')
  const sheets = getClient()

  async function safeGet(range: string): Promise<string[][]> {
    try {
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range })
      return (resp.data.values || []) as string[][]
    } catch (error) {
      const err = error as { code?: number; message?: string }
      if (err.code === 400 && err.message?.includes('Unable to parse range')) return []
      throw error
    }
  }

  const [groupRows, memberRows, expenseRows, splitRows, settlementRows, invitationRows] = await Promise.all([
    safeGet(`${SHEETS.GROUPS}!A2:D`),
    safeGet(`${SHEETS.MEMBERS}!A2:F`),
    safeGet(`${SHEETS.EXPENSES}!A2:I`),
    safeGet(`${SHEETS.SPLITS}!A2:D`),
    safeGet(`${SHEETS.SETTLEMENTS}!A2:J`),
    safeGet(`${SHEETS.INVITATIONS}!A2:I`),
  ])

  return {
    snapshot: {
      groups: groupRows.map(rowToGroup),
      members: memberRows.map(rowToMember),
      expenses: expenseRows.map(rowToExpense),
      splits: splitRows.map(rowToSplit),
      settlements: settlementRows.map(rowToSettlement),
      invitations: invitationRows.map(rowToInvitation),
    },
    readCount: 6,
  }
}
