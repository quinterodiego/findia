import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  getSmartTemplate, 
  saveSmartTemplate
} from '@/lib/googleSheets'

/**
 * GET /api/credit-cards/[id]/smart-template
 * Obtiene el smart template para una tarjeta
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cardId } = await params
    const smartTemplate = await getSmartTemplate(cardId, session.user.id as string)

    return NextResponse.json({ success: true, smartTemplate }, { status: 200 })
  } catch (e) {
    console.error('GET smart template error', e)
    return NextResponse.json({ error: 'Error obteniendo smart template' }, { status: 500 })
  }
}

/**
 * POST /api/credit-cards/[id]/smart-template
 * Guarda o actualiza el smart template para una tarjeta
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cardId } = await params
    const body = await req.json()

    const smartTemplate = await saveSmartTemplate({
      creditCardId: cardId,
      userId: session.user.id as string,
      ...body
    })

    return NextResponse.json({ success: true, smartTemplate }, { status: 200 })
  } catch (e) {
    console.error('POST smart template error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error guardando smart template' }, { status: 500 })
  }
}

