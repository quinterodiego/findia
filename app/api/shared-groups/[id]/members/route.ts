import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from '../../_lib/apiError'
import { listSharedGroupMembersForUser, addSharedGroupMemberForUser } from './handlers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const members = await listSharedGroupMembersForUser(id, session.user.id)
    return NextResponse.json({ success: true, members })
  } catch (error) {
    return handleApiError(error, 'GET /api/shared-groups/[id]/members')
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const member = await addSharedGroupMemberForUser(id, session.user.id, body)
    return NextResponse.json({ success: true, member })
  } catch (error) {
    return handleApiError(error, 'POST /api/shared-groups/[id]/members')
  }
}
