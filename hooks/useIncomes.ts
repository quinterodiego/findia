import { useState, useEffect } from 'react';
import { Income } from '@/types';

export function useIncomes() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncomes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/incomes');
      const data = await response.json();
      
      if (response.ok) {
        setIncomes(data.incomes || []);
        setError(null);
      } else {
        setError(data.error || 'Error al cargar ingresos');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error fetching incomes:', err);
    } finally {
      setLoading(false);
    }
  };

  const createIncome = async (incomeData: any) => {
    try {
      const response = await fetch('/api/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomeData),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Refrescar la lista de ingresos
        await fetchIncomes();
        return { success: true, income: result.income };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  const updateIncome = async (incomeId: string, incomeData: any) => {
    try {
      const response = await fetch(`/api/incomes/${incomeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomeData),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await fetchIncomes();
        return { success: true, income: result.income };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  const deleteIncome = async (incomeId: string) => {
    try {
      const response = await fetch(`/api/incomes/${incomeId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await fetchIncomes();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  useEffect(() => {
    // Solo cargar si hay un userId en session (evitar cargas sin autenticación)
    fetchIncomes().catch(() => {
      // Si hay error, establecer loading en false para que no quede bloqueado
      setLoading(false);
    });
  }, []);

  return {
    incomes,
    loading,
    error,
    fetchIncomes,
    createIncome,
    updateIncome,
    deleteIncome,
  };
}
