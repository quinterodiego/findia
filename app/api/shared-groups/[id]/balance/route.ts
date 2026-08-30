import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from '../../_lib/apiError'
import { getSharedGroupBalanceForUser } from './handlers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const result = await getSharedGroupBalanceForUser(id, session.user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error, 'GET /api/shared-groups/[id]/balance')
  }
}
