import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCreditCardConsumption, getCreditCardConsumptions } from '@/lib/googleSheets'

/**
 * GET /api/credit-cards/[id]/consumptions
 * Obtiene todos los consumos de una tarjeta de crédito
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cardId } = await params
    const consumptions = await getCreditCardConsumptions(cardId, session.user.id as string)

    return NextResponse.json({ success: true, consumptions }, { status: 200 })
  } catch (e) {
    console.error('GET consumptions error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

/**
 * POST /api/credit-cards/[id]/consumptions
 * Crea nuevos consumos (desde importación de PDF)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { id: cardId } = await params
    const body = await req.json()
    const items = Array.isArray(body.items) ? body.items : []
    const skipDuplicates = body.skipDuplicates !== false // Por defecto true para evitar duplicados

    // Obtener consumos existentes si queremos evitar duplicados
    let existingConsumptions: Pick<import('@/types').CreditCardConsumption, 'amount' | 'date' | 'merchant'>[] = []
    if (skipDuplicates) {
      existingConsumptions = await getCreditCardConsumptions(cardId, session.user.id as string)
    }

    let created = 0
    let skipped = 0

    for (const it of items) {
      // Calcular el monto total (PESOS + USD convertido, o solo el que tenga valor)
      // Por ahora usar PESOS como principal, o USD si no hay PESOS
      const totalAmount = it.montoPesos > 0 ? it.montoPesos : (it.montoUSD || it.amount || 0)
      
      // Verificar si ya existe un consumo similar (mismo monto, fecha y comercio)
      if (skipDuplicates) {
        const exists = existingConsumptions.some(ec => {
          const sameAmount = Math.abs(ec.amount - totalAmount) < 0.01
          const sameDate = ec.date === it.date
          const sameMerchant = ec.merchant?.toLowerCase().trim() === (it.description || 'Movimiento').toLowerCase().trim()
          return sameAmount && sameDate && sameMerchant
        })
        
        if (exists) {
          skipped++
          continue
        }
      }
      const totalInstallments = it.installments?.total || 1
      // El totalAmount ya es la cuota mensual, no el total
      // Para calcular el total original: totalAmount * totalInstallments
      const monthlyPayment = totalAmount

      await createCreditCardConsumption({
        creditCardId: cardId,
        userId: session.user.id as string,
        merchant: it.description || 'Movimiento',
        amount: totalAmount, // Este es la cuota mensual
        installments: totalInstallments,
        currentInstallment: it.installments?.current || 1,
        monthlyPayment: monthlyPayment,
        date: it.date, // dd/mm/aaaa
        categoryId: it.categoryId || '',
        subcategoryId: it.subcategoryId || '',
        description: it.type,
        createdAt: new Date().toISOString(),
        montoPesos: it.montoPesos || 0,
        montoUSD: it.montoUSD || 0,
      })
      
      created++
      // Agregar a la lista de existentes para evitar duplicados en la misma importación
      if (skipDuplicates) {
        existingConsumptions.push({
          amount: totalAmount,
          date: it.date,
          merchant: it.description || 'Movimiento'
        })
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      created, 
      skipped,
      message: skipDuplicates && skipped > 0 
        ? `Se importaron ${created} movimientos. ${skipped} duplicados omitidos.`
        : `Se importaron ${created} movimientos.`
    }), { status: 200 })
  } catch (e) {
    console.error('POST consumptions error', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Error' }), { status: 500 })
  }
}


