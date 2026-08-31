/**
 * Fase DB-4 — Contract tests de SharedGroupsRepository, corridos contra
 * PostgresSharedGroupsRepository sobre un Postgres LOCAL DESCARTABLE
 * (Docker). NO toca Google Sheets, NO usa Neon real, NO usa datos reales.
 * Todo sintético (emails *.test.local, userIds test-u-*).
 *
 * getSharedGroupsRepository() (producción) NO se toca ni se usa acá -- este
 * script instancia PostgresSharedGroupsRepository directamente.
 *
 * Ejecutar con (contra el Postgres descartable de esta fase):
 *   DATABASE_URL=postgresql://postgres:findia_test@localhost:5434/findia_db4 npx tsx scripts/db4-postgres-contract-tests.ts
 */
import { eq } from 'drizzle-orm'
import { PostgresSharedGroupsRepository } from '../lib/repositories/sharedGroups/postgresRepository'
import { getDb, closePool } from '../lib/db/client'
import * as schema from '../lib/db/schema'

let failures = 0
let idCounter = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}
function testId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}
async function expectError(label: string, fn: () => Promise<unknown>, messageIncludes?: string) {
  try {
    await fn()
    check(label, false, 'no lanzó ningún error')
  } catch (e) {
    const message = (e as Error)?.message || String(e)
    const ok = messageIncludes ? message.includes(messageIncludes) : true
    check(label, ok, { message })
  }
}

const repo = new PostgresSharedGroupsRepository()
const db = getDb()

// ============================================================================
// GROUPS
// ============================================================================
async function testGroups() {
  console.log('\n########## GROUPS ##########')
  const userId = testId('test-u-groups')

  const { group, creatorMember } = await repo.createGroup(userId, { name: 'DB4 Grupo Contract', creatorName: 'Creador Test' })
  check('create: group tiene id', !!group.id)
  check('create: creatorMember vinculado al userId', creatorMember.userId === userId)
  check('create: creatorMember.groupId === group.id', creatorMember.groupId === group.id)

  const fetched = await repo.getGroupById(group.id)
  check('get: devuelve el grupo correcto', fetched?.id === group.id && fetched.name === 'DB4 Grupo Contract')
  const missing = await repo.getGroupById(testId('no-existe'))
  check('get: null si no existe', missing === null)

  const renamed = await repo.updateGroup(group.id, userId, { name: 'DB4 Grupo Renombrado' })
  check('rename: nombre actualizado', renamed.name === 'DB4 Grupo Renombrado')
  await expectError('rename: por no-creador -> error', () => repo.updateGroup(group.id, testId('otro-user'), { name: 'X' }))

  const summary = await repo.getGroupsSummaryForUser(userId)
  check('summary: incluye el grupo', summary.some((s) => s.group.id === group.id))
  const mine = summary.find((s) => s.group.id === group.id)
  check('summary: myMemberId correcto', mine?.myMemberId === creatorMember.id)
  check('summary: members incluye al creador', !!mine?.members.find((m) => m.id === creatorMember.id))

  await repo.deleteGroupCascade(group.id, userId)
  check('cascade delete: grupo ya no existe', (await repo.getGroupById(group.id)) === null)
}

// ============================================================================
// MEMBERS
// ============================================================================
async function testMembers() {
  console.log('\n########## MEMBERS ##########')
  const ownerId = testId('test-u-members-owner')
  const { group } = await repo.createGroup(ownerId, { name: 'DB4 Grupo Members', creatorName: 'Owner' })

  const shadow = await repo.createMember(group.id, { name: 'Shadow Persona', email: 'shadow@test.local' })
  check('shadow: sin userId', shadow.userId === undefined)

  const linkedUserId = testId('test-u-linked')
  const linked = await repo.createMember(group.id, { name: 'Linked Persona', userId: linkedUserId })
  check('linked: userId seteado', linked.userId === linkedUserId)

  await expectError(
    'duplicate userId en el mismo grupo -> error',
    () => repo.createMember(group.id, { name: 'Otro con mismo user', userId: linkedUserId }),
    'ya es miembro'
  )

  await expectError(
    'duplicate email normalizado en el mismo grupo -> error',
    () => repo.createMember(group.id, { name: 'Otro con mismo email', email: 'Shadow@Test.Local' }),
    'ese email'
  )

  const toLinkUserId = testId('test-u-tolink')
  const linkedShadow = await repo.linkMemberToUser(shadow.id, toLinkUserId)
  check('link shadow: mismo memberId preservado', linkedShadow.id === shadow.id)
  check('link shadow: userId correcto', linkedShadow.userId === toLinkUserId)

  const idempotent = await repo.linkMemberToUser(shadow.id, toLinkUserId)
  check('link doble (idempotente): no lanza, mismo resultado', idempotent.id === shadow.id && idempotent.userId === toLinkUserId)
  await expectError('link a otro userId estando ya vinculado -> error', () => repo.linkMemberToUser(shadow.id, testId('tercero')), 'ya está vinculado')

  const { expense } = await repo.createExpense(group.id, ownerId, {
    description: 'Gasto de referencia',
    amount: 100,
    currency: 'pesos',
    paidByMemberId: linked.id,
    date: '2026-01-15',
    splits: [
      { memberId: linked.id, amount: 50 },
      { memberId: shadow.id, amount: 50 },
    ],
  })
  check('member referenciado: isMemberReferenced true', await repo.isMemberReferenced(group.id, linked.id))
  await expectError('borrar member referenciado -> error (ON DELETE RESTRICT)', () => repo.deleteMember(linked.id))

  const unreferenced = await repo.createMember(group.id, { name: 'Sin movimientos' })
  check('member sin referencias: isMemberReferenced false', !(await repo.isMemberReferenced(group.id, unreferenced.id)))
  await repo.deleteMember(unreferenced.id)
  check('member sin referencias: borrado OK', (await repo.getMembers(group.id)).every((m) => m.id !== unreferenced.id))

  await repo.deleteExpense(expense.id, ownerId)
  await repo.deleteGroupCascade(group.id, ownerId)
}

// ============================================================================
// EXPENSES
// ============================================================================
async function testExpenses() {
  console.log('\n########## EXPENSES ##########')
  const ownerId = testId('test-u-expenses-owner')
  const { group, creatorMember } = await repo.createGroup(ownerId, { name: 'DB4 Grupo Expenses', creatorName: 'Owner' })
  const memberB = await repo.createMember(group.id, { name: 'B' })
  const memberC = await repo.createMember(group.id, { name: 'C' })

  const { expense, splits } = await repo.createExpense(group.id, ownerId, {
    description: 'Cena',
    amount: 100,
    currency: 'pesos',
    paidByMemberId: creatorMember.id,
    date: '2026-02-01',
    // Remainder de centavos ya calculado afuera (33.34/33.33/33.33) -- el
    // repository NO recalcula, solo persiste tal cual.
    splits: [
      { memberId: creatorMember.id, amount: 33.34 },
      { memberId: memberB.id, amount: 33.33 },
      { memberId: memberC.id, amount: 33.33 },
    ],
  })
  check('create: expense creado', !!expense.id)
  check('create: 3 splits creados', splits.length === 3)
  check('create: remainder de centavos preservado tal cual', splits.find((s) => s.memberId === creatorMember.id)?.amount === 33.34)

  const listed = await repo.getExpenses(group.id)
  check('list: incluye el gasto', listed.some((e) => e.id === expense.id))

  const updated = await repo.updateExpense(expense.id, ownerId, { description: 'Cena actualizada' })
  check('update: descripción actualizada, resto intacto', updated.description === 'Cena actualizada' && updated.amount === 100)

  await expectError(
    'update: cambiar amount sin splits -> error',
    () => repo.updateExpense(expense.id, ownerId, { amount: 200 })
  )

  await repo.deleteExpense(expense.id, ownerId)
  check('delete: expense ya no está en la lista', (await repo.getExpenses(group.id)).every((e) => e.id !== expense.id))
  const splitsAfterDelete = await repo.getSplitsForExpenseIds([expense.id])
  check('delete: splits desaparecieron en cascada (ON DELETE CASCADE)', splitsAfterDelete.length === 0)

  await repo.deleteGroupCascade(group.id, ownerId)
}

// ============================================================================
// SETTLEMENTS
// ============================================================================
async function testSettlements() {
  console.log('\n########## SETTLEMENTS ##########')
  const ownerId = testId('test-u-settlements-owner')
  const { group, creatorMember } = await repo.createGroup(ownerId, { name: 'DB4 Grupo Settlements', creatorName: 'Owner' })
  const memberB = await repo.createMember(group.id, { name: 'B' })

  // Gasto en pesos: B le debe 100 a Owner. Gasto en usd: B le debe 20 a Owner.
  await repo.createExpense(group.id, ownerId, {
    description: 'Gasto pesos',
    amount: 200,
    currency: 'pesos',
    paidByMemberId: creatorMember.id,
    date: '2026-02-01',
    splits: [
      { memberId: creatorMember.id, amount: 100 },
      { memberId: memberB.id, amount: 100 },
    ],
  })
  await repo.createExpense(group.id, ownerId, {
    description: 'Gasto usd',
    amount: 40,
    currency: 'usd',
    paidByMemberId: creatorMember.id,
    date: '2026-02-01',
    splits: [
      { memberId: creatorMember.id, amount: 20 },
      { memberId: memberB.id, amount: 20 },
    ],
  })

  const settlementPesos = await repo.createSettlement(group.id, ownerId, {
    paidByMemberId: memberB.id,
    paidToMemberId: creatorMember.id,
    amount: 40,
    currency: 'pesos',
    date: '2026-02-05',
  })
  check('create: settlement en pesos creado', settlementPesos.currency === 'pesos')

  const settlementUsd = await repo.createSettlement(group.id, ownerId, {
    paidByMemberId: memberB.id,
    paidToMemberId: creatorMember.id,
    amount: 20,
    currency: 'usd',
    date: '2026-02-05',
  })
  check('create: settlement en usd (moneda separada) creado', settlementUsd.currency === 'usd' && settlementUsd.amount === 20)

  const list = await repo.getSettlements(group.id)
  check('list: 2 settlements', list.length === 2)

  const updatedSettlement = await repo.updateSettlement(settlementPesos.id, ownerId, { notes: 'nota actualizada' })
  check('update: notes actualizado', updatedSettlement.notes === 'nota actualizada')

  await expectError(
    'same payer/payee -> rechazado',
    () => repo.createSettlement(group.id, ownerId, { paidByMemberId: memberB.id, paidToMemberId: memberB.id, amount: 10, currency: 'pesos', date: '2026-02-06' }),
    'no pueden ser el mismo'
  )
  await expectError(
    'amount <= 0 -> rechazado',
    () => repo.createSettlement(group.id, ownerId, { paidByMemberId: memberB.id, paidToMemberId: creatorMember.id, amount: 0, currency: 'pesos', date: '2026-02-06' }),
    'mayor a 0'
  )
  await expectError(
    'overpayment (supera la deuda restante) -> rechazado',
    () => repo.createSettlement(group.id, ownerId, { paidByMemberId: memberB.id, paidToMemberId: creatorMember.id, amount: 1000, currency: 'pesos', date: '2026-02-06' }),
    'supera la deuda'
  )

  await repo.deleteSettlement(settlementUsd.id, ownerId)
  check('delete: settlement eliminado', (await repo.getSettlements(group.id)).every((s) => s.id !== settlementUsd.id))

  await repo.deleteGroupCascade(group.id, ownerId)
}

// ============================================================================
// INVITATIONS
// ============================================================================
async function testInvitations() {
  console.log('\n########## INVITATIONS ##########')
  const ownerId = testId('test-u-invitations-owner')
  const { group } = await repo.createGroup(ownerId, { name: 'DB4 Grupo Invitations', creatorName: 'Owner' })
  const shadow = await repo.createMember(group.id, { name: 'Invitado', email: 'invitado@test.local' })

  const { invitation, token } = await repo.createInvitation(group.id, shadow.id, ownerId, 'Invitado@Test.Local')
  check('create: pending', invitation.status === 'pending')
  check('create: email normalizado (lowercase)', invitation.targetEmail === 'invitado@test.local')
  check('create: token plano no vacío, distinto del hash', typeof token === 'string' && token.length > 0 && token !== invitation.tokenHash)

  await expectError(
    'duplicate pending (mismo member) -> rechazado (unique index)',
    () => repo.createInvitation(group.id, shadow.id, ownerId, 'invitado@test.local'),
    'invitación pendiente'
  )

  check('get by id', (await repo.getInvitationById(invitation.id))?.id === invitation.id)
  check('get by group', (await repo.getInvitationsByGroup(group.id)).some((i) => i.id === invitation.id))
  check('get by member', (await repo.getInvitationsByMember(group.id, shadow.id)).some((i) => i.id === invitation.id))
  check('get by target email', (await repo.getInvitationsByTargetEmail('invitado@test.local')).some((i) => i.id === invitation.id))

  const details = await repo.getInvitationsWithDetailsForTargetEmail('invitado@test.local')
  const detail = details.find((i) => i.id === invitation.id)
  check('details: groupName correcto', detail?.groupName === 'DB4 Grupo Invitations')
  check('details: inviterName correcto', detail?.inviterName === 'Owner')

  // accept: link member + updateInvitationStatus (mismo orden que el handler real)
  const accepteeUserId = testId('test-u-acceptee')
  await repo.linkMemberToUser(shadow.id, accepteeUserId)
  const accepted = await repo.updateInvitationStatus(invitation.id, 'accepted')
  check('accept: status accepted', accepted.status === 'accepted')
  check('accept: respondedAt seteado', !!accepted.respondedAt)

  await expectError('terminal transition: accepted -> rejected no se puede reabrir', () => repo.updateInvitationStatus(invitation.id, 'rejected'))

  // reject sobre una invitación nueva
  const shadow2 = await repo.createMember(group.id, { name: 'Invitado 2', email: 'invitado2@test.local' })
  const sent2 = await repo.createInvitation(group.id, shadow2.id, ownerId, 'invitado2@test.local')
  const rejected = await repo.updateInvitationStatus(sent2.invitation.id, 'rejected')
  check('reject: status rejected', rejected.status === 'rejected')

  // cancel sobre una invitación nueva
  const shadow3 = await repo.createMember(group.id, { name: 'Invitado 3', email: 'invitado3@test.local' })
  const sent3 = await repo.createInvitation(group.id, shadow3.id, ownerId, 'invitado3@test.local')
  const cancelled = await repo.updateInvitationStatus(sent3.invitation.id, 'cancelled')
  check('cancel: status cancelled', cancelled.status === 'cancelled')

  let deleteMissingThrew = false
  try {
    await repo.deleteInvitation(testId('no-existe'))
  } catch {
    deleteMissingThrew = true
  }
  check('delete invitation inexistente: no lanza (no-op)', !deleteMissingThrew)

  await repo.deleteGroupCascade(group.id, ownerId)
}

// ============================================================================
// GROUP DELETE -- cero huérfanos
// ============================================================================
async function testGroupDeleteCascade() {
  console.log('\n########## GROUP DELETE (cero huérfanos) ##########')
  const ownerId = testId('test-u-cascade-owner')
  const { group, creatorMember } = await repo.createGroup(ownerId, { name: 'DB4 Grupo Cascade', creatorName: 'Owner' })
  const memberB = await repo.createMember(group.id, { name: 'B', email: 'cascadeb@test.local' })

  const { expense } = await repo.createExpense(group.id, ownerId, {
    description: 'Gasto cascade',
    amount: 100,
    currency: 'pesos',
    paidByMemberId: creatorMember.id,
    date: '2026-03-01',
    splits: [
      { memberId: creatorMember.id, amount: 50 },
      { memberId: memberB.id, amount: 50 },
    ],
  })
  await repo.createSettlement(group.id, ownerId, { paidByMemberId: memberB.id, paidToMemberId: creatorMember.id, amount: 10, currency: 'pesos', date: '2026-03-02' })
  await repo.createInvitation(group.id, memberB.id, ownerId, 'cascadeb@test.local')

  await repo.deleteGroupCascade(group.id, ownerId)

  const [members, expenses, splits, settlements, invitations] = await Promise.all([
    db.select().from(schema.sharedGroupMembers).where(eq(schema.sharedGroupMembers.groupId, group.id)),
    db.select().from(schema.sharedGroupExpenses).where(eq(schema.sharedGroupExpenses.groupId, group.id)),
    db.select().from(schema.sharedGroupSplits).where(eq(schema.sharedGroupSplits.expenseId, expense.id)),
    db.select().from(schema.sharedGroupSettlements).where(eq(schema.sharedGroupSettlements.groupId, group.id)),
    db.select().from(schema.sharedGroupInvitations).where(eq(schema.sharedGroupInvitations.groupId, group.id)),
  ])
  check('cascade: cero members huérfanos', members.length === 0)
  check('cascade: cero expenses huérfanas', expenses.length === 0)
  check('cascade: cero splits huérfanos', splits.length === 0)
  check('cascade: cero settlements huérfanos', settlements.length === 0)
  check('cascade: cero invitations huérfanas', invitations.length === 0)
}

// ============================================================================
// ATOMICITY TESTS (DB-4 §24)
// ============================================================================
async function testAtomicity() {
  console.log('\n########## ATOMICITY ##########')

  // A) Mismo mecanismo transaccional que usa createGroup (2 inserts, 1
  // transacción): si el segundo insert viola una constraint real (NOT NULL),
  // el primero debe desaparecer también.
  {
    const groupId = testId('atomicity-a-group')
    let threw = false
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.sharedGroups).values({ id: groupId, name: 'Atomicity A', createdBy: testId('u') })
        // @ts-expect-error -- forzando a propósito una violación NOT NULL real de la tabla.
        await tx.insert(schema.sharedGroupMembers).values({ id: testId('m'), groupId, name: null })
      })
    } catch {
      threw = true
    }
    check('A) transacción abortada lanzó error', threw)
    const [group] = await db.select().from(schema.sharedGroups).where(eq(schema.sharedGroups.id, groupId))
    check('A) group NO quedó persistido tras el rollback (mismo mecanismo que createGroup)', !group)
  }

  // B) Mismo mecanismo que usa createExpense (insert expense + insert splits
  // en 1 transacción): un split con memberId inexistente viola la FK real.
  {
    const ownerId = testId('test-u-atomicity-b')
    const { group, creatorMember } = await repo.createGroup(ownerId, { name: 'DB4 Atomicity B', creatorName: 'Owner' })
    const expenseId = testId('atomicity-b-expense')
    let threw = false
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.sharedGroupExpenses).values({
          id: expenseId, groupId: group.id, description: 'x', amount: '100', currency: 'pesos',
          paidByMemberId: creatorMember.id, date: '2026-01-01', createdBy: ownerId,
        })
        await tx.insert(schema.sharedGroupSplits).values({ id: testId('s'), expenseId, memberId: testId('no-existe-member'), amount: '100' })
      })
    } catch {
      threw = true
    }
    check('B) transacción abortada lanzó error', threw)
    const [expense] = await db.select().from(schema.sharedGroupExpenses).where(eq(schema.sharedGroupExpenses.id, expenseId))
    check('B) expense NO quedó huérfana tras el rollback (mismo mecanismo que createExpense)', !expense)
    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // C) 2 SEND concurrentes al mismo member -> exactamente 1 creada (unique index parcial)
  {
    const ownerId = testId('test-u-atomicity-c')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4 Atomicity C', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'Race', email: 'racec@test.local' })

    const results = await Promise.allSettled([
      repo.createInvitation(group.id, shadow.id, ownerId, 'racec@test.local'),
      repo.createInvitation(group.id, shadow.id, ownerId, 'racec@test.local'),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    check('C) exactamente 1 invitation creada de 2 intentos concurrentes', fulfilled.length === 1)
    check('C) la otra fue rechazada', rejected.length === 1)
    const stored = await repo.getInvitationsByMember(group.id, shadow.id)
    check('C) exactamente 1 fila pending en la base', stored.filter((i) => i.status === 'pending').length === 1)
    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // D) accept vs cancel concurrentes sobre la MISMA invitación -> exactamente 1 gana
  {
    const ownerId = testId('test-u-atomicity-d')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4 Atomicity D', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'RaceD', email: 'raced@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow.id, ownerId, 'raced@test.local')

    const results = await Promise.allSettled([
      repo.updateInvitationStatus(invitation.id, 'accepted'),
      repo.updateInvitationStatus(invitation.id, 'cancelled'),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ status: string }>[]
    check('D) exactamente 1 transición ganó', fulfilled.length === 1)
    const final = await repo.getInvitationById(invitation.id)
    check('D) el status final coincide con la transición que ganó', final?.status === fulfilled[0]?.value.status)
    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // E) delete group -> cero huérfanos (ya cubierto en detalle por testGroupDeleteCascade)
  check('E) cubierto por la sección GROUP DELETE de arriba', true)
}

// ============================================================================
// CONCURRENCY TESTS (DB-4 §25) -- 2 operaciones simultáneas alcanzan
// ============================================================================
async function testConcurrency() {
  console.log('\n########## CONCURRENCY ##########')

  // Member duplicate race: 2 createMember concurrentes con el mismo userId -> exactamente 1
  {
    const ownerId = testId('test-u-concurrency-member')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4 Concurrency Member', creatorName: 'Owner' })
    const raceUserId = testId('race-user')

    const results = await Promise.allSettled([
      repo.createMember(group.id, { name: 'Race A', userId: raceUserId }),
      repo.createMember(group.id, { name: 'Race B', userId: raceUserId }),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    check('member race: exactamente 1 creado de 2 intentos concurrentes con el mismo userId', fulfilled.length === 1)
    const members = await repo.getMembers(group.id)
    check('member race: exactamente 1 fila con ese userId en la base', members.filter((m) => m.userId === raceUserId).length === 1)
    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // Settlement overpayment race: 2 settlements concurrentes por el TOTAL de la deuda -> exactamente 1
  {
    const ownerId = testId('test-u-concurrency-settlement')
    const { group, creatorMember } = await repo.createGroup(ownerId, { name: 'DB4 Concurrency Settlement', creatorName: 'Owner' })
    const memberB = await repo.createMember(group.id, { name: 'B' })

    // B le debe 100 pesos a Owner.
    await repo.createExpense(group.id, ownerId, {
      description: 'Gasto para la carrera',
      amount: 200,
      currency: 'pesos',
      paidByMemberId: creatorMember.id,
      date: '2026-04-01',
      splits: [
        { memberId: creatorMember.id, amount: 100 },
        { memberId: memberB.id, amount: 100 },
      ],
    })

    const results = await Promise.allSettled([
      repo.createSettlement(group.id, ownerId, { paidByMemberId: memberB.id, paidToMemberId: creatorMember.id, amount: 100, currency: 'pesos', date: '2026-04-02' }),
      repo.createSettlement(group.id, ownerId, { paidByMemberId: memberB.id, paidToMemberId: creatorMember.id, amount: 100, currency: 'pesos', date: '2026-04-02' }),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    check('settlement race: exactamente 1 de los 2 pagos concurrentes por el total de la deuda se aceptó', fulfilled.length === 1)
    check('settlement race: el otro fue rechazado por overpayment (advisory lock serializó la validación)', rejected.length === 1)

    const settlements = await repo.getSettlements(group.id)
    const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0)
    check('settlement race: la suma persistida es 100, no 200 (no se duplicó el pago)', totalSettled === 100)

    await repo.deleteGroupCascade(group.id, ownerId)
  }
}

// ============================================================================
// FASE DB-4.1 -- acceptInvitationAndLinkMember / linkMemberAndCancelPendingInvitation
// ============================================================================
async function testAcceptInvitationAndLinkMember() {
  console.log('\n########## DB-4.1: ACCEPT INVITATION AND LINK MEMBER ##########')

  // A) atomic success
  {
    const ownerId = testId('test-u-db41-accept-a-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Accept A', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'Invitado', email: 'db41accepta@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow.id, ownerId, 'db41accepta@test.local')
    const accepteeUserId = testId('test-u-db41-acceptee-a')

    const result = await repo.acceptInvitationAndLinkMember(invitation.id, accepteeUserId)
    check('A) invitation accepted', result.invitation.status === 'accepted')
    check('A) respondedAt presente', !!result.invitation.respondedAt)
    check('A) member.userId seteado', result.member.userId === accepteeUserId)
    check('A) mismo memberId', result.member.id === shadow.id)

    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // B) rollback: userId ya usado por OTRO member del mismo grupo -> el link
  // real falla por el unique constraint DESPUÉS de que el UPDATE de la
  // invitation ya corrió en la misma transacción -- debe revertir TODO.
  {
    const ownerId = testId('test-u-db41-accept-b-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Accept B', creatorName: 'Owner' })
    const takenUserId = testId('test-u-db41-taken')
    const member1 = await repo.createMember(group.id, { name: 'Ya vinculado', userId: takenUserId })
    const shadow2 = await repo.createMember(group.id, { name: 'Invitado 2', email: 'db41acceptb@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow2.id, ownerId, 'db41acceptb@test.local')

    await expectError('B) accept con userId ya usado por otro member -> lanza', () =>
      repo.acceptInvitationAndLinkMember(invitation.id, takenUserId)
    )

    const invitationAfter = await repo.getInvitationById(invitation.id)
    check('B) invitation SIGUE pending tras el rollback', invitationAfter?.status === 'pending')
    const membersAfter = await repo.getMembers(group.id)
    const shadow2After = membersAfter.find((m) => m.id === shadow2.id)
    check('B) member SIGUE shadow tras el rollback', shadow2After?.userId === undefined)
    check('B) member1 no se tocó', membersAfter.find((m) => m.id === member1.id)?.userId === takenUserId)

    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // C) replay: ejecutar accept, repetir -- no debe corromper estado.
  {
    const ownerId = testId('test-u-db41-accept-c-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Accept C', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'Invitado C', email: 'db41acceptc@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow.id, ownerId, 'db41acceptc@test.local')
    const accepteeUserId = testId('test-u-db41-acceptee-c')

    const first = await repo.acceptInvitationAndLinkMember(invitation.id, accepteeUserId)
    const second = await repo.acceptInvitationAndLinkMember(invitation.id, accepteeUserId)
    check('C) replay no lanza', true) // si llegó hasta acá, no lanzó
    check('C) mismo resultado (member/invitation) en ambas corridas', second.member.id === first.member.id && second.invitation.id === first.invitation.id)
    check('C) status sigue accepted (no se corrompió)', second.invitation.status === 'accepted')
    const membersAfter = await repo.getMembers(group.id)
    check('C) exactamente 1 member vinculado a ese userId (no se duplicó nada)', membersAfter.filter((m) => m.userId === accepteeUserId).length === 1)

    await repo.deleteGroupCascade(group.id, ownerId)
  }
}

async function testLinkMemberAndCancelPendingInvitation() {
  console.log('\n########## DB-4.1: LINK MEMBER AND CANCEL PENDING INVITATION ##########')

  // D) atomic success
  {
    const ownerId = testId('test-u-db41-link-d-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Link D', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'Shadow D', email: 'db41linkd@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow.id, ownerId, 'db41linkd@test.local')
    const linkUserId = testId('test-u-db41-link-d')

    const result = await repo.linkMemberAndCancelPendingInvitation(shadow.id, linkUserId)
    check('D) mismo memberId', result.member.id === shadow.id)
    check('D) member.userId seteado', result.member.userId === linkUserId)
    check('D) invitation cancelada', result.cancelledInvitationIds.includes(invitation.id))
    const invitationAfter = await repo.getInvitationById(invitation.id)
    check('D) invitation.status === cancelled', invitationAfter?.status === 'cancelled')

    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // E) rollback: el link en sí falla (userId ya usado por otro member) ->
  // la invitation pending NO debe quedar cancelada (todo o nada).
  {
    const ownerId = testId('test-u-db41-link-e-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Link E', creatorName: 'Owner' })
    const takenUserId = testId('test-u-db41-link-e-taken')
    await repo.createMember(group.id, { name: 'Ya vinculado E', userId: takenUserId })
    const shadow = await repo.createMember(group.id, { name: 'Shadow E', email: 'db41linke@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow.id, ownerId, 'db41linke@test.local')

    await expectError('E) link con userId ya usado por otro member -> lanza', () =>
      repo.linkMemberAndCancelPendingInvitation(shadow.id, takenUserId)
    )

    const invitationAfter = await repo.getInvitationById(invitation.id)
    check('E) invitation SIGUE pending (el rollback deshizo la cancelación también)', invitationAfter?.status === 'pending')
    const memberAfter = (await repo.getMembers(group.id)).find((m) => m.id === shadow.id)
    check('E) member SIGUE shadow', memberAfter?.userId === undefined)

    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // F) sin invitation -- el link funciona normal, sin nada para cancelar.
  {
    const ownerId = testId('test-u-db41-link-f-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Link F', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'Shadow F', email: 'db41linkf@test.local' })
    const linkUserId = testId('test-u-db41-link-f')

    const result = await repo.linkMemberAndCancelPendingInvitation(shadow.id, linkUserId)
    check('F) member linkeado igual sin invitation', result.member.userId === linkUserId)
    check('F) cancelledInvitationIds vacío', result.cancelledInvitationIds.length === 0)

    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // G) invitation en estado terminal -- no se reabre ni se toca.
  {
    const ownerId = testId('test-u-db41-link-g-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Link G', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'Shadow G', email: 'db41linkg@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow.id, ownerId, 'db41linkg@test.local')
    await repo.updateInvitationStatus(invitation.id, 'rejected')
    const linkUserId = testId('test-u-db41-link-g')

    const result = await repo.linkMemberAndCancelPendingInvitation(shadow.id, linkUserId)
    check('G) member linkeado igual', result.member.userId === linkUserId)
    check('G) NO se "canceló" la invitation terminal (no aparece en la lista de canceladas ahora)', result.cancelledInvitationIds.length === 0)
    const invitationAfter = await repo.getInvitationById(invitation.id)
    check('G) invitation SIGUE rejected (no se reabrió ni se tocó)', invitationAfter?.status === 'rejected')

    await repo.deleteGroupCascade(group.id, ownerId)
  }
}

async function testDb41Concurrency() {
  console.log('\n########## DB-4.1: CONCURRENCY ##########')

  // A) accept vs cancel simultáneos sobre la MISMA invitación -> exactamente 1 gana.
  {
    const ownerId = testId('test-u-db41-conc-a-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Concurrency A', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'Race A', email: 'db41conca@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow.id, ownerId, 'db41conca@test.local')
    const raceUserId = testId('test-u-db41-conc-a')

    const results = await Promise.allSettled([
      repo.acceptInvitationAndLinkMember(invitation.id, raceUserId),
      repo.updateInvitationStatus(invitation.id, 'cancelled'),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    check('A) exactamente 1 de las 2 operaciones concurrentes ganó', fulfilled.length === 1)

    const finalInvitation = await repo.getInvitationById(invitation.id)
    const finalMember = (await repo.getMembers(group.id)).find((m) => m.id === shadow.id)
    if (finalInvitation?.status === 'accepted') {
      check('A) si ganó accept: member quedó linkeado (coherente)', finalMember?.userId === raceUserId)
    } else {
      check('A) si ganó cancel: invitation cancelled', finalInvitation?.status === 'cancelled')
      check('A) si ganó cancel: member NUNCA quedó linkeado (nada incoherente)', finalMember?.userId === undefined)
    }

    await repo.deleteGroupCascade(group.id, ownerId)
  }

  // B) direct-link vs accept simultáneos sobre el mismo member/invitation.
  {
    const ownerId = testId('test-u-db41-conc-b-owner')
    const { group } = await repo.createGroup(ownerId, { name: 'DB4.1 Concurrency B', creatorName: 'Owner' })
    const shadow = await repo.createMember(group.id, { name: 'Race B', email: 'db41concb@test.local' })
    const { invitation } = await repo.createInvitation(group.id, shadow.id, ownerId, 'db41concb@test.local')
    const raceUserId = testId('test-u-db41-conc-b')

    await Promise.allSettled([
      repo.acceptInvitationAndLinkMember(invitation.id, raceUserId),
      repo.linkMemberAndCancelPendingInvitation(shadow.id, raceUserId),
    ])

    const finalMember = (await repo.getMembers(group.id)).find((m) => m.id === shadow.id)
    const finalInvitation = await repo.getInvitationById(invitation.id)
    check('B) member terminó vinculado al MISMO userId que ambas operaciones intentaban (invariante: máximo 1 userId)', finalMember?.userId === raceUserId)
    check('B) invitation terminó en un estado terminal (accepted o cancelled, nunca pending)', finalInvitation?.status !== 'pending')
    check('B) nunca quedó estado parcial (member sin userId con invitation ya resuelta)', !(finalMember?.userId === undefined && finalInvitation?.status !== 'pending'))

    await repo.deleteGroupCascade(group.id, ownerId)
  }
}

// ============================================================================
async function main() {
  await testGroups()
  await testMembers()
  await testExpenses()
  await testSettlements()
  await testInvitations()
  await testGroupDeleteCascade()
  await testAtomicity()
  await testConcurrency()
  await testAcceptInvitationAndLinkMember()
  await testLinkMemberAndCancelPendingInvitation()
  await testDb41Concurrency()

  console.log(`\n${failures === 0 ? 'TODOS LOS CONTRACT TESTS DE DB-4 PASARON' : `${failures} TEST(S) FALLARON`}`)
  await closePool()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('Error fatal:', e)
  await closePool()
  process.exit(1)
})
