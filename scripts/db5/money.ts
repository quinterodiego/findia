/**
 * Fase DB-5 — helpers puros de monto, compartidos por validate.ts y
 * transform.ts. Nunca usa `toFixed()` como única garantía de precisión
 * (DB-5 §20): valida la precisión sobre el STRING crudo, antes de convertir.
 */

export interface ParsedAmount {
  valid: boolean
  value: number
  hasExtraPrecision: boolean
}

export function parseAmountRaw(raw: string): ParsedAmount {
  if (!raw || raw.trim() === '') return { valid: false, value: NaN, hasExtraPrecision: false }
  const value = Number(raw)
  if (!Number.isFinite(value)) return { valid: false, value: NaN, hasExtraPrecision: false }
  const decimalMatch = raw.trim().match(/\.(\d+)$/)
  const hasExtraPrecision = !!decimalMatch && decimalMatch[1].length > 2
  return { valid: true, value, hasExtraPrecision }
}

export function toCents(value: number): number {
  return Math.round(value * 100)
}

/** Representación decimal segura para `numeric(12,2)` -- 2 decimales fijos,
 * derivados de centavos enteros (nunca de un `toFixed()` directo sobre el
 * float original). */
export function toSafeDecimalString(value: number): string {
  return (toCents(value) / 100).toFixed(2)
}
