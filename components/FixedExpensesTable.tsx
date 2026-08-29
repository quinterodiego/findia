'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FixedExpenseItem } from '@/hooks/useFixedExpenses';

interface FixedExpensesTableProps {
  fixedExpenses: FixedExpenseItem[];
  loading: boolean;
  totalAmount: number;
  totalPaid: number;
  formatCurrency: (amount: number) => string;
  onItemClick?: (item: FixedExpenseItem) => void;
}

export default function FixedExpensesTable({
  fixedExpenses,
  loading,
  totalAmount,
  totalPaid,
  formatCurrency,
  onItemClick,
}: FixedExpensesTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<'all' | 'automatic' | 'manual' | 'transfer'>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'automatic': return 'Débito automático';
      case 'manual': return 'Manual';
      case 'transfer': return 'Transferencia';
      default: return '—';
    }
  };

  const getPaymentStatus = (item: FixedExpenseItem): 'paid' | 'partial' | 'pending' | 'scheduled' => {
    // Los gastos fijos y en cuotas no tienen un registro real de pagos: su paidAmount
    // es una suposición (monto completo o 0), no un dato verificado como en las deudas.
    if (item.type !== 'debt') return 'scheduled';
    if (item.amount > 0 && item.paidAmount >= item.amount) return 'paid';
    if (item.paidAmount > 0) return 'partial';
    return 'pending';
  };

  // Un vencimiento solo puede afirmarse cuando hay tracking real (deuda) con fecha
  // pasada y sin pago suficiente. Un "Programado" con fecha pasada no cuenta: FindIA
  // no tiene información para confirmar si sigue impago.
  const isConfirmedOverdue = (item: FixedExpenseItem): boolean => {
    return item.type === 'debt' && item.isOverdue === true && getPaymentStatus(item) !== 'paid';
  };

  const filteredExpenses = useMemo(() => {
    let filtered = fixedExpenses;

    // Filtro de búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query)
      );
    }

    // Filtro por método de pago
    if (filterPaymentMethod !== 'all') {
      filtered = filtered.filter(item => item.paymentMethod === filterPaymentMethod);
    }

    // Filtro de vencidos: solo registros que realmente pueden confirmarse como vencidos
    if (showOverdueOnly) {
      filtered = filtered.filter(item => isConfirmedOverdue(item));
    }

    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedExpenses, searchQuery, filterPaymentMethod, showOverdueOnly]);

  // Desglosa el importe de cada ítem según el mismo estado que ya usa la tabla
  // (getPaymentStatus), de modo que Pagado + Pendiente + Programado sea siempre
  // igual a la suma de item.amount (= totalAmount), sin contar nada dos veces.
  const budgetBreakdown = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let scheduled = 0;

    fixedExpenses.forEach(item => {
      const status = getPaymentStatus(item);
      if (status === 'scheduled') {
        scheduled += item.amount;
      } else if (status === 'paid') {
        paid += item.amount;
      } else if (status === 'partial') {
        paid += item.paidAmount;
        pending += item.amount - item.paidAmount;
      } else {
        pending += item.amount;
      }
    });

    return { paid, pending, scheduled };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedExpenses]);

  const getPaymentMethodColor = (method?: string) => {
    switch (method) {
      case 'automatic': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'manual': return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
      case 'transfer': return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      default: return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Obtener mes y año actual para el título
  const getCurrentMonthYear = () => {
    const now = new Date();
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    return `${month} ${year}`;
  };

  return (
    <div className="space-y-4">
      {/* Descripción */}
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Vista consolidada de tus gastos fijos recurrentes
        </p>
      </div>

      {/* Resumen del presupuesto */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm bg-gray-50 dark:bg-gray-900/40 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700">
        <span className="flex items-baseline gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">Total del mes</span>
          <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(totalAmount)}</span>
        </span>
        {budgetBreakdown.paid > 0 && (
          <>
            <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">·</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Pagado</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(budgetBreakdown.paid)}</span>
            </span>
          </>
        )}
        {budgetBreakdown.pending > 0 && (
          <>
            <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">·</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Pendiente</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(budgetBreakdown.pending)}</span>
            </span>
          </>
        )}
        {budgetBreakdown.scheduled > 0 && (
          <>
            <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">·</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Programado</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(budgetBreakdown.scheduled)}</span>
            </span>
          </>
        )}
      </div>

      {/* Filtros y búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterPaymentMethod}
          onChange={(e) => setFilterPaymentMethod(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">Todos los métodos</option>
          <option value="automatic">Débito Automático</option>
          <option value="manual">Manual</option>
          <option value="transfer">Transferencia</option>
        </select>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
          <input
            type="checkbox"
            checked={showOverdueOnly}
            onChange={() => setShowOverdueOnly(!showOverdueOnly)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500 cursor-pointer"
          />
          Solo vencidos
        </label>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Concepto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cuotas
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Método
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Importe
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Vencimiento
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  {fixedExpenses.length === 0
                    ? 'No tienes pagos programados en tu presupuesto'
                    : 'No se encontraron pagos con los filtros aplicados'}
                </td>
              </tr>
            ) : (
              filteredExpenses.map((item) => {
                const confirmedOverdue = isConfirmedOverdue(item);
                // Fecha pasada de un "Programado" (sin tracking real): ámbar suave, nunca rojo,
                // para no comunicar una alerta que FindIA no puede confirmar. No aplica a una
                // deuda ya pagada cuya fecha original quedó atrás: ahí no corresponde ninguna alerta.
                const passedUnconfirmed = item.type !== 'debt' && item.isOverdue === true;
                const isDueSoon = item.daysUntilDue !== undefined && item.daysUntilDue >= 0 && item.daysUntilDue <= 3;

                return (
                  <tr
                    key={item.id}
                    onClick={() => onItemClick?.(item)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      onItemClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.type === 'debt'
                            ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                            : 'expenseType' in item.originalData && item.originalData.expenseType === 'installments'
                            ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                            : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        }`}>
                          {item.type === 'debt' 
                            ? 'Préstamo' 
                            : 'expenseType' in item.originalData && item.originalData.expenseType === 'installments' 
                            ? 'Cuotas' 
                            : 'Gasto Fijo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {item.installments || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {item.paymentMethod ? (
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPaymentMethodColor(item.paymentMethod)}`}>
                          {getPaymentMethodLabel(item.paymentMethod)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm ${
                        confirmedOverdue
                          ? 'text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded'
                          : passedUnconfirmed
                          ? 'text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded'
                          : isDueSoon
                          ? 'text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {formatDate(item.dueDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const status = getPaymentStatus(item);
                        if (status === 'paid') {
                          return (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                              Pagado
                            </span>
                          );
                        }
                        if (status === 'partial') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                              Parcial · {formatCurrency(item.paidAmount)}
                            </span>
                          );
                        }
                        if (status === 'scheduled') {
                          return (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                              Programado
                            </span>
                          );
                        }
                        return (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">
                            Pendiente
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {/* Totales */}
          <tfoot className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-600">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                TOTALES
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                {formatCurrency(totalAmount)}
              </td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
