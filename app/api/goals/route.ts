import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getGoalsByUser,
  createGoal,
} from '@/lib/googleSheets';

/**
 * GET /api/goals
 * Obtiene todas las metas del usuario autenticado
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
    
    // Obtener metas
    const goals = await getGoalsByUser(session.user.id);
    
    return NextResponse.json({
      success: true,
      goals,
    });
  } catch (error) {
    console.error('Error en GET /api/goals:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener metas',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/goals
 * Obtiene todas las metas del usuario
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
    
    const goals = await getGoalsByUser(session.user.id);
    
    return NextResponse.json({
      success: true,
      goals,
      totalGoals: goals.length,
    });
  } catch (error) {
    console.error('Error en GET /api/goals:', error);
    return NextResponse.json(
      { error: 'Error al obtener metas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals
 * Crea una nueva meta
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
    
    // Crear la meta
    const newGoal = await createGoal(session.user.id, {
      name: body.name,
      amount: parseFloat(body.amount),
      currentAmount: body.currentAmount || 0,
      targetDate: body.targetDate || body.date,
      date: body.date,
      category: body.category || 'savings',
      notes: body.notes || '',
    });
    
    return NextResponse.json({
      success: true,
      goal: newGoal,
    });
  } catch (error) {
    console.error('Error en POST /api/goals:', error);
    return NextResponse.json(
      { error: 'Error al crear meta' },
      { status: 500 }
    );
  }
}
