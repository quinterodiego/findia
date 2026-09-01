/**
 * Fase DB-7A.1 — maintenance freeze de Shared Groups V2, único punto de
 * aplicación server-side (en vez de editar cada uno de los 14 route.ts).
 * Corre ANTES que cualquier handler, incluso antes del chequeo de sesión de
 * cada ruta -- por eso una mutación bloqueada nunca llega a tocar el
 * repositorio (Sheets o Postgres, sea cual sea el backend activo).
 *
 * Runtime: edge (el default de Next.js para middleware). Se probó
 * explícitamente `runtime: 'nodejs'` (documentado como estable desde Next
 * 15.5) y se descartó: con esa opción, `middleware-manifest.json` queda
 * vacío (`"middleware": {}`, `"sortedMiddleware": []`) -- Next 15.5.9 lo
 * ignora en silencio, sin error de build, y el middleware directamente NO
 * se registra ni se ejecuta nunca. Confirmado inspeccionando el manifest
 * después de cada build. Con runtime edge (default, sin esa línea) el
 * manifest sí lo registra correctamente. Vercel expone env vars server-side
 * (no solo `NEXT_PUBLIC_*`) como bindings de runtime a los Edge Functions,
 * leídos en caliente por request -- no hay inlineado de build time acá.
 *

 * SHARED_GROUPS_MAINTENANCE_MODE=true/false por ahora no está seteada en
 * ningún entorno -- default false (sin freeze) en todos lados, incluida
 * Production, hasta que DB-7B decida activarla explícitamente.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { shouldBlockForMaintenance, SHARED_GROUPS_MAINTENANCE_MESSAGE } from '@/lib/sharedGroupsMaintenance'

export function middleware(request: NextRequest) {
  if (shouldBlockForMaintenance(request.method, request.nextUrl.pathname)) {
    return NextResponse.json({ error: SHARED_GROUPS_MAINTENANCE_MESSAGE }, { status: 503 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/shared-groups/:path*', '/api/shared-group-invitations/:path*'],
}
