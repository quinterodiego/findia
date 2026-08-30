import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from './_lib/apiError'
import { listSharedGroupsForUser, createSharedGroupForUser } from './handlers'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const groups = await listSharedGroupsForUser(session.user.id)
    return NextResponse.json({ success: true, groups })
  } catch (error) {
    return handleApiError(error, 'GET /api/shared-groups')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const result = await createSharedGroupForUser(session.user.id, session.user, body)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error, 'POST /api/shared-groups')
  }
}
