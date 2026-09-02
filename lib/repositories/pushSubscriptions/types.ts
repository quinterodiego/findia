/**
 * Fase DB-8.1 — frontera de persistencia para PushSubscriptions. Exactamente
 * las 3 operaciones que `lib/pushService.ts` ya usaba contra Sheets --
 * ninguna superficie nueva, ningún método especulativo.
 */
export interface PushSubscriptionRecord {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushSubscriptionsRepository {
  /**
   * Crea o reemplaza la suscripción de este endpoint. El endpoint identifica
   * la suscripción de forma GLOBAL (no por usuario) -- si ya existía una fila
   * para este endpoint (mismo browser/dispositivo, sea el mismo userId u
   * otro), queda reemplazada, nunca duplicada.
   */
  subscribe(userId: string, subscription: { endpoint: string; p256dh: string; auth: string }): Promise<void>

  /** Elimina la suscripción de este endpoint, si existe. No-op si no existe. */
  unsubscribe(endpoint: string): Promise<void>

  /** Todas las suscripciones activas de un usuario (para mandar una notificación). */
  getSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]>
}
