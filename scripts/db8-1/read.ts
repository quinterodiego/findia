/**
 * Fase DB-8.1 — lectura READ-ONLY de la hoja PushSubscriptions.
 *
 * UNA sola llamada `values.get` -- nunca `ensureSheet`/`addSheet`/`update`
 * (a diferencia de lib/repositories/pushSubscriptions/sheetsRepository.ts,
 * este lector nunca escribe nada, ni siquiera para crear la hoja si no
 * existiera). Sin retries. Ante 429, se relanza el error tal cual para que
 * el caller (`run.ts`) lo detecte y aborte inmediatamente.
 */
import { google } from 'googleapis'
import type { PushSubscriptionsSnapshot, RawPushSubscriptionRow } from './types'

interface GoogleApiErrorShape {
  code?: number
  message?: string
  errors?: Array<{ message?: string; reason?: string }>
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

export async function readPushSubscriptionsSnapshot(): Promise<{ snapshot: PushSubscriptionsSnapshot }> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID

  let values: string[][] = []
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'PushSubscriptions!A:E',
    })
    values = (res.data.values || []) as string[][]
  } catch (error) {
    if (isSheetNotFoundError(error)) {
      values = []
    } else {
      throw error
    }
  }

  // La primera fila es el header (userId, endpoint, p256dh, auth, createdAt) -- se descarta.
  const dataRows = values.slice(1)
  const rows: RawPushSubscriptionRow[] = dataRows.map((row, i) => ({
    rowIndex: i,
    userId: row[0] ?? '',
    endpoint: row[1] ?? '',
    p256dh: row[2] ?? '',
    auth: row[3] ?? '',
    createdAt: row[4] ?? '',
  }))

  return { snapshot: { rows } }
}
