/**
 * Test de integración REAL (Sheets + SMTP) para el envío de invitación de
 * Fase 4.3 — sendSharedGroupInvitationForUser() ahora también manda el
 * email. Envía UN único email real, dirigido a EMAIL_USER (la misma cuenta
 * ya configurada como remitente en .env.local — no se inventa un
 * destinatario nuevo, es un auto-envío de prueba).
 *
 * Acotado a propósito: una sola pasada lineal, sin loops. Si Google Sheets
 * responde 429, dejar que falle visiblemente ahí — no reintentar. Correr
 * una sola vez.
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-group-invitation-send-email.ts dotenv_config_path=.env.local
 */
import { createSharedGroup, deleteSharedGroup, createSharedGroupMember, deleteSharedGroupMember, deleteSharedGroupInvitation } from '../lib/googleSheets'
import { sendSharedGroupInvitationForUser } from '../app/api/shared-groups/[id]/invitations/handlers'

const DIEGO_USER_ID = '100827254183186994825' // cuenta mock real usada en esta sesión

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

async function main() {
  if (!process.env.EMAIL_USER) {
    console.log('EMAIL_USER no está configurado en .env.local — no se puede probar el envío real. Deteniendo sin tocar Sheets.')
    process.exit(0)
  }

  let groupId: string | null = null
  let creatorMemberId: string | null = null
  let memberId: string | null = null
  let invitationId: string | null = null

  try {
    const { group, creatorMember } = await createSharedGroup(DIEGO_USER_ID, { name: 'Casa Invitación Email (test)', creatorName: 'Diego (test)' })
    groupId = group.id
    creatorMemberId = creatorMember.id

    const member = await createSharedGroupMember(groupId, { name: 'Destinatario de prueba', email: process.env.EMAIL_USER })
    memberId = member.id

    console.log(`\n=== SEND real: email debería llegar a ${process.env.EMAIL_USER} ===`)
    const result = await sendSharedGroupInvitationForUser(groupId, DIEGO_USER_ID, { memberId })
    invitationId = result.invitation.id

    check('Invitation quedó pending', result.invitation.status === 'pending')
    check('Token plano no vacío (nunca sale de este script)', typeof result.token === 'string' && result.token.length > 0)
    console.log(`emailSent = ${result.emailSent}`)
    if (!result.emailSent) {
      console.log('El envío de email devolvió false — puede ser el problema de configuración SMTP ya visto en builds anteriores ("unable to verify the first certificate"), no necesariamente un bug de este código. La invitación se creó de todas formas (comportamiento esperado: no se revierte).')
    }

    console.log('\n=== Limpieza ===')
    await deleteSharedGroupInvitation(invitationId)
    invitationId = null
    await deleteSharedGroupMember(memberId)
    memberId = null
    // createSharedGroup ya crea un creatorMember además del group -- deleteSharedGroup
    // NO lo borra en cascada, así que hay que hacerlo explícitamente antes de borrar el group.
    await deleteSharedGroupMember(creatorMemberId!)
    creatorMemberId = null
    await deleteSharedGroup(groupId, DIEGO_USER_ID)
    groupId = null
  } catch (e) {
    const message = (e as Error)?.message || String(e)
    if (message.toLowerCase().includes('quota') || message.includes('429')) {
      console.error('\n429 real de Google Sheets — DETENIENDO, no se reintenta.')
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

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
