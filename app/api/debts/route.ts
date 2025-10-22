import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getDebtsByUser,
  createDebt,
  updateDebtStatuses,
  initializeSheets,
} from '@/lib/googleSheets';

/**
 * GET /api/debts
 * Obtiene todas las deudas del usuario autenticado
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
    
    // Actualizar estados de deudas (marcar overdue si es necesario)
    await updateDebtStatuses(session.user.id);
    
    // Obtener deudas
    const debts = await getDebtsByUser(session.user.id);
    
    return NextResponse.json({
      success: true,
      debts,
    });
  } catch (error) {
    console.error('Error en GET /api/debts:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener gastos',
        details: error instanceof Error ? error.message : 'Error desconocido',
        env_check: {
          sheets_id: !!process.env.GOOGLE_SHEETS_ID,
          service_email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: !!process.env.GOOGLE_PRIVATE_KEY
        }
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/debts
 * Crea una nueva deuda
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
    if (!body.name || !body.amount || !body.dueDate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, amount, dueDate' },
        { status: 400 }
      );
    }
    
    // Crear la deuda
    const newDebt = await createDebt(session.user.id, {
      name: body.name,
      amount: parseFloat(body.amount),
      balance: body.balance !== undefined ? parseFloat(body.balance) : parseFloat(body.amount),
      interestRate: body.interestRate ? parseFloat(body.interestRate) : 0,
      minPayment: body.minPayment ? parseFloat(body.minPayment) : 0,
      dueDate: body.dueDate,
      priority: body.priority || 'medium',
      status: body.status || 'active',
      categoryId: body.categoryId || '',
      subcategoryId: body.subcategoryId || '',
      notes: body.notes || '',
    });
    
    return NextResponse.json({
      success: true,
      debt: newDebt,
    });
  } catch (error) {
    console.error('Error en POST /api/debts:', error);
    return NextResponse.json(
      { error: 'Error al crear deuda' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/debts/init
 * Inicializa las hojas de Google Sheets (solo para admin)
 */
export async function PUT() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    // Verificar si es admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(session.user.email)) {
      return NextResponse.json(
        { error: 'No tienes permisos para esta acción' },
        { status: 403 }
      );
    }
    
    await initializeSheets();
    
    return NextResponse.json({
      success: true,
      message: 'Hojas inicializadas correctamente',
    });
  } catch (error) {
    console.error('Error en PUT /api/debts:', error);
    return NextResponse.json(
      { error: 'Error al inicializar hojas' },
      { status: 500 }
    );
  }
}
