import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cancelSharedExpense, getSharedExpensesByUser } from '@/lib/googleSheets';
import { sendSharedExpenseCancelledNotification } from '@/lib/email';

/**
 * DELETE /api/shared-expenses/[id]
 * Solicita cancelar un gasto compartido (solo el owner puede solicitar)
 * - Si está pendiente: lo cancela directamente
 * - Si está aceptado: cambia el estado a 'cancellation_requested' para que el partner confirme
 */
export async function DELETE(
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
    
    // Obtener información del gasto compartido antes de cancelarlo
    let sharedExpenseData: import('@/types').SharedExpense | null = null;
    try {
      const sharedExpenses = await getSharedExpensesByUser(session.user.id);
      sharedExpenseData = sharedExpenses.find(se => se.id === id);
    } catch (error) {
      console.error('Error obteniendo gasto compartido:', error);
    }
    
    const wasAccepted = sharedExpenseData?.status === 'accepted';
    const wasPending = sharedExpenseData?.status === 'pending';
    
    // Solicitar cancelar el gasto compartido
    await cancelSharedExpense(id, session.user.id);
    
    // Enviar email de notificación al partner
    if (sharedExpenseData && sharedExpenseData.partner) {
      try {
        const ownerName = session.user.name || session.user.email || 'Usuario';
        const expenseName = sharedExpenseData.expense?.name || 'Gasto compartido';
        const partnerEmail = sharedExpenseData.partner.email;
        
        if (wasAccepted) {
          // Si estaba aceptado, enviar email de solicitud de cancelación
          await sendSharedExpenseCancelledNotification(
            partnerEmail,
            ownerName,
            expenseName,
            true // fue aceptado, ahora necesita confirmación
          );
        } else if (wasPending) {
          // Si estaba pendiente, enviar email de cancelación directa
          await sendSharedExpenseCancelledNotification(
            partnerEmail,
            ownerName,
            expenseName,
            false // no estaba aceptado
          );
        }
      } catch (emailError) {
        console.error('Error enviando email de cancelación (no crítico):', emailError);
        // No fallar la cancelación si el email falla
      }
    }
    
    return NextResponse.json({
      success: true,
      message: wasAccepted 
        ? 'Solicitud de cancelación enviada. El partner debe confirmarla.' 
        : 'Gasto compartido cancelado',
    });
  } catch (error) {
    console.error('Error cancelando gasto compartido:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cancelar el gasto compartido' },
      { status: 500 }
    );
  }
}

