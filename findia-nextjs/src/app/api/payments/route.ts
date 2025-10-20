import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { googleSheetsService } from '@/lib/google-sheets'
import type { Payment } from '@/types'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const user = await googleSheetsService.getUser(session.user.email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const payments = await googleSheetsService.getPayments(user.id)
    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['debtId', 'amount', 'date']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Get user
    const user = await googleSheetsService.getUser(session.user.email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify debt ownership
    const userDebts = await googleSheetsService.getUserDebts(user.id)
    const debt = userDebts.find(d => d.id === body.debtId)
    
    if (!debt) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 })
    }

    const paymentData: Omit<Payment, 'id'> = {
      debtId: body.debtId,
      userId: user.id,
      amount: parseFloat(body.amount),
      date: body.date,
      notes: body.notes || '',
    }

    const payment = await googleSheetsService.createPayment(paymentData)

    // Update debt amount
    const newCurrentAmount = Math.max(0, debt.currentAmount - payment.amount)
    const updatedDebt = {
      ...debt,
      currentAmount: newCurrentAmount,
      updatedAt: new Date().toISOString(),
    }

    await googleSheetsService.updateDebt(updatedDebt)

    return NextResponse.json({ payment, updatedDebt }, { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}