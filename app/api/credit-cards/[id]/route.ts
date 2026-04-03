import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  updateCreditCard,
  deleteCreditCard,
} from '@/lib/googleSheets';

/**
 * PUT /api/credit-cards/[id]
 * Actualiza una tarjeta de crédito
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
    const body = await req.json();
    
    const updatedCard = await updateCreditCard(id, session.user.id, {
      name: body.name,
      bank: body.bank,
      cardNumber: body.cardNumber,
      limit: body.limit,
      currentBalance: body.currentBalance,
      cutDate: body.cutDate,
      paymentDate: body.paymentDate,
      interestRate: body.interestRate,
      status: body.status,
    });
    
    return NextResponse.json({
      success: true,
      card: updatedCard,
    });
  } catch (error) {
    console.error('Error en PUT /api/credit-cards/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar tarjeta de crédito' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/credit-cards/[id]
 * Elimina una tarjeta de crédito
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
    await deleteCreditCard(id, session.user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Tarjeta de crédito eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/credit-cards/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar tarjeta de crédito' },
      { status: 500 }
    );
  }
}

