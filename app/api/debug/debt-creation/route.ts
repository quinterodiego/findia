import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createDebt, getDebtsByUser } from '@/lib/googleSheets';

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
    
    // Datos de prueba para crear una deuda
    const testDebtData = {
      name: body.name || 'Deuda de Prueba',
      amount: body.amount || 1000,
      balance: body.balance || 1000,
      interestRate: body.interestRate || 0,
      minPayment: body.minPayment || 100,
      dueDate: body.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 días desde ahora
      priority: body.priority || 'medium',
      status: 'active',
      categoryId: body.categoryId || '',
      subcategoryId: body.subcategoryId || '',
      notes: body.notes || 'Deuda de prueba creada desde debug endpoint',
    };

    console.log('🔍 Intentando crear deuda de prueba:', testDebtData);
    console.log('👤 Usuario ID:', session.user.id);

    // Intentar crear la deuda
    let createdDebt;
    try {
      createdDebt = await createDebt(session.user.id, testDebtData);
      console.log('✅ Deuda creada exitosamente:', createdDebt);
    } catch (createError) {
      console.error('❌ Error creando deuda:', createError);
      return NextResponse.json({
        success: false,
        error: 'Error creando deuda',
        details: createError instanceof Error ? createError.message : 'Error desconocido',
        stack: createError instanceof Error ? createError.stack : undefined,
        testData: testDebtData,
        userId: session.user.id,
      });
    }

    // Intentar obtener todas las deudas del usuario
    let userDebts;
    try {
      userDebts = await getDebtsByUser(session.user.id);
      console.log('📋 Deudas del usuario:', userDebts);
    } catch (fetchError) {
      console.error('❌ Error obteniendo deudas:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo deudas después de crear',
        createSuccess: true,
        createdDebt,
        fetchError: fetchError instanceof Error ? fetchError.message : 'Error desconocido',
        testData: testDebtData,
        userId: session.user.id,
      });
    }

    // Verificar si la deuda creada está en la lista
    const debtExists = userDebts.some(debt => debt.id === createdDebt.id);

    return NextResponse.json({
      success: true,
      message: 'Prueba de creación de deuda completada',
      createdDebt,
      userDebts,
      debtExists,
      totalDebts: userDebts.length,
      testData: testDebtData,
      userId: session.user.id,
    });

  } catch (error) {
    console.error('❌ Error general en debug de creación de deudas:', error);
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

    // Obtener todas las deudas del usuario
    const userDebts = await getDebtsByUser(session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Deudas obtenidas exitosamente',
      debts: userDebts,
      totalDebts: userDebts.length,
      userId: session.user.id,
    });

  } catch (error) {
    console.error('❌ Error obteniendo deudas:', error);
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo deudas',
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
