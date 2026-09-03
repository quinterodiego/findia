import type { CategoriesSnapshot, ValidationResult } from './types'
import type { VerifyResult } from './verify'

export function printAuditReport(snapshot: CategoriesSnapshot, validation: ValidationResult) {
  console.log('\n=== CATEGORIES/SUBCATEGORIES MIGRATION AUDIT ===\n')
  console.log(`Categories: ${snapshot.categories.length}`)
  console.log(`Subcategories: ${snapshot.subcategories.length}`)

  const globalNames = new Set(snapshot.categories.map((c) => c.userId))
  console.log(`Usuarios distintos con categorías: ${globalNames.size}`)

  console.log(`\nCritical errors: ${validation.criticalCount}`)
  console.log(`Warnings: ${validation.warningCount}`)
  if (validation.issues.length > 0) {
    console.log('\nIssues:')
    for (const issue of validation.issues) {
      console.log(`  [${issue.severity}] (${issue.entity}) ${issue.code}${issue.rowIndex !== undefined ? ` (fila ${issue.rowIndex})` : ''}: ${issue.message}`)
    }
  }
  console.log(`\nIMPORTABLE: ${validation.importable ? 'YES' : 'NO'}`)
}

export function printVerifyReport(result: VerifyResult) {
  console.log('\n=== VERIFICATION REPORT ===')
  console.log(`categories: snapshot=${result.counts.categories.snapshot} postgres=${result.counts.categories.postgres}`)
  console.log(`subcategories: snapshot=${result.counts.subcategories.snapshot} postgres=${result.counts.subcategories.postgres}`)
  if (result.issues.length > 0) {
    for (const issue of result.issues) console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`)
  }
  console.log(`VERIFICATION: ${result.ok ? 'OK' : 'FALLÓ'}`)
}
