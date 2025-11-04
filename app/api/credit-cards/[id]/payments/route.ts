import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  createCreditCardPayment,
  getCreditCardPayments,
} from '@/lib/googleSheets';

/**
 * GET /api/credit-cards/[id]/payments
 * Obtiene los pagos de una tarjeta de crédito
 */
export async function GET(
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
    
    const { id } = await params;
    const payments = await getCreditCardPayments(id, session.user.id);
    
    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error('Error en GET /api/credit-cards/[id]/payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credit-cards/[id]/payments
 * Registra un pago de tarjeta de crédito
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
    
    const { id } = await params;
    const body = await req.json();
    
    if (!body.amount || !body.date) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: amount, date' },
        { status: 400 }
      );
    }
    
    const payment = await createCreditCardPayment(session.user.id, {
      creditCardId: id,
      amount: parseFloat(body.amount),
      date: body.date,
      paymentMethod: body.paymentMethod || 'transfer',
      notes: body.notes,
    });
    
    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('Error en POST /api/credit-cards/[id]/payments:', error);
    return NextResponse.json(
      { error: 'Error al registrar pago' },
      { status: 500 }
    );
  }
}

