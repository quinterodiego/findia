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
  editingTransaction?: any; // Datos de la transacción a editar
}

const typeConfig = {
  debt: {
    title: 'Agregar Deuda',
    icon: CreditCard,
    color: 'from-rose-400 to-pink-500',
    description: 'Registra una nueva deuda, préstamo o crédito'
  },
  expense: {
    title: 'Agregar Gasto',
    icon: DollarSign,
    color: 'from-orange-400 to-amber-500',
    description: 'Registra un gasto o compra realizada'
  },
  income: {
    title: 'Agregar Ingreso',
    icon: TrendingUp,
    color: 'from-emerald-400 to-green-500',
    description: 'Registra un ingreso o entrada de dinero'
  },
  goal: {
    title: 'Agregar Meta',
    icon: Target,
    color: 'from-sky-400 to-blue-500',
    description: 'Define una meta de ahorro u objetivo financiero'
  }
};

const expenseCategories = [
  'Alimentación',
  'Transporte',
  'Servicios (Luz, Agua, Gas)',
  'Vivienda',
  'Salud',
  'Educación',
  'Entretenimiento',
  'Tecnología',
  'Ropa',
  'Otros'
];

const incomeCategories = [
  'Salario',
  'Freelance',
  'Negocio',
  'Inversiones',
  'Otros ingresos'
];

const goalCategories = [
  'Ahorro de emergencia',
  'Compras',
  'Viajes',
  'Educación',
  'Vivienda',
  'Otros'
];

const debtCategories = [
  'Tarjeta de crédito',
  'Préstamo personal',
  'Préstamo hipotecario',
  'Préstamo de auto',
  'Préstamo estudiantil',
  'Prestado a familiares/amigos',
  'Deuda médica',
  'Otros'
];

export default function TransactionModal({ isOpen, onClose, type, onSave, loading = false, editingTransaction }: TransactionModalProps) {
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
    expenseType: 'variable' as 'fixed' | 'variable',
    isRecurring: false,
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const config = typeConfig[type];
  const Icon = config.icon;

  // Resetear formulario cuando cambia el tipo o poblar con datos de edición
  useEffect(() => {
    console.log('🔄 TransactionModal useEffect - isOpen:', isOpen, 'type:', type, 'editingTransaction:', editingTransaction);
    if (isOpen) {
      if (editingTransaction) {
        console.log('🔄 Cargando datos para edición:', editingTransaction);
        setFormData({
          name: editingTransaction.name || '',
          amount: editingTransaction.amount || 0,
          date: editingTransaction.date || new Date().toISOString().split('T')[0],
          category: editingTransaction.category || '',
          notes: editingTransaction.notes || '',
          balance: editingTransaction.balance || 0,
          interestRate: editingTransaction.interestRate || 0,
          minPayment: editingTransaction.minPayment || 0,
          dueDate: editingTransaction.dueDate || '',
          priority: editingTransaction.priority || 'medium',
          targetDate: editingTransaction.targetDate || '',
          currentAmount: editingTransaction.currentAmount || 0,
          expenseType: editingTransaction.expenseType || 'variable',
          isRecurring: editingTransaction.isRecurring || false,
          frequency: editingTransaction.frequency || 'monthly'
        });
      } else {
        console.log('🔄 Reseteando formulario para tipo:', type);
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
          expenseType: 'variable',
          isRecurring: false,
          frequency: 'monthly'
        });
      }
      setErrors({});
    }
  }, [isOpen, type, editingTransaction]);

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

  // Función para normalizar números con coma decimal
  const parseDecimalInput = (value: string): number => {
    if (!value || value.trim() === '') return 0;
    // Reemplazar coma por punto para parsear
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Función para formatear número con coma decimal para mostrar
  const formatDecimalDisplay = (value: number): string => {
    if (value === 0) return '';
    // Formatear con coma como separador decimal (formato argentino/español)
    return value.toString().replace('.', ',');
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNumberInputChange = (field: string, value: string) => {
    // Permite entrada con coma o punto
    const numericValue = parseDecimalInput(value);
    handleInputChange(field, numericValue);
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
                  <h2 className="text-xl font-semibold">
                    {editingTransaction ? `Editar ${type === 'debt' ? 'Deuda' : type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : 'Meta'}` : config.title}
                  </h2>
                  <p className="text-white/90 text-sm">
                    {editingTransaction ? `Actualiza los datos de ${type === 'debt' ? 'la deuda' : type === 'expense' ? 'el gasto' : type === 'income' ? 'el ingreso' : 'la meta'}` : config.description}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-600/20 rounded-lg transition-colors cursor-pointer"
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
                  type="text"
                  inputMode="decimal"
                  value={formData.amount === 0 ? '' : formatDecimalDisplay(formData.amount)}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    // Permitir solo números, punto, coma y espacios opcionales
                    if (inputValue === '' || /^[\d.,\s]*$/.test(inputValue)) {
                      handleNumberInputChange('amount', inputValue);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="0,00"
                />
              </div>
              {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categoría {type === 'goal' ? '(opcional)' : '(opcional)'}
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">Seleccionar categoría...</option>
                {type === 'expense' && expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                {type === 'income' && incomeCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                {type === 'goal' && goalCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                {type === 'debt' && debtCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Tipo de gasto (solo para gastos) */}
            {type === 'expense' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de gasto
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleInputChange('expenseType', 'fixed')}
                    className={`px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                      formData.expenseType === 'fixed'
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    💼 Fijo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('expenseType', 'variable')}
                    className={`px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                      formData.expenseType === 'variable'
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    📊 Variable
                  </button>
                </div>
              </div>
            )}

            {/* Campos específicos para deudas */}
            {type === 'debt' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Saldo actual
                    </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.balance === 0 ? '' : formatDecimalDisplay(formData.balance)}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '' || /^[\d.,\s]*$/.test(inputValue)) {
                            handleNumberInputChange('balance', inputValue);
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="0,00"
                      />
                    {errors.balance && <p className="text-red-500 text-sm mt-1">{errors.balance}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tasa de interés (%)
                    </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.interestRate === 0 ? '' : formatDecimalDisplay(formData.interestRate)}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '' || /^[\d.,\s]*$/.test(inputValue)) {
                            handleNumberInputChange('interestRate', inputValue);
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="0,00"
                      />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pago mínimo mensual
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.minPayment === 0 ? '' : formatDecimalDisplay(formData.minPayment)}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '' || /^[\d.,\s]*$/.test(inputValue)) {
                        handleNumberInputChange('minPayment', inputValue);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0,00"
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
                    type="text"
                    inputMode="decimal"
                    value={formData.currentAmount === 0 ? '' : formatDecimalDisplay(formData.currentAmount)}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '' || /^[\d.,\s]*$/.test(inputValue)) {
                        handleNumberInputChange('currentAmount', inputValue);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0,00"
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
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 px-6 py-3 bg-gradient-to-r ${config.color} text-white rounded-xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
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