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
