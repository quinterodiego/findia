import { getDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { TransformedBatch } from './types'

export async function assertTargetTablesEmpty(): Promise<void> {
  const db = getDb()
  const [cats, subs] = await Promise.all([
    db.select({ id: schema.categories.id }).from(schema.categories).limit(1),
    db.select({ id: schema.subcategories.id }).from(schema.subcategories).limit(1),
  ])
  const nonEmpty: string[] = []
  if (cats.length > 0) nonEmpty.push('categories')
  if (subs.length > 0) nonEmpty.push('subcategories')
  if (nonEmpty.length > 0) {
    throw new Error(`Las siguientes tablas destino NO están vacías: ${nonEmpty.join(', ')}. Abortando sin escribir nada.`)
  }
}

export interface ImportResult {
  inserted: { categories: number; subcategories: number }
}

/** Import atómico -- categories primero (subcategories tiene FK hacia
 * categories, tiene que insertarse después en la MISMA transacción). */
export async function importBatch(batch: TransformedBatch): Promise<ImportResult> {
  const db = getDb()
  await db.transaction(async (tx) => {
    if (batch.categories.length > 0) await tx.insert(schema.categories).values(batch.categories)
    if (batch.subcategories.length > 0) await tx.insert(schema.subcategories).values(batch.subcategories)
  })
  return { inserted: { categories: batch.categories.length, subcategories: batch.subcategories.length } }
}
