/**
 * Fase DB-6 — punto único de acceso al repositorio de Gastos Compartidos V2,
 * ahora con selección explícita de backend (antes: siempre Sheets, sin
 * ninguna selección -- ver DB-3).
 *
 * Regla de seguridad (DB-6 §11/§12), en este orden estricto:
 *   1. Default SIEMPRE Sheets. Si `SHARED_GROUPS_STORAGE` está ausente, o
 *      tiene cualquier valor que no sea EXACTAMENTE la string 'postgres',
 *      se usa Sheets -- falla seguro, nunca al revés.
 *   2. La sola PRESENCIA de `DATABASE_URL` NUNCA activa Postgres por sí
 *      sola -- solo se lee si `SHARED_GROUPS_STORAGE === 'postgres'`.
 *   3. Guard duro de producción: aunque `SHARED_GROUPS_STORAGE=postgres`
 *      esté seteada, si `VERCEL_ENV === 'production'` se ignora y se usa
 *      Sheets igual, con un log explícito. Esto es intencional y no
 *      configurable -- ningún deploy de Production puede terminar usando
 *      Postgres por un error de configuración de env vars. `VERCEL_ENV`
 *      (no `NODE_ENV`) es la señal correcta acá porque un Preview de
 *      Vercel también compila con `NODE_ENV=production`; `VERCEL_ENV`
 *      distingue production/preview/development de verdad.
 *
 * Producción sigue -- y debe seguir -- en Sheets. Este switch existe
 * exclusivamente para poder probar PostgresSharedGroupsRepository en un
 * Preview Deployment contra Neon staging (DB-6), sin tocar producción.
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
  if (env.VERCEL_ENV === 'production') return 'sheets'
  return 'postgres'
}

export function getSharedGroupsRepository(): SharedGroupsRepository {
  if (process.env.SHARED_GROUPS_STORAGE === 'postgres' && process.env.VERCEL_ENV === 'production') {
    console.error('[SharedGroupsRepository] SHARED_GROUPS_STORAGE=postgres ignorado en VERCEL_ENV=production. Usando Sheets.')
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
