'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, DollarSign, TrendingUp, Target, Calendar, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatNumber';

type TransactionType = 'debt' | 'expense' | 'income' | 'goal';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: TransactionType;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
  editingTransaction?: any; // Datos de la transacción a editar
  categories?: Array<{ id: string; name: string; type: string; icon?: string }>;
  subcategories?: Array<{ id: string; categoryId: string; name: string; icon?: string }>;
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

export default function TransactionModal({ isOpen, onClose, type, onSave, loading = false, editingTransaction, categories = [], subcategories = [] }: TransactionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    subcategory: '',
    notes: '',
    // Campos específicos para deudas
    balance: 0,
    interestRate: 0,
    minPayment: 0,
    dueDate: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    // Campos para préstamos con cuotas
    totalInstallmentsDebt: 0,
    remainingInstallmentsDebt: 0,
    paymentMethodDebt: 'manual' as 'automatic' | 'manual' | 'transfer',
    // Campos específicos para metas
    targetDate: '',
    currentAmount: 0,
    // Campos específicos para gastos/ingresos
    expenseType: 'variable' as 'fixed' | 'variable' | 'installments',
    isRecurring: false,
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    // Campos para gastos en cuotas
    totalInstallments: 0,
    currentInstallment: 1,
    paymentMethod: 'manual' as 'automatic' | 'manual' | 'transfer'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  // Estados para mantener los valores de entrada como strings (permite comas mientras se escribe)
  const [amountInput, setAmountInput] = useState<string>('');
  const [balanceInput, setBalanceInput] = useState<string>('');
  const [interestRateInput, setInterestRateInput] = useState<string>('');
  const [minPaymentInput, setMinPaymentInput] = useState<string>('');
  const [currentAmountInput, setCurrentAmountInput] = useState<string>('');
  const config = typeConfig[type];
  const Icon = config.icon;

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
          subcategory: editingTransaction.subcategory || editingTransaction.subcategoryId || '',
          notes: editingTransaction.notes || '',
          balance: editingTransaction.balance || 0,
          interestRate: editingTransaction.interestRate || 0,
          minPayment: editingTransaction.minPayment || 0,
          dueDate: editingTransaction.dueDate || '',
          priority: editingTransaction.priority || 'medium',
          totalInstallmentsDebt: editingTransaction.totalInstallments || 0,
          remainingInstallmentsDebt: editingTransaction.remainingInstallments || 0,
          paymentMethodDebt: editingTransaction.paymentMethod || 'manual',
          targetDate: editingTransaction.targetDate || '',
          currentAmount: editingTransaction.currentAmount || 0,
          expenseType: editingTransaction.expenseType || 'variable',
          totalInstallments: editingTransaction.totalInstallments || 0,
          currentInstallment: editingTransaction.currentInstallment || 1,
          paymentMethod: editingTransaction.paymentMethod || 'manual',
          isRecurring: editingTransaction.isRecurring || false,
          frequency: editingTransaction.frequency || 'monthly'
        });
        setAmountInput(editingTransaction.amount ? formatDecimalDisplay(editingTransaction.amount) : '');
        setBalanceInput(editingTransaction.balance ? formatDecimalDisplay(editingTransaction.balance) : '');
        setInterestRateInput(editingTransaction.interestRate ? formatDecimalDisplay(editingTransaction.interestRate) : '');
        setMinPaymentInput(editingTransaction.minPayment ? formatDecimalDisplay(editingTransaction.minPayment) : '');
        setCurrentAmountInput(editingTransaction.currentAmount ? formatDecimalDisplay(editingTransaction.currentAmount) : '');
      } else {
        console.log('🔄 Reseteando formulario para tipo:', type);
        setFormData({
          name: '',
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          subcategory: '',
          notes: '',
          balance: 0,
          interestRate: 0,
          minPayment: 0,
          dueDate: '',
          priority: 'medium',
          totalInstallmentsDebt: 0,
          remainingInstallmentsDebt: 0,
          paymentMethodDebt: 'manual',
          targetDate: '',
          currentAmount: 0,
          expenseType: 'variable',
          totalInstallments: 0,
          currentInstallment: 1,
          paymentMethod: 'manual',
          isRecurring: false,
          frequency: 'monthly'
        });
        setAmountInput('');
        setBalanceInput('');
        setInterestRateInput('');
        setMinPaymentInput('');
        setCurrentAmountInput('');
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

    if (type === 'debt' && !formData.dueDate) {
      newErrors.dueDate = 'La fecha de vencimiento es requerida';
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
                  value={amountInput}
                  onChange={(e) => {
                    handleNumberInputChange('amount', e.target.value, setAmountInput);
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="0,00"
                />
              </div>
              {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
            </div>

            {/* Subcategoría (filtrada por tipo de transacción) */}
            {subcategories.length > 0 && (
              <div>
                <label htmlFor="transaction-subcategory-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subcategoría (opcional)
                </label>
                <select
                  id="transaction-subcategory-select"
                  value={formData.subcategory || ''}
                  onChange={(e) => handleInputChange('subcategory', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  aria-label="Seleccionar subcategoría"
                >
                  <option value="">Seleccionar subcategoría...</option>
                  {(() => {
                    // Determinar el tipo de categoría según el tipo de transacción
                    let categoryType: 'expense' | 'income' | 'saving' = 'expense'
                    if (type === 'income') categoryType = 'income'
                    else if (type === 'goal') categoryType = 'saving'
                    else if (type === 'expense' || type === 'debt') categoryType = 'expense'
                    
                    // Obtener las categorías del usuario del tipo correspondiente
                    const userCategoriesOfType = categories.filter(cat => cat.type === categoryType)
                    const userCategoryIds = new Set(userCategoriesOfType.map(cat => cat.id))
                    
                    // Filtrar subcategorías que pertenecen a categorías del tipo correcto
                    return subcategories
                      .filter(sub => userCategoryIds.has(sub.categoryId))
                      .map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {sub.icon} {sub.name}
                        </option>
                      ))
                  })()}
                </select>
              </div>
            )}

            {/* Tipo de gasto (solo para gastos) */}
            {type === 'expense' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de gasto
                </label>
                <div className="grid grid-cols-3 gap-3">
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
                  <button
                    type="button"
                    onClick={() => handleInputChange('expenseType', 'installments')}
                    className={`px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                      formData.expenseType === 'installments'
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    📅 Cuotas
                  </button>
                </div>
              </div>
            )}

            {/* Campos para gastos en cuotas */}
            {type === 'expense' && formData.expenseType === 'installments' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Total de cuotas
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.totalInstallments || ''}
                      onChange={(e) => handleInputChange('totalInstallments', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Ej: 12"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cuota actual
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.currentInstallment || ''}
                      onChange={(e) => handleInputChange('currentInstallment', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Ej: 1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Método de pago
                  </label>
                  <select
                    value={formData.paymentMethod || 'manual'}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="automatic">Débito Automático</option>
                    <option value="manual">Manual</option>
                    <option value="transfer">Transferencia</option>
                  </select>
                </div>
                {formData.totalInstallments && formData.currentInstallment && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Cuota {formData.currentInstallment} de {formData.totalInstallments} 
                      {formData.totalInstallments > 0 && (
                        <span className="ml-2">
                          (Restan {formData.totalInstallments - formData.currentInstallment + 1})
                        </span>
                      )}
                    </p>
                    {formData.amount > 0 && formData.totalInstallments > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Monto por cuota: {formatCurrency(formData.amount / formData.totalInstallments)}
                      </p>
                    )}
                  </div>
                )}
              </>
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
                        value={balanceInput}
                        onChange={(e) => {
                          handleNumberInputChange('balance', e.target.value, setBalanceInput);
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
                        value={interestRateInput}
                        onChange={(e) => {
                          handleNumberInputChange('interestRate', e.target.value, setInterestRateInput);
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
                    value={minPaymentInput}
                    onChange={(e) => {
                      handleNumberInputChange('minPayment', e.target.value, setMinPaymentInput);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha de Vencimiento *
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  {errors.dueDate && <p className="text-red-500 text-sm mt-1">{errors.dueDate}</p>}
                </div>

                <div>
                  <label htmlFor="transaction-priority-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prioridad
                  </label>
                  <select
                    id="transaction-priority-select"
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    aria-label="Seleccionar prioridad"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </div>

                {/* Campos opcionales para préstamos con cuotas */}
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    📅 Cuotas (Opcional - para que aparezca en el presupuesto)
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Total de cuotas
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.totalInstallmentsDebt || ''}
                        onChange={(e) => handleInputChange('totalInstallmentsDebt', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Ej: 12 (dejar en 0 si no tiene cuotas)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cuotas restantes
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.remainingInstallmentsDebt || ''}
                        onChange={(e) => handleInputChange('remainingInstallmentsDebt', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Ej: 8"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Método de pago
                    </label>
                    <select
                      value={formData.paymentMethodDebt || 'manual'}
                      onChange={(e) => handleInputChange('paymentMethodDebt', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="automatic">Débito Automático</option>
                      <option value="manual">Manual</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </div>
                  {formData.totalInstallmentsDebt > 0 && formData.remainingInstallmentsDebt >= 0 && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {formData.totalInstallmentsDebt - formData.remainingInstallmentsDebt > 0 
                          ? `Cuota ${formData.totalInstallmentsDebt - formData.remainingInstallmentsDebt}/${formData.totalInstallmentsDebt} (Restan ${formData.remainingInstallmentsDebt})`
                          : `Total: ${formData.totalInstallmentsDebt} cuotas (Restan ${formData.remainingInstallmentsDebt})`}
                      </p>
                      {formData.minPayment > 0 && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Monto por cuota: {formatCurrency(formData.minPayment)}
                        </p>
                      )}
                    </div>
                  )}
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
                    value={currentAmountInput}
                    onChange={(e) => {
                      handleNumberInputChange('currentAmount', e.target.value, setCurrentAmountInput);
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