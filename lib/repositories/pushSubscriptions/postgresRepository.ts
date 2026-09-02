/**
 * Fase DB-8.1 — implementación Postgres de PushSubscriptionsRepository.
 *
 * Reemplaza el patrón leer-toda-la-hoja → borrar-todo → reescribir de la
 * versión Sheets por operaciones de una sola fila:
 *   - subscribe: INSERT ... ON CONFLICT (endpoint) DO UPDATE -- atómico,
 *     reemplaza la fila existente de ese endpoint (si la había) en una sola
 *     sentencia. Nunca toca ninguna otra fila.
 *   - unsubscribe: DELETE ... WHERE endpoint = $1 -- dirigido, no-op si no
 *     existía.
 *   - getSubscriptionsForUser: SELECT ... WHERE user_id = $1.
 *
 * Con esto, dos subscribe/unsubscribe concurrentes -- incluso sobre el mismo
 * endpoint -- nunca pueden pisarse ni perder la fila de otro endpoint: cada
 * operación es una sola sentencia sobre como máximo una fila, garantizado
 * por el índice único de `endpoint` a nivel de base (no por lógica de
 * aplicación). No hace falta ningún advisory lock acá -- a diferencia de
 * Settlements en Shared Groups V2, no hay ninguna validación cross-row que
 * proteger, solo unicidad de clave, que Postgres ya garantiza.
 */
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { PushSubscriptionRecord, PushSubscriptionsRepository } from './types'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export class PostgresPushSubscriptionsRepository implements PushSubscriptionsRepository {
  private db = getDb()

  async subscribe(userId: string, subscription: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
    const { endpoint, p256dh, auth } = subscription
    await this.db
      .insert(schema.pushSubscriptions)
      .values({ id: generateId(), userId, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: schema.pushSubscriptions.endpoint,
        set: { userId, p256dh, auth, createdAt: new Date() },
      })
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, endpoint))
  }

  async getSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId))
    return rows.map((row) => ({ userId: row.userId, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }))
  }
}
