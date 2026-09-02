import type { PushSubscriptionsSnapshot, ValidationIssue, ValidationResult } from './types'

function critical(code: string, rowIndex: number | undefined, message: string): ValidationIssue {
  return { severity: 'CRITICAL', code, rowIndex, message }
}
function warning(code: string, rowIndex: number | undefined, message: string): ValidationIssue {
  return { severity: 'WARNING', code, rowIndex, message }
}

export function validateSnapshot(snapshot: PushSubscriptionsSnapshot): ValidationResult {
  const issues: ValidationIssue[] = []
  const { rows } = snapshot

  const endpointCounts = new Map<string, number[]>()

  for (const row of rows) {
    if (!row.endpoint || row.endpoint.trim() === '') {
      issues.push(critical('EMPTY_ENDPOINT', row.rowIndex, 'endpoint vacío -- no se puede migrar sin la clave única de la fila'))
      continue // sin endpoint no tiene sentido seguir validando esta fila
    }
    if (!row.userId || row.userId.trim() === '') {
      issues.push(critical('EMPTY_USER_ID', row.rowIndex, `userId vacío para endpoint ${row.endpoint}`))
    }
    if (!row.p256dh || row.p256dh.trim() === '') {
      issues.push(critical('MISSING_P256DH', row.rowIndex, `p256dh ausente para endpoint ${row.endpoint}`))
    }
    if (!row.auth || row.auth.trim() === '') {
      issues.push(critical('MISSING_AUTH', row.rowIndex, `auth ausente para endpoint ${row.endpoint}`))
    }
    if (!row.createdAt || isNaN(new Date(row.createdAt).getTime())) {
      issues.push(warning('INVALID_CREATED_AT', row.rowIndex, `createdAt inválido o ausente: "${row.createdAt}" -- se usará la fecha actual en el import`))
    }

    const existing = endpointCounts.get(row.endpoint) || []
    existing.push(row.rowIndex)
    endpointCounts.set(row.endpoint, existing)
  }

  // Duplicate endpoints: el schema Postgres los rechazaría (UNIQUE), y la
  // race condition de Sheets ya documentada por DB-8 Audit es EXACTAMENTE
  // el escenario que podría haber dejado 2 filas para el mismo endpoint --
  // nunca decidir en silencio cuál de las dos es la "buena".
  for (const [endpoint, rowIndexes] of endpointCounts.entries()) {
    if (rowIndexes.length > 1) {
      issues.push(
        critical(
          'DUPLICATE_ENDPOINT',
          undefined,
          `endpoint "${endpoint}" aparece ${rowIndexes.length} veces (filas ${rowIndexes.join(', ')}) -- posible rastro de la race condition ya documentada. Revisar manualmente cuál fila es la vigente antes de importar.`
        )
      )
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length

  return { issues, criticalCount, warningCount, importable: criticalCount === 0 }
}
