import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { googleSheetsService } from '@/lib/google-sheets'
import type { Debt } from '@/types'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: debtId } = await params

    // Get user
    const user = await googleSheetsService.getUser(session.user.email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify debt ownership
    const existingDebts = await googleSheetsService.getUserDebts(user.id)
    const existingDebt = existingDebts.find(debt => debt.id === debtId)
    
    if (!existingDebt) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 })
    }

    // Update debt
    const updatedDebt: Debt = {
      ...existingDebt,
      ...body,
      id: debtId,
      userId: user.id,
      updatedAt: new Date().toISOString(),
    }

    await googleSheetsService.updateDebt(updatedDebt)
    return NextResponse.json(updatedDebt)
  } catch (error) {
    console.error('Error updating debt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: debtId } = await params

    // Get user
    const user = await googleSheetsService.getUser(session.user.email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify debt ownership
    const existingDebts = await googleSheetsService.getUserDebts(user.id)
    const existingDebt = existingDebts.find(debt => debt.id === debtId)
    
    if (!existingDebt) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 })
    }

    await googleSheetsService.deleteDebt(debtId)
    return NextResponse.json({ message: 'Debt deleted successfully' })
  } catch (error) {
    console.error('Error deleting debt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}