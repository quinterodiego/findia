/**
 * Fase DB-8.0S — chequeo de admin reutilizado tal cual del patrón ya
 * existente en app/api/debts/route.ts (PUT), extraído a una función pura y
 * testeable. No introduce un sistema de roles nuevo: sigue siendo el mismo
 * mecanismo ADMIN_EMAILS de siempre. Fail-closed: sin ADMIN_EMAILS
 * configurada, la lista queda vacía y nadie es admin.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  return adminEmails.includes(email)
}
