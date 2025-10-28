'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CreditCard, DollarSign, TrendingUp, Target, X } from 'lucide-react';

interface FloatingActionButtonProps {
  onAction: (type: 'debt' | 'expense' | 'income' | 'goal') => void;
}

const actions = [
  {
    type: 'debt' as const,
    label: 'Agregar Deuda',
    icon: CreditCard,
    color: 'from-red-400 to-red-500',
    description: 'Tarjetas, préstamos, créditos'
  },
  {
    type: 'expense' as const,
    label: 'Agregar Gasto',
    icon: DollarSign,
    color: 'from-orange-400 to-orange-500',
    description: 'Compras, facturas, gastos'
  },
  {
    type: 'income' as const,
    label: 'Agregar Ingreso',
    icon: TrendingUp,
    color: 'from-green-400 to-green-500',
    description: 'Salario, ventas, ingresos'
  },
  {
    type: 'goal' as const,
    label: 'Agregar Meta',
    icon: Target,
    color: 'from-blue-400 to-blue-500',
    description: 'Ahorros, objetivos'
  }
];

export default function FloatingActionButton({ onAction }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const handleAction = (type: 'debt' | 'expense' | 'income' | 'goal') => {
    console.log('🎯 FloatingActionButton.handleAction llamado con type:', type);
    onAction(type);
    setIsOpen(false);
  };

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Botones de acción */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <AnimatePresence>
          {isOpen && (
            <div className="absolute bottom-16 right-0 space-y-3">
              {actions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.type}
                    initial={{ scale: 0, x: 20, opacity: 0 }}
                    animate={{ 
                      scale: 1, 
                      x: 0, 
                      opacity: 1,
                      transition: { delay: index * 0.1 }
                    }}
                    exit={{ 
                      scale: 0, 
                      x: 20, 
                      opacity: 0,
                      transition: { delay: (actions.length - index - 1) * 0.05 }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      console.log('🖱️ Botón clickeado:', action.type, action.label);
                      handleAction(action.type);
                    }}
                    className="flex items-center gap-3 group"
                  >
                    {/* Etiqueta - Siempre visible en todos los dispositivos */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-lg border border-gray-200 dark:border-gray-700 opacity-100 transition-all duration-200 group-hover:shadow-xl">
                      <p className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {action.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {action.description}
                      </p>
                    </div>

                    {/* Botón circular */}
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-linear-to-r ${action.color} shadow-lg flex items-center justify-center`}>
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* Botón principal */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleMenu}
          className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-linear-to-r from-blue-400 to-purple-500 shadow-lg flex items-center justify-center transition-all duration-300 group cursor-pointer ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          ) : (
            <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          )}

          {/* Tooltip de ayuda */}
          {!isOpen && (
            <div className="absolute -top-12 right-0 bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              Agregar transacción
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          )}
        </motion.button>
      </div>
    </>
  );
}