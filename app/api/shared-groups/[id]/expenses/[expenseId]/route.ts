import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleApiError } from '../../../_lib/apiError'
import { updateSharedGroupExpenseForUser, deleteSharedGroupExpenseForUser } from './handlers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id, expenseId } = await params
    const body = await req.json()
    const expense = await updateSharedGroupExpenseForUser(id, expenseId, session.user.id, body)
    return NextResponse.json({ success: true, expense })
  } catch (error) {
    return handleApiError(error, 'PUT /api/shared-groups/[id]/expenses/[expenseId]')
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id, expenseId } = await params
    await deleteSharedGroupExpenseForUser(id, expenseId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'DELETE /api/shared-groups/[id]/expenses/[expenseId]')
  }
}
