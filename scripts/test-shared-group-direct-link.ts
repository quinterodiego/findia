/**
 * Test de integración REAL (Fase 4.4.1-B) para el direct-link seguro de
 * usuarios FINDIA a Gastos Compartidos V2. Cubre las superficies NUEVAS de
 * esta fase: persistencia de `googleOnlyIdentity`/`googleVerifiedAt` en
 * Users, `canDirectlyLinkUser`, y el flujo member-first de
 * POST /api/shared-groups/[id]/members (linked directo al crear, shadow, y
 * shadow-existente-que-se-vincula-preservando-memberId + cancelación de
 * invitation pending).
 *
 * Acotado a propósito: una sola pasada lineal, sin loops, sin reintentos.
 * Si Google Sheets responde 429, dejar que falle visiblemente y no
 * reintentar. Correr una sola vez.
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-group-direct-link.ts dotenv_config_path=.env.local
 */
import { google } from 'googleapis'
import {
  saveUser,
  getUserByEmail,
  registerUser,
  createSharedGroup,
  deleteSharedGroupCascade,
  deleteSharedGroupInvitation,
  getSharedGroupMembers,
  getSharedGroupInvitationsByGroup,
} from '../lib/googleSheets'
import { canDirectlyLinkUser } from '../lib/userIdentity'
import { addSharedGroupMemberForUser } from '../app/api/shared-groups/[id]/members/handlers'
import { sendSharedGroupInvitationForUser } from '../app/api/shared-groups/[id]/invitations/handlers'
import { ApiError } from '../app/api/shared-groups/_lib/apiError'

const DIEGO_USER_ID = '100827254183186994825' // cuenta mock real usada en esta sesión
const TS = Date.now()
const EMAIL_GOOGLE_PURE = `test-4441b-google-${TS}@example.com`
const EMAIL_CREDENTIALS = `test-4441b-creds-${TS}@example.com`
const EMAIL_PENDING = `test-4441b-pending-${TS}@example.com`

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

// Cliente crudo SOLO para borrar las filas de test en Users al final --
// lib/googleSheets.ts no expone un deleteUser (nunca hizo falta hasta
// ahora, y no se agrega solo para este test).
const rawAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
const rawSheets = google.sheets({ version: 'v4', auth: rawAuth })
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID

async function deleteTestUserRows(emails: string[]) {
  const spreadsheet = await rawSheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const usersSheetId = spreadsheet.data.sheets?.find((s) => s.properties?.title === 'Users')?.properties?.sheetId
  if (usersSheetId === undefined || usersSheetId === null) return
  const resp = await rawSheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Users!A2:I' })
  const rows = resp.data.values || []
  const rowIndexesToDelete = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => emails.includes(row[1]))
    .map(({ i }) => i)
    .sort((a, b) => b - a) // de abajo hacia arriba para no correr índices al borrar
  for (const i of rowIndexesToDelete) {
    const actualRowIndex = i + 2
    await rawSheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          { deleteDimension: { range: { sheetId: usersSheetId, dimension: 'ROWS', startIndex: actualRowIndex - 1, endIndex: actualRowIndex } } },
        ],
      },
    })
  }
}

async function main() {
  let groupId: string | null = null
  let pendingInvitationId: string | null = null

  try {
    console.log('\n=== A) canDirectlyLinkUser -- tabla de verdad pura (sin Sheets) ===')
    check('A. Google-pure nueva -> TRUE', canDirectlyLinkUser({ googleVerifiedAt: 'x', password: '', googleOnlyIdentity: true }) === true)
    check('B. Credentials nueva -> FALSE', canDirectlyLinkUser({ googleVerifiedAt: undefined, password: 'hash', googleOnlyIdentity: false }) === false)
    check('C. Credentials->Google -> FALSE', canDirectlyLinkUser({ googleVerifiedAt: 'x', password: 'hash', googleOnlyIdentity: false }) === false)
    check('D. legacy Google aparente -> FALSE', canDirectlyLinkUser({ googleVerifiedAt: undefined, password: '', googleOnlyIdentity: undefined }) === false)
    check('E. legacy Credentials -> FALSE', canDirectlyLinkUser({ googleVerifiedAt: undefined, password: 'hash', googleOnlyIdentity: undefined }) === false)
    check('F. googleVerifiedAt + password presente -> FALSE', canDirectlyLinkUser({ googleVerifiedAt: 'x', password: 'hash', googleOnlyIdentity: true }) === false)
    check('G. googleVerifiedAt + señal undefined -> FALSE', canDirectlyLinkUser({ googleVerifiedAt: 'x', password: '', googleOnlyIdentity: undefined }) === false)
    check('H. señal false + sin googleVerifiedAt -> FALSE', canDirectlyLinkUser({ googleVerifiedAt: undefined, password: '', googleOnlyIdentity: false }) === false)
    check('I. señal true + googleVerifiedAt + sin password -> TRUE', canDirectlyLinkUser({ googleVerifiedAt: 'x', password: '', googleOnlyIdentity: true }) === true)

    console.log('\n=== B) saveUser/registerUser -- persistencia real de googleOnlyIdentity ===')
    const googlePureId = `test-google-${TS}`
    await saveUser({ id: googlePureId, email: EMAIL_GOOGLE_PURE, name: 'Google Pure (test)', image: null, markGoogleVerified: true, googleOnlyIdentity: true })
    const googlePureUser = await getUserByEmail(EMAIL_GOOGLE_PURE)
    check('Google-pure: googleOnlyIdentity persistido true', googlePureUser?.googleOnlyIdentity === true)
    check('Google-pure: googleVerifiedAt persistido', !!googlePureUser?.googleVerifiedAt)
    check('Google-pure: canDirectlyLinkUser true', !!googlePureUser && canDirectlyLinkUser(googlePureUser))

    await registerUser(EMAIL_CREDENTIALS, 'password-test-123', 'Credentials (test)')
    const credentialsUser = await getUserByEmail(EMAIL_CREDENTIALS)
    check('Credentials: googleOnlyIdentity persistido false', credentialsUser?.googleOnlyIdentity === false)
    check('Credentials: canDirectlyLinkUser false', !!credentialsUser && !canDirectlyLinkUser(credentialsUser))

    // Simular "Credentials -> Google" (mismo id existente, sin pasar googleOnlyIdentity -- igual que lib/auth.ts).
    await saveUser({ id: credentialsUser!.id, email: EMAIL_CREDENTIALS, name: 'Credentials (test)', image: null, markGoogleVerified: true })
    const afterGoogleOnCredentials = await getUserByEmail(EMAIL_CREDENTIALS)
    check('Credentials->Google: googleOnlyIdentity SIGUE false (no se convierte)', afterGoogleOnCredentials?.googleOnlyIdentity === false)
    check('Credentials->Google: googleVerifiedAt ahora seteado', !!afterGoogleOnCredentials?.googleVerifiedAt)
    check('Credentials->Google: canDirectlyLinkUser sigue false', !!afterGoogleOnCredentials && !canDirectlyLinkUser(afterGoogleOnCredentials))

    console.log('\n=== C) POST members -- direct-link real ===')
    const { group } = await createSharedGroup(DIEGO_USER_ID, { name: 'Direct Link 4.4.1-B (test)', creatorName: 'Diego (test)' })
    groupId = group.id

    console.log('\n--- C1) email nuevo + Google-pure -> linked de inmediato ---')
    const linkedNew = await addSharedGroupMemberForUser(groupId, DIEGO_USER_ID, { name: 'Alguien', email: EMAIL_GOOGLE_PURE })
    check('Member creado YA linked', linkedNew.userId === googlePureId)

    console.log('\n--- C2) email nuevo + Credentials -> shadow ---')
    const shadowCreds = await addSharedGroupMemberForUser(groupId, DIEGO_USER_ID, { name: 'Otra Persona', email: EMAIL_CREDENTIALS })
    check('Member creado shadow (sin userId)', shadowCreds.userId === undefined)

    console.log('\n--- C3) shadow existente que ahora es elegible -> mismo memberId se linkea + pending se cancela ---')
    const shadowFirst = await addSharedGroupMemberForUser(groupId, DIEGO_USER_ID, { name: 'Pending Person', email: EMAIL_PENDING })
    check('Shadow inicial sin userId (User todavía no existe)', shadowFirst.userId === undefined)

    const sentInvitation = await sendSharedGroupInvitationForUser(groupId, DIEGO_USER_ID, { memberId: shadowFirst.id })
    pendingInvitationId = sentInvitation.invitation.id
    check('Invitation quedó pending', sentInvitation.invitation.status === 'pending')

    const pendingUserId = `test-pending-${TS}`
    await saveUser({ id: pendingUserId, email: EMAIL_PENDING, name: 'Pending (test)', image: null, markGoogleVerified: true, googleOnlyIdentity: true })

    const relinked = await addSharedGroupMemberForUser(groupId, DIEGO_USER_ID, { name: 'Pending Person', email: EMAIL_PENDING })
    check('MISMO memberId se vinculó (no se creó uno nuevo)', relinked.id === shadowFirst.id)
    check('Quedó linked al User correcto', relinked.userId === pendingUserId)

    const invitationsAfter = await getSharedGroupInvitationsByGroup(groupId)
    const resolvedInvitation = invitationsAfter.find((i) => i.id === pendingInvitationId)
    check('La invitation pending quedó cancelled (no borrada)', resolvedInvitation?.status === 'cancelled')

    console.log('\n--- C4) duplicado: mismo email ya linked -> 409, no se toca ni se duplica ---')
    await expectApiError('Mismo email otra vez (ya linked) -> 409', 409, () =>
      addSharedGroupMemberForUser(groupId!, DIEGO_USER_ID, { name: 'Otro Nombre', email: EMAIL_GOOGLE_PURE })
    )

    const membersFinal = await getSharedGroupMembers(groupId)
    check('Cantidad final de members correcta (creador + 3)', membersFinal.length === 4)

    console.log('\n=== Limpieza ===')
    if (pendingInvitationId) {
      await deleteSharedGroupInvitation(pendingInvitationId)
      pendingInvitationId = null
    }
    await deleteSharedGroupCascade(groupId, DIEGO_USER_ID)
    groupId = null
    await deleteTestUserRows([EMAIL_GOOGLE_PURE, EMAIL_CREDENTIALS, EMAIL_PENDING])
  } catch (e) {
    const message = (e as Error)?.message || String(e)
    if (message.toLowerCase().includes('quota') || message.includes('429')) {
      console.error('\n429 real de Google Sheets — DETENIENDO el test, no se reintenta.')
      console.error(message)
    }
    throw e
  } finally {
    try {
      if (pendingInvitationId) await deleteSharedGroupInvitation(pendingInvitationId)
    } catch (e) {
      console.error('cleanup invitation:', e)
    }
    try {
      if (groupId) await deleteSharedGroupCascade(groupId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup group:', e)
    }
    try {
      await deleteTestUserRows([EMAIL_GOOGLE_PURE, EMAIL_CREDENTIALS, EMAIL_PENDING])
    } catch (e) {
      console.error('cleanup users:', e)
    }
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE DIRECT-LINK PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
