import { useState, useEffect } from 'react';

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
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

  const createExpense = async (expenseData: any) => {
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
    fetchExpenses();
  }, []);

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
  };
}
