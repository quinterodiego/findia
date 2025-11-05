'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Filter, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { SharedExpense, SharedExpenseBalance } from '@/types';
import SharedExpenseCard from './SharedExpenseCard';

interface SharedExpensesSectionProps {
  currentUserId: string;
  formatCurrency: (amount: number) => string;
}

export default function SharedExpensesSection({
  currentUserId,
  formatCurrency,
}: SharedExpensesSectionProps) {
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>([]);
  const [balance, setBalance] = useState<SharedExpenseBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'cancellation_requested'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'sent'>('all');

  useEffect(() => {
    loadSharedExpenses();
    loadBalance();
  }, [filter, typeFilter]);

  const loadSharedExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('status', filter);
      }
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }

      const response = await fetch(`/api/shared-expenses?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSharedExpenses(data.sharedExpenses || []);
      }
    } catch (error) {
      console.error('Error cargando gastos compartidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    try {
      const response = await fetch('/api/shared-expenses/balance');
      const data = await response.json();

      if (data.success) {
        setBalance(data.balance);
      }
    } catch (error) {
      console.error('Error cargando balance:', error);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      const response = await fetch(`/api/shared-expenses/${id}/accept`, {
        method: 'PUT',
      });

      if (response.ok) {
        await loadSharedExpenses();
        await loadBalance();
      }
    } catch (error) {
      console.error('Error aceptando gasto compartido:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/shared-expenses/${id}/reject`, {
        method: 'PUT',
      });

      if (response.ok) {
        await loadSharedExpenses();
        await loadBalance();
      }
    } catch (error) {
      console.error('Error rechazando gasto compartido:', error);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres cancelar/solicitar cancelación de este gasto compartido?')) {
      return;
    }

    try {
      const response = await fetch(`/api/shared-expenses/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        await loadSharedExpenses();
        await loadBalance();
        if (data.message) {
          alert(data.message);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Error al cancelar el gasto compartido');
      }
    } catch (error) {
      console.error('Error cancelando gasto compartido:', error);
      alert('Error al cancelar el gasto compartido');
    }
  };

  const handleConfirmCancel = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres confirmar la cancelación de este gasto compartido? El gasto será eliminado.')) {
      return;
    }

    try {
      const response = await fetch(`/api/shared-expenses/${id}/confirm-cancel`, {
        method: 'PUT',
      });

      if (response.ok) {
        await loadSharedExpenses();
        await loadBalance();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al confirmar la cancelación');
      }
    } catch (error) {
      console.error('Error confirmando cancelación:', error);
      alert('Error al confirmar la cancelación');
    }
  };

  const handleRejectCancel = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres rechazar la solicitud de cancelación? El gasto se mantendrá activo.')) {
      return;
    }

    try {
      const response = await fetch(`/api/shared-expenses/${id}/reject-cancel`, {
        method: 'PUT',
      });

      if (response.ok) {
        await loadSharedExpenses();
        await loadBalance();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al rechazar la cancelación');
      }
    } catch (error) {
      console.error('Error rechazando cancelación:', error);
      alert('Error al rechazar la cancelación');
    }
  };

  const pendingCount = sharedExpenses.filter(se => 
    se.status === 'pending' && se.sharedWithUserId === currentUserId
  ).length;

  const filteredExpenses = sharedExpenses.filter(se => {
    if (filter !== 'all' && se.status !== filter) return false;
    if (typeFilter === 'received' && se.sharedWithUserId !== currentUserId) return false;
    if (typeFilter === 'sent' && se.ownerUserId !== currentUserId) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Balance */}
      {balance && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Te deben
              </span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(balance.totalOwed)}
            </p>
          </div>

          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Debes
              </span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(balance.totalReceived)}
            </p>
          </div>

          <div className={`p-4 border rounded-xl ${
            balance.balance >= 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className={`w-5 h-5 ${
                balance.balance >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Balance neto
              </span>
            </div>
            <p className={`text-2xl font-bold ${
              balance.balance >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(Math.abs(balance.balance))}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {balance.balance >= 0 ? 'Te deben' : 'Debes'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Estado:
          </span>
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'accepted', 'rejected', 'cancellation_requested'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? 'Todos' :
               status === 'pending' ? 'Pendientes' :
               status === 'accepted' ? 'Aceptados' :
               status === 'rejected' ? 'Rechazados' :
               'Cancelación Solicitada'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tipo:
          </span>
        </div>
        <div className="flex gap-2">
          {(['all', 'received', 'sent'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                typeFilter === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {type === 'all' ? 'Todos' :
               type === 'received' ? 'Recibidos' :
               'Enviados'}
            </button>
          ))}
        </div>
      </div>

      {/* Badge de pendientes */}
      {pendingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2"
        >
          <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm text-yellow-700 dark:text-yellow-300">
            Tienes <strong>{pendingCount}</strong> gasto{pendingCount !== 1 ? 's' : ''} compartido{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de aceptar
          </span>
        </motion.div>
      )}

      {/* Lista de gastos compartidos */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Cargando gastos compartidos...
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12 border border-gray-200 dark:border-gray-700 rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No hay gastos compartidos
          </h4>
          <p className="text-gray-600 dark:text-gray-400">
            {filter !== 'all' || typeFilter !== 'all'
              ? 'No hay gastos compartidos con los filtros seleccionados'
              : 'Comparte un gasto desde el dashboard para comenzar'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((sharedExpense) => (
            <SharedExpenseCard
              key={sharedExpense.id}
              sharedExpense={sharedExpense}
              currentUserId={currentUserId}
              onAccept={handleAccept}
              onReject={handleReject}
              onCancel={handleCancel}
              onConfirmCancel={handleConfirmCancel}
              onRejectCancel={handleRejectCancel}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

