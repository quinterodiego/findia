import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { googleSheetsService } from '@/lib/google-sheets'
import type { Debt } from '@/types'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize sheet structure if needed
    await googleSheetsService.initializeSheetStructure()

    // Get or create user
    let user = await googleSheetsService.getUser(session.user.email)
    if (!user) {
      user = await googleSheetsService.createUser({
        email: session.user.email,
        name: session.user.name || '',
        picture: session.user.image,
        provider: 'google',
        createdAt: new Date().toISOString(),
        isAdmin: process.env.ADMIN_EMAILS?.split(',').includes(session.user.email) || false,
      })
    }

    const debts = await googleSheetsService.getUserDebts(user.id)
    return NextResponse.json(debts)
  } catch (error) {
    console.error('Error fetching debts:', error)
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
    const requiredFields = ['name', 'currentAmount', 'originalAmount', 'minimumPayment', 'dueDate', 'priority', 'category', 'type']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Get or create user
    let user = await googleSheetsService.getUser(session.user.email)
    if (!user) {
      user = await googleSheetsService.createUser({
        email: session.user.email,
        name: session.user.name || '',
        picture: session.user.image,
        provider: 'google',
        createdAt: new Date().toISOString(),
        isAdmin: process.env.ADMIN_EMAILS?.split(',').includes(session.user.email) || false,
      })
    }

    const now = new Date().toISOString()
    const debtData: Omit<Debt, 'id'> = {
      userId: user.id,
      name: body.name,
      currentAmount: parseFloat(body.currentAmount),
      originalAmount: parseFloat(body.originalAmount),
      minimumPayment: parseFloat(body.minimumPayment),
      interestRate: parseFloat(body.interestRate) || 0,
      dueDate: body.dueDate,
      priority: body.priority,
      category: body.category,
      type: body.type,
      notes: body.notes || '',
      createdAt: now,
      updatedAt: now,
    }

    const debt = await googleSheetsService.createDebt(debtData)
    return NextResponse.json(debt, { status: 201 })
  } catch (error) {
    console.error('Error creating debt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}