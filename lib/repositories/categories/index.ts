/**
 * Fase DB-8.2 — punto único de acceso al repositorio de Categories +
 * Subcategories, mismo patrón de switch que Shared Groups V2/
 * PushSubscriptions, env vars propias -- un dominio nunca puede activar
 * Postgres para otro por error de configuración.
 *
 * UN solo switch para Categories y Subcategories (no dos independientes):
 * siempre se leen/escriben juntas, y permitir Category=Postgres con
 * Subcategory=Sheets (o viceversa) sería un estado híbrido que nadie pidió
 * y que complica el materializado sin ningún beneficio real.
 */
import { sheetsCategoriesRepository } from './sheetsRepository'
import { PostgresCategoriesRepository } from './postgresRepository'
import type { CategoriesRepository } from './types'

export type CategoriesStorage = 'sheets' | 'postgres'

export function resolveCategoriesStorage(env: Record<string, string | undefined> = process.env): CategoriesStorage {
  if (env.CATEGORIES_STORAGE !== 'postgres') return 'sheets'
  if (env.VERCEL_ENV === 'production' && env.CATEGORIES_POSTGRES_PRODUCTION_ENABLED !== 'true') return 'sheets'
  return 'postgres'
}

export function getCategoriesRepository(): CategoriesRepository {
  if (
    process.env.CATEGORIES_STORAGE === 'postgres' &&
    process.env.VERCEL_ENV === 'production' &&
    process.env.CATEGORIES_POSTGRES_PRODUCTION_ENABLED !== 'true'
  ) {
    console.error(
      '[CategoriesRepository] CATEGORIES_STORAGE=postgres ignorado en VERCEL_ENV=production ' +
        '(falta CATEGORIES_POSTGRES_PRODUCTION_ENABLED=true). Usando Sheets.'
    )
  }
  const storage = resolveCategoriesStorage()
  if (storage === 'postgres') return new PostgresCategoriesRepository()
  return sheetsCategoriesRepository
}

export type { CategoriesRepository, CategoryRecord, SubcategoryRecord } from './types'
export { SubcategoryDuplicateError, CategoryDuplicateError } from './types'
export { materializeSubcategoriesForUser } from './materialize'
