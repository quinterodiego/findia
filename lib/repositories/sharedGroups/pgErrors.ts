/**
 * Fase DB-4 — traducción mínima de errores de Postgres/Drizzle hacia la
 * misma semántica de negocio que ya esperan los handlers (errores `Error`
 * planos, con el mismo tipo de mensaje que lanzaba `lib/googleSheets.ts`).
 * Nunca deja pasar código SQL, nombres de tabla/constraint, ni detalles de
 * conexión hacia el caller -- eso lo haría `wrapPhase1Call` visible en la
 * respuesta HTTP.
 *
 * Solo traduce errores que realmente tienen forma de error de Postgres
 * (`.code` = SQLSTATE). Cualquier otro error (incluidos los `Error` de
 * negocio que el propio repository ya lanza deliberadamente, ej. "El monto
 * debe ser un número finito mayor a 0") pasa sin tocar.
 */

interface PgErrorLike {
  code?: string
  constraint?: string
  message?: string
  cause?: unknown
}

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'
const CHECK_VIOLATION = '23514'

/** Mensaje de negocio por constraint único conocido -- mismo texto que ya
 * usaban los chequeos manuales equivalentes en lib/googleSheets.ts. */
const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  shared_group_members_group_user_unique: 'Ese usuario ya es miembro del grupo',
  shared_group_members_group_email_unique: 'Ya existe un miembro con ese email en este grupo',
  shared_group_invitations_member_pending_unique: 'Ya existe una invitación pendiente para este miembro',
}

/** El driver node-postgres de Drizzle envuelve el error real de `pg` (el que
 * trae `.code`/`.constraint`) dentro de `DrizzleQueryError.cause` -- nunca
 * los expone directamente en el error de primer nivel. Sin este unwrap,
 * ninguna violación de constraint se traduce nunca (confirmado corriendo
 * los contract tests: sin esto, el mensaje crudo de Postgres se filtraba
 * tal cual). */
export function unwrapPgError(error: unknown): PgErrorLike {
  const top = error as PgErrorLike
  if (top?.code) return top
  if (top?.cause && typeof top.cause === 'object') return top.cause as PgErrorLike
  return top
}

export function translatePgError(error: unknown): Error {
  const pgError = unwrapPgError(error)

  if (pgError?.code === UNIQUE_VIOLATION) {
    const message = (pgError.constraint && UNIQUE_CONSTRAINT_MESSAGES[pgError.constraint]) || 'Ya existe un registro con esos datos'
    return new Error(message)
  }
  if (pgError?.code === FOREIGN_KEY_VIOLATION) {
    return new Error('La operación hace referencia a un dato que ya no existe')
  }
  if (pgError?.code === CHECK_VIOLATION) {
    return new Error('Los datos no cumplen una regla requerida')
  }

  return error instanceof Error ? error : new Error('Error de base de datos')
}

/** SQLSTATE clase 08 (connection exception) -- server_unavailable/connection_failure/
 * sqlclient_unable_to_establish_sqlconnection/connection_does_not_exist/etc. */
const CONNECTION_EXCEPTION_CLASS = '08'
/** cannot_connect_now (ej. Neon todavía iniciando el endpoint). */
const CANNOT_CONNECT_NOW = '57P03'
/** too_many_connections. */
const TOO_MANY_CONNECTIONS = '53300'

/** Códigos de error de Node/TCP que significan que la conexión nunca llegó
 * a completarse -- nunca tienen un SQLSTATE porque el protocolo de Postgres
 * nunca arrancó. */
const NETWORK_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH'])

/** Fase DB-7A.1 -- clasifica errores de CONECTIVIDAD a Postgres (Neon caído,
 * timeout, DNS, pool que no puede conectar, servidor rechazando conexiones)
 * como distintos de los errores de datos/negocio que `translatePgError` ya
 * traduce (unique/FK/check violation NUNCA pasan por acá con `true` -- son
 * errores de negocio, no de infraestructura). Nunca decide un fallback a
 * Sheets: solo permite que el caller (wrapPhase1Call/handleApiError) elija
 * el status HTTP correcto (503) en vez de dejar pasar un 400/500 con el
 * mensaje crudo del driver. */
export function isPostgresConnectivityError(error: unknown): boolean {
  const pgError = unwrapPgError(error)
  const code = pgError?.code

  if (code && NETWORK_ERROR_CODES.has(code)) return true
  if (code && (code.startsWith(CONNECTION_EXCEPTION_CLASS) || code === CANNOT_CONNECT_NOW || code === TOO_MANY_CONNECTIONS)) {
    return true
  }

  // `pg`/Drizzle a veces lanzan un Error de conectividad sin `.code` en
  // absoluto (ej. "Connection terminated unexpectedly" del propio Pool, o
  // "timeout exceeded when trying to connect" del connect timeout de `pg`).
  // Estos nunca deben confundirse con un error de negocio (que SIEMPRE tiene
  // un mensaje de validación reconocible, no estas frases fijas del driver).
  const message = (pgError?.message || (error instanceof Error ? error.message : '') || '').toLowerCase()
  if (!code && message && (message.includes('connection terminated') || message.includes('timeout exceeded when trying to connect'))) {
    return true
  }

  return false
}
