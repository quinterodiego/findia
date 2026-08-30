/**
 * Test de integración REAL contra Google Sheets para la persistencia de
 * Gastos Compartidos V2 (Fase 1). Crea datos de prueba en el spreadsheet
 * configurado en .env.local y los borra todos en un `finally`, sin tocar
 * nada del sistema viejo (SharedExpenses).
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-group-persistence.ts dotenv_config_path=.env.local
 *
 * IMPORTANTE: usa `-r dotenv/config` (no un `import 'dotenv/config'` dentro
 * del script) porque lib/googleSheets.ts lee variables de entorno al nivel
 * de módulo (para construir el cliente de Google Auth), y el hoisting de
 * imports de ES modules haría que ese import se evalúe ANTES que un
 * `dotenv.config()` escrito dentro de este mismo archivo.
 */
import {
  createSharedGroup,
  getSharedGroupsByUser,
  getSharedGroupById,
  updateSharedGroup,
  deleteSharedGroup,
  getSharedGroupMembers,
  createSharedGroupMember,
  updateSharedGroupMember,
  deleteSharedGroupMember,
  createSharedGroupExpense,
  getSharedGroupExpenses,
  getSharedGroupSplits,
  updateSharedGroupExpense,
  deleteSharedGroupExpense,
  createSharedGroupSettlement,
  getSharedGroupSettlements,
  updateSharedGroupSettlement,
  deleteSharedGroupSettlement,
} from '../lib/googleSheets'
import { google } from 'googleapis'

const DIEGO_USER_ID = '100827254183186994825' // cuenta mock real usada en esta sesión

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

async function countSharedExpensesRows(): Promise<number> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'SharedExpenses!A2:N',
    })
    return (resp.data.values || []).length
  } catch {
    return -1 // la hoja no existe todavía, o no aplica
  }
}

async function main() {
  const sharedExpensesRowsBefore = await countSharedExpensesRows()
  console.log(`Filas en SharedExpenses (sistema viejo) ANTES del test: ${sharedExpensesRowsBefore}`)

  let groupId: string | null = null
  let lauraMemberId: string | null = null
  let expenseId: string | null = null
  let settlementId: string | null = null

  try {
    console.log('\n=== 1) createSharedGroup crea el grupo + al creador como miembro ===')
    const { group, creatorMember } = await createSharedGroup(DIEGO_USER_ID, {
      name: 'Casa (test)',
      creatorName: 'Diego (test)',
      creatorEmail: 'diego-test@example.com',
    })
    groupId = group.id
    check('Grupo creado con nombre correcto', group.name === 'Casa (test)')
    check('Grupo con createdBy correcto', group.createdBy === DIEGO_USER_ID)
    check('Miembro creador con userId vinculado', creatorMember.userId === DIEGO_USER_ID)
    check('Miembro creador con groupId correcto', creatorMember.groupId === groupId)
    const diegoMemberId = creatorMember.id

    console.log('\n=== 2) getSharedGroupsByUser devuelve el grupo (por membresía, no por createdBy) ===')
    const myGroups = await getSharedGroupsByUser(DIEGO_USER_ID)
    check('El grupo aparece en la lista del usuario', myGroups.some((g) => g.id === groupId))

    console.log('\n=== 3) getSharedGroupById ===')
    const fetchedGroup = await getSharedGroupById(groupId)
    check('Se encuentra por id', fetchedGroup?.id === groupId)

    console.log('\n=== 4) createSharedGroupMember — shadow member sin userId ===')
    const laura = await createSharedGroupMember(groupId, { name: 'Laura (test)' })
    lauraMemberId = laura.id
    check('Shadow member creado con userId undefined', laura.userId === undefined)
    check('Shadow member con name correcto', laura.name === 'Laura (test)')

    console.log('\n=== 5) getSharedGroupMembers devuelve ambos miembros ===')
    const members = await getSharedGroupMembers(groupId)
    check('Hay exactamente 2 miembros', members.length === 2, members.length)
    check('Diego está entre los miembros', members.some((m) => m.id === diegoMemberId))
    check('Laura está entre los miembros', members.some((m) => m.id === lauraMemberId))

    console.log('\n=== 6) createSharedGroupExpense + splits (Supermercado $40.000, 20/20) ===')
    const { expense, splits } = await createSharedGroupExpense(groupId, DIEGO_USER_ID, {
      description: 'Supermercado (test)',
      amount: 40000,
      currency: 'pesos',
      paidByMemberId: diegoMemberId,
      date: '2026-08-15',
      splits: [
        { memberId: diegoMemberId, amount: 20000 },
        { memberId: lauraMemberId, amount: 20000 },
      ],
    })
    expenseId = expense.id
    check('Gasto creado con el monto correcto', expense.amount === 40000)
    check('Se crearon exactamente 2 splits', splits.length === 2, splits.length)

    console.log('\n=== 7) getSharedGroupExpenses / getSharedGroupSplits ===')
    const groupExpenses = await getSharedGroupExpenses(groupId)
    check('El gasto aparece filtrado por groupId', groupExpenses.some((e) => e.id === expenseId))
    const expenseSplits = await getSharedGroupSplits(expenseId)
    check('Los splits suman el total exacto', expenseSplits.reduce((s, x) => s + x.amount, 0) === 40000)

    console.log('\n=== 8) Validación: gasto con splits que NO suman el total debe rechazarse ===')
    try {
      await createSharedGroupExpense(groupId, DIEGO_USER_ID, {
        description: 'Gasto inválido (test)',
        amount: 1000,
        currency: 'pesos',
        paidByMemberId: diegoMemberId,
        date: '2026-08-15',
        splits: [{ memberId: diegoMemberId, amount: 999 }],
      })
      check('Rechazó splits que no suman el total', false)
    } catch (e) {
      check('Rechazó splits que no suman el total', true, (e as Error).message)
    }

    console.log('\n=== 9) createSharedGroupSettlement — pago válido (Laura debe 20.000, paga 10.000) ===')
    const settlement = await createSharedGroupSettlement(groupId, DIEGO_USER_ID, {
      paidByMemberId: lauraMemberId,
      paidToMemberId: diegoMemberId,
      amount: 10000,
      currency: 'pesos',
      date: '2026-08-20',
    })
    settlementId = settlement.id
    check('Settlement creado con el monto correcto', settlement.amount === 10000)

    console.log('\n=== 10) createSharedGroupSettlement — overpayment debe rechazarse (quedan $10.000 de deuda, intenta pagar $50.000) ===')
    try {
      await createSharedGroupSettlement(groupId, DIEGO_USER_ID, {
        paidByMemberId: lauraMemberId,
        paidToMemberId: diegoMemberId,
        amount: 50000,
        currency: 'pesos',
        date: '2026-08-21',
      })
      check('Rechazó el overpayment', false)
    } catch (e) {
      check('Rechazó el overpayment', true, (e as Error).message)
    }

    console.log('\n=== 11) getSharedGroupSettlements ===')
    const groupSettlements = await getSharedGroupSettlements(groupId)
    check('El settlement aparece filtrado por groupId', groupSettlements.some((s) => s.id === settlementId))

    console.log('\n=== 12) updateSharedGroup (rename) ===')
    const renamed = await updateSharedGroup(groupId, DIEGO_USER_ID, { name: 'Casa Renombrada (test)' })
    check('Grupo renombrado', renamed.name === 'Casa Renombrada (test)')

    console.log('\n=== 13) updateSharedGroup con userId incorrecto debe rechazarse ===')
    try {
      await updateSharedGroup(groupId, 'usuario-que-no-es-el-creador', { name: 'Hackeado' })
      check('Rechazó edición por un usuario no-creador', false)
    } catch (e) {
      check('Rechazó edición por un usuario no-creador', true, (e as Error).message)
    }

    console.log('\n=== 14) updateSharedGroupMember (agregar email a Laura) ===')
    const updatedLaura = await updateSharedGroupMember(lauraMemberId, { email: 'laura-test@example.com' })
    check('Email actualizado', updatedLaura.email === 'laura-test@example.com')
    check('userId sigue sin vincular', updatedLaura.userId === undefined)

    console.log('\n=== 15) updateSharedGroupExpense (solo descripción, sin tocar monto/splits) ===')
    const updatedExpense = await updateSharedGroupExpense(expenseId, DIEGO_USER_ID, {
      description: 'Supermercado actualizado (test)',
    })
    check('Descripción actualizada', updatedExpense.description === 'Supermercado actualizado (test)')
    check('Monto sin cambios', updatedExpense.amount === 40000)
    const splitsAfterDescUpdate = await getSharedGroupSplits(expenseId)
    check('Los splits no se tocaron', splitsAfterDescUpdate.length === 2)

    console.log('\n=== 16) updateSharedGroupExpense cambiando amount SIN pasar splits debe rechazarse ===')
    try {
      await updateSharedGroupExpense(expenseId, DIEGO_USER_ID, { amount: 99999 })
      check('Rechazó cambiar amount sin splits', false)
    } catch (e) {
      check('Rechazó cambiar amount sin splits', true, (e as Error).message)
    }

    console.log('\n=== 17) updateSharedGroupSettlement (solo notes, sin tocar amount) ===')
    const updatedSettlement = await updateSharedGroupSettlement(settlementId, DIEGO_USER_ID, { notes: 'nota de prueba' })
    check('Notes actualizadas', updatedSettlement.notes === 'nota de prueba')
    check('Monto del settlement sin cambios', updatedSettlement.amount === 10000)

    console.log('\n=== 18) deleteSharedGroupSettlement ===')
    await deleteSharedGroupSettlement(settlementId, DIEGO_USER_ID)
    const settlementsAfterDelete = await getSharedGroupSettlements(groupId)
    check('El settlement ya no existe', !settlementsAfterDelete.some((s) => s.id === settlementId))
    settlementId = null

    console.log('\n=== 19) deleteSharedGroupExpense — cascada de splits ===')
    await deleteSharedGroupExpense(expenseId, DIEGO_USER_ID)
    const expensesAfterDelete = await getSharedGroupExpenses(groupId)
    check('El gasto ya no existe', !expensesAfterDelete.some((e) => e.id === expenseId))
    const splitsAfterExpenseDelete = await getSharedGroupSplits(expenseId)
    check('Sus splits tampoco existen (cascada)', splitsAfterExpenseDelete.length === 0)
    expenseId = null

    console.log('\n=== 20) deleteSharedGroupMember ===')
    await deleteSharedGroupMember(lauraMemberId)
    const membersAfterDelete = await getSharedGroupMembers(groupId)
    check('Laura ya no es miembro', !membersAfterDelete.some((m) => m.id === lauraMemberId))
    lauraMemberId = null

    console.log('\n=== 21) deleteSharedGroup ===')
    await deleteSharedGroup(groupId, DIEGO_USER_ID)
    const groupAfterDelete = await getSharedGroupById(groupId)
    check('El grupo ya no existe', groupAfterDelete === null)
    groupId = null
  } finally {
    console.log('\n=== Limpieza final (por si algún paso falló a mitad de camino) ===')
    try {
      if (settlementId) await deleteSharedGroupSettlement(settlementId, DIEGO_USER_ID)
    } catch (e) {
      console.error('Error en limpieza de settlement:', e)
    }
    try {
      if (expenseId) await deleteSharedGroupExpense(expenseId, DIEGO_USER_ID)
    } catch (e) {
      console.error('Error en limpieza de expense:', e)
    }
    try {
      if (lauraMemberId) await deleteSharedGroupMember(lauraMemberId)
    } catch (e) {
      console.error('Error en limpieza de member:', e)
    }
    try {
      if (groupId) await deleteSharedGroup(groupId, DIEGO_USER_ID)
    } catch (e) {
      console.error('Error en limpieza de group:', e)
    }

    const sharedExpensesRowsAfter = await countSharedExpensesRows()
    console.log(`Filas en SharedExpenses (sistema viejo) DESPUÉS del test: ${sharedExpensesRowsAfter}`)
    check('SharedExpenses (sistema viejo) no cambió ni una fila', sharedExpensesRowsAfter === sharedExpensesRowsBefore, {
      antes: sharedExpensesRowsBefore,
      despues: sharedExpensesRowsAfter,
    })
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE PERSISTENCIA PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal en el test:', e)
  process.exit(1)
})
