/**
 * Test de integración REAL contra Google Sheets para las superficies NUEVAS
 * de Fase 4.4 de Invitaciones (Gastos Compartidos V2): el canal in-app sin
 * token (CANAL B, gateado por `hasVerifiedGoogleSession`), el listado de
 * invitaciones enviadas por grupo, y el aggregate enriquecido con
 * groupName/inviterName. NO repite lo que ya cubre
 * test-shared-group-invitations-api.ts (Fase 4.2: CANAL A, duplicados,
 * idempotencia de accept/reject/cancel) -- eso ya está probado ahí.
 *
 * Acotado a propósito: una sola pasada lineal, sin loops, sin reintentos.
 * Si Google Sheets responde 429, dejar que falle visiblemente ahí y no
 * reintentar. Correr una sola vez.
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-group-invitations-fase-4-4.ts dotenv_config_path=.env.local
 */
import { createSharedGroup, deleteSharedGroup, createSharedGroupMember, deleteSharedGroupMember, getSharedGroupMembers } from '../lib/googleSheets'
import { sendSharedGroupInvitationForUser, listSharedGroupInvitationsForGroupForUser } from '../app/api/shared-groups/[id]/invitations/handlers'
import { acceptSharedGroupInvitationForUser } from '../app/api/shared-group-invitations/[id]/accept/handlers'
import { rejectSharedGroupInvitationForUser } from '../app/api/shared-group-invitations/[id]/reject/handlers'
import { cancelSharedGroupInvitationForUser } from '../app/api/shared-group-invitations/[id]/handlers'
import { listMySharedGroupInvitationsForUser } from '../app/api/shared-group-invitations/handlers'
import { ApiError } from '../app/api/shared-groups/_lib/apiError'

const DIEGO_USER_ID = '100827254183186994825' // cuenta mock real usada en esta sesión
const LAURA_REAL_USER_ID = 'fake-laura-444-test-999'
const JUAN_REAL_USER_ID = 'fake-juan-444-test-999'

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
  let creatorMemberId: string | null = null
  let lauraMemberId: string | null = null
  let juanMemberId: string | null = null

  try {
    const { group, creatorMember } = await createSharedGroup(DIEGO_USER_ID, { name: 'Casa Invitaciones 4.4 (test)', creatorName: 'Diego (test)' })
    groupId = group.id
    creatorMemberId = creatorMember.id

    const laura = await createSharedGroupMember(groupId, { name: 'Laura (test)', email: 'laura.444.test@email.com' })
    lauraMemberId = laura.id
    const juan = await createSharedGroupMember(groupId, { name: 'Juan (test)', email: 'juan.444.test@email.com' })
    juanMemberId = juan.id

    console.log('\n=== A) GET invitaciones del grupo: vacío antes de invitar ===')
    const emptyList = await listSharedGroupInvitationsForGroupForUser(groupId, DIEGO_USER_ID)
    check('Sin invitaciones todavía', emptyList.length === 0)

    console.log('\n=== B) SEND a Laura, luego GET invitaciones del grupo ===')
    const sentLaura = await sendSharedGroupInvitationForUser(groupId, DIEGO_USER_ID, { memberId: lauraMemberId })
    const listAfterSend = await listSharedGroupInvitationsForGroupForUser(groupId, DIEGO_USER_ID)
    check('Aparece exactamente 1 pending', listAfterSend.length === 1 && listAfterSend[0].id === sentLaura.invitation.id)

    console.log('\n=== C) GET invitaciones del grupo por no-miembro -> 403 ===')
    await expectApiError('No-miembro lista invitaciones -> 403', 403, () =>
      listSharedGroupInvitationsForGroupForUser(groupId!, 'fake-outsider-444-test-999')
    )

    console.log('\n=== D) Inbox (aggregate con detalle) ANTES de aceptar: trae groupName/inviterName ===')
    const lauraInboxBefore = await listMySharedGroupInvitationsForUser('laura.444.test@email.com')
    const lauraInboxEntry = lauraInboxBefore.find((i) => i.id === sentLaura.invitation.id)
    check('La invitación de Laura aparece en su inbox', !!lauraInboxEntry)
    check('groupName resuelto correctamente', lauraInboxEntry?.groupName === 'Casa Invitaciones 4.4 (test)')
    check('inviterName resuelto correctamente', lauraInboxEntry?.inviterName === 'Diego (test)')

    console.log('\n=== E) ACCEPT CANAL B (sin token) con sesión Credentials (no verificada) -> 403 específico ===')
    await expectApiError('Accept sin token, sesión no-Google -> 403', 403, () =>
      acceptSharedGroupInvitationForUser(sentLaura.invitation.id, LAURA_REAL_USER_ID, 'laura.444.test@email.com', false, {})
    )

    console.log('\n=== F) ACCEPT CANAL B (sin token) con sesión Google verificada -> funciona ===')
    const acceptedCanalB = await acceptSharedGroupInvitationForUser(
      sentLaura.invitation.id,
      LAURA_REAL_USER_ID,
      'laura.444.test@email.com',
      true,
      {}
    )
    check('Invitation pasó a accepted vía CANAL B', acceptedCanalB.status === 'accepted')
    const membersAfterAccept = await getSharedGroupMembers(groupId)
    check('Laura quedó linkeada', membersAfterAccept.find((m) => m.id === lauraMemberId)?.userId === LAURA_REAL_USER_ID)

    console.log('\n=== G) Inbox DESPUÉS de aceptar: ya no aparece (solo pending) ===')
    const lauraInboxAfter = await listMySharedGroupInvitationsForUser('laura.444.test@email.com')
    check('Ya no aparece en el inbox', !lauraInboxAfter.some((i) => i.id === sentLaura.invitation.id))

    console.log('\n=== H) SEND a Juan, REJECT CANAL B sin sesión Google -> 403 específico ===')
    const sentJuan = await sendSharedGroupInvitationForUser(groupId, DIEGO_USER_ID, { memberId: juanMemberId })
    await expectApiError('Reject sin token, sesión no-Google -> 403', 403, () =>
      rejectSharedGroupInvitationForUser(sentJuan.invitation.id, 'juan.444.test@email.com', false, {})
    )

    console.log('\n=== I) REJECT CANAL B con sesión Google verificada -> funciona ===')
    const rejectedCanalB = await rejectSharedGroupInvitationForUser(sentJuan.invitation.id, 'juan.444.test@email.com', true, {})
    check('Invitation pasó a rejected vía CANAL B', rejectedCanalB.status === 'rejected')
    const membersAfterReject = await getSharedGroupMembers(groupId)
    check('Juan sigue shadow (reject no linkea)', membersAfterReject.find((m) => m.id === juanMemberId)?.userId === undefined)

    console.log('\n=== J) CANCEL: GET invitaciones del grupo ya no muestra ninguna pending ===')
    const listAfterAll = await listSharedGroupInvitationsForGroupForUser(groupId, DIEGO_USER_ID)
    check('Sin pendientes tras accept+reject', listAfterAll.length === 0)

    console.log('\n=== K) Reinvitar a Juan y CANCEL por el creador (gating ya cubierto en Fase 4.2; acá solo humo) ===')
    const sentJuanAgain = await sendSharedGroupInvitationForUser(groupId, DIEGO_USER_ID, { memberId: juanMemberId })
    const cancelled = await cancelSharedGroupInvitationForUser(sentJuanAgain.invitation.id, DIEGO_USER_ID)
    check('Cancel funciona', cancelled.status === 'cancelled')

    console.log('\n=== Limpieza ===')
    await deleteSharedGroupMember(lauraMemberId)
    lauraMemberId = null
    await deleteSharedGroupMember(juanMemberId)
    juanMemberId = null
    await deleteSharedGroupMember(creatorMemberId)
    creatorMemberId = null
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
      if (creatorMemberId) await deleteSharedGroupMember(creatorMemberId)
    } catch (e) {
      console.error('cleanup creator member:', e)
    }
    try {
      if (groupId) await deleteSharedGroup(groupId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup group:', e)
    }
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE FASE 4.4 PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
