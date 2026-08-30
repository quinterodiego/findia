/**
 * Tests del motor puro de Gastos Compartidos V2 (lib/sharedGroupBalances.ts).
 * Sin Google Sheets, sin red — corre en milisegundos.
 *
 * Ejecutar con: npx tsx scripts/test-shared-group-balances.ts
 */
import {
  calculateEqualSplit,
  validateSplitsSum,
  validateSharedGroupExpenseInput,
  computeGroupBalances,
  validateSettlementAgainstBalance,
} from '../lib/sharedGroupBalances'
import type { SharedGroupPairBalance } from '../types'

let failures = 0

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${label}`)
  if (!ok) {
    failures++
    console.log(`      esperado: ${JSON.stringify(expected)}`)
    console.log(`      obtenido: ${JSON.stringify(actual)}`)
  }
}

function assertTrue(label: string, condition: boolean) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}`)
  if (!condition) failures++
}

function findBalance(balances: SharedGroupPairBalance[], from: string, to: string, currency: 'pesos' | 'usd' = 'pesos') {
  return balances.find((b) => b.fromMemberId === from && b.toMemberId === to && b.currency === currency)
}

console.log('=== A) 2 personas — Diego paga $40.000, split 20/20 ===')
{
  const expenses = [{ id: 'e1', paidByMemberId: 'diego', currency: 'pesos' as const }]
  const splits = [
    { expenseId: 'e1', memberId: 'diego', amount: 20000 },
    { expenseId: 'e1', memberId: 'laura', amount: 20000 },
  ]
  const balances = computeGroupBalances([{ id: 'diego' }, { id: 'laura' }], expenses, splits, [])
  assertEqual('Laura -> Diego $20.000', findBalance(balances, 'laura', 'diego')?.amount, 20000)
  assertEqual('Solo 1 relación en el resultado', balances.length, 1)
}

console.log('\n=== B) 3 personas — Diego paga $90.000, 30/30/30 ===')
{
  const expenses = [{ id: 'e1', paidByMemberId: 'diego', currency: 'pesos' as const }]
  const splits = [
    { expenseId: 'e1', memberId: 'diego', amount: 30000 },
    { expenseId: 'e1', memberId: 'laura', amount: 30000 },
    { expenseId: 'e1', memberId: 'juan', amount: 30000 },
  ]
  const balances = computeGroupBalances([{ id: 'diego' }, { id: 'laura' }, { id: 'juan' }], expenses, splits, [])
  assertEqual('Laura -> Diego $30.000', findBalance(balances, 'laura', 'diego')?.amount, 30000)
  assertEqual('Juan -> Diego $30.000', findBalance(balances, 'juan', 'diego')?.amount, 30000)
  assertEqual('Solo 2 relaciones en el resultado', balances.length, 2)
}

console.log('\n=== C) Dos gastos cruzados (Diego $40.000 20/20, Laura $30.000 15/15) ===')
{
  const expenses = [
    { id: 'e1', paidByMemberId: 'diego', currency: 'pesos' as const },
    { id: 'e2', paidByMemberId: 'laura', currency: 'pesos' as const },
  ]
  const splits = [
    { expenseId: 'e1', memberId: 'diego', amount: 20000 },
    { expenseId: 'e1', memberId: 'laura', amount: 20000 },
    { expenseId: 'e2', memberId: 'diego', amount: 15000 },
    { expenseId: 'e2', memberId: 'laura', amount: 15000 },
  ]
  const balances = computeGroupBalances([{ id: 'diego' }, { id: 'laura' }], expenses, splits, [])
  assertEqual('Laura -> Diego $5.000', findBalance(balances, 'laura', 'diego')?.amount, 5000)
  assertEqual('Solo 1 relación en el resultado', balances.length, 1)
}

console.log('\n=== D) 3 personas, dos gastos (Diego $90.000 30/30/30, Laura $60.000 20/20/20) ===')
{
  const expenses = [
    { id: 'e1', paidByMemberId: 'diego', currency: 'pesos' as const },
    { id: 'e2', paidByMemberId: 'laura', currency: 'pesos' as const },
  ]
  const splits = [
    { expenseId: 'e1', memberId: 'diego', amount: 30000 },
    { expenseId: 'e1', memberId: 'laura', amount: 30000 },
    { expenseId: 'e1', memberId: 'juan', amount: 30000 },
    { expenseId: 'e2', memberId: 'diego', amount: 20000 },
    { expenseId: 'e2', memberId: 'laura', amount: 20000 },
    { expenseId: 'e2', memberId: 'juan', amount: 20000 },
  ]
  const balances = computeGroupBalances([{ id: 'diego' }, { id: 'laura' }, { id: 'juan' }], expenses, splits, [])
  assertEqual('Laura -> Diego $10.000', findBalance(balances, 'laura', 'diego')?.amount, 10000)
  assertEqual('Juan -> Diego $30.000', findBalance(balances, 'juan', 'diego')?.amount, 30000)
  assertEqual('Juan -> Laura $20.000', findBalance(balances, 'juan', 'laura')?.amount, 20000)
  assertEqual('Solo 3 relaciones en el resultado', balances.length, 3)
}

console.log('\n=== E) Settlement parcial: Laura debe Diego $20.000, paga $15.000 ===')
{
  const expenses = [{ id: 'e1', paidByMemberId: 'diego', currency: 'pesos' as const }]
  const splits = [{ expenseId: 'e1', memberId: 'laura', amount: 20000 }]
  const settlements = [{ paidByMemberId: 'laura', paidToMemberId: 'diego', amount: 15000, currency: 'pesos' as const }]
  const balances = computeGroupBalances([{ id: 'diego' }, { id: 'laura' }], expenses, splits, settlements)
  assertEqual('Laura -> Diego $5.000', findBalance(balances, 'laura', 'diego')?.amount, 5000)
}

console.log('\n=== F) Settlement exacto: Laura debe Diego $20.000, paga $20.000 ===')
{
  const expenses = [{ id: 'e1', paidByMemberId: 'diego', currency: 'pesos' as const }]
  const splits = [{ expenseId: 'e1', memberId: 'laura', amount: 20000 }]
  const settlements = [{ paidByMemberId: 'laura', paidToMemberId: 'diego', amount: 20000, currency: 'pesos' as const }]
  const balances = computeGroupBalances([{ id: 'diego' }, { id: 'laura' }], expenses, splits, settlements)
  assertEqual('La relación desaparece (balance vacío)', balances.length, 0)
}

console.log('\n=== G) Settlement mayor a la deuda: debe rechazarse por validación ===')
{
  const currentBalances: SharedGroupPairBalance[] = [{ fromMemberId: 'laura', toMemberId: 'diego', currency: 'pesos', amount: 20000 }]
  const result = validateSettlementAgainstBalance(currentBalances, {
    paidByMemberId: 'laura',
    paidToMemberId: 'diego',
    amount: 25000,
    currency: 'pesos',
  })
  assertTrue('Rechazado (valid === false)', result.valid === false)
  assertTrue('Con mensaje de error', !!result.error)

  const okResult = validateSettlementAgainstBalance(currentBalances, {
    paidByMemberId: 'laura',
    paidToMemberId: 'diego',
    amount: 20000,
    currency: 'pesos',
  })
  assertTrue('El monto exacto de la deuda sí se acepta', okResult.valid === true)
}

console.log('\n=== H) Dos monedas: Laura debe Diego ARS $20.000 y USD 10, balances separados ===')
{
  const expenses = [
    { id: 'e1', paidByMemberId: 'diego', currency: 'pesos' as const },
    { id: 'e2', paidByMemberId: 'diego', currency: 'usd' as const },
  ]
  const splits = [
    { expenseId: 'e1', memberId: 'laura', amount: 20000 },
    { expenseId: 'e2', memberId: 'laura', amount: 10 },
  ]
  const balances = computeGroupBalances([{ id: 'diego' }, { id: 'laura' }], expenses, splits, [])
  assertEqual('Laura -> Diego ARS $20.000', findBalance(balances, 'laura', 'diego', 'pesos')?.amount, 20000)
  assertEqual('Laura -> Diego USD 10', findBalance(balances, 'laura', 'diego', 'usd')?.amount, 10)
  assertEqual('Exactamente 2 relaciones (una por moneda)', balances.length, 2)
}

console.log('\n=== I) $100 / 3 — split igual, sin arrastre de floats ===')
{
  const split = calculateEqualSplit(100, ['A', 'B', 'C'])
  assertEqual('A recibe 33.34', split.find((s) => s.memberId === 'A')?.amount, 33.34)
  assertEqual('B recibe 33.33', split.find((s) => s.memberId === 'B')?.amount, 33.33)
  assertEqual('C recibe 33.33', split.find((s) => s.memberId === 'C')?.amount, 33.33)
  const sum = split.reduce((s, x) => s + x.amount, 0)
  assertTrue('La suma da exactamente 100 (comparada en centavos)', Math.round(sum * 100) === 10000)
}

console.log('\n=== J) Monto exacto: 50 + 30 + 10 = 90, válido ===')
{
  const result = validateSplitsSum(90, [
    { memberId: 'diego', amount: 50 },
    { memberId: 'laura', amount: 30 },
    { memberId: 'juan', amount: 10 },
  ])
  assertTrue('Válido', result.valid === true)
}

console.log('\n=== K) Monto exacto: 50 + 30 + 9.99 != 90, inválido ===')
{
  const result = validateSplitsSum(90, [
    { memberId: 'diego', amount: 50 },
    { memberId: 'laura', amount: 30 },
    { memberId: 'juan', amount: 9.99 },
  ])
  assertTrue('Inválido (valid === false)', result.valid === false)
}

console.log('\n=== L) Problema de floats: 0.1 + 0.2 no debe generar error si son 30 centavos ===')
{
  const result = validateSplitsSum(0.3, [
    { memberId: 'a', amount: 0.1 },
    { memberId: 'b', amount: 0.2 },
  ])
  assertTrue('Válido pese a 0.1 + 0.2 !== 0.3 en floats crudos de JS', result.valid === true)
  // Prueba adicional: confirmar que el problema de floats es real sin la comparación en centavos
  assertTrue('(control) 0.1 + 0.2 !== 0.3 en JS puro, para dejar constancia del problema que se evita', 0.1 + 0.2 !== 0.3)
}

console.log('\n=== Extra: validateSharedGroupExpenseInput — casos de borde de la validación completa ===')
{
  const validMemberIds = ['diego', 'laura']

  const dup = validateSharedGroupExpenseInput(
    {
      description: 'Super',
      amount: 100,
      currency: 'pesos',
      paidByMemberId: 'diego',
      splits: [
        { memberId: 'diego', amount: 50 },
        { memberId: 'diego', amount: 50 },
      ],
    },
    validMemberIds
  )
  assertTrue('Rechaza memberId duplicado en splits', dup.valid === false)

  const foreign = validateSharedGroupExpenseInput(
    {
      description: 'Super',
      amount: 100,
      currency: 'pesos',
      paidByMemberId: 'diego',
      splits: [
        { memberId: 'diego', amount: 50 },
        { memberId: 'extraño', amount: 50 },
      ],
    },
    validMemberIds
  )
  assertTrue('Rechaza split de un miembro ajeno al grupo', foreign.valid === false)

  const emptyDesc = validateSharedGroupExpenseInput(
    {
      description: '   ',
      amount: 100,
      currency: 'pesos',
      paidByMemberId: 'diego',
      splits: [{ memberId: 'diego', amount: 100 }],
    },
    validMemberIds
  )
  assertTrue('Rechaza descripción vacía (solo espacios)', emptyDesc.valid === false)
}

console.log(`\n${failures === 0 ? 'TODOS LOS TESTS PASARON' : `${failures} TEST(S) FALLARON`}`)
process.exit(failures === 0 ? 0 : 1)
