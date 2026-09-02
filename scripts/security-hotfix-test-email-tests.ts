/**
 * Fase DB-8.0S — tests de la autorización de /api/test-email.
 *
 * Parte A: tests puros de `isAdminEmail` (lib/adminAuth.ts).
 * Parte B: test de integración del route handler real (`GET` exportado de
 * app/api/test-email/route.ts), con `next-auth`'s getServerSession y
 * `lib/email`'s sendEmail MOCKEADOS -- nunca se manda un email real, nunca
 * se toca Sheets/Postgres/red.
 *
 * Ejecutar con: npx tsx scripts/security-hotfix-test-email-tests.ts
 */
import { Module } from 'module'
import { NextRequest } from 'next/server'
import { isAdminEmail } from '../lib/adminAuth'

let failures = 0
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'OK  ' : 'FALLO'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`)
  if (!condition) failures++
}

function withEnv(value: string | undefined, fn: () => void) {
  const previous = process.env.ADMIN_EMAILS
  if (value === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = value
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = previous
  }
}

async function testIsAdminEmail() {
  console.log('--- Parte A: isAdminEmail (puro) ---')
  withEnv('admin1@example.com,admin2@example.com', () => {
    check('email en la lista -> admin', isAdminEmail('admin1@example.com'))
    check('email en la lista (segundo) -> admin', isAdminEmail('admin2@example.com'))
    check('email fuera de la lista -> no admin', !isAdminEmail('nobody@example.com'))
    check('null -> no admin', !isAdminEmail(null))
    check('undefined -> no admin', !isAdminEmail(undefined))
    check('string vacío -> no admin', !isAdminEmail(''))
  })
  withEnv(undefined, () => {
    check('ADMIN_EMAILS ausente -> nadie es admin (fail-closed)', !isAdminEmail('admin1@example.com'))
  })
}

// --- Parte B: route handler real, con next-auth y lib/email mockeados ---
// Node's module system no tiene un `vi.mock` nativo -- interceptamos a mano
// parcheando el cache de require ANTES de importar el route handler, que es
// exactamente el patrón que ya usa este proyecto en sus otros scripts de
// test cuando necesita reemplazar un módulo sin un test runner instalado.
type SessionShape = { user?: { email?: string | null } } | null
let mockSession: SessionShape = null
const sendEmailCalls: Array<{ to: string }> = []

function installMocks() {
  const nextAuthPath = require.resolve('next-auth')
  const emailPath = require.resolve('../lib/email')

  const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load
  ;(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function (request: string, parent: unknown, isMain: boolean) {
    const resolved = Module._resolveFilename(request, parent as NodeModule)
    if (resolved === nextAuthPath) {
      return { getServerSession: async () => mockSession }
    }
    if (resolved === emailPath) {
      return {
        sendEmail: async (opts: { to: string }) => {
          sendEmailCalls.push({ to: opts.to })
          return true
        },
      }
    }
    return originalLoad.call(Module, request, parent, isMain)
  }
}

async function testRouteHandler() {
  console.log('\n--- Parte B: GET /api/test-email (route handler real, mocks para next-auth/sendEmail) ---')
  installMocks()
  process.env.ADMIN_EMAILS = 'admin@example.com'

  const { GET } = await import('../app/api/test-email/route')

  mockSession = null
  let res = await GET(new NextRequest('https://findia.vercel.app/api/test-email'))
  check('sin sesión -> 401', res.status === 401)

  mockSession = { user: { email: 'nobody@example.com' } }
  res = await GET(new NextRequest('https://findia.vercel.app/api/test-email'))
  check('sesión válida pero no admin -> 403', res.status === 403)

  const callsBefore = sendEmailCalls.length
  check('no admin -> sendEmail NUNCA se llamó', sendEmailCalls.length === callsBefore)

  mockSession = { user: { email: 'admin@example.com' } }
  res = await GET(new NextRequest('https://findia.vercel.app/api/test-email?to=someone@example.com'))
  const body = await res.json()
  check('admin autorizado -> 200', res.status === 200, body)
  check('admin autorizado -> sendEmail se llamó exactamente 1 vez', sendEmailCalls.length === callsBefore + 1)
  check('admin autorizado -> el destinatario es el que pasó el query param', sendEmailCalls[sendEmailCalls.length - 1]?.to === 'someone@example.com')
}

async function main() {
  await testIsAdminEmail()
  await testRouteHandler()
  console.log(`\n${failures === 0 ? 'TODOS LOS TESTS DE /api/test-email PASARON' : `${failures} TEST(S) FALLARON`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
