import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { 
  getPDFImportTemplate,
  updatePDFImportTemplate,
  deletePDFImportTemplate
} from '@/lib/googleSheets'

/**
 * GET /api/credit-cards/[id]/templates/[templateId]
 * Obtiene un template específico
 */
export async function GET(
  req: NextRequest, 
  { params }: { params: { id: string; templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const template = await getPDFImportTemplate(params.templateId, session.user.id as string)
    
    if (!template) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, template }, { status: 200 })
  } catch (e: any) {
    console.error('GET template error', e)
    return NextResponse.json({ error: 'Error obteniendo template' }, { status: 500 })
  }
}

/**
 * PUT /api/credit-cards/[id]/templates/[templateId]
 * Actualiza un template existente
 */
export async function PUT(
  req: NextRequest, 
  { params }: { params: { id: string; templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const updates: any = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.datePattern !== undefined) updates.datePattern = body.datePattern
    if (body.amountPattern !== undefined) updates.amountPattern = body.amountPattern
    if (body.descriptionPattern !== undefined) updates.descriptionPattern = body.descriptionPattern
    if (body.installmentsPattern !== undefined) updates.installmentsPattern = body.installmentsPattern
    if (body.interestKeywords !== undefined) updates.interestKeywords = body.interestKeywords
    if (body.feeKeywords !== undefined) updates.feeKeywords = body.feeKeywords
    if (body.dateFormat !== undefined) updates.dateFormat = body.dateFormat
    if (body.amountDecimalSeparator !== undefined) updates.amountDecimalSeparator = body.amountDecimalSeparator
    if (body.amountThousandsSeparator !== undefined) updates.amountThousandsSeparator = body.amountThousandsSeparator
    if (body.searchRange !== undefined) updates.searchRange = body.searchRange
    if (body.skipLines !== undefined) updates.skipLines = body.skipLines

    const template = await updatePDFImportTemplate(
      params.templateId,
      session.user.id as string,
      updates
    )

    return NextResponse.json({ success: true, template }, { status: 200 })
  } catch (e: any) {
    console.error('PUT template error', e)
    return NextResponse.json({ error: e.message || 'Error actualizando template' }, { status: 500 })
  }
}

/**
 * DELETE /api/credit-cards/[id]/templates/[templateId]
 * Elimina un template
 */
export async function DELETE(
  req: NextRequest, 
  { params }: { params: { id: string; templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await deletePDFImportTemplate(params.templateId, session.user.id as string)

    return NextResponse.json({ success: true, message: 'Template eliminado' }, { status: 200 })
  } catch (e: any) {
    console.error('DELETE template error', e)
    return NextResponse.json({ error: e.message || 'Error eliminando template' }, { status: 500 })
  }
}

