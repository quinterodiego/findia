import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getCreditCardsByUser,
  createCreditCard,
} from '@/lib/googleSheets';

/**
 * GET /api/credit-cards
 * Obtiene todas las tarjetas de crédito del usuario autenticado
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const cards = await getCreditCardsByUser(session.user.id);
    
    return NextResponse.json({
      success: true,
      cards,
    });
  } catch (error) {
    console.error('Error en GET /api/credit-cards:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener tarjetas de crédito',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credit-cards
 * Crea una nueva tarjeta de crédito
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
    if (!body.name || !body.bank || body.limit === undefined || body.currentBalance === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, bank, limit, currentBalance' },
        { status: 400 }
      );
    }
    
    // Crear la tarjeta
    const newCard = await createCreditCard(session.user.id, {
      name: body.name,
      bank: body.bank,
      cardNumber: body.cardNumber || '**** **** **** ****',
      limit: parseFloat(body.limit),
      currentBalance: parseFloat(body.currentBalance),
      cutDate: body.cutDate ? parseInt(body.cutDate) : 1,
      paymentDate: body.paymentDate ? parseInt(body.paymentDate) : 1,
      interestRate: body.interestRate ? parseFloat(body.interestRate) : 0,
      status: body.status || 'active',
    });
    
    return NextResponse.json({
      success: true,
      card: newCard,
    });
  } catch (error) {
    console.error('Error en POST /api/credit-cards:', error);
    return NextResponse.json(
      { error: 'Error al crear tarjeta de crédito' },
      { status: 500 }
    );
  }
}

