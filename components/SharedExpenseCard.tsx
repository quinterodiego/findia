'use client';

import { motion } from 'framer-motion';
import { Users, Clock, CheckCircle, XCircle, DollarSign, User, Trash2 } from 'lucide-react';
import type { SharedExpense } from '@/types';

interface SharedExpenseCardProps {
  sharedExpense: SharedExpense;
  currentUserId: string;
  onAccept?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
  onConfirmCancel?: (id: string) => Promise<void>;
  onRejectCancel?: (id: string) => Promise<void>;
  formatCurrency: (amount: number) => string;
}

export default function SharedExpenseCard({
  sharedExpense,
  currentUserId,
  onAccept,
  onReject,
  onCancel,
  onConfirmCancel,
  onRejectCancel,
  formatCurrency,
}: SharedExpenseCardProps) {
  const isOwner = sharedExpense.ownerUserId === currentUserId;
  const isPartner = sharedExpense.sharedWithUserId === currentUserId;
  const isPending = sharedExpense.status === 'pending';
  const isAccepted = sharedExpense.status === 'accepted';
  const isRejected = sharedExpense.status === 'rejected';
  const isCancellationRequested = sharedExpense.status === 'cancellation_requested';

  // Determinar qué monto mostrar
  const myAmount = isOwner ? sharedExpense.ownerAmount : sharedExpense.partnerAmount;
  const partnerAmount = isOwner ? sharedExpense.partnerAmount : sharedExpense.ownerAmount;
  const otherUser = isOwner ? sharedExpense.partner : sharedExpense.owner;

  const handleAccept = async () => {
    if (onAccept && isPending && isPartner) {
      await onAccept(sharedExpense.id);
    }
  };

  const handleReject = async () => {
    if (onReject && isPending && isPartner) {
      await onReject(sharedExpense.id);
    }
  };

  const handleCancel = async () => {
    if (onCancel && isOwner && (isPending || isAccepted)) {
      await onCancel(sharedExpense.id);
    }
  };

  const handleConfirmCancel = async () => {
    if (onConfirmCancel && isCancellationRequested && isPartner) {
      await onConfirmCancel(sharedExpense.id);
    }
  };

  const handleRejectCancel = async () => {
    if (onRejectCancel && isCancellationRequested && isPartner) {
      await onRejectCancel(sharedExpense.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl p-4 transition-all ${
        isPending
          ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10'
          : isAccepted
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
          : isRejected
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
          : isCancellationRequested
          ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Users className={`w-4 h-4 ${
              isPending ? 'text-yellow-600 dark:text-yellow-400' :
              isAccepted ? 'text-green-600 dark:text-green-400' :
              isCancellationRequested ? 'text-orange-600 dark:text-orange-400' :
              'text-red-600 dark:text-red-400'
            }`} />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {sharedExpense.expense?.name || 'Gasto compartido'}
            </h4>
            {isPending && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                Pendiente
              </span>
            )}
            {isAccepted && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                Aceptado
              </span>
            )}
            {isRejected && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                Rechazado
              </span>
            )}
            {isCancellationRequested && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                Cancelación Solicitada
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <User className="w-3 h-3" />
            <span>
              {isOwner ? 'Compartido con' : 'Compartido por'}:{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {otherUser?.name || otherUser?.email || 'Usuario'}
              </span>
            </span>
          </div>

          {sharedExpense.expense && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Fecha: </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(sharedExpense.expense.date).toLocaleDateString('es-AR')}
              </span>
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-600 dark:text-gray-400">Tu parte:</div>
          <div className={`text-lg font-bold ${
            isAccepted ? 'text-green-600 dark:text-green-400' :
            isRejected ? 'text-gray-400 dark:text-gray-500' :
            isCancellationRequested ? 'text-orange-600 dark:text-orange-400' :
            'text-yellow-600 dark:text-yellow-400'
          }`}>
            {formatCurrency(myAmount)}
          </div>
          {isAccepted && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Compañero: {formatCurrency(partnerAmount)}
            </div>
          )}
        </div>
      </div>

      {/* División */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <DollarSign className="w-4 h-4 text-gray-400" />
        <div className="flex-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Total:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(sharedExpense.ownerAmount + sharedExpense.partnerAmount)}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>
              {isOwner ? 'Tu parte' : 'Pago original'}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(sharedExpense.ownerAmount)}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>
              {isOwner ? 'Compañero' : 'Tu parte'}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(sharedExpense.partnerAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Notas */}
      {sharedExpense.notes && (
        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 italic">
            {sharedExpense.notes}
          </p>
        </div>
      )}

      {/* Botones de acción (solo para pendientes recibidos) */}
      {isPending && isPartner && onAccept && onReject && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleAccept}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            Aceptar
          </button>
          <button
            onClick={handleReject}
            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <XCircle className="w-4 h-4" />
            Rechazar
          </button>
        </div>
      )}

      {/* Botones para solicitud de cancelación - Partner puede confirmar o rechazar */}
      {isCancellationRequested && isPartner && onConfirmCancel && onRejectCancel && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleConfirmCancel}
            className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar Cancelación
          </button>
          <button
            onClick={handleRejectCancel}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <XCircle className="w-4 h-4" />
            Rechazar Cancelación
          </button>
        </div>
      )}

      {/* Estado para owner - cancelación solicitada, esperando confirmación */}
      {isCancellationRequested && isOwner && (
        <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400">
            <Clock className="w-3 h-3" />
            <span>Esperando confirmación de cancelación de {otherUser?.name || otherUser?.email || 'el usuario'}</span>
          </div>
        </div>
      )}

      {/* Botón de cancelar para el owner (solo pendiente, aceptado ya tiene su propio flujo) */}
      {isOwner && isPending && onCancel && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      )}

      {/* Botón de solicitar cancelación para el owner (solo aceptado) */}
      {isOwner && isAccepted && onCancel && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Solicitar Cancelación
          </button>
        </div>
      )}

      {/* Estado para gastos enviados */}
      {isPending && isOwner && !onCancel && (
        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
            <Clock className="w-3 h-3" />
            <span>Esperando respuesta de {otherUser?.name || otherUser?.email || 'el usuario'}</span>
          </div>
        </div>
      )}

      {/* Fecha de creación */}
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {isAccepted && sharedExpense.acceptedAt && (
          <span>Aceptado el {new Date(sharedExpense.acceptedAt).toLocaleDateString('es-AR')}</span>
        )}
        {isRejected && sharedExpense.rejectedAt && (
          <span>Rechazado el {new Date(sharedExpense.rejectedAt).toLocaleDateString('es-AR')}</span>
        )}
        {isPending && (
          <span>Compartido el {new Date(sharedExpense.createdAt).toLocaleDateString('es-AR')}</span>
        )}
      </div>
    </motion.div>
  );
}

