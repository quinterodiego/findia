import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateDebt, deleteDebt } from '@/lib/googleSheets';

/**
 * PUT /api/debts/[id]
 * Actualiza una deuda existente
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
    
    const updatedDebt = await updateDebt(id, session.user.id, {
      name: body.name,
      amount: parseFloat(body.amount),
      balance: parseFloat(body.balance) || parseFloat(body.amount),
      date: body.date,
      dueDate: body.dueDate || body.date,
      interestRate: body.interestRate || 0,
      minPayment: body.minPayment || 0,
      priority: body.priority || 'medium',
      category: body.category || 'other',
      notes: body.notes || '',
      totalInstallments: body.totalInstallments ? parseInt(body.totalInstallments) : undefined,
      remainingInstallments: body.remainingInstallments ? parseInt(body.remainingInstallments) : undefined,
      paymentMethod: body.paymentMethod || undefined,
    });
    
    return NextResponse.json({
      success: true,
      debt: updatedDebt,
    });
  } catch (error) {
    console.error('Error en PUT /api/debts:', error);
    return NextResponse.json(
      { 
        error: 'Error al actualizar deuda',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/debts/[id]
 * Elimina una deuda
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
    
    await deleteDebt(id, session.user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Deuda eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/debts:', error);
    return NextResponse.json(
      { 
        error: 'Error al eliminar deuda',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}