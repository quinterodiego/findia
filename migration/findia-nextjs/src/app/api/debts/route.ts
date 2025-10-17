import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { googleSheetsService } from '@/lib/google-sheets'

export async function GET() {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const debts = await googleSheetsService.getUserDebts(session.user.email)
    return NextResponse.json(debts)
  } catch (error) {
    console.error('Error fetching debts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const debt = await googleSheetsService.createDebt({
      ...body,
      userId: session.user.email,
    })

    return NextResponse.json(debt, { status: 201 })
  } catch (error) {
    console.error('Error creating debt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}