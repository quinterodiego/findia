import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { 
  getPDFImportTemplates, 
  createPDFImportTemplate,
  updatePDFImportTemplate,
  deletePDFImportTemplate,
  getPDFImportTemplate
} from '@/lib/googleSheets'

/**
 * GET /api/credit-cards/[id]/templates
 * Obtiene todos los templates de importación PDF para una tarjeta
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cardId } = await params
    const templates = await getPDFImportTemplates(cardId, session.user.id as string)

    return NextResponse.json({ success: true, templates }, { status: 200 })
  } catch (e: any) {
    console.error('GET templates error', e)
    return NextResponse.json({ error: 'Error obteniendo templates' }, { status: 500 })
  }
}

/**
 * POST /api/credit-cards/[id]/templates
 * Crea un nuevo template de importación PDF
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cardId } = await params
    const body = await req.json()

    const template = await createPDFImportTemplate({
      creditCardId: cardId,
      userId: session.user.id as string,
      name: body.name || 'Template sin nombre',
      datePattern: body.datePattern,
      amountPattern: body.amountPattern,
      descriptionPattern: body.descriptionPattern,
      installmentsPattern: body.installmentsPattern,
      interestKeywords: body.interestKeywords,
      feeKeywords: body.feeKeywords,
      dateFormat: body.dateFormat,
      amountDecimalSeparator: body.amountDecimalSeparator,
      amountThousandsSeparator: body.amountThousandsSeparator,
      searchRange: body.searchRange,
      skipLines: body.skipLines,
    })

    return NextResponse.json({ success: true, template }, { status: 201 })
  } catch (e: any) {
    console.error('POST template error', e)
    return NextResponse.json({ error: e.message || 'Error creando template' }, { status: 500 })
  }
}

