import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSharedExpense, getSharedExpensesByUser } from '@/lib/googleSheets';
import { sendSharedExpenseNotification } from '@/lib/email';

/**
 * POST /api/shared-expenses
 * Crea un nuevo gasto compartido
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    
    // Validación básica
    if (!body.expenseId || !body.sharedWithEmail || !body.splitType) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: expenseId, sharedWithEmail, splitType' },
        { status: 400 }
      );
    }
    
    // Crear el gasto compartido
    const newSharedExpense = await createSharedExpense(session.user.id, {
      expenseId: body.expenseId,
      sharedWithEmail: body.sharedWithEmail,
      splitType: body.splitType,
      ownerAmount: body.ownerAmount,
      partnerAmount: body.partnerAmount,
      ownerPercentage: body.ownerPercentage,
      partnerPercentage: body.partnerPercentage,
      notes: body.notes,
    });

    // Obtener información del gasto y usuarios para el email
    try {
      // Obtener el gasto original
      const { getExpensesByUser, getUserByEmail } = await import('@/lib/googleSheets');
      const expenses = await getExpensesByUser(session.user.id);
      const expense = expenses.find(e => e.id === body.expenseId);
      
      // Obtener información del usuario dueño
      const ownerUser = await getUserByEmail(session.user.email || '');
      
      if (expense && ownerUser) {
        const ownerName = session.user.name || ownerUser.name || session.user.email || 'Usuario';
        const expenseName = expense.name || 'Gasto compartido';
        const expenseAmount = expense.amount || 0;
        
        // Calcular montos según el tipo de división
        let ownerAmount = 0;
        let partnerAmount = 0;
        
        if (body.splitType === 'equal') {
          ownerAmount = expenseAmount / 2;
          partnerAmount = expenseAmount / 2;
        } else if (body.splitType === 'percentage') {
          ownerAmount = (expenseAmount * (body.ownerPercentage || 50)) / 100;
          partnerAmount = (expenseAmount * (body.partnerPercentage || 50)) / 100;
        } else if (body.splitType === 'amount') {
          ownerAmount = body.ownerAmount || 0;
          partnerAmount = body.partnerAmount || 0;
        }
        
        const notes = body.notes || '';

        // Enviar email de notificación
        await sendSharedExpenseNotification(
          body.sharedWithEmail,
          ownerName,
          expenseName,
          expenseAmount,
          ownerAmount,
          partnerAmount,
          notes
        );
      }
    } catch (emailError) {
      console.error('Error enviando email (no crítico):', emailError);
      // No fallar la creación del gasto si el email falla
    }
    
    return NextResponse.json({
      success: true,
      sharedExpense: newSharedExpense,
    });
  } catch (error) {
    console.error('Error en POST /api/shared-expenses:', error);
    return NextResponse.json(
      { 
        error: 'Error al crear gasto compartido',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shared-expenses
 * Obtiene todos los gastos compartidos del usuario
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
    
    // Obtener query params
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') as 'pending' | 'accepted' | 'rejected' | null;
    const type = searchParams.get('type') as 'received' | 'sent' | 'all' | null;
    
    const filters = {
      ...(status && { status }),
      ...(type && { type: type as 'received' | 'sent' | 'all' }),
    };
    
    const sharedExpenses = await getSharedExpensesByUser(session.user.id, Object.keys(filters).length > 0 ? filters : undefined);
    
    return NextResponse.json({
      success: true,
      sharedExpenses,
    });
  } catch (error) {
    console.error('Error en GET /api/shared-expenses:', error);
    return NextResponse.json(
      { error: 'Error al obtener gastos compartidos' },
      { status: 500 }
    );
  }
}

