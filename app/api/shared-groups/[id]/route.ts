import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from '../_lib/apiError'
import { getSharedGroupDetailForUser, renameSharedGroupForUser, deleteSharedGroupForUser } from './handlers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const result = await getSharedGroupDetailForUser(id, session.user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error, 'GET /api/shared-groups/[id]')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const group = await renameSharedGroupForUser(id, session.user.id, body)
    return NextResponse.json({ success: true, group })
  } catch (error) {
    return handleApiError(error, 'PUT /api/shared-groups/[id]')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    await deleteSharedGroupForUser(id, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'DELETE /api/shared-groups/[id]')
  }
}
