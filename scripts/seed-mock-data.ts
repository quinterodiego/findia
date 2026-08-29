/**
 * Genera datos de prueba realistas (en pesos argentinos) para una cuenta existente,
 * cubriendo deudas, pagos, gastos, ingresos, metas y tarjetas de crédito.
 *
 * Ejecutar con: npm run seed:mock -- <email>
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { google } from 'googleapis'

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
const sheets = google.sheets({ version: 'v4', auth })
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID

let idCounter = 0
function generateId(): string {
  idCounter += 1
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 9)}`
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function ddmmyyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base)
  d.setMonth(d.getMonth() + months)
  return d
}

async function getUserIdByEmail(email: string): Promise<{ id: string; name: string } | null> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Users!A2:G',
  })
  const rows = response.data.values || []
  const row = rows.find(r => r[1]?.toLowerCase() === email.toLowerCase())
  if (!row) return null
  return { id: row[0], name: row[3] || '' }
}

async function appendRows(sheetName: string, range: string, values: (string | number | boolean)[][]) {
  if (values.length === 0) return
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  })
}

async function sheetExists(sheetName: string): Promise<boolean> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  return spreadsheet.data.sheets?.some(s => s.properties?.title === sheetName) || false
}

async function createSheetWithHeaders(sheetName: string, headers: string[]) {
  const exists = await sheetExists(sheetName)
  if (exists) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  })
  console.log(`  ℹ️  Hoja "${sheetName}" no existía, se creó con sus headers.`)
}

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Uso: npm run seed:mock -- <email>')
    process.exit(1)
  }

  const user = await getUserIdByEmail(email)
  if (!user) {
    console.error(`❌ No existe un usuario con email ${email}. No se generó ningún dato.`)
    process.exit(1)
  }

  const userId = user.id
  const now = new Date()
  const nowIso = now.toISOString()
  console.log(`🚀 Generando datos de prueba para ${email} (userId: ${userId})\n`)

  // ==========================================================================
  // DEBTS
  // ==========================================================================
  console.log('📉 Creando deudas...')

  const debtTarjetaVisa = {
    id: generateId(),
    name: 'Tarjeta Visa Banco Nación',
    amount: 850000,
    balance: 850000,
    interestRate: 8.5,
    minPayment: 85000,
    dueDate: isoDate(addDays(now, 17)),
    priority: 'high',
    status: 'active',
    categoryId: '',
    subcategoryId: '',
    notes: 'Dato de prueba generado por seed-mock-data.ts',
    createdAt: nowIso,
    updatedAt: nowIso,
    paymentMethod: 'manual',
    totalInstallments: '',
    remainingInstallments: '',
    debtType: 'tarjeta',
  }

  const debtPrestamoPersonal = {
    id: generateId(),
    name: 'Préstamo Personal Banco Galicia',
    amount: 2000000,
    balance: 1500000,
    interestRate: 65,
    minPayment: 180000,
    dueDate: isoDate(addDays(now, 12)),
    priority: 'high',
    status: 'active',
    categoryId: '',
    subcategoryId: '',
    notes: 'Dato de prueba generado por seed-mock-data.ts',
    createdAt: nowIso,
    updatedAt: nowIso,
    paymentMethod: 'automatic',
    totalInstallments: 24,
    remainingInstallments: 18,
    debtType: 'prestamo',
  }

  const debtTarjetaMastercard = {
    id: generateId(),
    name: 'Tarjeta Mastercard Santander',
    amount: 420000,
    balance: 420000,
    interestRate: 9.2,
    minPayment: 42000,
    dueDate: isoDate(addDays(now, -27)),
    priority: 'medium',
    status: 'overdue',
    categoryId: '',
    subcategoryId: '',
    notes: 'Dato de prueba generado por seed-mock-data.ts',
    createdAt: nowIso,
    updatedAt: nowIso,
    paymentMethod: 'manual',
    totalInstallments: '',
    remainingInstallments: '',
    debtType: 'tarjeta',
  }

  const debtCreditoElectro = {
    id: generateId(),
    name: 'Crédito Electrodomésticos',
    amount: 600000,
    balance: 250000,
    interestRate: 0,
    minPayment: 50000,
    dueDate: isoDate(addDays(now, 8)),
    priority: 'low',
    status: 'active',
    categoryId: '',
    subcategoryId: '',
    notes: 'Dato de prueba generado por seed-mock-data.ts',
    createdAt: nowIso,
    updatedAt: nowIso,
    paymentMethod: 'automatic',
    totalInstallments: 12,
    remainingInstallments: 5,
    debtType: 'credito',
  }

  const debtPrestamoAuto = {
    id: generateId(),
    name: 'Préstamo Auto',
    amount: 3500000,
    balance: 0,
    interestRate: 55,
    minPayment: 0,
    dueDate: isoDate(addMonths(now, -7)),
    priority: 'medium',
    status: 'paid',
    categoryId: '',
    subcategoryId: '',
    notes: 'Dato de prueba generado por seed-mock-data.ts',
    createdAt: nowIso,
    updatedAt: nowIso,
    paymentMethod: 'transfer',
    totalInstallments: 36,
    remainingInstallments: 0,
    debtType: 'prestamo',
  }

  const debts = [
    debtTarjetaVisa,
    debtPrestamoPersonal,
    debtTarjetaMastercard,
    debtCreditoElectro,
    debtPrestamoAuto,
  ]

  await appendRows(
    'Debts',
    'A2',
    debts.map(d => [
      d.id, userId, d.name, d.amount, d.balance, d.interestRate, d.minPayment, d.dueDate,
      d.priority, d.status, d.categoryId, d.subcategoryId, d.notes, d.createdAt, d.updatedAt,
      d.paymentMethod, d.totalInstallments, d.remainingInstallments, d.debtType,
    ])
  )
  console.log(`  ✅ ${debts.length} deudas creadas`)

  // Pagos reales sobre la tarjeta Visa (deja el balance en 850000 - 270000 = 580000)
  console.log('💳 Creando pagos sobre deudas...')
  const debtPayments = [
    {
      id: generateId(), debtId: debtTarjetaVisa.id, userId, amount: 150000,
      date: isoDate(addMonths(now, -1)), type: 'regular', notes: 'Dato de prueba', createdAt: nowIso,
    },
    {
      id: generateId(), debtId: debtTarjetaVisa.id, userId, amount: 120000,
      date: isoDate(addDays(now, -9)), type: 'regular', notes: 'Dato de prueba', createdAt: nowIso,
    },
  ]
  await appendRows(
    'Payments',
    'A2',
    debtPayments.map(p => [p.id, p.debtId, p.userId, p.amount, p.date, p.type, p.notes, p.createdAt])
  )
  // Reflejar el balance resultante directamente en la fila de la deuda (850000 - 270000)
  await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Debts!A2:R' }).then(async (resp) => {
    const rows = resp.data.values || []
    const rowIndex = rows.findIndex(r => r[0] === debtTarjetaVisa.id)
    if (rowIndex !== -1) {
      const actualRow = rowIndex + 2
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Debts!E${actualRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[580000]] },
      })
    }
  })
  console.log(`  ✅ ${debtPayments.length} pagos creados`)

  // ==========================================================================
  // EXPENSES
  // ==========================================================================
  console.log('🧾 Creando gastos...')

  type ExpenseRow = {
    name: string; amount: number; date: string; category: string;
    expenseType: 'fixed' | 'variable' | 'installments'; isRecurring: boolean; frequency: string;
    totalInstallments?: number; currentInstallment?: number; paymentMethod?: string;
  }

  const expensesData: ExpenseRow[] = [
    { name: 'Alquiler', amount: 320000, date: isoDate(addDays(now, -5)), category: 'Gasto Fijo', expenseType: 'fixed', isRecurring: true, frequency: 'monthly' },
    { name: 'Expensas', amount: 45000, date: isoDate(addDays(now, -5)), category: 'Gasto Fijo', expenseType: 'fixed', isRecurring: true, frequency: 'monthly' },
    { name: 'Streaming (Netflix + Spotify)', amount: 8500, date: isoDate(addDays(now, -3)), category: 'Gasto Fijo', expenseType: 'fixed', isRecurring: true, frequency: 'monthly' },
    { name: 'Gimnasio', amount: 25000, date: isoDate(addDays(now, -10)), category: 'Gasto Fijo', expenseType: 'fixed', isRecurring: true, frequency: 'monthly' },
    { name: 'Seguro del auto', amount: 60000, date: isoDate(addDays(now, -12)), category: 'Gasto Fijo', expenseType: 'fixed', isRecurring: true, frequency: 'monthly' },
    { name: 'Supermercado', amount: 95000, date: isoDate(addDays(now, -2)), category: 'Gasto Variable', expenseType: 'variable', isRecurring: false, frequency: 'monthly' },
    { name: 'Nafta', amount: 40000, date: isoDate(addDays(now, -6)), category: 'Gasto Variable', expenseType: 'variable', isRecurring: false, frequency: 'monthly' },
    { name: 'Salidas y restaurantes', amount: 32000, date: isoDate(addDays(now, -4)), category: 'Gasto Variable', expenseType: 'variable', isRecurring: false, frequency: 'monthly' },
    { name: 'Farmacia', amount: 15000, date: isoDate(addDays(now, -8)), category: 'Gasto Variable', expenseType: 'variable', isRecurring: false, frequency: 'monthly' },
    { name: 'Notebook nueva (cuota)', amount: 45000, date: isoDate(addDays(now, -14)), category: 'Gasto Variable', expenseType: 'installments', isRecurring: false, frequency: 'monthly', totalInstallments: 6, currentInstallment: 2, paymentMethod: 'automatic' },
    { name: 'Regalo cumpleaños', amount: 20000, date: isoDate(addDays(now, -15)), category: 'Gasto Variable', expenseType: 'variable', isRecurring: false, frequency: 'monthly' },
    { name: 'Ropa', amount: 55000, date: isoDate(addDays(now, -18)), category: 'Gasto Variable', expenseType: 'variable', isRecurring: false, frequency: 'monthly' },
    { name: 'Supermercado', amount: 88000, date: isoDate(addMonths(now, -1)), category: 'Gasto Variable', expenseType: 'variable', isRecurring: false, frequency: 'monthly' },
    { name: 'Alquiler', amount: 310000, date: isoDate(addMonths(now, -1)), category: 'Gasto Fijo', expenseType: 'fixed', isRecurring: true, frequency: 'monthly' },
  ]

  await appendRows(
    'Expenses',
    'A2',
    expensesData.map(e => [
      generateId(), userId, e.name, e.amount, e.date, e.category, '', e.expenseType,
      'Dato de prueba generado por seed-mock-data.ts', e.isRecurring, e.frequency, nowIso,
      e.totalInstallments || '', e.currentInstallment || '', e.paymentMethod || '',
    ])
  )
  console.log(`  ✅ ${expensesData.length} gastos creados`)

  // ==========================================================================
  // INCOMES
  // ==========================================================================
  console.log('💵 Creando ingresos...')

  const incomesData = [
    { name: 'Sueldo', amount: 950000, date: isoDate(addDays(now, -1)), category: 'Salario', isRecurring: true, frequency: 'monthly' },
    { name: 'Freelance diseño', amount: 180000, date: isoDate(addDays(now, -7)), category: 'Freelance', isRecurring: false, frequency: 'monthly' },
    { name: 'Sueldo', amount: 920000, date: isoDate(addMonths(now, -1)), category: 'Salario', isRecurring: true, frequency: 'monthly' },
    { name: 'Venta artículo usado', amount: 65000, date: isoDate(addDays(now, -11)), category: 'Otro', isRecurring: false, frequency: 'monthly' },
    { name: 'Reintegro tarjeta', amount: 12000, date: isoDate(addDays(now, -16)), category: 'Otro', isRecurring: false, frequency: 'monthly' },
  ]

  await appendRows(
    'Incomes',
    'A2',
    incomesData.map(i => [
      generateId(), userId, i.name, i.amount, i.date, i.category,
      'Dato de prueba generado por seed-mock-data.ts', i.isRecurring, i.frequency, nowIso,
    ])
  )
  console.log(`  ✅ ${incomesData.length} ingresos creados`)

  // ==========================================================================
  // GOALS
  // ==========================================================================
  console.log('🎯 Creando metas de ahorro...')

  const goalsData = [
    { name: 'Fondo de emergencia', amount: 1000000, currentAmount: 650000, targetDate: isoDate(addMonths(now, 4)), category: 'savings' },
    { name: 'Vacaciones Bariloche', amount: 500000, currentAmount: 500000, targetDate: isoDate(addMonths(now, -2)), category: 'savings' },
    { name: 'Cambio de celular', amount: 400000, currentAmount: 90000, targetDate: isoDate(addMonths(now, 7)), category: 'savings' },
  ]

  await appendRows(
    'Goals',
    'A2',
    goalsData.map(g => [
      generateId(), userId, g.name, g.amount, g.currentAmount, g.targetDate, isoDate(now),
      g.category, 'Dato de prueba generado por seed-mock-data.ts', nowIso,
    ])
  )
  console.log(`  ✅ ${goalsData.length} metas creadas`)

  // ==========================================================================
  // CREDIT CARDS + CREDIT CARD PAYMENTS
  // ==========================================================================
  // Nota sobre currentBalance: este script no puede usar createCreditCardPayment() en forma
  // directa (importar lib/googleSheets.ts acá rompería la carga de variables de entorno, ver
  // el resto de este archivo que ya evita ese import por la misma razón). Para que el resultado
  // sea idéntico al que produciría ese flujo real, el currentBalance sembrado se calcula
  // explícitamente como saldoInicial - pagos, en vez de escribirse como un número suelto.
  console.log('💳 Creando tarjetas de crédito y sus pagos...')

  const existingCardsResp = await sheets.spreadsheets.values
    .get({ spreadsheetId: SPREADSHEET_ID, range: 'CreditCards!A2:M' })
    .catch(() => ({ data: { values: [] as string[][] } }))
  const existingCardNames = new Set(
    (existingCardsResp.data.values || []).filter(r => r[1] === userId).map(r => r[2])
  )

  if (existingCardNames.has('Visa Banco Nación') || existingCardNames.has('Mastercard Santander')) {
    console.log('  ⏭️  Ya existen tarjetas mock para este usuario (Visa Banco Nación / Mastercard Santander).')
    console.log('      Se omite esta sección completa (tarjetas, consumos y pagos) para no duplicar pagos.')
  } else {
    const cardVisaId = generateId()
    const cardMastercardId = generateId()

    // Pagos reales que se van a sembrar sobre cada tarjeta.
    const cardPaymentsData = [
      { cardId: cardVisaId, amount: 200000, date: isoDate(addMonths(now, -1)), paymentMethod: 'transfer' },
      { cardId: cardMastercardId, amount: 100000, date: isoDate(addMonths(now, -1)), paymentMethod: 'debit' },
    ]
    const totalPaidByCard = (cardId: string) =>
      cardPaymentsData.filter(p => p.cardId === cardId).reduce((sum, p) => sum + p.amount, 0)

    // Saldo ANTES de esos pagos. currentBalance sembrado = saldoInicial - pagos, así que
    // matemáticamente: saldoInicial - pagosRegistrados = currentBalance final, siempre.
    // Los valores finales (580.000 / 320.000) son intencionalmente los mismos que ya estaban
    // sembrados antes de esta corrección, para no invalidar todo lo ya validado en Estrategias
    // y Plan de pago con esos números.
    const cardVisaStartingBalance = 780000
    const cardMastercardStartingBalance = 420000

    const cardVisa = {
      id: cardVisaId, name: 'Visa Banco Nación', bank: 'Banco Nación', cardNumber: '**** **** **** 4521',
      limit: 1200000, currentBalance: cardVisaStartingBalance - totalPaidByCard(cardVisaId),
      cutDate: 5, paymentDate: 15, interestRate: 8.5, status: 'active', createdAt: nowIso, updatedAt: nowIso,
    }
    const cardMastercard = {
      id: cardMastercardId, name: 'Mastercard Santander', bank: 'Santander', cardNumber: '**** **** **** 7788',
      limit: 800000, currentBalance: cardMastercardStartingBalance - totalPaidByCard(cardMastercardId),
      cutDate: 20, paymentDate: 30, interestRate: 9.0, status: 'active', createdAt: nowIso, updatedAt: nowIso,
    }
    const creditCards = [cardVisa, cardMastercard]

    await appendRows(
      'CreditCards',
      'A2',
      creditCards.map(c => [
        c.id, userId, c.name, c.bank, c.cardNumber, c.limit, c.currentBalance,
        c.cutDate, c.paymentDate, c.interestRate, c.status, c.createdAt, c.updatedAt,
      ])
    )
    console.log(`  ✅ ${creditCards.length} tarjetas creadas (saldo = saldo inicial - pagos sembrados)`)

    // CREDIT CARD CONSUMPTIONS
    console.log('🛒 Creando consumos de tarjeta...')

    const consumptionsData = [
      { cardId: cardVisa.id, merchant: 'Supermercado Coto', amount: 45000, installments: 1, currentInstallment: 1, monthlyPayment: 45000, date: ddmmyyyy(addDays(now, -3)) },
      { cardId: cardVisa.id, merchant: 'MercadoLibre - Auriculares', amount: 60000, installments: 3, currentInstallment: 1, monthlyPayment: 20000, date: ddmmyyyy(addDays(now, -9)) },
      { cardId: cardVisa.id, merchant: 'Farmacity', amount: 12000, installments: 1, currentInstallment: 1, monthlyPayment: 12000, date: ddmmyyyy(addDays(now, -14)) },
      { cardId: cardMastercard.id, merchant: 'Netflix', amount: 6500, installments: 1, currentInstallment: 1, monthlyPayment: 6500, date: ddmmyyyy(addDays(now, -6)) },
      { cardId: cardMastercard.id, merchant: 'Despegar - Pasajes', amount: 240000, installments: 6, currentInstallment: 2, monthlyPayment: 40000, date: ddmmyyyy(addMonths(now, -1)) },
      { cardId: cardMastercard.id, merchant: 'YPF Full', amount: 30000, installments: 1, currentInstallment: 1, monthlyPayment: 30000, date: ddmmyyyy(addDays(now, -2)) },
      { cardId: cardMastercard.id, merchant: 'Zara', amount: 55000, installments: 1, currentInstallment: 1, monthlyPayment: 55000, date: ddmmyyyy(addDays(now, -20)) },
    ]

    await appendRows(
      'CreditCardConsumptions',
      'A2',
      consumptionsData.map(c => [
        generateId(), c.cardId, userId, c.merchant, c.amount, c.installments, c.currentInstallment,
        c.monthlyPayment, c.date, '', '', 'Dato de prueba generado por seed-mock-data.ts', nowIso,
        c.amount, 0,
      ])
    )
    console.log(`  ✅ ${consumptionsData.length} consumos creados`)

    // CREDIT CARD PAYMENTS
    console.log('💸 Creando pagos de tarjeta...')

    await createSheetWithHeaders('CreditCardPayments', [
      'id', 'creditCardId', 'userId', 'amount', 'date', 'paymentMethod', 'notes', 'createdAt',
    ])

    await appendRows(
      'CreditCardPayments',
      'A2',
      cardPaymentsData.map(p => [
        generateId(), p.cardId, userId, p.amount, p.date, p.paymentMethod,
        'Dato de prueba generado por seed-mock-data.ts', nowIso,
      ])
    )
    console.log(`  ✅ ${cardPaymentsData.length} pagos de tarjeta creados`)
    console.log(`      Visa: saldo inicial $${cardVisaStartingBalance} - pagos $${totalPaidByCard(cardVisaId)} = saldo final $${cardVisa.currentBalance}`)
    console.log(`      Mastercard: saldo inicial $${cardMastercardStartingBalance} - pagos $${totalPaidByCard(cardMastercardId)} = saldo final $${cardMastercard.currentBalance}`)
  }

  console.log('\n✨ ¡Datos de prueba generados con éxito para', email, '!')
  console.log('Todos los registros tienen "Dato de prueba generado por seed-mock-data.ts" en su campo de notas, para poder identificarlos y borrarlos fácilmente más adelante si hace falta.')
}

main().catch((err) => {
  console.error('❌ Error generando datos de prueba:', err)
  process.exit(1)
})
