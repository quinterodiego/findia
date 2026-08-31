import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from '@/app/api/shared-groups/_lib/apiError'
import { toPublicInvitation } from '@/app/api/shared-groups/_lib/invitationDto'
import { rejectSharedGroupInvitationForUser } from './handlers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const hasVerifiedGoogleSession = !!session.accessToken
    const invitation = await rejectSharedGroupInvitationForUser(id, session.user.email, hasVerifiedGoogleSession, body)
    return NextResponse.json({ success: true, invitation: toPublicInvitation(invitation) })
  } catch (error) {
    return handleApiError(error, 'POST /api/shared-group-invitations/[id]/reject')
  }
}
