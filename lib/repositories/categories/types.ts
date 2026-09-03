/**
 * Fase DB-8.2 — frontera de persistencia para Categories + Subcategories.
 * Un solo dominio/repository para ambas entidades a propósito: siempre se
 * leen/escriben juntas (el materializado de subcategorías por usuario
 * depende de las categorías del usuario), y usar dos switches independientes
 * podría dejar Category=Postgres/Subcategory=Sheets a mitad de camino --
 * un estado que no tiene sentido y que nadie pidió soportar.
 *
 * `userId` en ambas entidades se preserva exactamente como en Sheets (ver
 * comentario en lib/db/schema.ts) -- nunca normalizado acá.
 */

export interface CategoryRecord {
  id: string
  userId: string
  name: string
  color: string
  icon: string
  type: 'income' | 'expense' | 'saving' | 'custom'
  isDefault: boolean
  createdAt: string
}

export interface SubcategoryRecord {
  id: string
  userId: string
  categoryId: string
  name: string
  icon: string
  isDefault: boolean
  createdAt: string
}

/** Lanzado por `createSubcategory` cuando ya existe una subcategoría con
 * ese mismo (categoryId, name) -- mismo criterio de duplicado que Sheets
 * ya usaba, ahora garantizado por constraint en vez de un check racy. */
export class SubcategoryDuplicateError extends Error {}

/** Lanzado por `createCategory` (solo en Postgres) cuando el usuario ya
 * tiene una categoría con ese nombre -- constraint NUEVA, Sheets nunca
 * validó esto (podía crear duplicados libremente). */
export class CategoryDuplicateError extends Error {}

export interface CategoriesRepository {
  // --- categories ---------------------------------------------------------
  getCategoriesForUser(userId: string): Promise<CategoryRecord[]>
  /** TODAS las categorías, de todos los usuarios -- necesario para construir
   * el mapa categoryId→type que usa el materializado de subcategorías
   * (Subcategories son globales, no se puede acotar por usuario). */
  getAllCategories(): Promise<CategoryRecord[]>
  createCategory(data: { userId: string; name: string; color: string; icon: string; type: CategoryRecord['type'] }): Promise<CategoryRecord>
  /** Inserta el set de categorías default para un usuario que todavía no
   * tiene ninguna. Idempotente por diseño (ON CONFLICT DO NOTHING en
   * Postgres) -- dos llamadas concurrentes nunca duplican filas. Devuelve
   * el estado final real (por si otra request ya insertó algunas). */
  insertDefaultCategoriesIfEmpty(
    userId: string,
    rows: Array<{ name: string; color: string; icon: string; type: CategoryRecord['type']; isDefault: boolean }>
  ): Promise<CategoryRecord[]>

  // --- subcategories ---------------------------------------------------------
  /** TODAS las subcategorías, de todas las categorías -- son globales. */
  getAllSubcategories(): Promise<SubcategoryRecord[]>
  /** Lanza `SubcategoryDuplicateError` si ya existe (categoryId, name). */
  createSubcategory(categoryId: string, name: string, icon: string): Promise<SubcategoryRecord>
  /** Inserta el set de subcategorías default para las categorías dadas,
   * ignorando las que ya existan (mismo criterio de idempotencia que
   * insertDefaultCategoriesIfEmpty). Devuelve las filas tal como se
   * intentaron crear (mismo criterio que ya usaba Sheets: nunca vuelve a
   * leer para confirmar, solo refleja lo que esta llamada envió). */
  insertDefaultSubcategories(rows: Array<{ categoryId: string; name: string; icon: string; isDefault: boolean }>): Promise<SubcategoryRecord[]>
}
