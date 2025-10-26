import { useState, useEffect } from 'react';

export function useGoals() {
  const [goals, setGoals] = useState([]);
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

  const createGoal = async (goalData: any) => {
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
    fetchGoals();
  }, []);

  return {
    goals,
    loading,
    error,
    fetchGoals,
    createGoal,
  };
}
