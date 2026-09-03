import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { CategoriesSnapshot } from './types'

export interface VerifyIssue {
  severity: 'CRITICAL'
  code: string
  message: string
}
export interface VerifyResult {
  ok: boolean
  issues: VerifyIssue[]
  counts: { categories: { snapshot: number; postgres: number }; subcategories: { snapshot: number; postgres: number } }
}

function critical(code: string, message: string): VerifyIssue {
  return { severity: 'CRITICAL', code, message }
}

export async function verifyImport(snapshot: CategoriesSnapshot): Promise<VerifyResult> {
  const db = getDb()
  const [pgCategories, pgSubcategories] = await Promise.all([db.select().from(schema.categories), db.select().from(schema.subcategories)])
  const issues: VerifyIssue[] = []

  const validCats = snapshot.categories.filter((c) => c.id && c.id.trim() !== '')
  const validSubs = snapshot.subcategories.filter((s) => s.id && s.id.trim() !== '')

  const counts = {
    categories: { snapshot: validCats.length, postgres: pgCategories.length },
    subcategories: { snapshot: validSubs.length, postgres: pgSubcategories.length },
  }
  if (counts.categories.snapshot !== counts.categories.postgres) {
    issues.push(critical('CATEGORY_COUNT_MISMATCH', `snapshot=${counts.categories.snapshot} postgres=${counts.categories.postgres}`))
  }
  if (counts.subcategories.snapshot !== counts.subcategories.postgres) {
    issues.push(critical('SUBCATEGORY_COUNT_MISMATCH', `snapshot=${counts.subcategories.snapshot} postgres=${counts.subcategories.postgres}`))
  }

  const pgCatById = new Map(pgCategories.map((c) => [c.id, c]))
  for (const cat of validCats) {
    const pg = pgCatById.get(cat.id)
    if (!pg) {
      issues.push(critical('MISSING_CATEGORY', `category ${cat.id} del snapshot no está en Postgres`))
      continue
    }
    if (pg.userId !== cat.userId) issues.push(critical('CATEGORY_USER_ID_MISMATCH', `category ${cat.id}: userId no coincide`))
    if (pg.name !== cat.name) issues.push(critical('CATEGORY_NAME_MISMATCH', `category ${cat.id}: name no coincide`))
    if (pg.color !== cat.color) issues.push(critical('CATEGORY_COLOR_MISMATCH', `category ${cat.id}: color no coincide`))
    if (pg.icon !== cat.icon) issues.push(critical('CATEGORY_ICON_MISMATCH', `category ${cat.id}: icon no coincide`))
    if (pg.type !== cat.type) issues.push(critical('CATEGORY_TYPE_MISMATCH', `category ${cat.id}: type no coincide`))
    if (pg.isDefault !== (cat.isDefault === 'true')) issues.push(critical('CATEGORY_IS_DEFAULT_MISMATCH', `category ${cat.id}: isDefault no coincide`))
  }

  const pgSubById = new Map(pgSubcategories.map((s) => [s.id, s]))
  for (const sub of validSubs) {
    const pg = pgSubById.get(sub.id)
    if (!pg) {
      issues.push(critical('MISSING_SUBCATEGORY', `subcategory ${sub.id} del snapshot no está en Postgres`))
      continue
    }
    if (pg.userId !== sub.userId) issues.push(critical('SUBCATEGORY_USER_ID_MISMATCH', `subcategory ${sub.id}: userId no coincide`))
    if (pg.categoryId !== sub.categoryId) issues.push(critical('SUBCATEGORY_CATEGORY_ID_MISMATCH', `subcategory ${sub.id}: categoryId no coincide`))
    if (pg.name !== sub.name) issues.push(critical('SUBCATEGORY_NAME_MISMATCH', `subcategory ${sub.id}: name no coincide`))
    if (pg.icon !== sub.icon) issues.push(critical('SUBCATEGORY_ICON_MISMATCH', `subcategory ${sub.id}: icon no coincide`))
  }

  return { ok: issues.length === 0, issues, counts }
}
