/**
 * Fase DB-8.2 — contract tests de PostgresCategoriesRepository contra un
 * Postgres real. Confirma que las constraints nuevas (UNIQUE(userId,name),
 * UNIQUE(categoryId,name), FK subcategories→categories) eliminan las races
 * de duplicados que ya documentó DB-8 Audit, sin romper ningún caller real.
 *
 * NOTA: no existe update/delete para Category ni Subcategory en la API real
 * hoy (confirmado por auditoría -- `updateCategory`/`deleteCategory` del
 * hook `useCategories.ts` son código muerto, no hay ruta `[id]`), así que
 * este contract test no los cubre -- no hay nada que migrar ahí.
 */
import { PostgresCategoriesRepository } from '../lib/repositories/categories/postgresRepository'
import { materializeSubcategoriesForUser } from '../lib/repositories/categories/materialize'
import { SubcategoryDuplicateError, CategoryDuplicateError } from '../lib/repositories/categories/types'
import { closePool } from '../lib/db/client'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

const repo = new PostgresCategoriesRepository()
const ts = Date.now()
const USER_A = `contract-test-user-a-${ts}@example.com`
const USER_B = `contract-test-user-b-${ts}@example.com`

async function main() {
  console.log('\n--- create (categories) ---')
  const catA = await repo.createCategory({ userId: USER_A, name: 'Comida', color: '#fff', icon: '🍔', type: 'expense' })
  check('category creada', !!catA.id && catA.userId === USER_A && catA.isDefault === false)

  console.log('\n--- list (getCategoriesForUser) ---')
  let userCats = await repo.getCategoriesForUser(USER_A)
  check('aparece para el usuario', userCats.length === 1 && userCats[0].id === catA.id)

  console.log('\n--- user/global filtering: otro usuario no la ve ---')
  const userCatsB = await repo.getCategoriesForUser(USER_B)
  check('user B no ve las categorías de user A', userCatsB.length === 0)

  console.log('\n--- duplicate (categories): mismo userId+name ---')
  let dupError: unknown = null
  try {
    await repo.createCategory({ userId: USER_A, name: 'Comida', color: '#000', icon: '🍕', type: 'expense' })
  } catch (e) {
    dupError = e
  }
  check('duplicado rechazado con CategoryDuplicateError', dupError instanceof CategoryDuplicateError)
  userCats = await repo.getCategoriesForUser(USER_A)
  check('sigue habiendo 1 sola categoría (no quedó fila parcial)', userCats.length === 1)

  console.log('\n--- mismo nombre, usuario DISTINTO -> permitido (constraint es por usuario) ---')
  const catB = await repo.createCategory({ userId: USER_B, name: 'Comida', color: '#111', icon: '🍜', type: 'expense' })
  check('user B puede tener su propia "Comida"', !!catB.id && catB.id !== catA.id)

  console.log('\n--- insertDefaultCategoriesIfEmpty: usuario nuevo ---')
  const USER_C = `contract-test-user-c-${ts}@example.com`
  const defaults = [
    { name: 'Ingresos', color: '#1', icon: '💰', type: 'income' as const, isDefault: true },
    { name: 'Gasto Fijo', color: '#2', icon: '🏠', type: 'expense' as const, isDefault: true },
  ]
  const seeded = await repo.insertDefaultCategoriesIfEmpty(USER_C, defaults)
  check('se crearon las 2 categorías default', seeded.length === 2)

  console.log('\n--- insertDefaultCategoriesIfEmpty: usuario que YA tiene categorías -> no reinserta ---')
  const seededAgain = await repo.insertDefaultCategoriesIfEmpty(USER_C, defaults)
  check('devuelve las mismas 2 (no duplica)', seededAgain.length === 2)

  console.log('\n--- concurrencia: 2 llamadas simultáneas a insertDefaultCategoriesIfEmpty para el MISMO usuario nuevo ---')
  const USER_D = `contract-test-user-d-${ts}@example.com`
  const [r1, r2] = await Promise.all([
    repo.insertDefaultCategoriesIfEmpty(USER_D, defaults),
    repo.insertDefaultCategoriesIfEmpty(USER_D, defaults),
  ])
  check('ambas llamadas ven el mismo resultado final (2 categorías)', r1.length === 2 && r2.length === 2)
  const finalD = await repo.getCategoriesForUser(USER_D)
  check('nunca se duplicó por la concurrencia -- exactamente 2 filas en la base', finalD.length === 2, finalD.length)

  console.log('\n--- subcategory relationship ---')
  const sub1 = await repo.createSubcategory(catA.id, 'Delivery', '🛵')
  check('subcategory creada, ligada a la categoría', sub1.categoryId === catA.id)

  console.log('\n--- duplicate (subcategories): mismo categoryId+name ---')
  let subDupError: unknown = null
  try {
    await repo.createSubcategory(catA.id, 'Delivery', '🚗')
  } catch (e) {
    subDupError = e
  }
  check('duplicado rechazado con SubcategoryDuplicateError', subDupError instanceof SubcategoryDuplicateError)

  console.log('\n--- mismo nombre, categoría DISTINTA -> permitido ---')
  const sub2 = await repo.createSubcategory(catB.id, 'Delivery', '🛵')
  check('categoría B puede tener su propia "Delivery"', !!sub2.id && sub2.id !== sub1.id)

  console.log('\n--- materialización (lógica pura, agnóstica de backend) ---')
  const allCategories = await repo.getAllCategories()
  const allSubcategories = await repo.getAllSubcategories()
  const materializedForA = materializeSubcategoriesForUser([{ id: catA.id, type: 'expense' }], allCategories, allSubcategories)
  // El id siempre es sintético (`${globalId}-${userCategoryId}`), incluso
  // cuando la categoría del usuario ES la que originalmente creó la
  // subcategoría -- mismo comportamiento EXACTO que ya tenía Sheets (nunca
  // devuelve el id real de la fila, siempre reconstruye). Se verifica el
  // contenido (name/categoryId), no el id literal.
  check(
    'user A ve "Delivery" materializada contra su propia categoría',
    materializedForA.some((s) => s.name === 'Delivery' && s.categoryId === catA.id && s.id === `${sub1.id}-${catA.id}`)
  )

  console.log('\n--- CLEANUP ---')
  // No hay delete real para Category/Subcategory en la API (confirmado por
  // auditoría) -- limpiar directo con SQL, algo que el repository real
  // nunca necesita hacer.
  const { getDb } = await import('../lib/db/client')
  const schema = await import('../lib/db/schema')
  const { inArray } = await import('drizzle-orm')
  const db = getDb()
  await db.delete(schema.subcategories).where(inArray(schema.subcategories.categoryId, [catA.id, catB.id]))
  await db.delete(schema.categories).where(inArray(schema.categories.userId, [USER_A, USER_B, USER_C, USER_D]))

  const residualCats = await repo.getAllCategories()
  const residualTestCats = residualCats.filter((c) => [USER_A, USER_B, USER_C, USER_D].includes(c.userId))
  check('0 categorías de test residuales', residualTestCats.length === 0, residualTestCats.length)

  console.log(`\n${failures === 0 ? 'TODOS LOS CONTRACT TESTS DE DB-8.2 PASARON' : `${failures} TEST(S) FALLARON`}`)
}

main()
  .then(async () => {
    await closePool()
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch(async (e) => {
    console.error('Error fatal:', e)
    await closePool().catch(() => {})
    process.exit(1)
  })
