'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatNumber';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (paymentData: {
    amount: number;
    date: string;
    type?: 'regular' | 'extra' | 'minimum';
    notes?: string;
  }) => Promise<void>;
  debt: any;
  loading?: boolean;
}

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  onSave,
  debt,
  loading = false 
}: PaymentModalProps) {
  const [formData, setFormData] = useState({
    amount: debt?.minPayment || 0,
    date: new Date().toISOString().split('T')[0],
    type: 'regular' as 'regular' | 'extra' | 'minimum',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  // Estado para mantener el valor de entrada como string (permite comas mientras se escribe)
  const [amountInput, setAmountInput] = useState<string>('');

  // Función para normalizar números con coma decimal
  const parseDecimalInput = (value: string): number => {
    if (!value || value.trim() === '') return 0;
    // Remover puntos (separador de miles) y convertir coma a punto (decimal)
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Función para formatear número con coma decimal para mostrar
  const formatDecimalDisplay = (value: number): string => {
    if (value === 0) return '';
    // Formatear con coma como separador decimal (formato argentino/español)
    return value.toString().replace('.', ',');
  };

  useEffect(() => {
    if (isOpen && debt) {
      const initialAmount = debt.minPayment || 0;
      setFormData({
        amount: initialAmount,
        date: new Date().toISOString().split('T')[0],
        type: 'regular',
        notes: ''
      });
      setAmountInput(initialAmount ? formatDecimalDisplay(initialAmount) : '');
      setErrors({});
    } else if (isOpen && !debt) {
      setAmountInput('');
    }
  }, [isOpen, debt]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Función para manejar cambios en campos numéricos manteniendo el string de entrada
  const handleNumberInputChange = (field: string, inputValue: string, setInputState: (value: string) => void) => {
    // Permitir solo números, punto, coma y espacios opcionales
    if (inputValue === '' || /^[\d.,\s]*$/.test(inputValue)) {
      setInputState(inputValue);
      // Actualizar el valor numérico en formData
      const numericValue = parseDecimalInput(inputValue);
      handleInputChange(field, numericValue);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.amount <= 0) {
      newErrors.amount = 'El monto debe ser mayor a 0';
    }

    if (formData.amount > (debt?.balance || 0)) {
      newErrors.amount = 'El pago no puede ser mayor al saldo pendiente';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await onSave({
        amount: formData.amount,
        date: formData.date,
        type: formData.type,
        notes: formData.notes
      });
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
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
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-emerald-200 to-green-300 text-gray-800 rounded-t-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-600/20 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Registrar Pago</h2>
                  <p className="text-gray-700 text-sm">{debt?.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-600/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Info de deuda */}
            <div className="bg-gray-600/10 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Saldo pendiente:</span>
                <span className="font-semibold">{formatCurrency(debt?.balance || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Pago mínimo:</span>
                <span className="font-semibold">{formatCurrency(debt?.minPayment || 0)}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Monto del pago *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => {
                    handleNumberInputChange('amount', e.target.value, setAmountInput);
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="0,00"
                />
              </div>
              {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
            </div>

            {/* Tipo de pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de pago
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="regular">Pago regular</option>
                <option value="minimum">Pago mínimo</option>
                <option value="extra">Pago extraordinario</option>
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fecha del pago
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
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
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registrando...' : 'Registrar Pago'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
