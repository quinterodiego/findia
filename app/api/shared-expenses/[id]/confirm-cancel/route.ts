import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { confirmCancelSharedExpense, getSharedExpensesByUser } from '@/lib/googleSheets';

/**
 * PUT /api/shared-expenses/[id]/confirm-cancel
 * Confirma la cancelación de un gasto compartido (solo el partner puede confirmar)
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
    
    // Confirmar la cancelación
    await confirmCancelSharedExpense(id, session.user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Cancelación confirmada. El gasto compartido ha sido eliminado.',
    });
  } catch (error) {
    console.error('Error confirmando cancelación:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al confirmar la cancelación' },
      { status: 500 }
    );
  }
}

