export interface RawPushSubscriptionRow {
  rowIndex: number // 0-based dentro del snapshot (para mensajes de error legibles)
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  createdAt: string
}

export interface PushSubscriptionsSnapshot {
  rows: RawPushSubscriptionRow[]
}

export interface ValidationIssue {
  severity: 'CRITICAL' | 'WARNING'
  code: string
  rowIndex?: number
  message: string
}

export interface ValidationResult {
  issues: ValidationIssue[]
  criticalCount: number
  warningCount: number
  importable: boolean
}

export interface TransformedPushSubscription {
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  createdAt: Date
}
