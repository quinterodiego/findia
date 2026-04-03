'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, CheckCircle, XCircle, DollarSign, User, Trash2, CheckCircle2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import type { SharedExpense } from '@/types';

interface SharedExpenseCardProps {
  sharedExpense: SharedExpense;
  currentUserId: string;
  onAccept?: (id: string) => Promise<void> | void;
  onReject?: (id: string) => Promise<void> | void;
  onCancel?: (id: string) => Promise<void> | void;
  onConfirmCancel?: (id: string) => Promise<void> | void;
  onRejectCancel?: (id: string) => Promise<void> | void;
  onSettle?: (id: string) => Promise<void> | void;
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
  onSettle,
  formatCurrency,
}: SharedExpenseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = sharedExpense.ownerUserId === currentUserId;
  const isPartner = sharedExpense.sharedWithUserId === currentUserId;
  const isPending = sharedExpense.status === 'pending';
  const isAccepted = sharedExpense.status === 'accepted';
  const isRejected = sharedExpense.status === 'rejected';
  const isCancellationRequested = sharedExpense.status === 'cancellation_requested';
  const isSettled = sharedExpense.isSettled === true;

  // Determinar qué monto mostrar
  const myAmount = isOwner ? sharedExpense.ownerAmount : sharedExpense.partnerAmount;
  const partnerAmount = isOwner ? sharedExpense.partnerAmount : sharedExpense.ownerAmount;
  const otherUser = isOwner ? sharedExpense.partner : sharedExpense.owner;

  // Colores suaves según estado (opacity-20 en fondos)
  const getStatusColors = () => {
    if (isPending) {
      return {
        bg: 'bg-yellow-50/50 dark:bg-yellow-950/5',
        border: 'border-yellow-200/50 dark:border-yellow-900/20',
        badge: 'bg-yellow-100/80 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      };
    }
    if (isAccepted) {
      return {
        bg: 'bg-green-50/50 dark:bg-green-950/5',
        border: 'border-green-200/50 dark:border-green-900/20',
        badge: 'bg-green-100/80 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      };
    }
    if (isRejected) {
      return {
        bg: 'bg-red-50/50 dark:bg-red-950/5',
        border: 'border-red-200/50 dark:border-red-900/20',
        badge: 'bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      };
    }
    if (isCancellationRequested) {
      return {
        bg: 'bg-orange-50/50 dark:bg-orange-950/5',
        border: 'border-orange-200/50 dark:border-orange-900/20',
        badge: 'bg-orange-100/80 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
      };
    }
    return {
      bg: 'bg-white dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    };
  };

  const statusColors = getStatusColors();

  const getStatusText = () => {
    if (isPending) return 'Pendiente';
    if (isAccepted) return 'Aceptado';
    if (isRejected) return 'Rechazado';
    if (isCancellationRequested) return 'Cancelación Solicitada';
    if (isSettled) return 'Saldado';
    return '';
  };

  const withSubmit = (fn: () => Promise<void> | void) => async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await fn();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = withSubmit(async () => {
    if (onAccept && isPending && isPartner) await onAccept(sharedExpense.id);
  });

  const handleReject = withSubmit(async () => {
    if (onReject && isPending && isPartner) await onReject(sharedExpense.id);
  });

  const handleCancel = withSubmit(async () => {
    if (onCancel && isOwner && (isPending || isAccepted)) await onCancel(sharedExpense.id);
  });

  const handleConfirmCancel = withSubmit(async () => {
    if (onConfirmCancel && isCancellationRequested && isPartner) await onConfirmCancel(sharedExpense.id);
  });

  const handleRejectCancel = withSubmit(async () => {
    if (onRejectCancel && isCancellationRequested && isPartner) await onRejectCancel(sharedExpense.id);
  });

  const handleSettle = withSubmit(async () => {
    if (onSettle && isAccepted && !isSettled) await onSettle(sharedExpense.id);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-lg p-2.5 transition-all ${statusColors.bg} ${statusColors.border}`}
    >
      {/* Header súper compacto - siempre visible */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Primera línea: Nombre + Monto */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
              {sharedExpense.expense?.name || 'Gasto compartido'}
            </h4>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
              {formatCurrency(myAmount)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">(Tu parte)</span>
          </div>

          {/* Segunda línea: Estado · Persona · Fecha */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${statusColors.badge}`}>
              {getStatusText()}
            </span>
            <span className="text-gray-400">·</span>
            <span className="truncate">{otherUser?.name || otherUser?.email || 'Usuario'}</span>
            {sharedExpense.expense && (
              <>
                <span className="text-gray-400">·</span>
                <span>{new Date(sharedExpense.expense.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Botón para expandir/colapsar - más compacto */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full mt-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3 h-3" />
            <span>Ocultar detalle</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            <span>Mostrar detalle</span>
          </>
        )}
      </button>

      {/* Contenido expandible */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 pt-2.5 border-t border-gray-200/50 dark:border-gray-700 space-y-2.5">
              {/* Desglose súper compacto - lista con bullets */}
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">•</span>
                  <span>Total: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(sharedExpense.ownerAmount + sharedExpense.partnerAmount)}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">•</span>
                  <span>{isOwner ? 'Tu parte' : 'Pago original'}: <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(sharedExpense.ownerAmount)}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">•</span>
                  <span>{isOwner ? 'Compañero' : 'Tu parte'}: <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(sharedExpense.partnerAmount)}</span></span>
                </div>
              </div>

              {/* Notas */}
              {sharedExpense.notes && (
                <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>Nota: <span className="italic">"{sharedExpense.notes}"</span></span>
                </div>
              )}

              {/* Mensaje cuando está saldado */}
              {isSettled && (
                <div className="flex items-start gap-1.5 text-xs text-blue-700 dark:text-blue-400">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    {isOwner 
                      ? `${otherUser?.name || otherUser?.email || 'Tu compañero'} ya pagó su parte de ${formatCurrency(partnerAmount)}`
                      : `Ya pagaste tu parte de ${formatCurrency(partnerAmount)}`}
                    {sharedExpense.settledAt && (
                      <span className="ml-1 text-gray-500">
                        ({new Date(sharedExpense.settledAt).toLocaleDateString('es-AR')})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Botones de acción - menos invasivos, más compactos */}
              <div className="flex flex-wrap gap-2 pt-2">
                {/* Botones para pendientes recibidos */}
                {isPending && isPartner && onAccept && onReject && (
                  <>
                    <button
                      onClick={handleAccept}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs font-medium"
                    >
                      {isSubmitting ? '...' : 'Aceptar'}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded text-xs font-medium"
                    >
                      Rechazar
                    </button>
                  </>
                )}

                {/* Botones para solicitud de cancelación */}
                {isCancellationRequested && isPartner && onConfirmCancel && onRejectCancel && (
                  <>
                    <button
                      onClick={handleConfirmCancel}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded text-xs font-medium"
                    >
                      {isSubmitting ? '...' : 'Confirmar Cancelación'}
                    </button>
                    <button
                      onClick={handleRejectCancel}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 rounded text-xs font-medium"
                    >
                      Rechazar Cancelación
                    </button>
                  </>
                )}

                {/* Botón de cancelar para owner (solo pendiente) */}
                {isOwner && isPending && onCancel && (
                  <button
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 rounded text-xs font-medium"
                  >
                    Cancelar
                  </button>
                )}

                {/* Botones para gastos aceptados */}
                {isAccepted && !isSettled && (
                  <>
                    {isOwner && onCancel && (
                      <button
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 rounded text-xs font-medium"
                      >
                        Solicitar Cancelación
                      </button>
                    )}
                    {onSettle && (
                      <button
                        onClick={handleSettle}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 rounded text-xs font-medium"
                      >
                        {isSubmitting ? '...' : 'Marcar como Saldado'}
                      </button>
                    )}
                  </>
                )}

                {/* Estado para owner - cancelación solicitada */}
                {isCancellationRequested && isOwner && (
                  <div className="px-2.5 py-1 bg-orange-50/50 dark:bg-orange-900/20 rounded border border-orange-200/50 dark:border-orange-800">
                    <div className="flex items-center gap-1.5 text-xs text-orange-700 dark:text-orange-400">
                      <Clock className="w-3 h-3" />
                      <span>Esperando confirmación de {otherUser?.name || otherUser?.email || 'el usuario'}</span>
                    </div>
                  </div>
                )}

                {/* Estado para owner - pendiente */}
                {isPending && isOwner && !onCancel && (
                  <div className="px-2.5 py-1 bg-yellow-50/50 dark:bg-yellow-900/20 rounded border border-yellow-200/50 dark:border-yellow-800">
                    <div className="flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-400">
                      <Clock className="w-3 h-3" />
                      <span>Esperando respuesta de {otherUser?.name || otherUser?.email || 'el usuario'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Fecha de creación - más compacta */}
              {(isAccepted && sharedExpense.acceptedAt) || (isRejected && sharedExpense.rejectedAt) || isPending ? (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200/50 dark:border-gray-700">
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
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
