/**
 * Fase 2 — Tests API: grupos + miembros (parte 1/3, por límite real de cuota
 * de lecturas de Google Sheets detectado en Fase 1 y de nuevo en esta fase).
 * Llama directamente a las funciones planas exportadas de cada route.ts.
 *
 * Ejecutar con: npx tsx -r dotenv/config scripts/test-shared-groups-api-1-groups-members.ts dotenv_config_path=.env.local
 */
import { createSharedGroupForUser } from '../app/api/shared-groups/handlers'
import { getSharedGroupDetailForUser, renameSharedGroupForUser, deleteSharedGroupForUser } from '../app/api/shared-groups/[id]/handlers'
import { addSharedGroupMemberForUser } from '../app/api/shared-groups/[id]/members/handlers'
import { editSharedGroupMemberForUser, deleteSharedGroupMemberForUser } from '../app/api/shared-groups/[id]/members/[memberId]/handlers'
import { ApiError } from '../app/api/shared-groups/_lib/apiError'

const DIEGO_USER_ID = '100827254183186994825'
const OTHER_USER_ID = 'fake-other-user-test-999'

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

  try {
    console.log('\n=== E/F) Crear grupo — el creador queda miembro ===')
    const { group, creatorMember } = await createSharedGroupForUser(
      DIEGO_USER_ID,
      { name: 'Diego (test)', email: 'diego-test@example.com' },
      { name: 'Casa API (test)' }
    )
    groupId = group.id
    const diegoMemberId = creatorMember.id
    check('Grupo creado', group.name === 'Casa API (test)')
    check('Creador quedó como miembro vinculado', creatorMember.userId === DIEGO_USER_ID)

    console.log('\n=== C) Miembro vinculado puede leer / B) no-miembro no puede (403) / 404 inexistente ===')
    const detail = await getSharedGroupDetailForUser(groupId, DIEGO_USER_ID)
    check('Diego puede ver el detalle', detail.group.id === groupId)
    await expectApiError('Usuario externo -> 403', 403, () => getSharedGroupDetailForUser(groupId!, OTHER_USER_ID))
    await expectApiError('Grupo inexistente -> 404', 404, () => getSharedGroupDetailForUser('grupo-inexistente', DIEGO_USER_ID))

    console.log('\n=== H) Creator renombra / G) otro usuario no puede (403) ===')
    const renamed = await renameSharedGroupForUser(groupId, DIEGO_USER_ID, { name: 'Casa API Renombrada (test)' })
    check('Renombrado', renamed.name === 'Casa API Renombrada (test)')
    await expectApiError('Otro usuario -> 403', 403, () => renameSharedGroupForUser(groupId!, OTHER_USER_ID, { name: 'Hackeado' }))

    console.log('\n=== J) Agregar shadow member / K) userId del cliente se ignora ===')
    const laura = await addSharedGroupMemberForUser(groupId, DIEGO_USER_ID, { name: 'Laura API (test)', email: 'laura-api-test@example.com' })
    lauraMemberId = laura.id
    check('Shadow member sin userId', laura.userId === undefined)

    const spoofed = await addSharedGroupMemberForUser(groupId, DIEGO_USER_ID, {
      name: 'Intento Vinculado (test)',
      userId: 'usuario-forzado-por-cliente',
    } as unknown)
    check('userId del body ignorado', spoofed.userId === undefined)
    await deleteSharedGroupMemberForUser(groupId, spoofed.id, DIEGO_USER_ID)

    console.log('\n=== L) Email duplicado normalizado (mayúsculas) -> 409 ===')
    await expectApiError('Duplicado -> 409', 409, () =>
      addSharedGroupMemberForUser(groupId!, DIEGO_USER_ID, { name: 'Otra Laura', email: 'LAURA-API-TEST@EXAMPLE.COM' })
    )

    console.log('\n=== M) Creator edita miembro / N) no-creator no puede (403) ===')
    const edited = await editSharedGroupMemberForUser(groupId, lauraMemberId, DIEGO_USER_ID, { email: 'laura-nueva@example.com' })
    check('Email actualizado', edited.email === 'laura-nueva@example.com')
    await expectApiError('No-creator -> 403', 403, () => editSharedGroupMemberForUser(groupId!, lauraMemberId!, OTHER_USER_ID, { name: 'Hackeada' }))

    console.log('\n=== P) No se puede borrar al miembro vinculado al creador -> 409 ===')
    await expectApiError('Creator member -> 409', 409, () => deleteSharedGroupMemberForUser(groupId!, diegoMemberId, DIEGO_USER_ID))

    console.log('\n=== I) No-creator no puede borrar el grupo -> 403 ===')
    await expectApiError('No-creator delete -> 403', 403, () => deleteSharedGroupForUser(groupId!, OTHER_USER_ID))

    console.log('\n=== Limpieza: borrar Laura y el grupo ===')
    await deleteSharedGroupMemberForUser(groupId, lauraMemberId, DIEGO_USER_ID)
    lauraMemberId = null
    await deleteSharedGroupForUser(groupId, DIEGO_USER_ID)
    groupId = null
  } finally {
    try {
      if (lauraMemberId) await deleteSharedGroupMemberForUser(groupId!, lauraMemberId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup member:', e)
    }
    try {
      if (groupId) await deleteSharedGroupForUser(groupId, DIEGO_USER_ID)
    } catch (e) {
      console.error('cleanup group:', e)
    }
  }

  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS (parte 1) PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
