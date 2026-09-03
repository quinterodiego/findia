/**
 * Fase DB-8.2 — lógica de materialización de subcategorías, extraída tal
 * cual de `app/api/subcategories/route.ts` (antes vivía inline en el
 * handler, mezclada con las llamadas a Sheets). Pura y agnóstica de
 * backend: recibe arrays ya leídos (de Sheets o Postgres, da igual) y
 * reproduce EXACTAMENTE el mismo comportamiento de antes --
 * Subcategories son un catálogo global agrupado por *tipo* de categoría
 * (no por categoryId puntual), y cada usuario ve una copia sintética por
 * cada categoría propia de ese tipo, con un id determinístico
 * `${subcategoríaGlobal.id}-${categoríaDelUsuario.id}` que NUNCA es una fila
 * real -- se reconstruye en cada request.
 *
 * Esto es intencionalmente el modelo actual, no una versión normalizada --
 * la auditoría DB-8 Audit señaló que normalizar sería mejor a futuro, pero
 * esta fase es una migración de infraestructura, no un rediseño de producto.
 */
import type { CategoryRecord, SubcategoryRecord } from './types'

export function materializeSubcategoriesForUser(
  userCategories: Array<{ id: string; type: string }>,
  allCategories: CategoryRecord[],
  allSubcategories: SubcategoryRecord[]
): SubcategoryRecord[] {
  const categoryIdToType = new Map<string, string>()
  for (const cat of allCategories) categoryIdToType.set(cat.id, cat.type)

  const userCategoryTypes = new Set(userCategories.map((cat) => cat.type))

  // Agrupar todas las subcategorías por tipo de categoría, eliminando
  // duplicados por nombre dentro del mismo tipo.
  const subcategoriesByType = new Map<string, Map<string, SubcategoryRecord>>()
  for (const subcat of allSubcategories) {
    const categoryType = categoryIdToType.get(subcat.categoryId)
    if (!categoryType || !userCategoryTypes.has(categoryType)) continue

    if (!subcategoriesByType.has(categoryType)) {
      subcategoriesByType.set(categoryType, new Map())
    }
    const typeMap = subcategoriesByType.get(categoryType)!
    if (!typeMap.has(subcat.name)) {
      typeMap.set(subcat.name, subcat)
    }
  }

  // Mapear las subcategorías globales a TODAS las categorías del usuario
  // del mismo tipo -- una copia sintética por cada combinación.
  const userSubcategories: SubcategoryRecord[] = []
  const processedKeys = new Set<string>()

  for (const [categoryType, uniqueSubcats] of subcategoriesByType.entries()) {
    const userCategoriesOfType = userCategories.filter((cat) => cat.type === categoryType)

    for (const globalSubcat of uniqueSubcats.values()) {
      for (const userCategory of userCategoriesOfType) {
        const uniqueKey = `${globalSubcat.name}-${userCategory.id}`
        if (!processedKeys.has(uniqueKey)) {
          userSubcategories.push({
            ...globalSubcat,
            categoryId: userCategory.id,
            id: `${globalSubcat.id}-${userCategory.id}`,
          })
          processedKeys.add(uniqueKey)
        }
      }
    }
  }

  return userSubcategories
}
