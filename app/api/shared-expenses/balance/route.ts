import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { calculateSharedExpenseBalance } from '@/lib/googleSheets';

/**
 * GET /api/shared-expenses/balance
 * Obtiene el balance de gastos compartidos del usuario
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
    
    const balance = await calculateSharedExpenseBalance(session.user.id);
    
    return NextResponse.json({
      success: true,
      balance,
    });
  } catch (error) {
    console.error('Error en GET /api/shared-expenses/balance:', error);
    return NextResponse.json(
      { error: 'Error al calcular balance de gastos compartidos' },
      { status: 500 }
    );
  }
}

