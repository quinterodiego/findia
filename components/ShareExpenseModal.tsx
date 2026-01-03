'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, DollarSign, Percent, Calculator, AlertCircle } from 'lucide-react';
import type { Expense } from '@/types';

interface ShareExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onShare: (data: {
    expenseId: string;
    sharedWithEmail: string;
    splitType: 'equal' | 'percentage' | 'amount';
    ownerAmount?: number;
    partnerAmount?: number;
    ownerPercentage?: number;
    partnerPercentage?: number;
    notes?: string;
  }) => Promise<void>;
}

export default function ShareExpenseModal({
  isOpen,
  onClose,
  expense,
  onShare
}: ShareExpenseModalProps) {
  const [sharedWithEmail, setSharedWithEmail] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'amount'>('equal');
  const [ownerPercentage, setOwnerPercentage] = useState(50);
  const [partnerPercentage, setPartnerPercentage] = useState(50);
  const [ownerAmount, setOwnerAmount] = useState(0);
  const [partnerAmount, setPartnerAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (expense && isOpen) {
      // Resetear valores cuando se abre el modal
      setSharedWithEmail('');
      setSplitType('equal');
      setOwnerPercentage(50);
      setPartnerPercentage(50);
      setOwnerAmount(0);
      setPartnerAmount(0);
      setNotes('');
      setError('');
      
      // Calcular montos por defecto (50/50)
      if (expense.amount > 0) {
        const half = expense.amount / 2;
        setOwnerAmount(half);
        setPartnerAmount(half);
      }
    }
  }, [expense, isOpen]);

  // Recalcular montos cuando cambia el tipo de división
  useEffect(() => {
    if (!expense) return;

    if (splitType === 'equal') {
      const half = expense.amount / 2;
      setOwnerAmount(half);
      setPartnerAmount(half);
    } else if (splitType === 'percentage') {
      const ownerAmountCalc = (expense.amount * ownerPercentage) / 100;
      const partnerAmountCalc = (expense.amount * partnerPercentage) / 100;
      setOwnerAmount(ownerAmountCalc);
      setPartnerAmount(partnerAmountCalc);
    }
    // Para 'amount', los montos se ingresan manualmente
  }, [splitType, ownerPercentage, partnerPercentage, expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!expense) {
      setError('No se ha seleccionado un gasto');
      return;
    }

    if (!sharedWithEmail) {
      setError('Debes ingresar el email del usuario con quien compartir');
      return;
    }

    if (splitType === 'percentage' && (ownerPercentage + partnerPercentage !== 100)) {
      setError('Los porcentajes deben sumar 100%');
      return;
    }

    if (splitType === 'amount' && (ownerAmount + partnerAmount !== expense.amount)) {
      setError(`Los montos deben sumar ${expense.amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`);
      return;
    }

    setLoading(true);
    try {
      await onShare({
        expenseId: expense.id,
        sharedWithEmail,
        splitType,
        ownerAmount: splitType === 'amount' ? ownerAmount : undefined,
        partnerAmount: splitType === 'amount' ? partnerAmount : undefined,
        ownerPercentage: splitType === 'percentage' ? ownerPercentage : undefined,
        partnerPercentage: splitType === 'percentage' ? partnerPercentage : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al compartir el gasto');
    } finally {
      setLoading(false);
    }
  };

  if (!expense) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-400 to-violet-500 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6" />
                  <div>
                    <h3 className="text-xl font-semibold">
                      Compartir Gasto
                    </h3>
                    <p className="text-white/90 text-sm">
                      {expense.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Monto total */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Monto total:
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {expense.amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </span>
                </div>
              </div>

              {/* Email del usuario */}
              <div>
                <label htmlFor="shared-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Compartir con (email):
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="shared-email"
                    type="email"
                    value={sharedWithEmail}
                    onChange={(e) => setSharedWithEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Tipo de división */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de división:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSplitType('equal');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      splitType === 'equal'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Users className="w-5 h-5" />
                      <span className="text-xs font-medium">50/50</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSplitType('percentage');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      splitType === 'percentage'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Percent className="w-5 h-5" />
                      <span className="text-xs font-medium">%</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSplitType('amount');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      splitType === 'amount'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <DollarSign className="w-5 h-5" />
                      <span className="text-xs font-medium">Monto</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* División por porcentaje */}
              {splitType === 'percentage' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tu porcentaje:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ownerPercentage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setOwnerPercentage(val);
                          setPartnerPercentage(100 - val);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Porcentaje del compañero:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={partnerPercentage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setPartnerPercentage(val);
                          setOwnerPercentage(100 - val);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* División por monto */}
              {splitType === 'amount' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tu monto:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={expense.amount}
                      value={ownerAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setOwnerAmount(val);
                        setPartnerAmount(expense.amount - val);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Monto del compañero:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={expense.amount}
                      value={partnerAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPartnerAmount(val);
                        setOwnerAmount(expense.amount - val);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Preview del cálculo */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
                    Resumen de división:
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tu parte:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {ownerAmount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Compañero:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {partnerAmount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-indigo-200 dark:border-indigo-700">
                    <span className="font-medium text-indigo-900 dark:text-indigo-300">Total:</span>
                    <span className="font-bold text-indigo-900 dark:text-indigo-300">
                      {(ownerAmount + partnerAmount).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label htmlFor="shared-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas (opcional):
                </label>
                <textarea
                  id="shared-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Agregar notas sobre este gasto compartido..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Compartiendo...' : 'Compartir Gasto'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

