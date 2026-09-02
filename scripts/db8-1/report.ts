import type { PushSubscriptionsSnapshot, ValidationResult } from './types'
import type { VerifyResult } from './verify'

export function printAuditReport(snapshot: PushSubscriptionsSnapshot, validation: ValidationResult) {
  console.log('\n=== PUSHSUBSCRIPTIONS MIGRATION AUDIT ===\n')
  console.log(`Rows: ${snapshot.rows.length}`)
  console.log(`Critical errors: ${validation.criticalCount}`)
  console.log(`Warnings: ${validation.warningCount}`)
  if (validation.issues.length > 0) {
    console.log('\nIssues:')
    for (const issue of validation.issues) {
      console.log(`  [${issue.severity}] ${issue.code}${issue.rowIndex !== undefined ? ` (fila ${issue.rowIndex})` : ''}: ${issue.message}`)
    }
  }
  console.log(`\nIMPORTABLE: ${validation.importable ? 'YES' : 'NO'}`)
}

export function printVerifyReport(result: VerifyResult) {
  console.log('\n=== VERIFICATION REPORT ===')
  console.log(`counts: snapshot=${result.counts.snapshot} postgres=${result.counts.postgres}`)
  if (result.issues.length > 0) {
    for (const issue of result.issues) console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`)
  }
  console.log(`VERIFICATION: ${result.ok ? 'OK' : 'FALLÓ'}`)
}
