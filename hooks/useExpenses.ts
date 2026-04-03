import { useState, useEffect } from 'react';
import type { Expense } from '@/types';

type ExpenseInput = Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type ExpenseUpdate = Partial<ExpenseInput>;

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/expenses');
      const data = await response.json();
      
      if (response.ok) {
        setExpenses(data.expenses || []);
        setError(null);
      } else {
        setError(data.error || 'Error al cargar gastos');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const createExpense = async (expenseData: ExpenseInput) => {
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Refrescar la lista de gastos
        await fetchExpenses();
        return { success: true, expense: result.expense };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  useEffect(() => {
    // Solo cargar si hay un userId en session (evitar cargas sin autenticación)
    fetchExpenses().catch(() => {
      // Si hay error, establecer loading en false para que no quede bloqueado
      setLoading(false);
    });
  }, []);

  const updateExpense = async (expenseId: string, expenseData: ExpenseUpdate) => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await fetchExpenses();
        return { success: true, expense: result.expense };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await fetchExpenses();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
  };
}
