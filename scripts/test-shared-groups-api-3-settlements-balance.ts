/**
 * Fase 2 — Tests API: settlements + balance (parte 3/3). Ver parte 1 para la
 * nota sobre por qué se llama directamente a las funciones planas.
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-groups-api-3-settlements-balance.ts dotenv_config_path=.env.local
 */
import { createSharedGroupForUser } from '../app/api/shared-groups/handlers'
import { deleteSharedGroupForUser } from '../app/api/shared-groups/[id]/handlers'
import { addSharedGroupMemberForUser } from '../app/api/shared-groups/[id]/members/handlers'
import { deleteSharedGroupMemberForUser } from '../app/api/shared-groups/[id]/members/[memberId]/handlers'
import { createSharedGroupExpenseForUser } from '../app/api/shared-groups/[id]/expenses/handlers'
import { deleteSharedGroupExpenseForUser } from '../app/api/shared-groups/[id]/expenses/[expenseId]/handlers'
import { listSharedGroupSettlementsForUser, createSharedGroupSettlementForUser } from '../app/api/shared-groups/[id]/settlements/handlers'
import { updateSharedGroupSettlementForUser, deleteSharedGroupSettlementForUser } from '../app/api/shared-groups/[id]/settlements/[settlementId]/handlers'
import { getSharedGroupBalanceForUser } from '../app/api/shared-groups/[id]/balance/handlers'
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
  let expenseId: string | null = null
  let settlementId: string | null = null
  let secondSettlementId: string | null = null

  try {
    const { group, creatorMember } = await createSharedGroupForUser(
      DIEGO_USER_ID,
      { name: 'Diego (test)' },
      { name: 'Casa Settlements (test)' }
    )
    groupId = group.id
    const diegoMemberId = creatorMember.id
    const laura = await addSharedGroupMemberForUser(groupId, DIEGO_USER_ID, { name: 'Laura API (test)' })
    lauraMemberId = laura.id

    // Diego paga $60.000, split igual -> Laura debe $30.000 a Diego.
    const expense = await createSharedGroupExpenseForUser(groupId, DIEGO_USER_ID, {
      description: 'Base para settlements (test)',
      amount: 60000,
      currency: 'pesos',
      paidByMemberId: diegoMemberId,
      date: '2026-08-15',
      splitType: 'equal',
    })
    expenseId = expense.expense.id

    console.log('\n=== AA) Settlement válido / AB) overpayment -> 400 / AD) paidBy===paidTo -> 400 ===')
    const settlement = await createSharedGroupSettlementForUser(groupId, DIEGO_USER_ID, {
      paidByMemberId: lauraMemberId,
      paidToMemberId: diegoMemberId,
      amount: 10000,
      currency: 'pesos',
      date: '2026-08-20',
    })
    settlementId = settlement.id
    check('Settlement creado', settlement.amount === 10000)

    await expectApiError('Overpayment -> 400', 400, () =>
      createSharedGroupSettlementForUser(groupId!, DIEGO_USER_ID, {
        paidByMemberId: lauraMemberId!,
        paidToMemberId: diegoMemberId,
        amount: 999999,
        currency: 'pesos',
        date: '2026-08-21',
      })
    )
    await expectApiError('paidBy===paidTo -> 400', 400, () =>
      createSharedGroupSettlementForUser(groupId!, DIEGO_USER_ID, {
        paidByMemberId: diegoMemberId,
        paidToMemberId: diegoMemberId,
        amount: 100,
        currency: 'pesos',
        date: '2026-08-21',
      })
    )

    console.log('\n=== AC) Shadow member (Laura) puede ser paidBy (ya probado arriba: Laura es shadow member y pagó) ===')
    check('El settlement válido de arriba ya usa a Laura (shadow) como paidBy', settlement.paidByMemberId === lauraMemberId)

    console.log('\n=== AE/AF) Solo el autor edita/borra el settlement ===')
    await expectApiError('No-autor edita -> 403', 403, () => updateSharedGroupSettlementForUser(groupId!, settlementId!, OTHER_USER_ID, { notes: 'hackeado' }))
    await expectApiError('No-autor borra -> 403', 403, () => deleteSharedGroupSettlementForUser(groupId!, settlementId!, OTHER_USER_ID))
    const edited = await updateSharedGroupSettlementForUser(groupId, settlementId, DIEGO_USER_ID, { notes: 'nota test' })
    check('Autor puede editar (notes)', edited.notes === 'nota test')

    console.log('\n=== AG) Update retroactivo que rompe un settlement posterior -> 409 ===')
    secondSettlementId = (
      await createSharedGroupSettlementForUser(groupId, DIEGO_USER_ID, {
        paidByMemberId: lauraMemberId,
        paidToMemberId: diegoMemberId,
        amount: 20000,
        currency: 'pesos',
        date: '2026-08-22',
      })
    ).id
    // Deuda total era $30.000. Ya pagó $10.000 + $20.000 = $30.000 exacto (0 restante).
    // Subir el PRIMER pago a $20.000 dejaría el segundo ($20.000) sumando $40.000 > $30.000 -> 409.
    await expectApiError('Update rompe settlement posterior -> 409', 409, () =>
      updateSharedGroupSettlementForUser(groupId!, settlementId!, DIEGO_USER_ID, { amount: 20000 })
    )

    console.log('\n=== AG variante DELETE) Borrar el primero rompería el segundo -> 409 ===')
    await expectApiError('Delete rompe settlement posterior -> 409', 409, () =>
      deleteSharedGroupSettlementForUser(groupId!, settlementId!, DIEGO_USER_ID)
    )
    // Limpieza en orden correcto: primero el más nuevo (no rompe nada), después el original.
    await deleteSharedGroupSettlementForUser(groupId, secondSettlementId, DIEGO_USER_ID)
    secondSettlementId = null

    console.log('\n=== AH/AI) Balance: miembro ve, externo no ===')
    const balance = await getSharedGroupBalanceForUser(groupId, DIEGO_USER_ID)
    check('Diego puede ver el balance', balance.groupId === groupId)
    await expectApiError('Externo no puede ver balance -> 403', 403, () => getSharedGroupBalanceForUser(groupId!, OTHER_USER_ID))

    console.log('\n=== AJ/AK) Balance neto correcto (deuda $30.000 - pago $10.000 = $20.000) ===')
    const laurasDebt = balance.balances.find((b) => b.fromMemberId === lauraMemberId && b.toMemberId === diegoMemberId)
    check('Laura le debe $20.000 a Diego', laurasDebt?.amount === 20000, laurasDebt)
    check('Exactamente 1 relación (sin ruido)', balance.balances.length === 1, balance.balances.length)

    console.log('\n=== Listado de settlements ===')
    const list = await listSharedGroupSettlementsForUser(groupId, DIEGO_USER_ID)
    check('El settlement original sigue existiendo', list.some((s) => s.id === settlementId))

    console.log('\n=== Limpieza ===')
    await deleteSharedGroupSettlementForUser(groupId, settlementId, DIEGO_USER_ID)
    settlementId = null
    await deleteSharedGroupExpenseForUser(groupId, expenseId, DIEGO_USER_ID)
    expenseId = null
    await deleteSharedGroupMemberForUser(groupId, lauraMemberId, DIEGO_USER_ID)
    lauraMemberId = null
    await deleteSharedGroupForUser(groupId, DIEGO_USER_ID)
    groupId = null
  } finally {
    try {
      if (secondSettlementId) await deleteSharedGroupSettlementForUser(groupId!, secondSettlementId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup 2nd settlement:', e)
    }
    try {
      if (settlementId) await deleteSharedGroupSettlementForUser(groupId!, settlementId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup settlement:', e)
    }
    try {
      if (expenseId) await deleteSharedGroupExpenseForUser(groupId!, expenseId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup expense:', e)
    }
    try {
      if (lauraMemberId) await deleteSharedGroupMemberForUser(groupId!, lauraMemberId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup member:', e)
    }
    try {
      if (groupId) await deleteSharedGroupForUser(groupId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup group:', e)
    }
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS (parte 3) PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
