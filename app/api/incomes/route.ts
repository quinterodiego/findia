import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getIncomesByUser,
  createIncome,
} from '@/lib/googleSheets';

/**
 * GET /api/incomes
 * Obtiene todos los ingresos del usuario autenticado
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
    
    // Obtener ingresos
    const incomes = await getIncomesByUser(session.user.id);
    
    return NextResponse.json({
      success: true,
      incomes,
    });
  } catch (error) {
    console.error('Error en GET /api/incomes:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener ingresos',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/incomes
 * Crea un nuevo ingreso
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
    if (!body.name || !body.amount || !body.date) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, amount, date' },
        { status: 400 }
      );
    }
    
    // Crear el ingreso
    const newIncome = await createIncome(session.user.id, {
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
      income: newIncome,
    });
  } catch (error) {
    console.error('Error en POST /api/incomes:', error);
    return NextResponse.json(
      { error: 'Error al crear ingreso' },
      { status: 500 }
    );
  }
}
