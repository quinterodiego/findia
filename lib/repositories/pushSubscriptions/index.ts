/**
 * Fase DB-8.1 — punto único de acceso al repositorio de PushSubscriptions,
 * mismo patrón de switch que Shared Groups V2 (DB-6/DB-7A.1), con sus propias
 * env vars -- un repositorio nunca puede activar Postgres para otro dominio
 * por error de configuración.
 *
 * Regla de seguridad, igual que Shared Groups V2:
 *   1. Default SIEMPRE Sheets. Si `PUSH_SUBSCRIPTIONS_STORAGE` está ausente,
 *      o tiene cualquier valor que no sea EXACTAMENTE 'postgres', se usa
 *      Sheets.
 *   2. La sola PRESENCIA de `DATABASE_URL` NUNCA activa Postgres por sí sola.
 *   3. Guard de producción: en `VERCEL_ENV === 'production'`,
 *      `PUSH_SUBSCRIPTIONS_STORAGE=postgres` por sí solo no alcanza -- hace
 *      falta además `PUSH_SUBSCRIPTIONS_POSTGRES_PRODUCTION_ENABLED=true`.
 *      Ninguna de las dos está seteada todavía en ningún entorno -- esta
 *      fase (DB-8.1) no activa Postgres en Production.
 */
import { sheetsPushSubscriptionsRepository } from './sheetsRepository'
import { PostgresPushSubscriptionsRepository } from './postgresRepository'
import type { PushSubscriptionsRepository } from './types'

export type PushSubscriptionsStorage = 'sheets' | 'postgres'

export function resolvePushSubscriptionsStorage(env: Record<string, string | undefined> = process.env): PushSubscriptionsStorage {
  if (env.PUSH_SUBSCRIPTIONS_STORAGE !== 'postgres') return 'sheets'
  if (env.VERCEL_ENV === 'production' && env.PUSH_SUBSCRIPTIONS_POSTGRES_PRODUCTION_ENABLED !== 'true') return 'sheets'
  return 'postgres'
}

export function getPushSubscriptionsRepository(): PushSubscriptionsRepository {
  if (
    process.env.PUSH_SUBSCRIPTIONS_STORAGE === 'postgres' &&
    process.env.VERCEL_ENV === 'production' &&
    process.env.PUSH_SUBSCRIPTIONS_POSTGRES_PRODUCTION_ENABLED !== 'true'
  ) {
    console.error(
      '[PushSubscriptionsRepository] PUSH_SUBSCRIPTIONS_STORAGE=postgres ignorado en VERCEL_ENV=production ' +
        '(falta PUSH_SUBSCRIPTIONS_POSTGRES_PRODUCTION_ENABLED=true). Usando Sheets.'
    )
  }
  const storage = resolvePushSubscriptionsStorage()
  if (storage === 'postgres') return new PostgresPushSubscriptionsRepository()
  return sheetsPushSubscriptionsRepository
}

export type { PushSubscriptionsRepository, PushSubscriptionRecord } from './types'
