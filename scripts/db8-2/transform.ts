import type { CategoriesSnapshot, TransformedBatch } from './types'

function toDate(value: string): Date {
  const d = new Date(value)
  return isNaN(d.getTime()) ? new Date() : d
}

/** IDs, userId, name, color, icon, type -- todo preservado tal cual, nunca
 * reinterpretado. Solo se convierten tipos (string 'true'/'false' -> boolean,
 * string ISO -> Date). */
export function transformSnapshot(snapshot: CategoriesSnapshot): TransformedBatch {
  const categories = snapshot.categories
    .filter((c) => c.id && c.id.trim() !== '')
    .map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      color: c.color,
      icon: c.icon,
      type: c.type,
      isDefault: c.isDefault === 'true',
      createdAt: toDate(c.createdAt),
    }))

  const subcategories = snapshot.subcategories
    .filter((s) => s.id && s.id.trim() !== '')
    .map((s) => ({
      id: s.id,
      userId: s.userId,
      categoryId: s.categoryId,
      name: s.name,
      icon: s.icon,
      isDefault: s.isDefault === 'true',
      createdAt: toDate(s.createdAt),
    }))

  return { categories, subcategories }
}
