import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/googleSheets'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    const user = await getUserByEmail(email)
    
    return NextResponse.json({ exists: !!user })
  } catch (error) {
    console.error('Error checking user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
