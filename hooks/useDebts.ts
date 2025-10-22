'use client';

import { useState, useCallback } from 'react';
import type { Debt, Payment } from '@/types';

interface DebtStats {
  totalDebt: number;
  totalBalance: number;
  totalPaid: number;
  progress: number;
  activeDebts: number;
  paidDebts: number;
  overdueDebts: number;
  monthlyMinPayment: number;
  totalPaidThisMonth: number;
  paymentsThisMonth: number;
}

export function useDebts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [stats, setStats] = useState<DebtStats>({
    totalDebt: 0,
    totalBalance: 0,
    totalPaid: 0,
    progress: 0,
    activeDebts: 0,
    paidDebts: 0,
    overdueDebts: 0,
    monthlyMinPayment: 0,
    totalPaidThisMonth: 0,
    paymentsThisMonth: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Obtiene todas las deudas del usuario
   */
  const fetchDebts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/debts');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener deudas');
      }
      
  setDebts(Array.isArray(data.debts) ? data.debts : []);
  return Array.isArray(data.debts) ? data.debts : [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Obtiene las estadísticas del usuario
   */
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener estadísticas');
      }
      
      setStats(data.stats || {
        totalDebt: 0,
        totalBalance: 0,
        totalPaid: 0,
        progress: 0,
        activeDebts: 0,
        paidDebts: 0,
        overdueDebts: 0,
        monthlyMinPayment: 0,
        totalPaidThisMonth: 0,
        paymentsThisMonth: 0,
      });
      return data.stats || {
        totalDebt: 0,
        totalBalance: 0,
        totalPaid: 0,
        progress: 0,
        activeDebts: 0,
        paidDebts: 0,
        overdueDebts: 0,
        monthlyMinPayment: 0,
        totalPaidThisMonth: 0,
        paymentsThisMonth: 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Crea una nueva deuda
   */
  const createDebt = useCallback(async (debtData: {
    name: string;
    amount: number;
    balance?: number;
    interestRate?: number;
    minPayment?: number;
    dueDate: string;
    priority?: 'high' | 'medium' | 'low';
    status?: 'active' | 'paid' | 'overdue';
    category?: string;
    notes?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debtData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al crear deuda');
      }
      
      // Actualizar lista de deudas
      await fetchDebts();
      await fetchStats();
      
      return data.debt;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchDebts, fetchStats]);

  /**
   * Actualiza una deuda existente
   */
  const updateDebt = useCallback(async (
    debtId: string,
    updates: Partial<Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar deuda');
      }
      
      // Actualizar lista de deudas
      await fetchDebts();
      await fetchStats();
      
      return data.debt;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchDebts, fetchStats]);

  /**
   * Elimina una deuda
   */
  const deleteDebt = useCallback(async (debtId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar deuda');
      }
      
      // Actualizar lista de deudas
      await fetchDebts();
      await fetchStats();
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchDebts, fetchStats]);

  /**
   * Registra un pago para una deuda
   */
  const makePayment = useCallback(async (
    debtId: string,
    paymentData: {
      amount: number;
      date: string;
      type?: 'regular' | 'extra' | 'minimum';
      notes?: string;
    }
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/debts/${debtId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar pago');
      }
      
      // Actualizar lista de deudas y estadísticas
      await fetchDebts();
      await fetchStats();
      
      return data.payment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchDebts, fetchStats]);

  /**
   * Obtiene los pagos de una deuda específica
   */
  const getPayments = useCallback(async (debtId: string): Promise<Payment[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/debts/${debtId}/payments`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener pagos');
      }
      
      return data.payments;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Inicializa las hojas de Google Sheets (solo admin)
   */
  const initializeSheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/debts', {
        method: 'PUT',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al inicializar hojas');
      }
      
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Estado
    debts,
    stats,
    loading,
    error,
    
    // Acciones
    fetchDebts,
    fetchStats,
    createDebt,
    updateDebt,
    deleteDebt,
    makePayment,
    getPayments,
    initializeSheets,
  };
}
