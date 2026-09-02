/**
 * Fase DB-8.1 — implementación Sheets de PushSubscriptionsRepository.
 * Movido tal cual desde `lib/pushService.ts` (mismo cliente propio de
 * `googleapis`, mismo patrón clear+rewrite, mismo swallow de errores) --
 * el objetivo de esta fase es dar una alternativa Postgres, no arreglar el
 * comportamiento de Sheets. Ese comportamiento (incluida la race condition
 * de DB-8 Audit) se preserva intacto acá.
 */
import { google } from 'googleapis'
import type { PushSubscriptionRecord, PushSubscriptionsRepository } from './types'

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID
const SHEET = 'PushSubscriptions'
const HEADERS = ['userId', 'endpoint', 'p256dh', 'auth', 'createdAt']

async function ensureSheet() {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = res.data.sheets?.some((s) => s.properties?.title === SHEET)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    })
  }
}

async function unsubscribe(endpoint: string): Promise<void> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A:E`,
    })
    const rows = res.data.values || []
    const kept = rows.filter((row, i) => i === 0 || row[1] !== endpoint)
    await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET}!A:E` })
    if (kept.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: kept },
      })
    }
  } catch {
    // Hoja aún no existe, ignorar
  }
}

async function subscribe(userId: string, subscription: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  await ensureSheet()
  const { endpoint, p256dh, auth: authKey } = subscription

  // Eliminar suscripción previa del mismo endpoint antes de guardar --
  // mismo comportamiento de siempre, con la misma race condition conocida.
  await unsubscribe(endpoint)

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET}!A:E`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[userId, endpoint, p256dh, authKey, new Date().toISOString()]],
    },
  })
}

async function getSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  try {
    await ensureSheet()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A:E`,
    })
    return (res.data.values || [])
      .slice(1)
      .filter((row) => row[0] === userId)
      .map((row) => ({ userId: row[0], endpoint: row[1], p256dh: row[2], auth: row[3] }))
  } catch {
    return []
  }
}

export const sheetsPushSubscriptionsRepository: PushSubscriptionsRepository = {
  subscribe,
  unsubscribe,
  getSubscriptionsForUser,
}
