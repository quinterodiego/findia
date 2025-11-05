import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { rejectSharedExpense, getSharedExpensesByUser } from '@/lib/googleSheets';
import { sendSharedExpenseRejectedNotification } from '@/lib/email';

/**
 * PUT /api/shared-expenses/[id]/reject
 * Rechaza un gasto compartido
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
    
    // Obtener información del gasto compartido antes de rechazarlo
    let sharedExpenseData: any = null;
    try {
      const sharedExpenses = await getSharedExpensesByUser(session.user.id);
      sharedExpenseData = sharedExpenses.find((se: any) => se.id === id);
    } catch (error) {
      console.error('Error obteniendo gasto compartido:', error);
    }
    
    await rejectSharedExpense(id, session.user.id);
    
    // Enviar email de notificación al dueño del gasto
    if (sharedExpenseData && sharedExpenseData.owner) {
      try {
        const partnerName = session.user.name || session.user.email || 'Usuario';
        const expenseName = sharedExpenseData.expense?.name || 'Gasto compartido';
        const ownerEmail = sharedExpenseData.owner.email;
        
        await sendSharedExpenseRejectedNotification(
          ownerEmail,
          partnerName,
          expenseName
        );
      } catch (emailError) {
        console.error('Error enviando email de rechazo (no crítico):', emailError);
        // No fallar el rechazo si el email falla
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Gasto compartido rechazado',
    });
  } catch (error: any) {
    console.error('Error en PUT /api/shared-expenses/[id]/reject:', error);
    return NextResponse.json(
      { 
        error: 'Error al rechazar gasto compartido',
        details: error.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

