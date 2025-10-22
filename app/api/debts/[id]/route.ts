import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getDebtById,
  updateDebt,
  deleteDebt,
} from '@/lib/googleSheets';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/debts/[id]
 * Obtiene una deuda específica
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const debt = await getDebtById(id, session.user.id);
    
    if (!debt) {
      return NextResponse.json(
        { error: 'Deuda no encontrada' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      debt,
    });
  } catch (error) {
    console.error('Error en GET /api/debts/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener gasto' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/debts/[id]
 * Actualiza una deuda
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const body = await req.json();
    
    // Preparar actualizaciones
    const updates: Record<string, string | number> = {};
    
    if (body.name !== undefined) updates.name = body.name;
    if (body.amount !== undefined) updates.amount = parseFloat(body.amount);
    if (body.balance !== undefined) updates.balance = parseFloat(body.balance);
    if (body.interestRate !== undefined) updates.interestRate = parseFloat(body.interestRate);
    if (body.minPayment !== undefined) updates.minPayment = parseFloat(body.minPayment);
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.status !== undefined) updates.status = body.status;
    if (body.category !== undefined) updates.category = body.category;
    if (body.notes !== undefined) updates.notes = body.notes;
    
    const updatedDebt = await updateDebt(id, session.user.id, updates);
    
    return NextResponse.json({
      success: true,
      debt: updatedDebt,
    });
  } catch (error) {
    console.error('Error en PUT /api/debts/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar gasto' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/debts/[id]
 * Elimina una deuda
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
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
      message: 'Gasto eliminado correctamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/debts/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar gasto' },
      { status: 500 }
    );
  }
}
