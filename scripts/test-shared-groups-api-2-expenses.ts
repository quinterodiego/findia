/**
 * Fase 2 — Tests API: expenses (parte 2/3). Ver parte 1 para la nota sobre
 * por qué se llama directamente a las funciones planas de cada route.ts.
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-groups-api-2-expenses.ts dotenv_config_path=.env.local
 */
import { createSharedGroupMember } from '../lib/googleSheets'
import { createSharedGroupForUser } from '../app/api/shared-groups/handlers'
import { deleteSharedGroupForUser } from '../app/api/shared-groups/[id]/handlers'
import { addSharedGroupMemberForUser } from '../app/api/shared-groups/[id]/members/handlers'
import { deleteSharedGroupMemberForUser } from '../app/api/shared-groups/[id]/members/[memberId]/handlers'
import { listSharedGroupExpensesForUser, createSharedGroupExpenseForUser } from '../app/api/shared-groups/[id]/expenses/handlers'
import { updateSharedGroupExpenseForUser, deleteSharedGroupExpenseForUser } from '../app/api/shared-groups/[id]/expenses/[expenseId]/handlers'
import { ApiError } from '../app/api/shared-groups/_lib/apiError'

const DIEGO_USER_ID = '100827254183186994825'
const OTHER_USER_ID = 'fake-other-user-test-999'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

async function expectApiError(label: string, expectedStatus: number, fn: () => Promise<unknown>) {
  try {
    await fn()
    check(label, false, 'no lanzó ningún error')
  } catch (e) {
    if (e instanceof ApiError) check(label, e.status === expectedStatus, { status: e.status, message: e.message })
    else check(label, false, `no es ApiError: ${(e as Error).message}`)
  }
}

async function main() {
  let groupId: string | null = null
  let lauraMemberId: string | null = null
  let otherMemberId: string | null = null
  let expenseId: string | null = null

  try {
    const { group, creatorMember } = await createSharedGroupForUser(
      DIEGO_USER_ID,
      { name: 'Diego (test)' },
      { name: 'Casa Expenses (test)' }
    )
    groupId = group.id
    const diegoMemberId = creatorMember.id
    const laura = await addSharedGroupMemberForUser(groupId, DIEGO_USER_ID, { name: 'Laura API (test)' })
    lauraMemberId = laura.id
    // Miembro vinculado a un segundo "usuario" real, creado directo por lib (no por la ruta) solo
    // para poder simular en este test que OTHER_USER_ID es miembro autenticado del grupo.
    const otherMember = await createSharedGroupMember(groupId, { name: 'Otro Usuario (test)', userId: OTHER_USER_ID })
    otherMemberId = otherMember.id

    console.log('\n=== Q) Gasto equal entre TODOS (sin participantMemberIds) ===')
    const equalAll = await createSharedGroupExpenseForUser(groupId, DIEGO_USER_ID, {
      description: 'Supermercado (test)',
      amount: 40000,
      currency: 'pesos',
      paidByMemberId: diegoMemberId,
      date: '2026-08-15',
      splitType: 'equal',
    })
    expenseId = equalAll.expense.id
    check('3 splits (todos los miembros)', equalAll.splits.length === 3, equalAll.splits.length)
    check(
      'Splits suman el total',
      equalAll.splits.reduce((s: number, x: { amount: number }) => s + x.amount, 0) === 40000
    )

    console.log('\n=== R) Gasto equal SOLO subset ===')
    const equalSubset = await createSharedGroupExpenseForUser(groupId, DIEGO_USER_ID, {
      description: 'Solo Diego y Laura (test)',
      amount: 10000,
      currency: 'pesos',
      paidByMemberId: diegoMemberId,
      date: '2026-08-16',
      splitType: 'equal',
      participantMemberIds: [diegoMemberId, lauraMemberId],
    })
    check('2 splits (subset)', equalSubset.splits.length === 2)
    await deleteSharedGroupExpenseForUser(groupId, equalSubset.expense.id, DIEGO_USER_ID)

    console.log('\n=== S) Gasto amount válido / T) suma inválida -> 400 ===')
    const amountExpense = await createSharedGroupExpenseForUser(groupId, DIEGO_USER_ID, {
      description: 'Monto exacto (test)',
      amount: 90000,
      currency: 'pesos',
      paidByMemberId: diegoMemberId,
      date: '2026-08-17',
      splitType: 'amount',
      splits: [
        { memberId: diegoMemberId, amount: 60000 },
        { memberId: lauraMemberId, amount: 30000 },
      ],
    })
    check('Gasto amount creado', amountExpense.expense.amount === 90000)
    await deleteSharedGroupExpenseForUser(groupId, amountExpense.expense.id, DIEGO_USER_ID)

    await expectApiError('Suma inválida -> 400', 400, () =>
      createSharedGroupExpenseForUser(groupId!, DIEGO_USER_ID, {
        description: 'Suma inválida (test)',
        amount: 1000,
        currency: 'pesos',
        paidByMemberId: diegoMemberId,
        date: '2026-08-17',
        splitType: 'amount',
        splits: [{ memberId: diegoMemberId, amount: 999 }],
      })
    )

    console.log('\n=== U) Payer ajeno al grupo -> 400 / V) shadow member como payer -> válido ===')
    await expectApiError('Payer ajeno -> 400', 400, () =>
      createSharedGroupExpenseForUser(groupId!, DIEGO_USER_ID, {
        description: 'Payer ajeno (test)',
        amount: 1000,
        currency: 'pesos',
        paidByMemberId: 'miembro-inexistente',
        date: '2026-08-17',
        splitType: 'equal',
      })
    )
    const shadowPayerExpense = await createSharedGroupExpenseForUser(groupId, DIEGO_USER_ID, {
      description: 'Internet pagado por Laura (test)',
      amount: 20000,
      currency: 'pesos',
      paidByMemberId: lauraMemberId,
      date: '2026-08-18',
      splitType: 'equal',
    })
    check('Shadow member como payer', shadowPayerExpense.expense.paidByMemberId === lauraMemberId)
    check('createdBy es quien cargó (Diego), no el payer', shadowPayerExpense.expense.createdBy === DIEGO_USER_ID)
    await deleteSharedGroupExpenseForUser(groupId, shadowPayerExpense.expense.id, DIEGO_USER_ID)

    console.log('\n=== W) Otro miembro autenticado puede crear gasto ===')
    const byOther = await createSharedGroupExpenseForUser(groupId, OTHER_USER_ID, {
      description: 'Cargado por otro miembro (test)',
      amount: 5000,
      currency: 'pesos',
      paidByMemberId: otherMemberId,
      date: '2026-08-19',
      splitType: 'equal',
    })
    check('Otro miembro pudo crear el gasto', byOther.expense.createdBy === OTHER_USER_ID)
    await deleteSharedGroupExpenseForUser(groupId, byOther.expense.id, OTHER_USER_ID)

    console.log('\n=== §14: cambiar currency sin splits -> 400 ===')
    await expectApiError('Sin splits -> 400', 400, () => updateSharedGroupExpenseForUser(groupId!, expenseId!, DIEGO_USER_ID, { currency: 'usd' }))

    console.log('\n=== §13: cambiar amount con equal recalcula splits ===')
    const resized = await updateSharedGroupExpenseForUser(groupId, expenseId!, DIEGO_USER_ID, { amount: 60000, splitType: 'equal' })
    check('Monto actualizado', resized.amount === 60000)
    const listAfterResize = await listSharedGroupExpensesForUser(groupId, DIEGO_USER_ID)
    const thisExp = listAfterResize.find((e) => e.id === expenseId)
    check(
      'Splits recalculados suman el nuevo monto',
      (thisExp?.splits || []).reduce((s: number, x: { amount: number }) => s + x.amount, 0) === 60000
    )

    console.log('\n=== X) Solo el autor edita / Y) Solo el autor borra ===')
    await expectApiError('No-autor edita -> 403', 403, () => updateSharedGroupExpenseForUser(groupId!, expenseId!, OTHER_USER_ID, { description: 'Hackeado' }))
    await expectApiError('No-autor borra -> 403', 403, () => deleteSharedGroupExpenseForUser(groupId!, expenseId!, OTHER_USER_ID))

    console.log('\n=== O) No se puede borrar miembro con movimientos -> 409 ===')
    await expectApiError('Diego (paga el gasto) -> 409', 409, () => deleteSharedGroupMemberForUser(groupId!, diegoMemberId, DIEGO_USER_ID))

    console.log('\n=== Z) Borrar el gasto elimina también sus splits ===')
    await deleteSharedGroupExpenseForUser(groupId, expenseId, DIEGO_USER_ID)
    const listAfterDelete = await listSharedGroupExpensesForUser(groupId, DIEGO_USER_ID)
    check('El gasto ya no existe', !listAfterDelete.some((e) => e.id === expenseId))
    expenseId = null

    console.log('\n=== Limpieza ===')
    await deleteSharedGroupMemberForUser(groupId, lauraMemberId, DIEGO_USER_ID)
    lauraMemberId = null
    await deleteSharedGroupMemberForUser(groupId, otherMemberId, DIEGO_USER_ID)
    otherMemberId = null
    await deleteSharedGroupForUser(groupId, DIEGO_USER_ID)
    groupId = null
  } finally {
    try {
      if (expenseId) await deleteSharedGroupExpenseForUser(groupId!, expenseId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup expense:', e)
    }
    try {
      if (lauraMemberId) await deleteSharedGroupMemberForUser(groupId!, lauraMemberId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup laura:', e)
    }
    try {
      if (otherMemberId) await deleteSharedGroupMemberForUser(groupId!, otherMemberId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup other:', e)
    }
    try {
      if (groupId) await deleteSharedGroupForUser(groupId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup group:', e)
    }
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS (parte 2) PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
