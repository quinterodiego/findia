import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createDebt, getDebtsByUser, initializeSheets } from '@/lib/googleSheets';

/**
 * Debug endpoint para probar la creación de deudas
 * NOTA: Eliminar en producción final por seguridad
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

    // Verificar variables de entorno
    const envCheck = {
      GOOGLE_SHEETS_ID: !!process.env.GOOGLE_SHEETS_ID,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
    };

    if (!envCheck.GOOGLE_SHEETS_ID || !envCheck.GOOGLE_SERVICE_ACCOUNT_EMAIL || !envCheck.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json({
        error: 'Variables de entorno faltantes',
        envCheck,
      }, { status: 500 });
    }

    // Intentar inicializar hojas si es necesario
    try {
      await initializeSheets();
    } catch (initError) {
      console.log('Error inicializando hojas (puede ser normal si ya existen):', initError);
    }

    // Crear deuda de prueba
    const testDebt = await createDebt(session.user.id, {
      name: 'Deuda de Prueba',
      amount: 1000,
      balance: 1000,
      interestRate: 0,
      minPayment: 100,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 días
      priority: 'medium',
      status: 'active',
      categoryId: 'test',
      subcategoryId: 'test',
      notes: 'Deuda de prueba creada desde debug endpoint',
    });

    // Verificar que se creó correctamente
    const allDebts = await getDebtsByUser(session.user.id);
    const createdDebt = allDebts.find(debt => debt.id === testDebt.id);

    return NextResponse.json({
      success: true,
      testDebt,
      createdDebt,
      totalDebts: allDebts.length,
      allDebts: allDebts.map(debt => ({
        id: debt.id,
        name: debt.name,
        amount: debt.amount,
        balance: debt.balance,
        status: debt.status,
      })),
      envCheck,
    });
  } catch (error) {
    console.error('Error en test-debt endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Error probando creación de deuda',
        details: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

