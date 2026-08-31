/**
 * Fase DB-6 — batería remota ACOTADA contra Neon staging (DB-6 §17).
 * Usa PostgresSharedGroupsRepository real contra Neon real. Todos los datos
 * nombrados "DB6 QA ..." para poder limpiarlos dirigido después (DB-6 §24).
 * NUNCA toca los 2 grupos migrados (baseline).
 *
 * Ejecutar con: DATABASE_URL=<Neon staging> npx tsx scripts/db6-remote-smoke-tests.ts
 */
import { PostgresSharedGroupsRepository } from '../lib/repositories/sharedGroups/postgresRepository'
import { closePool } from '../lib/db/client'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

const repo = new PostgresSharedGroupsRepository()
const createdGroupIds: string[] = []
const ownerId = `db6-qa-owner-${Date.now()}`

async function main() {
  const t0 = Date.now()

  console.log('\n--- create group ---')
  const tCreate0 = Date.now()
  const { group, creatorMember } = await repo.createGroup(ownerId, { name: 'DB6 QA Group', creatorName: 'DB6 QA Owner' })
  createdGroupIds.push(group.id)
  console.log(`  timing: ${Date.now() - tCreate0}ms`)
  check('create group: ok', !!group.id && creatorMember.userId === ownerId)

  console.log('\n--- list groups (summary) ---')
  const tList0 = Date.now()
  const summary = await repo.getGroupsSummaryForUser(ownerId)
  console.log(`  timing: ${Date.now() - tList0}ms`)
  check('list groups: incluye el grupo DB6 QA', summary.some((s) => s.group.id === group.id))

  console.log('\n--- add member (shadow) ---')
  const member = await repo.createMember(group.id, { name: 'DB6 QA Member', email: 'db6qa@test.local' })
  check('add member: shadow creado', member.userId === undefined)

  console.log('\n--- create expense ---')
  const tExpense0 = Date.now()
  const { expense } = await repo.createExpense(group.id, ownerId, {
    description: 'DB6 QA Expense',
    amount: 100,
    currency: 'pesos',
    paidByMemberId: creatorMember.id,
    date: '2026-01-01',
    splits: [
      { memberId: creatorMember.id, amount: 50 },
      { memberId: member.id, amount: 50 },
    ],
  })
  console.log(`  timing: ${Date.now() - tExpense0}ms`)
  check('create expense: ok', !!expense.id)

  console.log('\n--- create settlement ---')
  const tSettlement0 = Date.now()
  const settlement = await repo.createSettlement(group.id, ownerId, {
    paidByMemberId: member.id,
    paidToMemberId: creatorMember.id,
    amount: 20,
    currency: 'pesos',
    date: '2026-01-02',
  })
  console.log(`  timing: ${Date.now() - tSettlement0}ms`)
  check('create settlement: ok', settlement.amount === 20)

  console.log('\n--- invitation transition (create + accept via acceptInvitationAndLinkMember) ---')
  const { invitation } = await repo.createInvitation(group.id, member.id, ownerId, 'db6qa@test.local')
  check('invitation: pending', invitation.status === 'pending')
  const accepteeUserId = `db6-qa-acceptee-${Date.now()}`
  const acceptResult = await repo.acceptInvitationAndLinkMember(invitation.id, accepteeUserId)
  check('invitation: accepted + member linkeado', acceptResult.invitation.status === 'accepted' && acceptResult.member.userId === accepteeUserId)

  console.log('\n--- settlement concurrency / advisory lock remoto (DB-6 §16/§19) ---')
  const group2Data = await repo.createGroup(ownerId, { name: 'DB6 QA Concurrency Group', creatorName: 'DB6 QA Owner' })
  createdGroupIds.push(group2Data.group.id)
  const memberB = await repo.createMember(group2Data.group.id, { name: 'DB6 QA B' })
  await repo.createExpense(group2Data.group.id, ownerId, {
    description: 'DB6 QA Expense for race',
    amount: 200,
    currency: 'pesos',
    paidByMemberId: group2Data.creatorMember.id,
    date: '2026-01-01',
    splits: [
      { memberId: group2Data.creatorMember.id, amount: 100 },
      { memberId: memberB.id, amount: 100 },
    ],
  })
  const tRace0 = Date.now()
  const raceResults = await Promise.allSettled([
    repo.createSettlement(group2Data.group.id, ownerId, { paidByMemberId: memberB.id, paidToMemberId: group2Data.creatorMember.id, amount: 100, currency: 'pesos', date: '2026-01-03' }),
    repo.createSettlement(group2Data.group.id, ownerId, { paidByMemberId: memberB.id, paidToMemberId: group2Data.creatorMember.id, amount: 100, currency: 'pesos', date: '2026-01-03' }),
  ])
  console.log(`  timing (2 concurrentes): ${Date.now() - tRace0}ms`)
  const raceFulfilled = raceResults.filter((r) => r.status === 'fulfilled')
  const raceRejected = raceResults.filter((r) => r.status === 'rejected')
  check('advisory lock remoto: exactamente 1 de 2 settlements concurrentes se aceptó', raceFulfilled.length === 1)
  check('advisory lock remoto: el otro fue rechazado por overpayment', raceRejected.length === 1)

  console.log('\n--- cascade delete ---')
  await repo.deleteGroupCascade(group.id, ownerId)
  await repo.deleteGroupCascade(group2Data.group.id, ownerId)
  createdGroupIds.length = 0
  const afterDelete = await repo.getGroupById(group.id)
  check('cascade delete: grupo DB6 QA ya no existe', afterDelete === null)

  console.log(`\nTiming total: ${Date.now() - t0}ms`)
  console.log(`\n${failures === 0 ? 'TODOS LOS SMOKE TESTS REMOTOS DE DB-6 PASARON' : `${failures} TEST(S) FALLARON`}`)
  await closePool()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('Error fatal:', e)
  // best-effort cleanup de lo que se haya alcanzado a crear
  for (const id of createdGroupIds) {
    try {
      await repo.deleteGroupCascade(id, ownerId)
    } catch {
      console.error('No se pudo limpiar automáticamente el grupo', id, '-- revisar manualmente en staging.')
    }
  }
  await closePool()
  process.exit(1)
})
