import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { markSharedExpenseAsSettled, getSharedExpensesByUser } from '@/lib/googleSheets';

/**
 * PUT /api/shared-expenses/[id]/settle
 * Marca un gasto compartido como saldado (cuando la parte del otro usuario ya está pagada)
 */
export async function PUT(
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
    
    // Obtener información del gasto compartido antes de marcarlo como saldado
    let sharedExpenseData: import('@/types').SharedExpense | null = null;
    try {
      const sharedExpenses = await getSharedExpensesByUser(session.user.id);
      sharedExpenseData = sharedExpenses.find(se => se.id === id);
    } catch (error) {
      console.error('Error obteniendo gasto compartido:', error);
    }

    await markSharedExpenseAsSettled(id, session.user.id);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Gasto compartido marcado como saldado.' 
    });
  } catch (error) {
    console.error('Error marcando gasto compartido como saldado:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al marcar el gasto compartido como saldado' },
      { status: 500 }
    );
  }
}
