import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPaymentsByUser } from '@/lib/googleSheets';

/**
 * GET /api/payments
 * Obtiene todos los pagos de deudas del usuario
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const payments = await getPaymentsByUser(session.user.id);
    
    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error('Error en GET /api/payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos' },
      { status: 500 }
    );
  }
}
