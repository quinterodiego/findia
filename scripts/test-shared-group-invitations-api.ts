/**
 * Test de integración REAL contra Google Sheets para la API de invitaciones
 * de Gastos Compartidos V2 (Fase 4.2). Llama a los handlers directamente
 * (mismo patrón que test-shared-groups-api-1/2/3-*.ts), sin pasar por HTTP.
 *
 * Acotado a propósito: una sola pasada lineal, sin loops, sin reintentos.
 * Si Google Sheets responde 429, dejar que falle visiblemente ahí — no
 * atrapar para reintentar. Correr una sola vez.
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-group-invitations-api.ts dotenv_config_path=.env.local
 */
import { createSharedGroup, deleteSharedGroup, createSharedGroupMember, deleteSharedGroupMember, getSharedGroupMembers } from '../lib/googleSheets'
import { sendSharedGroupInvitationForUser } from '../app/api/shared-groups/[id]/invitations/handlers'
import { acceptSharedGroupInvitationForUser } from '../app/api/shared-group-invitations/[id]/accept/handlers'
import { rejectSharedGroupInvitationForUser } from '../app/api/shared-group-invitations/[id]/reject/handlers'
import { cancelSharedGroupInvitationForUser } from '../app/api/shared-group-invitations/[id]/handlers'
import { listMySharedGroupInvitationsForUser } from '../app/api/shared-group-invitations/handlers'
import { toPublicInvitation } from '../app/api/shared-groups/_lib/invitationDto'
import { ApiError } from '../app/api/shared-groups/_lib/apiError'

const DIEGO_USER_ID = '100827254183186994825' // cuenta mock real usada en esta sesión
const OUTSIDER_USER_ID = 'fake-outsider-test-999'
const LAURA_REAL_USER_ID = 'fake-laura-real-test-999'
const JUAN_REAL_USER_ID = 'fake-juan-real-test-999'

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
  let juanMemberId: string | null = null

  try {
    const { group } = await createSharedGroup(DIEGO_USER_ID, { name: 'Casa Invitaciones API (test)', creatorName: 'Diego (test)' })
    groupId = group.id

    const laura = await createSharedGroupMember(groupId, { name: 'Laura (test)', email: 'laura.invite.test@email.com' })
    lauraMemberId = laura.id
    const juan = await createSharedGroupMember(groupId, { name: 'Juan (test)', email: 'juan.invite.test@email.com' })
    juanMemberId = juan.id

    console.log('\n=== A) SEND: no-miembro no puede invitar -> 403 ===')
    await expectApiError('No-miembro invita -> 403', 403, () =>
      sendSharedGroupInvitationForUser(groupId!, OUTSIDER_USER_ID, { memberId: lauraMemberId })
    )

    console.log('\n=== B) SEND: miembro vinculado invita a Laura (shadow) ===')
    const sentLaura = await sendSharedGroupInvitationForUser(groupId, DIEGO_USER_ID, { memberId: lauraMemberId })
    check('Invitation creada en pending', sentLaura.invitation.status === 'pending')
    check('Email persistido normalizado', sentLaura.invitation.targetEmail === 'laura.invite.test@email.com')
    check('Token plano no vacío', typeof sentLaura.token === 'string' && sentLaura.token.length > 0)
    const publicLaura = toPublicInvitation(sentLaura.invitation)
    check('DTO público NO expone tokenHash', !('tokenHash' in (publicLaura as unknown as Record<string, unknown>)))

    console.log('\n=== C) SEND duplicado (mismo member, todavía pending) -> 409 ===')
    await expectApiError('Duplicate pending para el mismo member -> 409', 409, () =>
      sendSharedGroupInvitationForUser(groupId!, DIEGO_USER_ID, { memberId: lauraMemberId })
    )

    console.log('\n=== D) ACCEPT: token incorrecto -> 403 genérico ===')
    await expectApiError('Token incorrecto -> 403', 403, () =>
      acceptSharedGroupInvitationForUser(sentLaura.invitation.id, LAURA_REAL_USER_ID, 'laura.invite.test@email.com', false, { token: 'token-incorrecto' })
    )

    console.log('\n=== E) ACCEPT: email de sesión no coincide -> 403 genérico ===')
    await expectApiError('Email no coincide -> 403', 403, () =>
      acceptSharedGroupInvitationForUser(sentLaura.invitation.id, LAURA_REAL_USER_ID, 'otro-email@test.com', false, { token: sentLaura.token })
    )

    console.log('\n=== F) ACCEPT correcto: linkea exactamente el member existente ===')
    const accepted = await acceptSharedGroupInvitationForUser(
      sentLaura.invitation.id,
      LAURA_REAL_USER_ID,
      'Laura.Invite.Test@Email.com', // mayúsculas/espacios distintos a propósito -- debe normalizar igual
      false,
      { token: sentLaura.token }
    )
    check('Invitation pasó a accepted', accepted.status === 'accepted')
    check('respondedAt seteado', !!accepted.respondedAt)

    const membersAfterAccept = await getSharedGroupMembers(groupId)
    const lauraAfterAccept = membersAfterAccept.find((m) => m.id === lauraMemberId)
    check('El member sigue teniendo el MISMO id (no se creó uno nuevo)', lauraAfterAccept?.id === lauraMemberId)
    check('member.userId quedó vinculado a la cuenta real de Laura', lauraAfterAccept?.userId === LAURA_REAL_USER_ID)
    check('Cantidad de members del grupo sigue siendo 2 (no se duplicó ninguno)', membersAfterAccept.length === 2)

    console.log('\n=== G) ACCEPT doble (retry / doble click) -> idempotente, no lanza ===')
    const acceptedAgain = await acceptSharedGroupInvitationForUser(
      sentLaura.invitation.id,
      LAURA_REAL_USER_ID,
      'laura.invite.test@email.com',
      false,
      { token: sentLaura.token }
    )
    check('Segundo accept devuelve status accepted sin lanzar', acceptedAgain.status === 'accepted')

    console.log('\n=== H) REJECT sobre una invitación ya accepted -> 409 ===')
    await expectApiError('Reject sobre accepted -> 409', 409, () =>
      rejectSharedGroupInvitationForUser(sentLaura.invitation.id, 'laura.invite.test@email.com', false, { token: sentLaura.token })
    )

    console.log('\n=== I) SEND a Juan, luego REJECT correcto ===')
    const sentJuan = await sendSharedGroupInvitationForUser(groupId, DIEGO_USER_ID, { memberId: juanMemberId })
    const rejected = await rejectSharedGroupInvitationForUser(sentJuan.invitation.id, 'juan.invite.test@email.com', false, { token: sentJuan.token })
    check('Invitation de Juan pasó a rejected', rejected.status === 'rejected')

    const membersAfterReject = await getSharedGroupMembers(groupId)
    const juanAfterReject = membersAfterReject.find((m) => m.id === juanMemberId)
    check('Juan sigue shadow (reject no linkea member)', juanAfterReject?.userId === undefined)

    console.log('\n=== J) REJECT doble -> idempotente ===')
    const rejectedAgain = await rejectSharedGroupInvitationForUser(sentJuan.invitation.id, 'juan.invite.test@email.com', false, { token: sentJuan.token })
    check('Segundo reject devuelve rejected sin lanzar', rejectedAgain.status === 'rejected')

    console.log('\n=== K) Reinvitar a Juan tras el rechazo: crea una fila NUEVA ===')
    const sentJuanAgain = await sendSharedGroupInvitationForUser(groupId, DIEGO_USER_ID, { memberId: juanMemberId })
    check('La reinvitación es una invitation con id distinto', sentJuanAgain.invitation.id !== sentJuan.invitation.id)
    check('La reinvitación está pending', sentJuanAgain.invitation.status === 'pending')

    console.log('\n=== L) CANCEL por un tercero -> 403 ===')
    await expectApiError('Cancel por tercero -> 403', 403, () =>
      cancelSharedGroupInvitationForUser(sentJuanAgain.invitation.id, OUTSIDER_USER_ID)
    )

    console.log('\n=== M) CANCEL por el invitador (Diego) ===')
    const cancelled = await cancelSharedGroupInvitationForUser(sentJuanAgain.invitation.id, DIEGO_USER_ID)
    check('Invitation pasó a cancelled', cancelled.status === 'cancelled')

    const membersAfterCancel = await getSharedGroupMembers(groupId)
    const juanAfterCancel = membersAfterCancel.find((m) => m.id === juanMemberId)
    check('Juan sigue shadow (cancel no toca el member)', juanAfterCancel?.userId === undefined)

    console.log('\n=== N) CANCEL doble -> idempotente ===')
    const cancelledAgain = await cancelSharedGroupInvitationForUser(sentJuanAgain.invitation.id, DIEGO_USER_ID)
    check('Segundo cancel devuelve cancelled sin lanzar', cancelledAgain.status === 'cancelled')

    console.log('\n=== O) GET (listar mías): accepted/cancelled no aparecen, solo pending ===')
    const lauraInbox = await listMySharedGroupInvitationsForUser('laura.invite.test@email.com')
    check('Laura no tiene pending (la suya ya está accepted)', !lauraInbox.some((i) => i.id === sentLaura.invitation.id))
    const juanInbox = await listMySharedGroupInvitationsForUser('juan.invite.test@email.com')
    check('Juan no tiene pending (rejected y cancelled, ninguna pending)', !juanInbox.some((i) => i.id === sentJuan.invitation.id || i.id === sentJuanAgain.invitation.id))

    console.log('\n=== Limpieza ===')
    await deleteSharedGroupMember(lauraMemberId)
    lauraMemberId = null
    await deleteSharedGroupMember(juanMemberId)
    juanMemberId = null
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
      if (lauraMemberId) await deleteSharedGroupMember(lauraMemberId)
    } catch (e) {
      console.error('cleanup laura:', e)
    }
    try {
      if (juanMemberId) await deleteSharedGroupMember(juanMemberId)
    } catch (e) {
      console.error('cleanup juan:', e)
    }
    try {
      if (groupId) await deleteSharedGroup(groupId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup group:', e)
    }
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE API PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
