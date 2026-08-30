import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from '../../../_lib/apiError'
import { editSharedGroupMemberForUser, deleteSharedGroupMemberForUser } from './handlers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id, memberId } = await params
    const body = await req.json()
    const member = await editSharedGroupMemberForUser(id, memberId, session.user.id, body)
    return NextResponse.json({ success: true, member })
  } catch (error) {
    return handleApiError(error, 'PUT /api/shared-groups/[id]/members/[memberId]')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id, memberId } = await params
    await deleteSharedGroupMemberForUser(id, memberId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'DELETE /api/shared-groups/[id]/members/[memberId]')
  }
}
