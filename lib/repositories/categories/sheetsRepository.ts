/**
 * Fase DB-8.2 — implementación Sheets de CategoriesRepository. Movido tal
 * cual desde `app/api/categories/route.ts` y `app/api/subcategories/route.ts`
 * (mismo cliente propio de `googleapis`, mismo comportamiento, mismas races
 * ya documentadas por DB-8 Audit) -- el objetivo de esta fase es dar una
 * alternativa Postgres, no arreglar el comportamiento de Sheets.
 */
import { google } from 'googleapis'
import { SubcategoryDuplicateError } from './types'
import type { CategoryRecord, SubcategoryRecord, CategoriesRepository } from './types'

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
const sheets = google.sheets({ version: 'v4', auth })
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID

function rowToCategory(row: string[]): CategoryRecord {
  return {
    id: row[0],
    userId: row[1],
    name: row[2],
    color: row[3],
    icon: row[4],
    type: row[5] as CategoryRecord['type'],
    isDefault: row[6] === 'true',
    createdAt: row[7],
  }
}

function rowToSubcategory(row: string[]): SubcategoryRecord {
  return {
    id: row[0],
    userId: row[1] || '',
    categoryId: row[2],
    name: row[3],
    icon: row[4],
    isDefault: row[5] === 'true',
    createdAt: row[6],
  }
}

async function ensureCategoriesSheet(): Promise<void> {
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Categories!A2:H' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('Unable to parse range') && !message.includes('not found')) throw error
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Categories' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Categories!A1:H1',
      valueInputOption: 'RAW',
      requestBody: { values: [['ID', 'UserID', 'Name', 'Color', 'Icon', 'Type', 'IsDefault', 'CreatedAt']] },
    })
  }
}

async function ensureSubcategoriesSheet(): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = spreadsheet.data.sheets?.some((s) => s.properties?.title === 'Subcategories') || false
  if (exists) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: 'Subcategories', gridProperties: { rowCount: 1000, columnCount: 7 } } } }],
    },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Subcategories!A1:G1',
    valueInputOption: 'RAW',
    requestBody: { values: [['ID', 'UserId', 'CategoryId', 'Name', 'Icon', 'IsDefault', 'CreatedAt']] },
  })
}

async function getAllCategoriesRaw(): Promise<CategoryRecord[]> {
  await ensureCategoriesSheet()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Categories!A2:H' })
  return (res.data.values || []).map(rowToCategory)
}

async function getCategoriesForUser(userId: string): Promise<CategoryRecord[]> {
  const all = await getAllCategoriesRaw()
  return all.filter((c) => c.userId === userId)
}

async function getAllCategories(): Promise<CategoryRecord[]> {
  return getAllCategoriesRaw()
}

async function createCategory(data: { userId: string; name: string; color: string; icon: string; type: CategoryRecord['type'] }): Promise<CategoryRecord> {
  const category: CategoryRecord = {
    id: `cat_${Date.now()}`,
    userId: data.userId,
    name: data.name,
    color: data.color,
    icon: data.icon,
    type: data.type,
    isDefault: false,
    createdAt: new Date().toISOString(),
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Categories!A2:H',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[category.id, category.userId, category.name, category.color, category.icon, category.type, category.isDefault.toString(), category.createdAt]],
    },
  })
  return category
}

async function insertDefaultCategoriesIfEmpty(
  userId: string,
  rows: Array<{ name: string; color: string; icon: string; type: CategoryRecord['type']; isDefault: boolean }>
): Promise<CategoryRecord[]> {
  const existing = await getCategoriesForUser(userId)
  if (existing.length > 0) return existing

  const now = Date.now()
  const created: CategoryRecord[] = rows.map((r, index) => ({
    id: `cat_${now}_${index}`,
    userId,
    name: r.name,
    color: r.color,
    icon: r.icon,
    type: r.type,
    isDefault: r.isDefault,
    createdAt: new Date().toISOString(),
  }))

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Categories!A2:H',
    valueInputOption: 'RAW',
    requestBody: {
      values: created.map((c) => [c.id, c.userId, c.name, c.color, c.icon, c.type, c.isDefault.toString(), c.createdAt]),
    },
  })
  return created
}

async function getAllSubcategories(): Promise<SubcategoryRecord[]> {
  await ensureSubcategoriesSheet()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Subcategories!A2:G' })
  return (res.data.values || []).map(rowToSubcategory)
}

async function createSubcategory(categoryId: string, name: string, icon: string): Promise<SubcategoryRecord> {
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Subcategories!A2:G' })
  const existingRows = existing.data.values || []
  const alreadyExists = existingRows.some((row) => row[2] === categoryId && row[3] === name)
  if (alreadyExists) {
    throw new SubcategoryDuplicateError('Ya existe una subcategoría con este nombre para esta categoría')
  }

  const subcategory: SubcategoryRecord = {
    id: crypto.randomUUID(),
    userId: '',
    categoryId,
    name,
    icon: icon || '📌',
    isDefault: false,
    createdAt: new Date().toISOString(),
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Subcategories!A2:G',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[subcategory.id, subcategory.userId, subcategory.categoryId, subcategory.name, subcategory.icon, subcategory.isDefault.toString(), subcategory.createdAt]],
    },
  })
  return subcategory
}

async function insertDefaultSubcategories(rows: Array<{ categoryId: string; name: string; icon: string; isDefault: boolean }>): Promise<SubcategoryRecord[]> {
  if (rows.length === 0) return []
  const now = new Date().toISOString()
  const created: SubcategoryRecord[] = rows.map((r) => ({
    id: crypto.randomUUID(),
    userId: '',
    categoryId: r.categoryId,
    name: r.name,
    icon: r.icon,
    isDefault: r.isDefault,
    createdAt: now,
  }))
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Subcategories!A2:G',
    valueInputOption: 'RAW',
    requestBody: { values: created.map((c) => [c.id, c.userId, c.categoryId, c.name, c.icon, c.isDefault.toString(), c.createdAt]) },
  })
  return created
}

export const sheetsCategoriesRepository: CategoriesRepository = {
  getCategoriesForUser,
  getAllCategories,
  createCategory,
  insertDefaultCategoriesIfEmpty,
  getAllSubcategories,
  createSubcategory,
  insertDefaultSubcategories,
}
