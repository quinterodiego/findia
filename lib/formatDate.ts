/**
 * Utilidades para tratar fechas "YYYY-MM-DD" como fecha CIVIL (un día de calendario),
 * no como un instante temporal. `new Date('YYYY-MM-DD')` la interpreta como medianoche
 * UTC, y formatearla con `.toLocaleDateString()` en una timezone negativa (ej. Argentina,
 * UTC-3) puede mostrar el día anterior. Estas funciones evitan esa conversión.
 */

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Parsea "YYYY-MM-DD" a sus componentes sin pasar por new Date() (evita el corrimiento UTC). */
export function parseCivilDate(dateStr: string): { year: number; month: number; day: number } | null {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** "2026-08-26" -> "26/08/2026" */
export function formatCivilDate(dateStr: string): string {
  const parsed = parseCivilDate(dateStr);
  if (!parsed) return dateStr;
  const { year, month, day } = parsed;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** "2026-08-26" -> "26 ago" (para ejes de gráfico compactos) */
export function formatCivilDateShort(dateStr: string): string {
  const parsed = parseCivilDate(dateStr);
  if (!parsed) return dateStr;
  const { month, day } = parsed;
  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

/**
 * Fecha de HOY según el reloj local del navegador (no UTC), lista para usar como
 * `value` de un <input type="date"> ("YYYY-MM-DD").
 */
export function getLocalTodayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
