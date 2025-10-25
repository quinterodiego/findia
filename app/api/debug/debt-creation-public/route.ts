import { NextRequest, NextResponse } from 'next/server';
import { createDebt, getDebtsByUser } from '@/lib/googleSheets';

export async function POST(req: NextRequest) {
  try {
    // Usar un userId fijo para pruebas (el tuyo)
    const testUserId = '100827254183186994825';
    
    const body = await req.json();
    
    // Datos de prueba para crear una deuda
    const testDebtData = {
      name: body.name || 'Deuda de Prueba Pública',
      amount: body.amount || 1000,
      balance: body.balance || 1000,
      interestRate: body.interestRate || 0,
      minPayment: body.minPayment || 100,
      dueDate: body.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: body.priority || 'medium',
      status: 'active' as const,
      categoryId: body.categoryId || '',
      subcategoryId: body.subcategoryId || '',
      notes: body.notes || 'Deuda de prueba creada desde endpoint público',
    };

    console.log('🔍 Intentando crear deuda de prueba (público):', testDebtData);
    console.log('👤 Usuario ID fijo:', testUserId);

    // Intentar crear la deuda
    let createdDebt;
    try {
      createdDebt = await createDebt(testUserId, testDebtData);
      console.log('✅ Deuda creada exitosamente:', createdDebt);
    } catch (createError) {
      console.error('❌ Error creando deuda:', createError);
      return NextResponse.json({
        success: false,
        error: 'Error creando deuda',
        details: createError instanceof Error ? createError.message : 'Error desconocido',
        stack: createError instanceof Error ? createError.stack : undefined,
        testData: testDebtData,
        userId: testUserId,
      });
    }

    // Intentar obtener todas las deudas del usuario
    let userDebts;
    try {
      userDebts = await getDebtsByUser(testUserId);
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
        userId: testUserId,
      });
    }

    // Verificar si la deuda creada está en la lista
    const debtExists = userDebts.some(debt => debt.id === createdDebt.id);

    return NextResponse.json({
      success: true,
      message: 'Prueba de creación de deuda completada (endpoint público)',
      createdDebt,
      userDebts,
      debtExists,
      totalDebts: userDebts.length,
      testData: testDebtData,
      userId: testUserId,
    });

  } catch (error) {
    console.error('❌ Error general en debug de creación de deudas (público):', error);
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
    // Usar un userId fijo para pruebas
    const testUserId = '100827254183186994825';

    // Obtener todas las deudas del usuario
    const userDebts = await getDebtsByUser(testUserId);

    return NextResponse.json({
      success: true,
      message: 'Deudas obtenidas exitosamente (endpoint público)',
      debts: userDebts,
      totalDebts: userDebts.length,
      userId: testUserId,
    });

  } catch (error) {
    console.error('❌ Error obteniendo deudas (público):', error);
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo deudas',
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
