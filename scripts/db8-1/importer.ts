import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { TransformedPushSubscription } from './types'

export async function assertTargetTableEmpty(): Promise<void> {
  const db = getDb()
  const rows = await db.select({ id: schema.pushSubscriptions.id }).from(schema.pushSubscriptions).limit(1)
  if (rows.length > 0) {
    throw new Error('La tabla push_subscriptions NO está vacía. DB-8.1 no importa sobre una tabla ya poblada -- abortando sin escribir nada.')
  }
}

export interface ImportResult {
  inserted: number
}

/** Import atómico -- una sola transacción, todo o nada. Asume que
 * `assertTargetTableEmpty()` ya se llamó y pasó. */
export async function importBatch(rows: TransformedPushSubscription[]): Promise<ImportResult> {
  const db = getDb()
  if (rows.length === 0) return { inserted: 0 }
  await db.transaction(async (tx) => {
    await tx.insert(schema.pushSubscriptions).values(rows)
  })
  return { inserted: rows.length }
}
