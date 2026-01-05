import { useState, useEffect, useCallback } from 'react';
import type { Debt, Expense, CreditCard, Payment } from '@/types';

export interface FixedExpenseItem {
  id: string;
  name: string;
  type: 'debt' | 'expense' | 'credit_card';
  installments?: string; // "Restan 37", "cierre 22/08", etc.
  paymentMethod?: 'automatic' | 'manual' | 'transfer';
  amount: number; // Importe a pagar
  dueDate?: string; // Fecha de vencimiento
  paidAmount: number; // Monto pagado del período actual
  originalData: Debt | Expense | CreditCard;
  isOverdue?: boolean;
  daysUntilDue?: number;
}

interface UseFixedExpensesReturn {
  fixedExpenses: FixedExpenseItem[];
  loading: boolean;
  error: string | null;
  totalAmount: number;
  totalPaid: number;
  refresh: () => Promise<void>;
}

interface PaymentData {
  id: string;
  debtId?: string;
  creditCardId?: string;
  amount: number;
  date: string;
}

export function useFixedExpenses(
  expenses: Expense[] = [],
  debts: Debt[] = [],
  payments: Payment[] = []
): UseFixedExpensesReturn {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateFixedExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const currentDate = new Date(currentYear, currentMonth, now.getDate());

      const items: FixedExpenseItem[] = [];

      // Procesar todos los gastos fijos (son recurrentes automáticamente)
      expenses
        .filter(exp => exp.expenseType === 'fixed')
        .forEach(expense => {
          // Calcular la fecha de vencimiento para el mes actual
          // Si el gasto tiene fecha 15/01/2025, en febrero debería ser 15/02/2025
          const originalDate = new Date(expense.date);
          const dayOfMonth = originalDate.getDate(); // Día del mes (1-31)
          
          // Crear fecha de vencimiento para el mes actual con el mismo día
          let dueDateForCurrentMonth = new Date(currentYear, currentMonth, dayOfMonth);
          
          // Si el día del mes original es mayor que los días del mes actual (ej: 31 en febrero)
          // usar el último día del mes actual
          const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          if (dayOfMonth > lastDayOfCurrentMonth) {
            dueDateForCurrentMonth = new Date(currentYear, currentMonth, lastDayOfCurrentMonth);
          }
          
          // Si la fecha calculada ya pasó este mes, usar la del próximo mes
          if (dueDateForCurrentMonth < currentDate) {
            dueDateForCurrentMonth = new Date(currentYear, currentMonth + 1, Math.min(dayOfMonth, new Date(currentYear, currentMonth + 2, 0).getDate()));
          }
          
          const isOverdue = dueDateForCurrentMonth < currentDate;
          const daysUntilDue = Math.ceil((dueDateForCurrentMonth.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Verificar si hay un pago registrado para este gasto en el mes actual
          // Por ahora, si el gasto está en expenses, asumimos que está pagado
          // TODO: En el futuro, podríamos tener un sistema de pagos separado para gastos fijos
          const paidAmount = expense.amount; // Si está en expenses, ya está "pagado"
          
          items.push({
            id: expense.id,
            name: expense.name,
            type: 'expense',
            amount: expense.amount,
            dueDate: dueDateForCurrentMonth.toISOString(),
            paidAmount,
            originalData: expense,
            isOverdue,
            daysUntilDue,
            paymentMethod: expense.paymentMethod,
          });
        });

      // Procesar gastos en cuotas (similar a préstamos)
      expenses
        .filter(exp => exp.expenseType === 'installments' && exp.totalInstallments && exp.currentInstallment)
        .forEach(expense => {
          // Verificar si ya se pagaron todas las cuotas
          if (expense.currentInstallment > expense.totalInstallments!) {
            return; // Ya está completamente pagado
          }

          // Calcular la fecha de vencimiento para el mes actual
          const originalDate = new Date(expense.date);
          const dayOfMonth = originalDate.getDate();
          
          // Crear fecha de vencimiento para el mes actual con el mismo día
          let dueDateForCurrentMonth = new Date(currentYear, currentMonth, dayOfMonth);
          
          // Si el día del mes original es mayor que los días del mes actual
          const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          if (dayOfMonth > lastDayOfCurrentMonth) {
            dueDateForCurrentMonth = new Date(currentYear, currentMonth, lastDayOfCurrentMonth);
          }
          
          // Si la fecha calculada ya pasó este mes, usar la del próximo mes
          if (dueDateForCurrentMonth < currentDate) {
            dueDateForCurrentMonth = new Date(currentYear, currentMonth + 1, Math.min(dayOfMonth, new Date(currentYear, currentMonth + 2, 0).getDate()));
          }
          
          const isOverdue = dueDateForCurrentMonth < currentDate;
          const daysUntilDue = Math.ceil((dueDateForCurrentMonth.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Calcular monto por cuota
          const amountPerInstallment = expense.amount / expense.totalInstallments!;
          const remainingInstallments = expense.totalInstallments! - expense.currentInstallment! + 1;
          
          // Por ahora, asumimos que si está en expenses, la cuota actual ya está pagada
          // TODO: En el futuro, podríamos tener un sistema de pagos separado para gastos en cuotas
          const paidAmount = amountPerInstallment; // Solo la cuota actual
          
          items.push({
            id: expense.id,
            name: expense.name,
            type: 'expense',
            installments: `Restan ${remainingInstallments}`,
            paymentMethod: expense.paymentMethod,
            amount: amountPerInstallment, // Monto de la cuota actual
            dueDate: dueDateForCurrentMonth.toISOString(),
            paidAmount,
            originalData: expense,
            isOverdue,
            daysUntilDue,
          });
        });

      // Procesar préstamos/deudas con cuotas
      console.log('🔍 Procesando deudas para presupuesto:', debts.length, 'deudas totales');
      const debtsWithInstallments = debts.filter(debt => {
        const hasInstallments = debt.totalInstallments && debt.remainingInstallments !== undefined && debt.remainingInstallments > 0;
        if (!hasInstallments && debt.totalInstallments) {
          console.log('⚠️ Deuda sin cuotas válidas:', debt.name, {
            totalInstallments: debt.totalInstallments,
            remainingInstallments: debt.remainingInstallments
          });
        }
        return hasInstallments;
      });
      console.log('✅ Deudas con cuotas válidas:', debtsWithInstallments.length);
      
      debtsWithInstallments.forEach(debt => {
          // Calcular la fecha de vencimiento para el mes actual
          const originalDate = new Date(debt.dueDate);
          const dayOfMonth = originalDate.getDate();
          
          // Crear fecha de vencimiento para el mes actual con el mismo día
          let dueDateForCurrentMonth = new Date(currentYear, currentMonth, dayOfMonth);
          
          // Si el día del mes original es mayor que los días del mes actual
          const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          if (dayOfMonth > lastDayOfCurrentMonth) {
            dueDateForCurrentMonth = new Date(currentYear, currentMonth, lastDayOfCurrentMonth);
          }
          
          // Si la fecha calculada ya pasó este mes, usar la del próximo mes
          if (dueDateForCurrentMonth < currentDate) {
            dueDateForCurrentMonth = new Date(currentYear, currentMonth + 1, Math.min(dayOfMonth, new Date(currentYear, currentMonth + 2, 0).getDate()));
          }
          
          const isOverdue = dueDateForCurrentMonth < currentDate;
          const daysUntilDue = Math.ceil((dueDateForCurrentMonth.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Calcular cuota actual y restantes
          const currentInstallment = debt.totalInstallments! - debt.remainingInstallments! + 1;
          const remainingInstallments = debt.remainingInstallments!;
          
          // Usar minPayment como monto de la cuota (es el pago mensual)
          const amountPerInstallment = debt.minPayment || 0;
          
          // Calcular el monto pagado en el mes actual para esta deuda
          const paymentsForThisDebt = payments.filter(payment => {
            if (payment.debtId !== debt.id) return false;
            
            const paymentDate = new Date(payment.date);
            return (
              paymentDate.getMonth() === currentMonth &&
              paymentDate.getFullYear() === currentYear
            );
          });
          
          const paidAmount = paymentsForThisDebt.reduce((sum, payment) => sum + payment.amount, 0);
          
          items.push({
            id: debt.id,
            name: debt.name,
            type: 'debt',
            installments: `Cuota ${currentInstallment}/${debt.totalInstallments} (Restan ${remainingInstallments})`,
            paymentMethod: debt.paymentMethod,
            amount: amountPerInstallment, // Monto de la cuota mensual
            dueDate: dueDateForCurrentMonth.toISOString(),
            paidAmount,
            originalData: debt,
            isOverdue,
            daysUntilDue,
          });
        });

      // Ordenar por fecha de vencimiento (más próximos primero)
      items.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      setFixedExpenses(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al calcular presupuesto';
      setError(message);
      console.error('Error calculando presupuesto:', err);
    } finally {
      setLoading(false);
    }
  }, [expenses, debts, payments]);

  useEffect(() => {
    calculateFixedExpenses();
  }, [calculateFixedExpenses]);

  const totalAmount = fixedExpenses.reduce((sum, item) => sum + item.amount, 0);
  const totalPaid = fixedExpenses.reduce((sum, item) => sum + item.paidAmount, 0);

  return {
    fixedExpenses,
    loading,
    error,
    totalAmount,
    totalPaid,
    refresh: calculateFixedExpenses,
  };
}
