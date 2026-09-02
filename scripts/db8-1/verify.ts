import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { PushSubscriptionsSnapshot } from './types'

export interface VerifyIssue {
  severity: 'CRITICAL'
  code: string
  message: string
}

export interface VerifyResult {
  ok: boolean
  issues: VerifyIssue[]
  counts: { snapshot: number; postgres: number }
}

function critical(code: string, message: string): VerifyIssue {
  return { severity: 'CRITICAL', code, message }
}

/** Compara el snapshot YA EN MEMORIA contra Postgres -- nunca vuelve a leer
 * Sheets. Una sola query a Postgres (sin N+1). */
export async function verifyImport(snapshot: PushSubscriptionsSnapshot): Promise<VerifyResult> {
  const db = getDb()
  const pgRows = await db.select().from(schema.pushSubscriptions)
  const issues: VerifyIssue[] = []

  const validSnapshotRows = snapshot.rows.filter((r) => r.endpoint && r.endpoint.trim() !== '')
  const counts = { snapshot: validSnapshotRows.length, postgres: pgRows.length }
  if (counts.snapshot !== counts.postgres) {
    issues.push(critical('COUNT_MISMATCH', `snapshot=${counts.snapshot} postgres=${counts.postgres}`))
  }

  const pgByEndpoint = new Map(pgRows.map((r) => [r.endpoint, r]))
  for (const row of validSnapshotRows) {
    const pg = pgByEndpoint.get(row.endpoint)
    if (!pg) {
      issues.push(critical('MISSING_ENDPOINT', `endpoint ${row.endpoint} del snapshot no está en Postgres`))
      continue
    }
    if (pg.userId !== row.userId) issues.push(critical('USER_ID_MISMATCH', `endpoint ${row.endpoint}: userId no coincide`))
    if (pg.p256dh !== row.p256dh) issues.push(critical('P256DH_MISMATCH', `endpoint ${row.endpoint}: p256dh no coincide`))
    if (pg.auth !== row.auth) issues.push(critical('AUTH_MISMATCH', `endpoint ${row.endpoint}: auth no coincide`))
  }

  return { ok: issues.length === 0, issues, counts }
}
