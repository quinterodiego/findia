/**
 * Fase DB-5 — formato del reporte (DB-5 §28). Nunca imprime tokenHash
 * completo, passwords, tokens crudos ni DATABASE_URL.
 */
import type { SharedGroupsSnapshot, ValidationResult } from './types'
import type { VerifyResult } from './verify'

const TEST_DATA_PATTERN = /\(test\)/i

export function detectPossibleTestData(snapshot: SharedGroupsSnapshot): string[] {
  return snapshot.groups.filter((g) => TEST_DATA_PATTERN.test(g.name)).map((g) => `${g.name} (id: ${g.id})`)
}

export function printAuditReport(snapshot: SharedGroupsSnapshot, validation: ValidationResult) {
  console.log('\n=== SHARED GROUPS MIGRATION AUDIT ===\n')
  console.log(`Groups: ${snapshot.groups.length}`)
  console.log(`Members: ${snapshot.members.length}`)
  console.log(`Expenses: ${snapshot.expenses.length}`)
  console.log(`Splits: ${snapshot.splits.length}`)
  console.log(`Settlements: ${snapshot.settlements.length}`)
  console.log(`Invitations: ${snapshot.invitations.length}`)
  console.log(`\nCritical errors: ${validation.criticalCount}`)
  console.log(`Warnings: ${validation.warningCount}`)

  const testData = detectPossibleTestData(snapshot)
  if (testData.length > 0) {
    console.log(`\nPosible test data detectada (grupos con "(test)" en el nombre) -- NO se borra automáticamente:`)
    for (const t of testData) console.log(`  - ${t}`)
  }

  if (validation.issues.length > 0) {
    console.log('\n--- Detalle ---')
    for (const issue of validation.issues) {
      const idsStr = Object.entries(issue.ids).map(([k, v]) => `${k}=${v}`).join(' ')
      console.log(`[${issue.severity}] (${issue.entity}/${issue.code}) ${issue.message}${idsStr ? ' -- ' + idsStr : ''}`)
    }
  }

  console.log(`\nIMPORTABLE: ${validation.importable ? 'YES' : 'NO'}`)
}

export function printVerifyReport(result: VerifyResult) {
  console.log('\n=== VERIFICATION REPORT ===\n')
  for (const [name, c] of Object.entries(result.counts)) {
    console.log(`${name}: snapshot=${c.snapshot} postgres=${c.postgres} ${c.snapshot === c.postgres ? 'OK' : 'MISMATCH'}`)
  }
  if (result.issues.length > 0) {
    console.log('\n--- Detalle ---')
    for (const issue of result.issues) console.log(`[${issue.severity}] (${issue.code}) ${issue.message}`)
  }
  console.log(`\nVERIFICATION: ${result.ok ? 'OK' : 'FAILED'}`)
}
