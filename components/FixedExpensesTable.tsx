'use client';

import { useState, useMemo } from 'react';
import { Calendar, DollarSign, TrendingUp, Search, Filter } from 'lucide-react';
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

    // Filtro de vencidos
    if (showOverdueOnly) {
      filtered = filtered.filter(item => item.isOverdue === true);
    }

    return filtered;
  }, [fixedExpenses, searchQuery, filterPaymentMethod, showOverdueOnly]);

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'automatic': return 'DbA';
      case 'manual': return 'Man';
      case 'transfer': return 'Transf';
      default: return '-';
    }
  };

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
        <button
          onClick={() => setShowOverdueOnly(!showOverdueOnly)}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            showOverdueOnly
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Filter className="w-4 h-4 inline mr-2" />
          Solo vencidos
        </button>
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
                Forma
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Importe
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                VTO
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pagado
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
                const isOverdue = item.isOverdue;
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
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPaymentMethodColor(item.paymentMethod)}`}>
                        {getPaymentMethodLabel(item.paymentMethod)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm ${
                        isOverdue
                          ? 'text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded'
                          : isDueSoon
                          ? 'text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {formatDate(item.dueDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                      {item.paidAmount > 0 ? formatCurrency(item.paidAmount) : '-'}
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
              <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
                {formatCurrency(totalPaid)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
