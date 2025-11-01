import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { 
  getSmartTemplate, 
  saveSmartTemplate
} from '@/lib/googleSheets'

/**
 * GET /api/credit-cards/[id]/smart-template
 * Obtiene el smart template para una tarjeta
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cardId = params.id
    const smartTemplate = await getSmartTemplate(cardId, session.user.id as string)

    return NextResponse.json({ success: true, smartTemplate }, { status: 200 })
  } catch (e: any) {
    console.error('GET smart template error', e)
    return NextResponse.json({ error: 'Error obteniendo smart template' }, { status: 500 })
  }
}

/**
 * POST /api/credit-cards/[id]/smart-template
 * Guarda o actualiza el smart template para una tarjeta
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cardId = params.id
    const body = await req.json()

    const smartTemplate = await saveSmartTemplate({
      creditCardId: cardId,
      userId: session.user.id as string,
      ...body
    })

    return NextResponse.json({ success: true, smartTemplate }, { status: 200 })
  } catch (e: any) {
    console.error('POST smart template error', e)
    return NextResponse.json({ error: e.message || 'Error guardando smart template' }, { status: 500 })
  }
}

