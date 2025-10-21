import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getPaymentsByDebt,
  createPayment,
} from '@/lib/googleSheets';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/debts/[id]/payments
 * Obtiene todos los pagos de una deuda
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const payments = await getPaymentsByDebt(id);
    
    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error('Error en GET /api/debts/[id]/payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/debts/[id]/payments
 * Registra un nuevo pago para una deuda
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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
    
    // Validación básica
    if (!body.amount || !body.date) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: amount, date' },
        { status: 400 }
      );
    }
    
    // Crear el pago
    const newPayment = await createPayment(session.user.id, id, {
      amount: parseFloat(body.amount),
      date: body.date,
      type: body.type || 'regular',
      notes: body.notes || '',
    });
    
    return NextResponse.json({
      success: true,
      payment: newPayment,
    });
  } catch (error) {
    console.error('Error en POST /api/debts/[id]/payments:', error);
    return NextResponse.json(
      { error: 'Error al registrar pago' },
      { status: 500 }
    );
  }
}
