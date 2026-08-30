import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from '../../../_lib/apiError'
import { updateSharedGroupSettlementForUser, deleteSharedGroupSettlementForUser } from './handlers'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id, settlementId } = await params
    const body = await req.json()
    const settlement = await updateSharedGroupSettlementForUser(id, settlementId, session.user.id, body)
    return NextResponse.json({ success: true, settlement })
  } catch (error) {
    return handleApiError(error, 'PUT /api/shared-groups/[id]/settlements/[settlementId]')
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id, settlementId } = await params
    await deleteSharedGroupSettlementForUser(id, settlementId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'DELETE /api/shared-groups/[id]/settlements/[settlementId]')
  }
}
