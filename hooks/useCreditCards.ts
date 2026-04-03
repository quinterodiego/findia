'use client';

import { useState, useCallback } from 'react';
import type { CreditCard, CreditCardPayment, CreditCardConsumption } from '@/types';

export function useCreditCards() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [payments, setPayments] = useState<{ [cardId: string]: CreditCardPayment[] }>({});
  const [consumptions, setConsumptions] = useState<{ [cardId: string]: CreditCardConsumption[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Obtiene todas las tarjetas de crédito del usuario
   */
  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/credit-cards');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener tarjetas de crédito');
      }
      
      setCards(Array.isArray(data.cards) ? data.cards : []);
      return Array.isArray(data.cards) ? data.cards : [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Crea una nueva tarjeta de crédito
   */
  const createCard = useCallback(async (cardData: {
    name: string;
    bank: string;
    cardNumber?: string;
    limit: number;
    currentBalance: number;
    cutDate: number;
    paymentDate: number;
    interestRate: number;
    status?: 'active' | 'blocked' | 'expired';
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/credit-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al crear tarjeta de crédito');
      }
      
      await fetchCards();
      return data.card;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchCards]);

  /**
   * Actualiza una tarjeta de crédito existente
   */
  const updateCard = useCallback(async (
    cardId: string,
    updates: Partial<Omit<CreditCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/credit-cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar tarjeta de crédito');
      }
      
      await fetchCards();
      return data.card;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchCards]);

  /**
   * Elimina una tarjeta de crédito
   */
  const deleteCard = useCallback(async (cardId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/credit-cards/${cardId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar tarjeta de crédito');
      }
      
      await fetchCards();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchCards]);

  /**
   * Registra un pago de tarjeta de crédito
   */
  const makePayment = useCallback(async (
    cardId: string,
    paymentData: {
      amount: number;
      date: string;
      paymentMethod?: 'transfer' | 'cash' | 'debit' | 'other';
      notes?: string;
    }
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/credit-cards/${cardId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar pago');
      }
      
      await fetchCards();
      await fetchPayments(cardId);
      return data.payment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Obtiene los pagos de una tarjeta de crédito
   */
  const fetchPayments = useCallback(async (cardId: string): Promise<CreditCardPayment[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/credit-cards/${cardId}/payments`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener pagos');
      }
      
      const paymentsList = Array.isArray(data.payments) ? data.payments : [];
      setPayments(prev => ({ ...prev, [cardId]: paymentsList }));
      return paymentsList;
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
    cards,
    payments,
    consumptions,
    loading,
    error,
    
    // Acciones
    fetchCards,
    createCard,
    updateCard,
    deleteCard,
    makePayment,
    fetchPayments,
  };
}

