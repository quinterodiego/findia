import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getExpensesByUser,
  createExpense,
  updateExpenseStatuses,
} from '@/lib/googleSheets';

/**
 * GET /api/expenses
 * Obtiene todos los gastos del usuario
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
    
    const expenses = await getExpensesByUser(session.user.id);
    
    return NextResponse.json({
      success: true,
      expenses,
      totalExpenses: expenses.length,
    });
  } catch (error) {
    console.error('Error en GET /api/expenses:', error);
    return NextResponse.json(
      { error: 'Error al obtener gastos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/expenses
 * Crea un nuevo gasto
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
    
    // Crear el gasto
    const newExpense = await createExpense(session.user.id, {
      name: body.name,
      amount: parseFloat(body.amount),
      date: body.date,
      category: body.category || 'other',
      subcategoryId: body.subcategory || body.subcategoryId || undefined,
      expenseType: body.expenseType || 'variable',
      notes: body.notes || '',
      isRecurring: body.isRecurring || false,
      frequency: body.frequency || 'monthly',
      totalInstallments: body.totalInstallments ? parseInt(body.totalInstallments) : undefined,
      currentInstallment: body.currentInstallment ? parseInt(body.currentInstallment) : undefined,
      paymentMethod: body.paymentMethod || undefined,
    });
    
    return NextResponse.json({
      success: true,
      expense: newExpense,
    });
  } catch (error) {
    console.error('Error en POST /api/expenses:', error);
    return NextResponse.json(
      { error: 'Error al crear gasto' },
      { status: 500 }
    );
  }
}
