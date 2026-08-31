/**
 * Tests puros de Fase 4.1 — Invitaciones de Gastos Compartidos V2
 * (lib/sharedGroupInvitations.ts). Sin Google Sheets, sin red — corre en
 * milisegundos. Mismo estilo que scripts/test-shared-group-balances.ts.
 *
 * Ejecutar con: npx tsx scripts/test-shared-group-invitations-pure.ts
 */
import {
  normalizeInvitationEmail,
  generateInvitationToken,
  hashInvitationToken,
  verifyInvitationToken,
  isInvitationPending,
  hasPendingInvitation,
  canCreateInvitation,
  validateInvitationTransition,
} from '../lib/sharedGroupInvitations'
import type { SharedGroupInvitation } from '../types'

let failures = 0

function assertTrue(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

function makeInvitation(overrides: Partial<SharedGroupInvitation> = {}): SharedGroupInvitation {
  return {
    id: 'inv-1',
    groupId: 'group-1',
    memberId: 'member-1',
    invitedByUserId: 'user-diego',
    targetEmail: 'laura@email.com',
    status: 'pending',
    tokenHash: 'irrelevante-para-estos-tests',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

console.log('\n=== A) normalizeInvitationEmail: trim + lowercase ===')
assertTrue('Normaliza mayúsculas y espacios', normalizeInvitationEmail('  Laura@Email.COM ') === 'laura@email.com')
assertTrue('Ya normalizado queda igual', normalizeInvitationEmail('laura@email.com') === 'laura@email.com')

console.log('\n=== B) generateInvitationToken: no vacío ===')
const tokenA = generateInvitationToken()
assertTrue('Token generado no está vacío', typeof tokenA === 'string' && tokenA.length > 0, tokenA.length)

console.log('\n=== C) generateInvitationToken: dos tokens distintos ===')
const tokenB = generateInvitationToken()
assertTrue('Dos tokens generados son distintos entre sí', tokenA !== tokenB)

console.log('\n=== D) hashInvitationToken: el hash no es igual al token plano ===')
const hashA = hashInvitationToken(tokenA)
assertTrue('El hash no es igual al token plano', hashA !== tokenA)
assertTrue('El hash es un string no vacío', typeof hashA === 'string' && hashA.length > 0)

console.log('\n=== E) verifyInvitationToken: verifica correctamente el token correcto ===')
assertTrue('El token correcto verifica OK contra su propio hash', verifyInvitationToken(tokenA, hashA) === true)

console.log('\n=== F) verifyInvitationToken: falla con un token incorrecto ===')
assertTrue('Un token distinto NO verifica contra el hash de otro token', verifyInvitationToken(tokenB, hashA) === false)
assertTrue('Un hash corrupto/de otra longitud no verifica (no debe lanzar)', verifyInvitationToken(tokenA, 'no-es-un-hash-valido') === false)

console.log('\n=== isInvitationPending / hasPendingInvitation ===')
assertTrue('Una invitación pending es "pending"', isInvitationPending(makeInvitation({ status: 'pending' })) === true)
assertTrue('Una invitación accepted NO es "pending"', isInvitationPending(makeInvitation({ status: 'accepted' })) === false)
assertTrue('hasPendingInvitation detecta al menos una pending', hasPendingInvitation([makeInvitation({ status: 'rejected' }), makeInvitation({ status: 'pending' })]) === true)
assertTrue('hasPendingInvitation es false si ninguna está pending', hasPendingInvitation([makeInvitation({ status: 'rejected' }), makeInvitation({ status: 'cancelled' })]) === false)
assertTrue('hasPendingInvitation es false con array vacío', hasPendingInvitation([]) === false)

console.log('\n=== canCreateInvitation ===')
assertTrue(
  'Permite invitar a un member shadow sin invitaciones previas',
  canCreateInvitation({ userId: undefined }, []).valid === true
)
assertTrue(
  'Rechaza invitar a un member ya vinculado a una cuenta',
  canCreateInvitation({ userId: 'user-laura' }, []).valid === false
)
assertTrue(
  'Rechaza si ya existe una invitación pending para ese member',
  canCreateInvitation({ userId: undefined }, [makeInvitation({ status: 'pending' })]).valid === false
)
assertTrue(
  'Permite reinvitar si la única invitación previa ya no está pending',
  canCreateInvitation({ userId: undefined }, [makeInvitation({ status: 'rejected' })]).valid === true
)

console.log('\n=== G) validateInvitationTransition: pending -> accepted ===')
assertTrue('pending -> accepted es válido', validateInvitationTransition('pending', 'accepted').valid === true)

console.log('\n=== H) validateInvitationTransition: pending -> rejected ===')
assertTrue('pending -> rejected es válido', validateInvitationTransition('pending', 'rejected').valid === true)

console.log('\n=== I) validateInvitationTransition: pending -> cancelled ===')
assertTrue('pending -> cancelled es válido', validateInvitationTransition('pending', 'cancelled').valid === true)

console.log('\n=== J) validateInvitationTransition: accepted -> pending inválido ===')
assertTrue('accepted -> pending es inválido', validateInvitationTransition('accepted', 'pending').valid === false)

console.log('\n=== K) validateInvitationTransition: rejected -> accepted inválido ===')
assertTrue('rejected -> accepted es inválido', validateInvitationTransition('rejected', 'accepted').valid === false)

console.log('\n=== L) validateInvitationTransition: cancelled -> accepted inválido ===')
assertTrue('cancelled -> accepted es inválido', validateInvitationTransition('cancelled', 'accepted').valid === false)

console.log('\n=== Extra: ningún estado terminal admite ninguna transición ===')
for (const from of ['accepted', 'rejected', 'cancelled'] as const) {
  for (const to of ['pending', 'accepted', 'rejected', 'cancelled'] as const) {
    if (from === to) continue
    assertTrue(`${from} -> ${to} es inválido (estado terminal)`, validateInvitationTransition(from, to).valid === false)
  }
}

console.log(`\n${failures === 0 ? 'TODOS LOS TESTS PASARON' : `${failures} TEST(S) FALLARON`}`)
process.exit(failures === 0 ? 0 : 1)
