import type { PushSubscriptionsSnapshot, TransformedPushSubscription } from './types'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sheets nunca tuvo un id de fila propio para PushSubscriptions -- se genera
 * acá, una vez, al momento del import real (no en el dry-run, que descarta
 * el resultado). `endpoint`/`userId`/`p256dh`/`auth` se preservan tal cual,
 * nunca se reinterpretan.
 */
export function transformSnapshot(snapshot: PushSubscriptionsSnapshot): TransformedPushSubscription[] {
  return snapshot.rows
    .filter((row) => row.endpoint && row.endpoint.trim() !== '')
    .map((row) => ({
      id: generateId(),
      userId: row.userId,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      createdAt: isNaN(new Date(row.createdAt).getTime()) ? new Date() : new Date(row.createdAt),
    }))
}
