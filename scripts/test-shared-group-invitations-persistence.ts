/**
 * Test de integración REAL contra Google Sheets para la persistencia de
 * invitaciones de Gastos Compartidos V2 (Fase 4.1). Crea datos de prueba en
 * el spreadsheet configurado en .env.local y los borra todos en un
 * `finally`, sin tocar SharedGroups/SharedGroupMembers existentes ni
 * SharedExpenses (legacy).
 *
 * Acotado a propósito: una sola pasada lineal, sin loops, sin reintentos.
 * Si Google Sheets responde 429, el script debe fallar visiblemente ahí
 * mismo (no se atrapa el error para reintentar) — correr una sola vez.
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-group-invitations-persistence.ts dotenv_config_path=.env.local
 */
import {
  createSharedGroup,
  deleteSharedGroup,
  createSharedGroupMember,
  deleteSharedGroupMember,
  getSharedGroupInvitationById,
  getSharedGroupInvitationsByGroup,
  getSharedGroupInvitationsByMember,
  getSharedGroupInvitationsByTargetEmail,
  createSharedGroupInvitation,
  updateSharedGroupInvitation,
  deleteSharedGroupInvitation,
} from '../lib/googleSheets'
import { verifyInvitationToken } from '../lib/sharedGroupInvitations'

const DIEGO_USER_ID = '100827254183186994825' // cuenta mock real usada en esta sesión

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

async function main() {
  let groupId: string | null = null
  let memberId: string | null = null
  let invitationId: string | null = null

  try {
    const { group, creatorMember } = await createSharedGroup(DIEGO_USER_ID, {
      name: 'Casa Invitaciones (test)',
      creatorName: 'Diego (test)',
    })
    groupId = group.id
    void creatorMember

    const laura = await createSharedGroupMember(groupId, { name: 'Laura (test)' })
    memberId = laura.id
    check('Member shadow creado sin userId', laura.userId === undefined)

    console.log('\n=== Crear invitación: token plano solo en el resultado de create ===')
    const { invitation, token } = await createSharedGroupInvitation(
      groupId,
      memberId,
      DIEGO_USER_ID,
      '  Laura@Email.COM  '
    )
    invitationId = invitation.id
    check('Email persistido normalizado (trim + lowercase)', invitation.targetEmail === 'laura@email.com', invitation.targetEmail)
    check('Status inicial es pending', invitation.status === 'pending')
    check('Token plano no vacío', typeof token === 'string' && token.length > 0)
    check('tokenHash persistido es distinto al token plano', invitation.tokenHash !== token)
    check('El objeto invitation NO tiene un campo "token"', !('token' in (invitation as unknown as Record<string, unknown>)))

    console.log('\n=== Lectura por id: el token plano nunca se reconstruye ===')
    const fetchedById = await getSharedGroupInvitationById(invitationId)
    check('Se encuentra por id', fetchedById?.id === invitationId)
    check('tokenHash leído coincide con el persistido al crear', fetchedById?.tokenHash === invitation.tokenHash)
    check('verifyInvitationToken valida el token original contra el hash leído', !!fetchedById && verifyInvitationToken(token, fetchedById.tokenHash))
    check('La fila leída NO expone el token plano', !('token' in (fetchedById as unknown as Record<string, unknown>)))

    console.log('\n=== Listados: por grupo, por member, por email ===')
    const byGroup = await getSharedGroupInvitationsByGroup(groupId)
    check('Aparece en el listado por grupo', byGroup.some((i) => i.id === invitationId))

    const byMember = await getSharedGroupInvitationsByMember(groupId, memberId)
    check('Aparece en el listado por member', byMember.length === 1 && byMember[0].id === invitationId)

    const byEmail = await getSharedGroupInvitationsByTargetEmail('LAURA@EMAIL.COM')
    check('Aparece en el listado por email (normalizado en la búsqueda también)', byEmail.some((i) => i.id === invitationId))

    console.log('\n=== Transición de status: pending -> accepted ===')
    const accepted = await updateSharedGroupInvitation(invitationId, 'accepted')
    check('Status pasó a accepted', accepted.status === 'accepted')
    check('respondedAt quedó seteado', !!accepted.respondedAt)

    console.log('\n=== Transición inválida rechazada también a nivel de persistencia (no solo en el helper puro) ===')
    try {
      await updateSharedGroupInvitation(invitationId, 'pending')
      check('accepted -> pending debía lanzar y no lanzó', false)
    } catch (e) {
      check('accepted -> pending lanzó el error esperado', (e as Error).message.includes('No se puede pasar de'), (e as Error).message)
    }

    console.log('\n=== Borrado físico (cascada administrativa, no "cancelar") ===')
    await deleteSharedGroupInvitation(invitationId)
    const afterDelete = await getSharedGroupInvitationById(invitationId)
    check('Ya no se encuentra tras borrarla', afterDelete === null)
    invitationId = null

    console.log('\n=== Limpieza ===')
    await deleteSharedGroupMember(memberId)
    memberId = null
    await deleteSharedGroup(groupId, DIEGO_USER_ID)
    groupId = null
  } catch (e) {
    const message = (e as Error)?.message || String(e)
    if (message.toLowerCase().includes('quota') || message.includes('429')) {
      console.error('\n429 real de Google Sheets — DETENIENDO el test, no se reintenta.')
      console.error(message)
    }
    throw e
  } finally {
    try {
      if (invitationId) await deleteSharedGroupInvitation(invitationId)
    } catch (e) {
      console.error('cleanup invitation:', e)
    }
    try {
      if (memberId) await deleteSharedGroupMember(memberId)
    } catch (e) {
      console.error('cleanup member:', e)
    }
    try {
      if (groupId) await deleteSharedGroup(groupId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup group:', e)
    }
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE PERSISTENCIA PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
