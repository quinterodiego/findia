import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createPayment } from '@/lib/googleSheets';

/**
 * POST /api/debts/[id]/payments
 * Registra un pago para una deuda
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { id } = await params;
    
    if (!body.amount || !body.date) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: amount, date' },
        { status: 400 }
      );
    }
    
    const payment = await createPayment(session.user.id, id, {
      amount: parseFloat(body.amount),
      date: body.date,
      type: body.type || 'regular',
      notes: body.notes || '',
    });
    
    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('Error en POST /api/debts/payments:', error);
    return NextResponse.json(
      { 
        error: 'Error al registrar pago',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}