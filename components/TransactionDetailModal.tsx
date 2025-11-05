'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit, Trash2, Calendar, Target, Plus, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/formatNumber';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  onEdit: () => void;
  onDelete: () => void;
  onAddPayment?: () => void;
  onShare?: () => void;
}

export default function TransactionDetailModal({ 
  isOpen, 
  onClose, 
  transaction, 
  onEdit, 
  onDelete,
  onAddPayment,
  onShare
}: TransactionDetailModalProps) {
  if (!isOpen || !transaction) return null;

  const getTransactionColor = () => {
    switch (transaction.type) {
      case 'debt': return 'bg-gradient-to-r from-rose-200 to-pink-300';
      case 'income': return 'bg-gradient-to-r from-emerald-200 to-green-300';
      case 'expense': return 'bg-gradient-to-r from-orange-200 to-amber-300';
      case 'goal': return 'bg-gradient-to-r from-sky-200 to-blue-300';
      default: return 'bg-gradient-to-r from-gray-200 to-gray-300';
    }
  };

  const getTransactionIcon = () => {
    switch (transaction.type) {
      case 'debt': return '💳';
      case 'income': return '💰';
      case 'expense': return '💸';
      case 'goal': return '🎯';
      default: return '📊';
    }
  };

  const getTransactionLabel = () => {
    switch (transaction.type) {
      case 'debt': return 'Deuda';
      case 'income': return 'Ingreso';
      case 'expense': return 'Gasto';
      case 'goal': return 'Meta';
      default: return 'Transacción';
    }
  };

  const formatDate = (date: string) => {
    if (!date) return 'No disponible';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Fecha inválida';
    return dateObj.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Determinar la fecha a mostrar según el tipo de transacción
  const getDisplayDate = () => {
    if (transaction.type === 'debt') {
      // Para deudas, usar dueDate si existe, sino createdAt
      return transaction.dueDate || transaction.createdAt || '';
    }
    // Para otras transacciones, usar date
    return transaction.date || '';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 ${getTransactionColor()} text-gray-800 rounded-t-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{getTransactionIcon()}</span>
                <div>
                  <h2 className="text-xl font-semibold">{transaction.name}</h2>
                  <p className="text-gray-700 text-sm">{getTransactionLabel()}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-600/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Amount */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Monto</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {transaction.type === 'debt' ? 'Fecha de vencimiento' : 'Fecha'}
                  </p>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {formatDate(getDisplayDate())}
                </p>
              </div>

              {transaction.category && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Categoría</p>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">
                    {transaction.category}
                  </p>
                </div>
              )}
            </div>

            {/* Debt Specific Info */}
            {transaction.type === 'debt' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Saldo</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(transaction.balance || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Interés</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {transaction.interestRate || 0}%
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Progreso de pago</span>
                    <span className="font-semibold">
                      {((transaction.amount - transaction.balance) / transaction.amount * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((transaction.amount - transaction.balance) / transaction.amount * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </>
            )}

            {/* Goal Specific Info */}
            {transaction.type === 'goal' && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Progreso de meta</span>
                  <span className="font-semibold">
                    {((transaction.currentAmount || 0) / transaction.amount * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((transaction.currentAmount || 0) / transaction.amount * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Notes */}
            {transaction.notes && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Notas</p>
                <p className="text-gray-900 dark:text-white">{transaction.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 flex-wrap">
              {transaction.type === 'debt' && onAddPayment && (
                <button
                  onClick={onAddPayment}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-400 hover:bg-green-500 text-white rounded-xl transition-colors font-semibold"
                >
                  <Plus className="w-5 h-5" />
                  Registrar Pago
                </button>
              )}
              {transaction.type === 'expense' && (
                <button
                  onClick={onShare || (() => {})}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-400 hover:bg-purple-500 text-white rounded-xl transition-colors font-semibold"
                  disabled={!onShare}
                >
                  <Users className="w-5 h-5" />
                  Compartir
                </button>
              )}
              <button
                onClick={onEdit}
                className={`${(transaction.type === 'debt' && onAddPayment) || (transaction.type === 'expense') ? 'flex-1' : 'flex-1'} flex items-center justify-center gap-2 px-4 py-3 bg-blue-400 hover:bg-blue-500 text-white rounded-xl transition-colors font-semibold`}
              >
                <Edit className="w-5 h-5" />
                Editar
              </button>
              <button
                onClick={onDelete}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-400 hover:bg-red-500 text-white rounded-xl transition-colors font-semibold"
              >
                <Trash2 className="w-5 h-5" />
                Eliminar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}