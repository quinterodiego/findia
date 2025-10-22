'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CreditCard, DollarSign, TrendingUp, Target, X, ChevronUp } from 'lucide-react';

interface MobileActionSheetProps {
  onAction: (type: 'debt' | 'expense' | 'income' | 'goal') => void;
}

const actions = [
  {
    type: 'debt' as const,
    label: 'Agregar Deuda',
    icon: CreditCard,
    color: 'from-red-500 to-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    textColor: 'text-red-600 dark:text-red-400',
    description: 'Tarjetas de crédito, préstamos, hipotecas',
    emoji: '💳'
  },
  {
    type: 'expense' as const,
    label: 'Agregar Gasto',
    icon: DollarSign,
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    textColor: 'text-orange-600 dark:text-orange-400',
    description: 'Compras diarias, facturas, servicios',
    emoji: '💸'
  },
  {
    type: 'income' as const,
    label: 'Agregar Ingreso',
    icon: TrendingUp,
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    textColor: 'text-green-600 dark:text-green-400',
    description: 'Salario, freelance, ventas, bonos',
    emoji: '💰'
  },
  {
    type: 'goal' as const,
    label: 'Agregar Meta',
    icon: Target,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    textColor: 'text-blue-600 dark:text-blue-400',
    description: 'Objetivos de ahorro, metas financieras',
    emoji: '🎯'
  }
];

export default function MobileActionSheet({ onAction }: MobileActionSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSheet = () => setIsOpen(!isOpen);

  const handleAction = (type: 'debt' | 'expense' | 'income' | 'goal') => {
    onAction(type);
    setIsOpen(false);
  };

  return (
    <>
      {/* Botón principal - Solo visible en mobile */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleSheet}
          className="w-16 h-16 rounded-full bg-linear-to-r from-blue-500 to-purple-600 shadow-lg flex items-center justify-center"
        >
          <Plus className="w-8 h-8 text-white" />
        </motion.button>
      </div>

      {/* Action Sheet Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-xl"
            >
              {/* Handle */}
              <div className="flex justify-center pt-4 pb-2">
                <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      ¿Qué quieres agregar?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Selecciona el tipo de transacción
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="p-6 grid grid-cols-2 gap-4">
                {actions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.type}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        transition: { delay: index * 0.1 }
                      }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAction(action.type)}
                      className={`p-4 rounded-2xl ${action.bgColor} border border-gray-200 dark:border-gray-700 transition-all active:scale-95`}
                    >
                      <div className="flex flex-col items-center text-center space-y-3">
                        {/* Icon + Emoji */}
                        <div className="relative">
                          <div className={`w-12 h-12 rounded-full bg-linear-to-r ${action.color} flex items-center justify-center shadow-md`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="absolute -top-1 -right-1 text-lg">
                            {action.emoji}
                          </div>
                        </div>

                        {/* Label */}
                        <div>
                          <h4 className={`font-semibold ${action.textColor} text-sm`}>
                            {action.label}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-t-3xl">
                <div className="flex items-center justify-center">
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    Desliza hacia arriba para cerrar
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}