/**
 * Fase DB-8.2 — lectura READ-ONLY de Categories + Subcategories. Dos
 * `values.get` en paralelo (una por hoja, ideal por el requisito de
 * mínima cantidad de llamadas) -- nunca `ensureSheet`/`addSheet`/`update`.
 * Sin retries. Ante 429, se relanza el error tal cual.
 */
import { google } from 'googleapis'
import type { CategoriesSnapshot, RawCategoryRow, RawSubcategoryRow } from './types'

interface GoogleApiErrorShape {
  code?: number
  message?: string
  errors?: Array<{ message?: string }>
}

function getGoogleApiErrorStatus(error: unknown): number | undefined {
  const err = error as { code?: number; response?: { status?: number } } | undefined
  return err?.code ?? err?.response?.status
}

function isSheetNotFoundError(error: unknown): boolean {
  const err = error as GoogleApiErrorShape | undefined
  if (getGoogleApiErrorStatus(error) !== 400) return false
  const message = err?.message || err?.errors?.[0]?.message || ''
  return /unable to parse range/i.test(message)
}

async function safeGet(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string | undefined, range: string): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
    return (res.data.values || []) as string[][]
  } catch (error) {
    if (isSheetNotFoundError(error)) return []
    throw error
  }
}

export async function readCategoriesSnapshot(): Promise<{ snapshot: CategoriesSnapshot }> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID

  const [categoryValues, subcategoryValues] = await Promise.all([
    safeGet(sheets, spreadsheetId, 'Categories!A2:H'),
    safeGet(sheets, spreadsheetId, 'Subcategories!A2:G'),
  ])

  const categories: RawCategoryRow[] = categoryValues.map((row, i) => ({
    rowIndex: i,
    id: row[0] ?? '',
    userId: row[1] ?? '',
    name: row[2] ?? '',
    color: row[3] ?? '',
    icon: row[4] ?? '',
    type: row[5] ?? '',
    isDefault: row[6] ?? '',
    createdAt: row[7] ?? '',
  }))

  const subcategories: RawSubcategoryRow[] = subcategoryValues.map((row, i) => ({
    rowIndex: i,
    id: row[0] ?? '',
    userId: row[1] ?? '',
    categoryId: row[2] ?? '',
    name: row[3] ?? '',
    icon: row[4] ?? '',
    isDefault: row[5] ?? '',
    createdAt: row[6] ?? '',
  }))

  return { snapshot: { categories, subcategories } }
}
