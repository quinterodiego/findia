import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { rejectCancelSharedExpense, getSharedExpensesByUser } from '@/lib/googleSheets';
import { sendSharedExpenseAcceptedNotification } from '@/lib/email';

/**
 * PUT /api/shared-expenses/[id]/reject-cancel
 * Rechaza la solicitud de cancelación y restaura el gasto a 'accepted' (solo el partner puede rechazar)
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
    
    // Obtener información del gasto antes de rechazar la cancelación
    let sharedExpenseData: any = null;
    try {
      const sharedExpenses = await getSharedExpensesByUser(session.user.id);
      sharedExpenseData = sharedExpenses.find((se: any) => se.id === id);
    } catch (error) {
      console.error('Error obteniendo gasto compartido:', error);
    }
    
    // Rechazar la cancelación (restaura a 'accepted')
    await rejectCancelSharedExpense(id, session.user.id);
    
    // Enviar email de notificación al owner
    if (sharedExpenseData && sharedExpenseData.owner) {
      try {
        const partnerName = session.user.name || session.user.email || 'Usuario';
        const expenseName = sharedExpenseData.expense?.name || 'Gasto compartido';
        const partnerAmount = sharedExpenseData.partnerAmount || 0;
        const ownerEmail = sharedExpenseData.owner.email;
        
        await sendSharedExpenseAcceptedNotification(
          ownerEmail,
          partnerName,
          expenseName,
          partnerAmount
        );
      } catch (emailError) {
        console.error('Error enviando email de rechazo de cancelación (no crítico):', emailError);
        // No fallar si el email falla
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Cancelación rechazada. El gasto compartido se mantiene activo.',
    });
  } catch (error: any) {
    console.error('Error rechazando cancelación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al rechazar la cancelación' },
      { status: 500 }
    );
  }
}

