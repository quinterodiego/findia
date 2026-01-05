import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateExpense, deleteExpense } from '@/lib/googleSheets';

/**
 * PUT /api/expenses/[id]
 * Actualiza un gasto existente
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
    
    const body = await req.json();
    const { id } = await params;
    
    if (!body.name || !body.amount || !body.date) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, amount, date' },
        { status: 400 }
      );
    }
    
    const updatedExpense = await updateExpense(id, session.user.id, {
      name: body.name,
      amount: parseFloat(body.amount),
      date: body.date,
      category: body.category || 'other',
      expenseType: body.expenseType || 'variable',
      notes: body.notes || '',
      isRecurring: body.isRecurring || false,
      frequency: body.frequency || 'monthly',
      totalInstallments: body.totalInstallments ? parseInt(body.totalInstallments) : undefined,
      currentInstallment: body.currentInstallment ? parseInt(body.currentInstallment) : undefined,
      paymentMethod: body.paymentMethod || undefined,
    });
    
    return NextResponse.json({
      success: true,
      expense: updatedExpense,
    });
  } catch (error) {
    console.error('Error en PUT /api/expenses:', error);
    return NextResponse.json(
      { 
        error: 'Error al actualizar gasto',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expenses/[id]
 * Elimina un gasto
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
    
    await deleteExpense(id, session.user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Gasto eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/expenses:', error);
    return NextResponse.json(
      { 
        error: 'Error al eliminar gasto',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
