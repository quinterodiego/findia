import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateIncome, deleteIncome } from '@/lib/googleSheets';

/**
 * PUT /api/incomes/[id]
 * Actualiza un ingreso existente
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
    
    // Validación básica
    if (!body.name || !body.amount || !body.date) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, amount, date' },
        { status: 400 }
      );
    }
    
    const updatedIncome = await updateIncome(id, session.user.id, {
      name: body.name,
      amount: parseFloat(body.amount),
      date: body.date,
      category: body.category || 'other',
      notes: body.notes || '',
      isRecurring: body.isRecurring || false,
      frequency: body.frequency || 'monthly',
    });
    
    return NextResponse.json({
      success: true,
      income: updatedIncome,
    });
  } catch (error) {
    console.error('Error en PUT /api/incomes:', error);
    return NextResponse.json(
      { 
        error: 'Error al actualizar ingreso',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/incomes/[id]
 * Elimina un ingreso
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
    
    await deleteIncome(id, session.user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Ingreso eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/incomes:', error);
    return NextResponse.json(
      { 
        error: 'Error al eliminar ingreso',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
