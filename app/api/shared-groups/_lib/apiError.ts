import { NextResponse } from 'next/server'
import { isGoogleSheetsRateLimitError, isGoogleSheetsInfrastructureError } from '@/lib/googleSheets'
import { isPostgresConnectivityError } from '@/lib/repositories/sharedGroups/pgErrors'

const FRIENDLY_INFRA_MESSAGE = 'No pudimos actualizar los datos en este momento. Intentá nuevamente en unos segundos.'
const FRIENDLY_POSTGRES_UNAVAILABLE_MESSAGE = 'Gastos compartidos no está disponible temporalmente. Probá de nuevo en unos minutos.'

/**
 * Error tipado para las rutas de Gastos Compartidos V2, con el status HTTP
 * que le corresponde. Convención de status usada en TODAS las rutas de
 * shared-groups:
 *   400 payload inválido / regla financiera inválida (ej. overpayment directo)
 *   401 no autenticado
 *   403 autenticado pero sin permiso explícito (no es miembro / no es el autor)
 *   404 entidad inexistente
 *   409 conflicto de integridad (miembro con movimientos, duplicado, overpayment
 *       provocado retroactivamente por un update/delete de otro registro)
 *   429 rate-limit real de Google Sheets (detectado explícitamente)
 *   500/503 error de infraestructura inesperado/transitorio (nunca 400)
 *   503 Postgres/Neon no disponible (DB-7A.1 -- ver isPostgresConnectivityError).
 *       Nunca implica fallback a Sheets: el backend seleccionado sigue siendo
 *       el mismo, esto solo controla qué status/mensaje ve el cliente.
 */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Catch-all final de cada ruta. Antes cualquier error no-ApiError caía en un
 * 500 genérico sin distinguir un 429/5xx real de Google Sheets de un bug
 * inesperado — ahora, si el error que se coló hasta acá (sin pasar por
 * wrapPhase1Call, ej. un chequeo de existencia/permiso hecho directo en el
 * handler) es identificablemente un rate-limit o un error de infraestructura
 * de Sheets, se clasifica igual que en wrapPhase1Call. Nunca se expone el
 * mensaje técnico crudo de Google al cliente.
 */
export function handleApiError(error: unknown, label: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (isGoogleSheetsRateLimitError(error)) {
    console.error(`Rate limit de Google Sheets en ${label}:`, error)
    return NextResponse.json({ error: FRIENDLY_INFRA_MESSAGE }, { status: 429 })
  }

  if (isGoogleSheetsInfrastructureError(error)) {
    console.error(`Error de infraestructura de Google Sheets en ${label}:`, error)
    return NextResponse.json({ error: FRIENDLY_INFRA_MESSAGE }, { status: 503 })
  }

  if (isPostgresConnectivityError(error)) {
    // Nunca loggear la connection string completa -- acá solo llega el error
    // de conexión de `pg`/Drizzle (mensaje tipo "connect ECONNREFUSED ..."),
    // nunca DATABASE_URL ni credenciales.
    console.error(`Error de conectividad a Postgres en ${label}:`, error)
    return NextResponse.json({ error: FRIENDLY_POSTGRES_UNAVAILABLE_MESSAGE }, { status: 503 })
  }

  console.error(`Error en ${label}:`, error)
  return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
}

/**
 * Envuelve una llamada a una función de persistencia de Fase 1 (que lanza
 * `Error` planos con mensajes de validación de negocio, ej. "la suma de los
 * splits debe ser igual al monto total"). Las rutas SIEMPRE verifican
 * existencia/permiso ANTES de llegar a esta llamada, así que un Error de
 * negocio genuino de Fase 1 en este punto sigue siendo 400 — eso no cambió.
 *
 * Lo que sí se corrigió: antes CUALQUIER error no-ApiError (incluyendo un 429
 * real de Google Sheets que se cuele desde adentro de una función de Fase 1)
 * se convertía ciegamente en 400 "solicitud inválida". Ahora se clasifica
 * primero como rate-limit (429) o infraestructura (503) antes de asumir que
 * es una violación de regla de negocio — nunca se rediseña ni se modifica el
 * mensaje/comportamiento de Fase 1 en sí, solo se lo traduce al status HTTP
 * correcto.
 */
export async function wrapPhase1Call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ApiError) throw error

    if (isGoogleSheetsRateLimitError(error)) {
      throw new ApiError(429, FRIENDLY_INFRA_MESSAGE)
    }
    if (isGoogleSheetsInfrastructureError(error)) {
      throw new ApiError(503, FRIENDLY_INFRA_MESSAGE)
    }

    // DB-7A.1: antes de asumir que cualquier error no reconocido es una
    // violación de regla de negocio (400), descartar que sea en realidad
    // Postgres/Neon caído -- si no se hiciera esto, un ECONNREFUSED real
    // terminaría como "400 Solicitud inválida: connect ECONNREFUSED ..."
    // con el mensaje crudo del driver filtrado al cliente.
    if (isPostgresConnectivityError(error)) {
      throw new ApiError(503, FRIENDLY_POSTGRES_UNAVAILABLE_MESSAGE)
    }

    throw new ApiError(400, error instanceof Error ? error.message : 'Solicitud inválida')
  }
}
