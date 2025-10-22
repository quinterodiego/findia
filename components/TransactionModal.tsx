'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, DollarSign, TrendingUp, Target, Calendar, AlertTriangle } from 'lucide-react';

type TransactionType = 'debt' | 'expense' | 'income' | 'goal';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: TransactionType;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

const typeConfig = {
  debt: {
    title: 'Agregar Deuda',
    icon: CreditCard,
    color: 'from-red-500 to-red-600',
    description: 'Registra una nueva deuda, préstamo o crédito'
  },
  expense: {
    title: 'Agregar Gasto',
    icon: DollarSign,
    color: 'from-orange-500 to-orange-600',
    description: 'Registra un gasto o compra realizada'
  },
  income: {
    title: 'Agregar Ingreso',
    icon: TrendingUp,
    color: 'from-green-500 to-green-600',
    description: 'Registra un ingreso o entrada de dinero'
  },
  goal: {
    title: 'Agregar Meta',
    icon: Target,
    color: 'from-blue-500 to-blue-600',
    description: 'Define una meta de ahorro u objetivo financiero'
  }
};

export default function TransactionModal({ isOpen, onClose, type, onSave, loading = false }: TransactionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: '',
    notes: '',
    // Campos específicos para deudas
    balance: 0,
    interestRate: 0,
    minPayment: 0,
    dueDate: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    // Campos específicos para metas
    targetDate: '',
    currentAmount: 0,
    // Campos específicos para gastos/ingresos
    isRecurring: false,
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const config = typeConfig[type];
  const Icon = config.icon;

  // Resetear formulario cuando cambia el tipo
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        category: '',
        notes: '',
        balance: 0,
        interestRate: 0,
        minPayment: 0,
        dueDate: '',
        priority: 'medium',
        targetDate: '',
        currentAmount: 0,
        isRecurring: false,
        frequency: 'monthly'
      });
      setErrors({});
    }
  }, [isOpen, type]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (formData.amount <= 0) {
      newErrors.amount = 'El monto debe ser mayor a 0';
    }

    if (type === 'debt' && formData.balance < 0) {
      newErrors.balance = 'El saldo no puede ser negativo';
    }

    if (type === 'debt' && formData.interestRate < 0) {
      newErrors.interestRate = 'La tasa de interés no puede ser negativa';
    }

    if (type === 'goal' && formData.currentAmount < 0) {
      newErrors.currentAmount = 'El monto actual no puede ser negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

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
        >
          {/* Header */}
          <div className={`p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r ${config.color} text-white rounded-t-2xl`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-semibold">{config.title}</h2>
                  <p className="text-white/80 text-sm">{config.description}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder={`Nombre de ${type === 'debt' ? 'la deuda' : type === 'expense' ? 'el gasto' : type === 'income' ? 'el ingreso' : 'la meta'}`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {type === 'goal' ? 'Meta de ahorro *' : 'Monto *'}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
            </div>

            {/* Campos específicos para deudas */}
            {type === 'debt' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Saldo actual
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => handleInputChange('balance', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                    />
                    {errors.balance && <p className="text-red-500 text-sm mt-1">{errors.balance}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tasa de interés (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.interestRate}
                      onChange={(e) => handleInputChange('interestRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pago mínimo mensual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.minPayment}
                    onChange={(e) => handleInputChange('minPayment', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prioridad
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </>
            )}

            {/* Campos específicos para metas */}
            {type === 'goal' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monto actual ahorrado
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.currentAmount}
                    onChange={(e) => handleInputChange('currentAmount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                  />
                  {errors.currentAmount && <p className="text-red-500 text-sm mt-1">{errors.currentAmount}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha objetivo
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => handleInputChange('targetDate', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </>
            )}

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                placeholder="Información adicional..."
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 px-6 py-3 bg-gradient-to-r ${config.color} text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}