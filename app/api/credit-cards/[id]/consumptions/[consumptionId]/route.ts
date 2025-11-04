import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { updateCreditCardConsumption, getCreditCardConsumptions } from '@/lib/googleSheets'

/**
 * PUT /api/credit-cards/[id]/consumptions/[consumptionId]
 * Actualiza un consumo específico de una tarjeta de crédito
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; consumptionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cardId, consumptionId } = await params
    const body = await req.json()

    // Verificar que el consumo pertenece a la tarjeta y al usuario
    const consumptions = await getCreditCardConsumptions(cardId, session.user.id as string)
    const consumption = consumptions.find(c => c.id === consumptionId)
    
    if (!consumption) {
      return NextResponse.json({ error: 'Consumo no encontrado' }, { status: 404 })
    }

    // Actualizar el consumo
    console.log('[PUT consumption] Body recibido:', {
      merchant: body.merchant,
      amount: body.amount,
      montoPesos: body.montoPesos,
      montoUSD: body.montoUSD,
      currency: body.currency
    })
    
    const updated = await updateCreditCardConsumption(consumptionId, session.user.id as string, {
      merchant: body.merchant,
      amount: body.amount,
      installments: body.installments,
      currentInstallment: body.currentInstallment,
      monthlyPayment: body.monthlyPayment,
      date: body.date,
      categoryId: body.categoryId,
      subcategoryId: body.subcategoryId,
      description: body.description,
      montoPesos: body.montoPesos,
      montoUSD: body.montoUSD,
    })

    console.log('[PUT consumption] Consumo actualizado:', {
      id: updated.id,
      amount: updated.amount,
      montoPesos: (updated as any).montoPesos,
      montoUSD: (updated as any).montoUSD,
    })

    return NextResponse.json({ success: true, consumption: updated }, { status: 200 })
  } catch (e: any) {
    console.error('PUT consumption error', e)
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}

