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
    console.log('🔍 POST /api/incomes - Iniciando...');
    
    const session = await getServerSession(authOptions);
    console.log('👤 Sesión obtenida:', session?.user?.id ? '✅' : '❌');
    
    if (!session?.user?.id) {
      console.log('❌ No autorizado - sin sesión');
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    console.log('📋 Body recibido:', body);
    
    // Validación básica
    if (!body.name || !body.amount || !body.date) {
      console.log('❌ Validación fallida - campos faltantes');
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, amount, date' },
        { status: 400 }
      );
    }
    
    console.log('✅ Validación pasada, creando ingreso...');
    
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
    
    console.log('✅ Ingreso creado exitosamente:', newIncome);
    
    return NextResponse.json({
      success: true,
      income: newIncome,
    });
  } catch (error) {
    console.error('❌ Error en POST /api/incomes:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('❌ Error message:', error instanceof Error ? error.message : 'No message');
    
    return NextResponse.json(
      { 
        error: 'Error al crear ingreso',
        details: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
