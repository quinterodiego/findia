/**
 * Fase DB-8.2 — implementación Postgres de CategoriesRepository.
 *
 * Las dos constraints nuevas (`categories_user_name_unique`,
 * `subcategories_category_name_unique`) reemplazan los checks racy
 * read-then-append de Sheets por una garantía real de la base: dos
 * creaciones/seeds concurrentes para el mismo (userId,name) o
 * (categoryId,name) nunca pueden producir un duplicado, sea cual sea el
 * orden de ejecución -- `ON CONFLICT DO NOTHING` en los inserts masivos de
 * defaults, y una violación de constraint traducida a un error de negocio
 * claro en las creaciones puntuales.
 */
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { unwrapPgError } from '@/lib/repositories/sharedGroups/pgErrors'
import { SubcategoryDuplicateError, CategoryDuplicateError } from './types'
import type { CategoryRecord, SubcategoryRecord, CategoriesRepository } from './types'

const UNIQUE_VIOLATION = '23505'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function mapCategory(row: typeof schema.categories.$inferSelect): CategoryRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    color: row.color,
    icon: row.icon,
    type: row.type as CategoryRecord['type'],
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapSubcategory(row: typeof schema.subcategories.$inferSelect): SubcategoryRecord {
  return {
    id: row.id,
    userId: row.userId,
    categoryId: row.categoryId,
    name: row.name,
    icon: row.icon,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
  }
}

export class PostgresCategoriesRepository implements CategoriesRepository {
  private db = getDb()

  async getCategoriesForUser(userId: string): Promise<CategoryRecord[]> {
    const rows = await this.db.select().from(schema.categories).where(eq(schema.categories.userId, userId))
    return rows.map(mapCategory)
  }

  async getAllCategories(): Promise<CategoryRecord[]> {
    const rows = await this.db.select().from(schema.categories)
    return rows.map(mapCategory)
  }

  async createCategory(data: { userId: string; name: string; color: string; icon: string; type: CategoryRecord['type'] }): Promise<CategoryRecord> {
    try {
      const [row] = await this.db
        .insert(schema.categories)
        .values({ id: generateId(), userId: data.userId, name: data.name, color: data.color, icon: data.icon, type: data.type, isDefault: false })
        .returning()
      return mapCategory(row)
    } catch (error) {
      const pgError = unwrapPgError(error)
      if (pgError?.code === UNIQUE_VIOLATION) {
        throw new CategoryDuplicateError('Ya existe una categoría con ese nombre')
      }
      throw error
    }
  }

  async insertDefaultCategoriesIfEmpty(
    userId: string,
    rows: Array<{ name: string; color: string; icon: string; type: CategoryRecord['type']; isDefault: boolean }>
  ): Promise<CategoryRecord[]> {
    const existing = await this.getCategoriesForUser(userId)
    if (existing.length > 0) return existing
    if (rows.length === 0) return []

    await this.db
      .insert(schema.categories)
      .values(rows.map((r) => ({ id: generateId(), userId, name: r.name, color: r.color, icon: r.icon, type: r.type, isDefault: r.isDefault })))
      .onConflictDoNothing({ target: [schema.categories.userId, schema.categories.name] })

    // Releer el estado real -- si otra request concurrente ya insertó
    // algunas (o todas), esto devuelve lo que efectivamente quedó, nunca lo
    // que ESTA llamada creyó haber creado.
    return this.getCategoriesForUser(userId)
  }

  async getAllSubcategories(): Promise<SubcategoryRecord[]> {
    const rows = await this.db.select().from(schema.subcategories)
    return rows.map(mapSubcategory)
  }

  async createSubcategory(categoryId: string, name: string, icon: string): Promise<SubcategoryRecord> {
    try {
      const [row] = await this.db
        .insert(schema.subcategories)
        .values({ id: crypto.randomUUID(), userId: '', categoryId, name, icon: icon || '📌', isDefault: false })
        .returning()
      return mapSubcategory(row)
    } catch (error) {
      const pgError = unwrapPgError(error)
      if (pgError?.code === UNIQUE_VIOLATION) {
        throw new SubcategoryDuplicateError('Ya existe una subcategoría con este nombre para esta categoría')
      }
      throw error
    }
  }

  async insertDefaultSubcategories(rows: Array<{ categoryId: string; name: string; icon: string; isDefault: boolean }>): Promise<SubcategoryRecord[]> {
    if (rows.length === 0) return []
    const inserted = await this.db
      .insert(schema.subcategories)
      .values(rows.map((r) => ({ id: crypto.randomUUID(), userId: '', categoryId: r.categoryId, name: r.name, icon: r.icon, isDefault: r.isDefault })))
      .onConflictDoNothing({ target: [schema.subcategories.categoryId, schema.subcategories.name] })
      .returning()
    return inserted.map(mapSubcategory)
  }
}
