/**
 * Fase DB-6 — punto único de acceso al repositorio de Gastos Compartidos V2,
 * ahora con selección explícita de backend (antes: siempre Sheets, sin
 * ninguna selección -- ver DB-3). Extendido en DB-7A.1 con la puerta de
 * activación productiva (ver punto 3 más abajo).
 *
 * Regla de seguridad, en este orden estricto:
 *   1. Default SIEMPRE Sheets. Si `SHARED_GROUPS_STORAGE` está ausente, o
 *      tiene cualquier valor que no sea EXACTAMENTE la string 'postgres',
 *      se usa Sheets -- falla seguro, nunca al revés.
 *   2. La sola PRESENCIA de `DATABASE_URL` NUNCA activa Postgres por sí
 *      sola -- solo se lee si `SHARED_GROUPS_STORAGE === 'postgres'`.
 *   3. Guard de producción (DB-7A.1): en `VERCEL_ENV === 'production'`,
 *      `SHARED_GROUPS_STORAGE=postgres` por sí solo NO alcanza -- hace
 *      falta ADEMÁS `SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED=true`
 *      (exactamente esa string). Sin ese segundo consentimiento explícito,
 *      Production sigue en Sheets con un log explícito. Esto es intencional:
 *      dos variables independientes, ambas necesarias, para que activar
 *      Postgres en Production requiera una acción deliberada y no pueda
 *      pasar por un typo o una configuración incompleta. `VERCEL_ENV`
 *      (no `NODE_ENV`) es la señal correcta acá porque un Preview de
 *      Vercel también compila con `NODE_ENV=production`; `VERCEL_ENV`
 *      distingue production/preview/development de verdad. El guard de
 *      Preview/development (DB-6) no cambió: ninguno de los dos requiere
 *      el segundo flag.
 *
 * Producción sigue -- y debe seguir -- en Sheets hasta que DB-7B decida lo
 * contrario. Ninguna env var productiva se tocó en DB-7A.1 -- este archivo
 * solo agrega la puerta; nadie la abrió todavía.
 */
import { sheetsSharedGroupsRepository } from './sheetsRepository'
import { PostgresSharedGroupsRepository } from './postgresRepository'
import type { SharedGroupsRepository } from './types'

export type SharedGroupsStorage = 'sheets' | 'postgres'

/** Expuesto para poder loggear/testear la decisión sin duplicar la lógica.
 * Tipo de `env` deliberadamente laxo (no `NodeJS.ProcessEnv`, que en este
 * proyecto exige `NODE_ENV`) para que un test pueda pasar un objeto parcial. */
export function resolveSharedGroupsStorage(env: Record<string, string | undefined> = process.env): SharedGroupsStorage {
  if (env.SHARED_GROUPS_STORAGE !== 'postgres') return 'sheets'
  if (env.VERCEL_ENV === 'production' && env.SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED !== 'true') return 'sheets'
  return 'postgres'
}

export function getSharedGroupsRepository(): SharedGroupsRepository {
  if (
    process.env.SHARED_GROUPS_STORAGE === 'postgres' &&
    process.env.VERCEL_ENV === 'production' &&
    process.env.SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED !== 'true'
  ) {
    console.error(
      '[SharedGroupsRepository] SHARED_GROUPS_STORAGE=postgres ignorado en VERCEL_ENV=production ' +
        '(falta SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED=true). Usando Sheets.'
    )
  }
  const storage = resolveSharedGroupsStorage()
  if (storage === 'postgres') return new PostgresSharedGroupsRepository()
  return sheetsSharedGroupsRepository
}

export type { SharedGroupsRepository } from './types'
export type {
  SharedGroupSummaryItem,
  SharedGroupBalanceInputs,
  SharedGroupCurrency,
  CreateSharedGroupExpenseData,
  UpdateSharedGroupExpenseData,
  CreateSharedGroupSettlementData,
  UpdateSharedGroupSettlementData,
} from './types'
