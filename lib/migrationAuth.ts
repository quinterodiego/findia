import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Fail-closed: sin MIGRATION_TOKEN configurada, ninguna request pasa -- nunca
 * hay un valor por default. Comparación de tiempo constante para no filtrar
 * por timing cuánto del token coincide. Nunca loggea ni devuelve el token.
 * El caller siempre debe responder el mismo 401 genérico sea cual sea el
 * motivo (env ausente, header ausente, token incorrecto) para no filtrar si
 * el servidor está configurado o no.
 */
export function isAuthorizedMigrationRequest(request: NextRequest): boolean {
  const expectedToken = process.env.MIGRATION_TOKEN
  if (!expectedToken) return false

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const expected = Buffer.from(`Bearer ${expectedToken}`)
  const actual = Buffer.from(authHeader)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
