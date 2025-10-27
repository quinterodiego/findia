import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateGoal, deleteGoal } from '@/lib/googleSheets';

/**
 * PUT /api/goals/[id]
 * Actualiza una meta existente
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
    
    if (!body.name || !body.amount || !body.date || !body.targetDate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, amount, date, targetDate' },
        { status: 400 }
      );
    }
    
    const updatedGoal = await updateGoal(id, session.user.id, {
      name: body.name,
      amount: parseFloat(body.amount),
      currentAmount: body.currentAmount ? parseFloat(body.currentAmount) : 0,
      targetDate: body.targetDate,
      date: body.date,
      category: body.category || 'savings',
      notes: body.notes || '',
    });
    
    return NextResponse.json({
      success: true,
      goal: updatedGoal,
    });
  } catch (error) {
    console.error('Error en PUT /api/goals:', error);
    return NextResponse.json(
      { 
        error: 'Error al actualizar meta',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/goals/[id]
 * Elimina una meta
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
    
    await deleteGoal(id, session.user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Meta eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/goals:', error);
    return NextResponse.json(
      { 
        error: 'Error al eliminar meta',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
