import type { CategoriesSnapshot, ValidationIssue, ValidationResult } from './types'

function critical(entity: 'category' | 'subcategory', code: string, rowIndex: number | undefined, message: string): ValidationIssue {
  return { severity: 'CRITICAL', code, entity, rowIndex, message }
}
function warning(entity: 'category' | 'subcategory', code: string, rowIndex: number | undefined, message: string): ValidationIssue {
  return { severity: 'WARNING', code, entity, rowIndex, message }
}

export function validateSnapshot(snapshot: CategoriesSnapshot): ValidationResult {
  const issues: ValidationIssue[] = []
  const { categories, subcategories } = snapshot

  const categoryIds = new Set<string>()
  const categoryIdCounts = new Map<string, number>()
  const categoryUserNameCounts = new Map<string, number[]>()

  for (const cat of categories) {
    if (!cat.id || cat.id.trim() === '') {
      issues.push(critical('category', 'EMPTY_ID', cat.rowIndex, 'id vacío'))
      continue
    }
    categoryIds.add(cat.id)
    categoryIdCounts.set(cat.id, (categoryIdCounts.get(cat.id) || 0) + 1)

    if (!cat.userId || cat.userId.trim() === '') issues.push(critical('category', 'EMPTY_USER_ID', cat.rowIndex, `userId vacío para categoría ${cat.id}`))
    if (!cat.name || cat.name.trim() === '') issues.push(critical('category', 'EMPTY_NAME', cat.rowIndex, `name vacío para categoría ${cat.id}`))
    if (!cat.color) issues.push(warning('category', 'EMPTY_COLOR', cat.rowIndex, `color vacío para categoría ${cat.id}`))
    if (!cat.icon) issues.push(warning('category', 'EMPTY_ICON', cat.rowIndex, `icon vacío para categoría ${cat.id}`))
    if (!['income', 'expense', 'saving', 'custom'].includes(cat.type)) {
      issues.push(warning('category', 'UNEXPECTED_TYPE', cat.rowIndex, `type inesperado: "${cat.type}"`))
    }
    if (!cat.createdAt || isNaN(new Date(cat.createdAt).getTime())) {
      issues.push(warning('category', 'INVALID_CREATED_AT', cat.rowIndex, `createdAt inválido: "${cat.createdAt}"`))
    }

    const key = `${cat.userId}|||${cat.name}`
    const list = categoryUserNameCounts.get(key) || []
    list.push(cat.rowIndex)
    categoryUserNameCounts.set(key, list)
  }

  for (const [id, count] of categoryIdCounts.entries()) {
    if (count > 1) issues.push(critical('category', 'DUPLICATE_ID', undefined, `category id "${id}" aparece ${count} veces`))
  }
  for (const [key, rows] of categoryUserNameCounts.entries()) {
    if (rows.length > 1) {
      const [userId, name] = key.split('|||')
      issues.push(
        critical(
          'category',
          'DUPLICATE_USER_NAME',
          undefined,
          `userId="${userId}" ya tiene ${rows.length} categorías llamadas "${name}" (filas ${rows.join(', ')}) -- la constraint UNIQUE(userId,name) rechazaría este import tal cual`
        )
      )
    }
  }

  const subcategoryIdCounts = new Map<string, number>()
  const subcategoryCategoryNameCounts = new Map<string, number[]>()

  for (const sub of subcategories) {
    if (!sub.id || sub.id.trim() === '') {
      issues.push(critical('subcategory', 'EMPTY_ID', sub.rowIndex, 'id vacío'))
      continue
    }
    subcategoryIdCounts.set(sub.id, (subcategoryIdCounts.get(sub.id) || 0) + 1)

    if (!sub.categoryId || sub.categoryId.trim() === '') {
      issues.push(critical('subcategory', 'EMPTY_CATEGORY_ID', sub.rowIndex, `categoryId vacío para subcategoría ${sub.id}`))
    } else if (!categoryIds.has(sub.categoryId)) {
      issues.push(
        critical(
          'subcategory',
          'ORPHAN_CATEGORY',
          sub.rowIndex,
          `categoryId "${sub.categoryId}" (subcategoría ${sub.id}, "${sub.name}") no existe en Categories -- la FK rechazaría este import tal cual`
        )
      )
    }
    if (!sub.name || sub.name.trim() === '') issues.push(critical('subcategory', 'EMPTY_NAME', sub.rowIndex, `name vacío para subcategoría ${sub.id}`))
    if (!sub.icon) issues.push(warning('subcategory', 'EMPTY_ICON', sub.rowIndex, `icon vacío para subcategoría ${sub.id}`))
    if (!sub.createdAt || isNaN(new Date(sub.createdAt).getTime())) {
      issues.push(warning('subcategory', 'INVALID_CREATED_AT', sub.rowIndex, `createdAt inválido: "${sub.createdAt}"`))
    }
    if (sub.userId && sub.userId.trim() !== '') {
      issues.push(warning('subcategory', 'NON_EMPTY_USER_ID', sub.rowIndex, `userId="${sub.userId}" (se preserva, pero el modelo actual nunca lo usa para filtrar)`))
    }

    if (sub.categoryId && sub.name) {
      const key = `${sub.categoryId}|||${sub.name}`
      const list = subcategoryCategoryNameCounts.get(key) || []
      list.push(sub.rowIndex)
      subcategoryCategoryNameCounts.set(key, list)
    }
  }

  for (const [id, count] of subcategoryIdCounts.entries()) {
    if (count > 1) issues.push(critical('subcategory', 'DUPLICATE_ID', undefined, `subcategory id "${id}" aparece ${count} veces`))
  }
  for (const [key, rows] of subcategoryCategoryNameCounts.entries()) {
    if (rows.length > 1) {
      const [categoryId, name] = key.split('|||')
      issues.push(
        critical(
          'subcategory',
          'DUPLICATE_CATEGORY_NAME',
          undefined,
          `categoryId="${categoryId}" ya tiene ${rows.length} subcategorías llamadas "${name}" (filas ${rows.join(', ')}) -- la constraint UNIQUE(categoryId,name) rechazaría este import tal cual`
        )
      )
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length

  return { issues, criticalCount, warningCount, importable: criticalCount === 0 }
}
