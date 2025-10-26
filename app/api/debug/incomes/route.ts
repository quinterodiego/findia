import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createIncome, getIncomesByUser } from '@/lib/googleSheets';

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
    
    // Datos de prueba para crear un ingreso
    const testIncomeData = {
      name: body.name || 'Ingreso de Prueba',
      amount: body.amount || 1000,
      date: body.date || new Date().toISOString().split('T')[0],
      category: body.category || 'other',
      notes: body.notes || 'Ingreso de prueba creado desde debug endpoint',
      isRecurring: body.isRecurring || false,
      frequency: body.frequency || 'monthly',
    };

    console.log('🔍 Intentando crear ingreso de prueba:', testIncomeData);
    console.log('👤 Usuario ID:', session.user.id);

    // Intentar crear el ingreso
    let createdIncome;
    try {
      createdIncome = await createIncome(session.user.id, testIncomeData);
      console.log('✅ Ingreso creado exitosamente:', createdIncome);
    } catch (createError) {
      console.error('❌ Error creando ingreso:', createError);
      return NextResponse.json({
        success: false,
        error: 'Error creando ingreso',
        details: createError instanceof Error ? createError.message : 'Error desconocido',
        stack: createError instanceof Error ? createError.stack : undefined,
        testData: testIncomeData,
        userId: session.user.id,
      });
    }

    // Intentar obtener todos los ingresos del usuario
    let userIncomes;
    try {
      userIncomes = await getIncomesByUser(session.user.id);
      console.log('📋 Ingresos del usuario:', userIncomes);
    } catch (fetchError) {
      console.error('❌ Error obteniendo ingresos:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo ingresos después de crear',
        createSuccess: true,
        createdIncome,
        fetchError: fetchError instanceof Error ? fetchError.message : 'Error desconocido',
        testData: testIncomeData,
        userId: session.user.id,
      });
    }

    // Verificar si el ingreso creado está en la lista
    const incomeExists = userIncomes.some(income => income.id === createdIncome.id);

    return NextResponse.json({
      success: true,
      message: 'Prueba de creación de ingreso completada',
      createdIncome,
      userIncomes,
      incomeExists,
      totalIncomes: userIncomes.length,
      testData: testIncomeData,
      userId: session.user.id,
    });

  } catch (error) {
    console.error('❌ Error general en debug de creación de ingresos:', error);
    return NextResponse.json({
      success: false,
      error: 'Error general',
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener todos los ingresos del usuario
    const userIncomes = await getIncomesByUser(session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Ingresos obtenidos exitosamente',
      incomes: userIncomes,
      totalIncomes: userIncomes.length,
      userId: session.user.id,
    });

  } catch (error) {
    console.error('❌ Error obteniendo ingresos:', error);
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo ingresos',
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
