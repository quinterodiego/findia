import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from '@/app/api/shared-groups/_lib/apiError'
import { listMySharedGroupInvitationsForUser } from './handlers'

/**
 * GET /api/shared-group-invitations — sin conectar a ningún fetch de
 * frontend todavía (Fase 4.2 es solo API). Reservado para que Fase 4.4 lo
 * consuma desde la UI de invitaciones.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const invitations = await listMySharedGroupInvitationsForUser(session.user.email)
    return NextResponse.json({ success: true, invitations })
  } catch (error) {
    return handleApiError(error, 'GET /api/shared-group-invitations')
  }
}
