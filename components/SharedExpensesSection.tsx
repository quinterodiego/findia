'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Filter, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, DollarSign, Search, User as UserIcon, Eye, EyeOff } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  useEffect(() => {
    loadSharedExpenses();
    loadBalance();
  }, []);

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

  const handleSettle = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres marcar este gasto como saldado? Esto indica que la parte del otro usuario ya está pagada.')) {
      return;
    }
    try {
      const response = await fetch(`/api/shared-expenses/${id}/settle`, { method: 'PUT' });
      if (response.ok) {
        await loadSharedExpenses();
        await loadBalance();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al marcar como saldado');
      }
    } catch (error) {
      console.error('Error marcando como saldado:', error);
      alert('Error al marcar como saldado');
    }
  };

  const pendingCount = sharedExpenses.filter(se => 
    se.status === 'pending' && se.sharedWithUserId === currentUserId
  ).length;

  // Obtener lista única de personas para el filtro
  const allPeople = useMemo(() => {
    const people = new Set<string>();
    sharedExpenses.forEach(se => {
      if (se.owner && se.owner.id !== currentUserId) {
        people.add(se.owner.id);
      }
      if (se.partner && se.partner.id !== currentUserId) {
        people.add(se.partner.id);
      }
    });
    return Array.from(people).map(id => {
      const expense = sharedExpenses.find(se => se.owner?.id === id || se.partner?.id === id);
      const person = expense?.owner?.id === id ? expense.owner : expense?.partner;
      return { id, name: person?.name || person?.email || 'Usuario', email: person?.email || '' };
    });
  }, [sharedExpenses, currentUserId]);

  const filteredExpenses = useMemo(() => {
    return sharedExpenses.filter(se => {
      // Filtro por estado
      if (filter !== 'all' && se.status !== filter) return false;
      
      // Filtro por tipo (received/sent)
      if (typeFilter === 'received' && se.sharedWithUserId !== currentUserId) return false;
      if (typeFilter === 'sent' && se.ownerUserId !== currentUserId) return false;
      
      // Filtro por persona
      if (personFilter !== 'all') {
        const isPersonOwner = se.ownerUserId === personFilter;
        const isPersonPartner = se.sharedWithUserId === personFilter;
        if (!isPersonOwner && !isPersonPartner) return false;
      }
      
      // Toggle: Solo mostrar gastos con saldo pendiente (no saldados)
      if (showOnlyPending) {
        // Un gasto tiene saldo pendiente si:
        // 1. Está aceptado (status === 'accepted')
        // 2. NO está saldado (isSettled !== true)
        // Excluimos gastos rechazados, cancelados, o saldados
        
        // Verificar si está saldado (puede venir como string 'true' o booleano true)
        const isSettled = se.isSettled === true || se.isSettled === 'true';
        
        // Si está saldado, rechazado o cancelado, no mostrar
        if (isSettled || se.status === 'rejected' || se.status === 'cancellation_requested') {
          return false;
        }
        
        // Solo mostrar gastos aceptados que no estén saldados (tienen saldo pendiente)
        if (se.status !== 'accepted') {
          return false;
        }
      }
      
      // Búsqueda por texto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const expenseName = se.expense?.name?.toLowerCase() || '';
        const ownerName = se.owner?.name?.toLowerCase() || '';
        const ownerEmail = se.owner?.email?.toLowerCase() || '';
        const partnerName = se.partner?.name?.toLowerCase() || '';
        const partnerEmail = se.partner?.email?.toLowerCase() || '';
        const notes = se.notes?.toLowerCase() || '';
        
        if (!expenseName.includes(query) && 
            !ownerName.includes(query) && 
            !ownerEmail.includes(query) &&
            !partnerName.includes(query) &&
            !partnerEmail.includes(query) &&
            !notes.includes(query)) {
          return false;
        }
      }
      
      return true;
    });
  }, [sharedExpenses, filter, typeFilter, personFilter, searchQuery, showOnlyPending, currentUserId]);

  return (
    <div className="space-y-4">
      {/* Balance - Más visual */}
      {balance && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="p-4 bg-[#f4fff6] dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Te deben</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">persona te debe</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(balance.totalOwed)}
            </p>
          </div>

          <div className="p-4 bg-[#fff6f6] dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Debes</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">no debes nada</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(balance.totalReceived)}
            </p>
          </div>

          <div className={`p-4 border rounded-lg ${
            balance.balance >= 0
              ? 'bg-[#f4fff6] dark:bg-green-950/10 border-green-200 dark:border-green-900/30'
              : 'bg-[#fff6f6] dark:bg-red-950/10 border-red-200 dark:border-red-900/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-2 rounded-lg ${
                balance.balance >= 0
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                <DollarSign className={`w-4 h-4 ${
                  balance.balance >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Balance</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {balance.balance >= 0 ? 'neto positivo' : 'neto negativo'}
                </p>
              </div>
            </div>
            <p className={`text-2xl font-bold ${
              balance.balance >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(Math.abs(balance.balance))}
            </p>
          </div>
        </motion.div>
      )}

      {/* Búsqueda y Filtros */}
      <div className="space-y-3">
        {/* Búsqueda rápida */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, persona, notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Estado:
            </span>
          </div>
          <div className="flex gap-2">
            {(['all', 'pending', 'accepted', 'rejected', 'cancellation_requested'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {status === 'all' ? 'Todos' :
                 status === 'pending' ? 'Pendientes' :
                 status === 'accepted' ? 'Aceptados' :
                 status === 'rejected' ? 'Rechazados' :
                 'Cancelación'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Tipo:
            </span>
          </div>
          <div className="flex gap-2">
            {(['all', 'received', 'sent'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
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

          {/* Filtro por persona */}
          {allPeople.length > 0 && (
            <>
              <div className="flex items-center gap-2 ml-4">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Persona:
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPersonFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    personFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Todos
                </button>
                {allPeople.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => setPersonFilter(person.id)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer truncate max-w-[120px] ${
                      personFilter === person.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={person.name}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Toggle: Solo mostrar gastos con saldo pendiente */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setShowOnlyPending(!showOnlyPending)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                showOnlyPending
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Mostrar solo gastos con saldo pendiente"
            >
              {showOnlyPending ? (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Ocultar saldados</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  <span>Solo pendientes</span>
                </>
              )}
            </button>
          </div>
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
        <div className="space-y-2.5">
          {filteredExpenses.length > 0 ? (
            filteredExpenses.map((sharedExpense) => (
              <SharedExpenseCard
                key={sharedExpense.id}
                sharedExpense={sharedExpense}
                currentUserId={currentUserId}
                onAccept={handleAccept}
                onReject={handleReject}
                onCancel={handleCancel}
                onConfirmCancel={handleConfirmCancel}
                onRejectCancel={handleRejectCancel}
                onSettle={handleSettle}
                formatCurrency={formatCurrency}
              />
            ))
          ) : (
            <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-lg">
              <Users className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No hay gastos compartidos con los filtros seleccionados
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

