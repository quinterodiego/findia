'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import type { Debt, Category, Subcategory } from '@/types';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debtData: {
    name: string;
    amount: number;
    balance?: number;
    interestRate?: number;
    minPayment?: number;
    dueDate: string;
    priority?: 'high' | 'medium' | 'low';
    categoryId?: string;
    subcategoryId?: string;
    notes?: string;
  }) => Promise<void>;
  debt?: Debt; // Para edición
  loading?: boolean;
  categories: Category[];
  subcategories: Subcategory[];
}

export default function DebtModal({ isOpen, onClose, onSave, debt, loading = false, categories, subcategories }: DebtModalProps) {
  const [formData, setFormData] = useState({
    name: debt?.name || '',
    amount: debt?.amount || 0,
    balance: debt?.balance || debt?.amount || 0,
    interestRate: debt?.interestRate || 0,
    minPayment: debt?.minPayment || 0,
    dueDate: debt?.dueDate ? debt.dueDate.split('T')[0] : '',
    priority: debt?.priority || 'medium' as 'high' | 'medium' | 'low',
    categoryId: debt?.categoryId || (categories.length > 0 ? categories[0].id : ''),
    subcategoryId: debt?.subcategoryId || '',
    notes: debt?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filtrar subcategorías basadas en la categoría seleccionada
  const availableSubcategories = subcategories.filter(
    subcat => subcat.categoryId === formData.categoryId
  );

  // Resetear subcategoría cuando cambia la categoría
  useEffect(() => {
    // Si la subcategoría actual no pertenece a la nueva categoría, resetearla
    const isSubcatValid = availableSubcategories.some(
      subcat => subcat.id === formData.subcategoryId
    );
    
    if (!isSubcatValid && availableSubcategories.length > 0) {
      setFormData(prev => ({
        ...prev,
        subcategoryId: availableSubcategories[0].id,
      }));
    }
  }, [formData.categoryId, formData.subcategoryId, availableSubcategories]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (formData.amount <= 0) {
      newErrors.amount = 'El monto debe ser mayor a 0';
    }

    if (formData.balance < 0) {
      newErrors.balance = 'El saldo no puede ser negativo';
    }

    if (formData.balance > formData.amount) {
      newErrors.balance = 'El saldo no puede ser mayor al monto original';
    }

    if (formData.interestRate < 0) {
      newErrors.interestRate = 'La tasa de interés no puede ser negativa';
    }

    if (formData.minPayment < 0) {
      newErrors.minPayment = 'El pago mínimo no puede ser negativo';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'La fecha de vencimiento es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave({
        name: formData.name.trim(),
        amount: Number(formData.amount),
        balance: Number(formData.balance),
        interestRate: Number(formData.interestRate),
        minPayment: Number(formData.minPayment),
        dueDate: new Date(formData.dueDate).toISOString(),
        priority: formData.priority,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId,
        notes: formData.notes.trim(),
      });
      
      onClose();
    } catch (error) {
      console.error('Error al guardar deuda:', error);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {debt ? 'Editar Deuda' : 'Nueva Deuda'}
                </h2>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categoría *
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => handleInputChange('categoryId', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dark:bg-gray-800 dark:text-white cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategoría */}
              {availableSubcategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subcategoría *
                  </label>
                  <select
                    value={formData.subcategoryId}
                    onChange={(e) => handleInputChange('subcategoryId', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dark:bg-gray-800 dark:text-white cursor-pointer"
                  >
                    {availableSubcategories.map(subcat => (
                      <option key={subcat.id} value={subcat.id}>
                        {subcat.icon} {subcat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.name 
                      ? 'border-red-500 bg-red-50 dark:bg-red-950' 
                      : 'border-gray-300 dark:border-gray-600'
                  } dark:bg-gray-800 dark:text-white`}
                  placeholder="Ej: Tarjeta de Crédito Visa"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Monto *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    handleInputChange('amount', value);
                    // Auto-ajustar balance si es la primera vez
                    if (!debt && formData.balance === 0) {
                      handleInputChange('balance', value);
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.amount 
                      ? 'border-red-500 bg-red-50 dark:bg-red-950' 
                      : 'border-gray-300 dark:border-gray-600'
                  } dark:bg-gray-800 dark:text-white`}
                  placeholder="5000.00"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
                )}
              </div>

              {/* Fecha de Vencimiento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fecha de Vencimiento *
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.dueDate 
                      ? 'border-red-500 bg-red-50 dark:bg-red-950' 
                      : 'border-gray-300 dark:border-gray-600'
                  } dark:bg-gray-800 dark:text-white`}
                />
                {errors.dueDate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dueDate}</p>
                )}
              </div>

              {/* Prioridad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Prioridad
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dark:bg-gray-800 dark:text-white cursor-pointer"
                >
                  <option value="low">🟢 Baja</option>
                  <option value="medium">🟡 Media</option>
                  <option value="high">🔴 Alta</option>
                </select>
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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dark:bg-gray-800 dark:text-white resize-none"
                  placeholder="Información adicional sobre esta deuda..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? 'Guardando...' : debt ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}