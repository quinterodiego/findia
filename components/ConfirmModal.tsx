'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check, X as XIcon } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'brand';
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-400';
      case 'warning':
        return 'bg-orange-400';
      case 'info':
        return 'bg-blue-400';
      case 'brand':
        return 'bg-gradient-to-r from-[#FF3A5F] to-[#FF007A]';
      default:
        return 'bg-gray-400';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return 'text-red-400 dark:text-red-300';
      case 'warning':
        return 'text-orange-400 dark:text-orange-300';
      case 'info':
        return 'text-blue-400 dark:text-blue-300';
      case 'brand':
        return 'text-[#FF3A5F] dark:text-[#FF007A]';
      default:
        return 'text-gray-400 dark:text-gray-300';
    }
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
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 ${getTypeStyles()} text-white rounded-t-2xl`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-semibold">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-700 dark:text-gray-300">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl transition-colors font-semibold cursor-pointer"
            >
              <div className="flex items-center justify-center gap-2">
                <XIcon className="w-5 h-5" />
                {cancelText}
              </div>
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 px-4 py-3 ${
                type === 'danger'
                  ? 'bg-red-400 hover:bg-red-500'
                  : type === 'warning'
                  ? 'bg-orange-400 hover:bg-orange-500'
                  : type === 'brand'
                  ? 'bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:from-[#FF3A5F] hover:to-[#FF007A] hover:opacity-90'
                  : 'bg-blue-400 hover:bg-blue-500'
              } text-white rounded-xl transition-colors font-semibold cursor-pointer`}
            >
              <div className="flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                {confirmText}
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
