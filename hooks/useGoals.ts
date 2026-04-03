import { useState, useEffect } from 'react';
import type { Goal } from '@/types';

type GoalInput = Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type GoalUpdate = Partial<GoalInput>;

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/goals');
      const data = await response.json();
      
      if (response.ok) {
        setGoals(data.goals || []);
        setError(null);
      } else {
        setError(data.error || 'Error al cargar metas');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error fetching goals:', err);
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (goalData: GoalInput) => {
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Refrescar la lista de metas
        await fetchGoals();
        return { success: true, goal: result.goal };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  useEffect(() => {
    // Solo cargar si hay un userId en session (evitar cargas sin autenticación)
    fetchGoals().catch(() => {
      // Si hay error, establecer loading en false para que no quede bloqueado
      setLoading(false);
    });
  }, []);

  const updateGoal = async (goalId: string, goalData: GoalUpdate) => {
    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await fetchGoals();
        return { success: true, goal: result.goal };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await fetchGoals();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  return {
    goals,
    loading,
    error,
    fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
