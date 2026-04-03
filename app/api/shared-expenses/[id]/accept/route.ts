import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { acceptSharedExpense, getSharedExpensesByUser, getUserByEmail } from '@/lib/googleSheets';
import { sendSharedExpenseAcceptedNotification } from '@/lib/email';

/**
 * PUT /api/shared-expenses/[id]/accept
 * Acepta un gasto compartido
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
    
    // Obtener información del gasto compartido antes de aceptarlo
    let sharedExpenseData: import('@/types').SharedExpense | null = null;
    try {
      const sharedExpenses = await getSharedExpensesByUser(session.user.id);
      sharedExpenseData = sharedExpenses.find(se => se.id === id);
    } catch (error) {
      console.error('Error obteniendo gasto compartido:', error);
    }
    
    await acceptSharedExpense(id, session.user.id);
    
    // Enviar email de notificación al dueño del gasto
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
        console.error('Error enviando email de aceptación (no crítico):', emailError);
        // No fallar la aceptación si el email falla
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Gasto compartido aceptado',
    });
  } catch (error) {
    console.error('Error en PUT /api/shared-expenses/[id]/accept:', error);
    return NextResponse.json(
      { 
        error: 'Error al aceptar gasto compartido',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

