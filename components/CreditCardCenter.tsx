'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CreditCard as CreditCardIcon,
  TrendingDown,
  Target,
  Calculator,
  BarChart3,
  CheckCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  Sparkles,
  Percent,
  Info,
  ChevronRight,
  Wallet,
  Edit2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { useToastContext } from '@/components/Toast';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useDebts } from '@/hooks/useDebts';
import type { CreditCard } from '@/types';
import { argentineBanks } from '@/lib/argentineBanks';
import { formatCurrency, formatNumber } from '@/lib/formatNumber';
import CreditCardStatementImport from './CreditCardStatementImport';
import CreditCardConsumptionModal from './CreditCardConsumptionModal';
import EditCardModal from './EditCardModal';
import CreditCardProjectionModal from './CreditCardProjectionModal';
import CreditCardProgress from './CreditCardProgress';

interface PaymentStrategy {
  type: 'snowball' | 'avalanche';
  name: string;
  description: string;
  priority: number[];
  totalMonths: number;
  totalInterest: number;
  monthlyPayment: number;
  savings: number;
}

interface PaymentPlan {
  month: number;
  date: string;
  cardId: string;
  cardName: string;
  paymentAmount: number;
  remainingBalance: number;
  interestPaid: number;
  principalPaid: number;
}

interface DebtSimulationResult {
  schedule: PaymentPlan[];
  totalMonths: number;
  totalInterest: number;
  finalDate: string | null;
  /** false si el presupuesto no alcanza para reducir la deuda (el saldo no baja) o si se llegó al tope de meses sin saldar. */
  isViable: boolean;
}

/** Redondea a centavos para evitar arrastre de error de punto flotante. */
const roundToCents = (value: number): number => Math.round(value * 100) / 100;

/**
 * Motor único de simulación de pago de deuda mes a mes. Lo usan tanto
 * calculateStrategies() (para comparar Bola de Nieve vs Avalancha) como
 * generatePaymentPlan() (para el cronograma detallado de "Ver plan"), de modo
 * que ambas pantallas reporten exactamente los mismos meses e intereses.
 *
 * Reutiliza tal cual la lógica de reparto de presupuesto y transferencia entre
 * tarjetas que ya existía (orden de prioridad, "for" con remainingPayment
 * decreciente); solo se le agrega redondeo monetario y un piso en 0 para el
 * capital pagado, para que un presupuesto insuficiente no pueda generar un
 * pago de capital negativo (que aumentaría el saldo en vez de reducirlo).
 */
function simulateDebtPayoff(
  cardsToSimulate: CreditCard[],
  strategyType: 'snowball' | 'avalanche',
  monthlyBudget: number
): DebtSimulationResult {
  if (cardsToSimulate.length === 0 || monthlyBudget <= 0) {
    return { schedule: [], totalMonths: 0, totalInterest: 0, finalDate: null, isViable: false };
  }

  const schedule: PaymentPlan[] = [];
  const cardCopies = cardsToSimulate.map(c => ({ ...c, remainingBalance: c.currentBalance }));
  const priorityOrder = strategyType === 'snowball'
    ? [...cardCopies].sort((a, b) => a.currentBalance - b.currentBalance)
    : [...cardCopies].sort((a, b) => b.interestRate - a.interestRate);

  let month = 1;
  let totalInterest = 0;
  // Protección anti-loop: si el saldo total no baja durante 2 meses seguidos
  // (el presupuesto no alcanza ni para cubrir el interés devengado), cortamos
  // la simulación en vez de dejarla "crecer" indefinidamente hasta el tope de 36 meses.
  let stagnantMonths = 0;
  const MAX_STAGNANT_MONTHS = 2;

  while (cardCopies.some(c => c.remainingBalance > 0) && month <= 36) {
    const totalBalanceBeforeMonth = roundToCents(cardCopies.reduce((sum, c) => sum + c.remainingBalance, 0));
    let remainingPayment = monthlyBudget;

    for (const card of priorityOrder) {
      if (card.remainingBalance <= 0) continue;
      if (remainingPayment <= 0) break;

      // El presupuesto restante es un techo real: nunca se paga más de lo disponible.
      // El interés que no llega a cubrirse se capitaliza (se suma al saldo) en vez de descartarse.
      const available = remainingPayment;
      const interestDue = roundToCents((card.remainingBalance * card.interestRate) / 100);
      const interestPayment = roundToCents(Math.min(interestDue, available));
      const availableForPrincipal = roundToCents(available - interestPayment);
      const principalPayment = roundToCents(Math.max(0, Math.min(availableForPrincipal, card.remainingBalance)));
      const unpaidInterest = roundToCents(interestDue - interestPayment);

      card.remainingBalance = roundToCents(card.remainingBalance - principalPayment + unpaidInterest);
      if (card.remainingBalance < 0.01) card.remainingBalance = 0; // limpia residuos de redondeo

      remainingPayment = Math.max(0, roundToCents(remainingPayment - (principalPayment + interestPayment)));
      totalInterest += interestPayment;

      schedule.push({
        month,
        date: new Date(new Date().getFullYear(), new Date().getMonth() + month - 1, card.paymentDate).toISOString(),
        cardId: card.id,
        cardName: card.name,
        paymentAmount: roundToCents(principalPayment + interestPayment),
        remainingBalance: card.remainingBalance,
        interestPaid: interestPayment,
        principalPaid: principalPayment,
      });
    }

    const totalBalanceAfterMonth = roundToCents(cardCopies.reduce((sum, c) => sum + c.remainingBalance, 0));
    if (totalBalanceAfterMonth >= totalBalanceBeforeMonth - 0.01) {
      stagnantMonths++;
      if (stagnantMonths >= MAX_STAGNANT_MONTHS) break; // el aporte no alcanza para reducir el saldo: cortamos, no tiene sentido seguir
    } else {
      stagnantMonths = 0;
    }

    month++;
  }

  const lastEntry = schedule[schedule.length - 1];
  // Viable únicamente si terminó porque las tarjetas quedaron efectivamente en $0,
  // no porque se cortó por estancamiento o se llegó al tope de 36 meses sin saldar.
  const isViable = cardCopies.every(c => c.remainingBalance === 0);

  return {
    schedule,
    totalMonths: lastEntry ? lastEntry.month : 0,
    totalInterest: roundToCents(totalInterest),
    finalDate: lastEntry ? lastEntry.date : null,
    isViable,
  };
}

interface CreditCardCenterProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: any[];
  subcategories?: any[];
}

type TabType = 'overview' | 'strategies' | 'plan' | 'calculator' | 'progress' | 'projection';

export default function CreditCardCenter({
  isOpen,
  onClose,
  categories = [],
  subcategories = []
}: CreditCardCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedStrategy, setSelectedStrategy] = useState<PaymentStrategy | null>(null);
  // Guarda el resultado calculado de AMBAS estrategias (no solo la recomendada),
  // para poder comparar Bola de Nieve vs Avalancha una al lado de la otra.
  const [strategyResults, setStrategyResults] = useState<PaymentStrategy[]>([]);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan[]>([]);
  // Plan original (presupuesto real de la estrategia elegida) vs. plan simulado
  // con un aporte mensual distinto que el usuario está probando. `paymentPlan`
  // siempre refleja el que está activo/visible (base o simulado).
  const [basePlan, setBasePlan] = useState<DebtSimulationResult | null>(null);
  const [simulatedPlan, setSimulatedPlan] = useState<DebtSimulationResult | null>(null);
  const [simulatedBudget, setSimulatedBudget] = useState(''); // dígitos crudos, mismo patrón que quickForm.limit
  const [simulationWarning, setSimulationWarning] = useState<string | null>(null);
  const [progressHistory, setProgressHistory] = useState<Array<{ date: string; totalDebt: number; paid: number; isInitial?: boolean }>>([]);
  const [projections, setProjections] = useState<Array<{
    month: number;
    monthName: string;
    year: number;
    cardId: string;
    cardName: string;
    initialBalance: number;
    installmentsDue: number;
    interest: number;
    finalBalance: number;
    installmentsDetail: Array<{ merchant: string; amount: number; installment: string }>;
  }>>([]);
  const [loadingProjections, setLoadingProjections] = useState(false);
  
  // Detectar si es móvil
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint de Tailwind
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const { success, error } = useToastContext();
  const { cards, loading, fetchCards, createCard, updateCard, deleteCard, fetchPayments } = useCreditCards();
  const { debts, fetchDebts } = useDebts();

  // Calculadora state
  const [calculatorData, setCalculatorData] = useState({
    totalDebt: '',
    availableForPayments: '',
    strategy: 'snowball' as 'snowball' | 'avalanche',
    includeInterests: true
  });

  // Quick add card modal state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showImport, setShowImport] = useState<{ open: boolean; cardId?: string }>({ open: false });
  const [showConsumptions, setShowConsumptions] = useState<CreditCard | null>(null);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [showProjection, setShowProjection] = useState(false);
  const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState({
    name: '',
    bank: '',
    last4: '',
    limit: '',
    cutDate: '',
    paymentDate: '',
    interestRate: '',
  });
  const [quickCreating, setQuickCreating] = useState(false);
  const [showBillingFields, setShowBillingFields] = useState(false);

  const handleQuickCreate = async () => {
    if (quickCreating) return;
    try {
      setQuickCreating(true);
      if (!quickForm.name || !quickForm.bank || !quickForm.limit) {
        error('Completa nombre, banco y límite');
        return;
      }
      await createCard({
        name: quickForm.name,
        bank: quickForm.bank,
        cardNumber: quickForm.last4 ? `**** **** **** ${quickForm.last4}` : '**** **** **** ****',
        limit: Number(quickForm.limit),
        currentBalance: 0, // Se actualizará al importar el PDF o registrar consumos/pagos
        // Datos de facturación: se usan si el usuario los cargó manualmente; si no,
        // quedan en estos valores por defecto y se pueden completar después (manualmente o importando el PDF)
        cutDate: quickForm.cutDate ? Number(quickForm.cutDate) : 1,
        paymentDate: quickForm.paymentDate ? Number(quickForm.paymentDate) : 1,
        interestRate: quickForm.interestRate ? Number(quickForm.interestRate.replace(',', '.')) : 0,
        status: 'active',
      } as any);
      success('Tarjeta creada correctamente.');
      setShowQuickAdd(false);
      setShowBillingFields(false);
      setQuickForm({ name: '', bank: '', last4: '', limit: '', cutDate: '', paymentDate: '', interestRate: '' });
      fetchCards();
    } catch {
      error('No se pudo crear la tarjeta');
    } finally {
      setQuickCreating(false);
    }
  };

  // Función para sincronizar tarjetas con deudas
  const syncCardsWithDebts = useCallback(async () => {
    try {
      // Buscar deudas que parezcan ser tarjetas de crédito (contienen "tarjeta", "card", etc.)
      const cardDebts = debts.filter(debt => 
        debt.name.toLowerCase().includes('tarjeta') ||
        debt.name.toLowerCase().includes('card') ||
        debt.name.toLowerCase().includes('crédito') ||
        debt.name.toLowerCase().includes('credito')
      );

      for (const debt of cardDebts) {
        // Verificar si ya existe una tarjeta relacionada
        const existingCard = cards.find(c => 
          c.name.toLowerCase() === debt.name.toLowerCase() ||
          (debt.notes && c.name.toLowerCase().includes(debt.name.toLowerCase()))
        );

        if (!existingCard) {
          // Sincronizar: actualizar el balance de la tarjeta desde la deuda más reciente
          // No creamos automáticamente, solo sugerimos al usuario
        } else {
          // Sincronizar balance si la deuda está más actualizada
          if (Math.abs(existingCard.currentBalance - debt.balance) > 100) {
            // Diferencia significativa, actualizar tarjeta
            await updateCard(existingCard.id, {
              currentBalance: debt.balance,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error sincronizando tarjetas con deudas:', err);
    }
  }, [cards, debts, updateCard]);

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Al cerrar el Centro de Control, descartar cualquier simulación de aporte
  // mensual en curso: es solo una prueba, no debe sobrevivir a un cierre/reapertura.
  useEffect(() => {
    if (!isOpen) {
      setSimulatedPlan(null);
      setSimulationWarning(null);
      if (basePlan) {
        setPaymentPlan(basePlan.schedule);
      }
      if (selectedStrategy) {
        setSimulatedBudget(String(Math.round(selectedStrategy.monthlyPayment)));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Cargar proyecciones cuando se selecciona la pestaña de proyección
  useEffect(() => {
    if (activeTab === 'projection' && cards.length > 0 && projections.length === 0) {
      calculateProjections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Cargar tarjetas al abrir
  useEffect(() => {
    if (isOpen) {
      fetchCards();
      fetchDebts(); // Sincronizar con deudas
    }
  }, [isOpen]);

  // Sincronizar tarjetas con deudas: convertir deudas de tarjetas a tarjetas si no existen
  useEffect(() => {
    if (cards.length > 0 && debts.length > 0 && isOpen) {
      syncCardsWithDebts();
    }
  }, [cards, debts, isOpen, syncCardsWithDebts]);

  // Cargar historial cuando cambian las tarjetas o hay pagos
  useEffect(() => {
    if (cards.length > 0 && isOpen) {
      loadProgressHistory();
    }
  }, [cards, isOpen]);

  // Calcular estrategias cuando cambian las tarjetas
  useEffect(() => {
    if (cards.length > 0) {
      calculateStrategies();
    }
  }, [cards]);

  // Cargar historial de progreso para gráficos.
  //
  // Reconstrucción: currentBalance ya viene NETO de los pagos reales (createCreditCardPayment
  // lo descuenta al registrar cada pago), así que la deuda ANTES de esos pagos se puede
  // recuperar como currentDebt + totalPayments (nunca restando totalPayments de currentDebt,
  // que era el bug anterior: doble descuento).
  //
  // Límite conocido: esto asume que currentBalance solo cambió por pagos reales. Si en el medio
  // se editó el saldo manualmente (EditCardModal) o se sincronizó con una Deuda vinculada
  // (syncCardsWithDebts), esta reconstrucción no lo puede detectar y el "initialDebt" resultante
  // puede no ser el 100% histórico real. Corregirlo de raíz requiere persistir un saldo inicial
  // (startingBalance) — fuera de alcance por ahora.
  const loadProgressHistory = useCallback(async () => {
    try {
      const allPayments: { date: string; amount: number; cardId: string }[] = [];

      for (const card of cards) {
        try {
          const cardPayments = await fetchPayments(card.id);
          cardPayments.forEach(payment => {
            allPayments.push({
              date: payment.date,
              amount: payment.amount,
              cardId: card.id,
            });
          });
        } catch {
        }
      }

      if (allPayments.length === 0) {
        // Sin pagos reales: no se genera ningún punto sintético. El empty state lo maneja la UI.
        setProgressHistory([]);
        return;
      }

      const currentDebt = cards.reduce((sum, c) => sum + c.currentBalance, 0);
      const totalPayments = allPayments.reduce((sum, p) => sum + p.amount, 0);
      const initialDebt = currentDebt + totalPayments;

      // Agrupar por fecha CALENDARIO: si hubo varios pagos el mismo día, se consolidan en
      // un único punto con el acumulado del día (evita puntos superpuestos en X en el gráfico).
      const paymentsByDate = new Map<string, number>();
      allPayments.forEach(payment => {
        const dayKey = new Date(payment.date).toISOString().slice(0, 10);
        paymentsByDate.set(dayKey, (paymentsByDate.get(dayKey) || 0) + payment.amount);
      });
      const sortedDates = Array.from(paymentsByDate.keys()).sort();

      const history: Array<{ date: string; totalDebt: number; paid: number; isInitial?: boolean }> = [];

      // Punto inicial (antes del primer pago), solo a efectos de visualización — no es un
      // evento real registrado. Se marca con isInitial para que el gráfico lo muestre como
      // "Inicio" en vez de una fecha, sin confundirlo con un pago real de ese mismo día.
      history.push({ date: sortedDates[0], totalDebt: initialDebt, paid: 0, isInitial: true });

      let acumulatedPaid = 0;
      sortedDates.forEach(dayKey => {
        acumulatedPaid += paymentsByDate.get(dayKey) as number;
        history.push({
          date: dayKey,
          totalDebt: Math.max(0, initialDebt - acumulatedPaid),
          paid: acumulatedPaid,
        });
      });

      setProgressHistory(history);
    } catch (err) {
      console.error('Error cargando historial de progreso:', err);
    }
  }, [cards, fetchPayments]);

  const calculateStrategies = () => {
    if (cards.length === 0) return;

    const sortedByBalance = [...cards].sort((a, b) => a.currentBalance - b.currentBalance);
    const sortedByRate = [...cards].sort((a, b) => b.interestRate - a.interestRate);

    // Calcular método bola de nieve (deuda menor primero)
    const snowballPriority = sortedByBalance.map((c, i) => ({
      cardId: c.id,
      priority: i + 1
    }));

    // Calcular método avalancha (tasa mayor primero)
    const avalanchePriority = sortedByRate.map((c, i) => ({
      cardId: c.id,
      priority: i + 1
    }));

    const totalDebt = cards.reduce((sum, c) => sum + c.currentBalance, 0);
    // Presupuesto mensual estimado (mismo supuesto de siempre: 10% de la deuda total).
    // Se usa EL MISMO monto para ambas estrategias: la comparación snowball vs avalancha
    // debe reflejar únicamente el efecto de PRIORIZAR distinto, no un presupuesto distinto.
    const monthlyPayment = totalDebt * 0.1;

    // Tiempo e intereses reales de cada estrategia: misma simulación mes a mes
    // que usa "Ver plan" (simulateDebtPayoff), no una fórmula agregada aparte.
    const snowballSim = simulateDebtPayoff(cards, 'snowball', monthlyPayment);
    const avalancheSim = simulateDebtPayoff(cards, 'avalanche', monthlyPayment);

    const strategies: PaymentStrategy[] = [
      {
        type: 'snowball',
        name: 'Método Bola de Nieve',
        description: 'Paga primero la deuda más pequeña para generar impulso psicológico',
        priority: snowballPriority.map(p => p.priority),
        totalMonths: snowballSim.totalMonths,
        totalInterest: snowballSim.totalInterest,
        monthlyPayment,
        savings: 0
      },
      {
        type: 'avalanche',
        name: 'Método Avalancha',
        description: 'Paga primero la tarjeta con mayor tasa de interés para ahorrar más dinero',
        priority: avalanchePriority.map(p => p.priority),
        totalMonths: avalancheSim.totalMonths,
        totalInterest: avalancheSim.totalInterest,
        monthlyPayment,
        savings: roundToCents(snowballSim.totalInterest - avalancheSim.totalInterest)
      }
    ];

    setStrategyResults(strategies);

    // Auto-seleccionar la mejor estrategia (avalancha si ahorra dinero)
    const bestStrategy = strategies[1].savings > 0 ? strategies[1] : strategies[0];
    setSelectedStrategy(bestStrategy);
  };

  const generatePaymentPlan = (strategy: PaymentStrategy) => {
    if (!strategy || cards.length === 0) return;

    // Mismo motor que calculateStrategies(): mismas tarjetas, misma estrategia,
    // mismo presupuesto mensual → mismo resultado que ya se mostró en Estrategias.
    const result = simulateDebtPayoff(cards, strategy.type, strategy.monthlyPayment);
    setPaymentPlan(result.schedule);
    setBasePlan(result);
    // Un plan nuevo (o un cambio de estrategia) invalida cualquier simulación previa.
    setSimulatedPlan(null);
    setSimulationWarning(null);
    setSimulatedBudget(String(Math.round(strategy.monthlyPayment)));
  };

  // Si ya existía un Plan de pago generado y los saldos reales cambian (ej. se registró un
  // pago real en la pantalla de Pagos y se volvió a abrir el Centro de Control), ese
  // cronograma quedó calculado con saldos viejos. `selectedStrategy` ya se recalcula solo
  // cuando cambian las tarjetas (ver el efecto de calculateStrategies más arriba), así que
  // alcanza con re-generar el plan cada vez que esa estrategia recalculada cambia — sin
  // volver a leer `cards` acá ni duplicar simulateDebtPayoff(). Si nunca se generó un plan
  // (basePlan === null), no se crea uno artificialmente solo porque cambiaron las tarjetas.
  useEffect(() => {
    if (basePlan && selectedStrategy) {
      generatePaymentPlan(selectedStrategy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStrategy]);

  // Simula el MISMO motor (simulateDebtPayoff) con la estrategia ya elegida pero un
  // presupuesto mensual distinto, para responder "¿qué pasa si pongo más/menos dinero?"
  // sin persistir nada: solo actualiza el cronograma mostrado en Plan de pago.
  const handleSimulateBudget = () => {
    if (!selectedStrategy || cards.length === 0 || !basePlan) return;

    const budget = Number(simulatedBudget);
    if (!simulatedBudget || Number.isNaN(budget) || budget <= 0) {
      setSimulationWarning('Ingresá un monto mensual válido, mayor a $0.');
      return;
    }

    const result = simulateDebtPayoff(cards, selectedStrategy.type, budget);

    if (!result.isViable) {
      setSimulationWarning('Con este monto mensual la deuda no logra reducirse. Probá con un aporte mayor.');
      return; // no se toca el plan que ya está mostrado
    }

    setSimulationWarning(null);
    setPaymentPlan(result.schedule);

    // Si el monto simulado coincide con el presupuesto base, no es una simulación
    // "distinta": mostramos ese mismo resultado pero sin comparación ni "Restablecer".
    const isSameAsBase = roundToCents(budget) === roundToCents(selectedStrategy.monthlyPayment);
    setSimulatedPlan(isSameAsBase ? null : result);
  };

  const handleResetSimulation = () => {
    if (!basePlan || !selectedStrategy) return;
    setSimulatedPlan(null);
    setSimulationWarning(null);
    setPaymentPlan(basePlan.schedule);
    setSimulatedBudget(String(Math.round(selectedStrategy.monthlyPayment)));
  };

  // Función para calcular proyección mensual basada en cuotas pendientes
  const calculateProjections = useCallback(async () => {
    if (cards.length === 0) {
      return;
    }

    setLoadingProjections(true);
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const allProjections: Array<{
      month: number;
      monthName: string;
      year: number;
      cardId: string;
      cardName: string;
      initialBalance: number;
      installmentsDue: number;
      interest: number;
      finalBalance: number;
      installmentsDetail: Array<{ merchant: string; amount: number; installment: string }>;
    }> = [];

    try {

      // Calcular proyección para los próximos 12 meses
      for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
        const targetMonth = (currentMonth + monthOffset) % 12;
        const targetYear = currentYear + Math.floor((currentMonth + monthOffset) / 12);
        
        // Para cada tarjeta
        for (const card of cards) {
          // Obtener consumos de la tarjeta
          const response = await fetch(`/api/credit-cards/${card.id}/consumptions`);
          const data = await response.json();
          const consumptions = Array.isArray(data.consumptions) ? data.consumptions : [];

          // Calcular saldo inicial (para el primer mes es el currentBalance, para los siguientes se calcula)
          let initialBalance = monthOffset === 0 ? card.currentBalance : 0;
          
          // Si no es el primer mes, calcular el saldo inicial basándose en la proyección anterior
          if (monthOffset > 0) {
            const previousMonthProjection = allProjections.find(
              p => p.cardId === card.id && 
              p.month === (targetMonth - 1 >= 0 ? targetMonth - 1 : 11) &&
              p.year === (targetMonth - 1 >= 0 ? targetYear : targetYear - 1)
            );
            if (previousMonthProjection) {
              initialBalance = previousMonthProjection.finalBalance;
            } else {
              // Si no hay proyección anterior, usar el saldo actual
              initialBalance = card.currentBalance;
            }
          }

          // Calcular qué cuotas vencen este mes
          const installmentsDetail: Array<{ merchant: string; amount: number; installment: string }> = [];
          let totalInstallmentsDue = 0;

          for (const consumption of consumptions) {
            // Parsear fecha del consumo (formato dd/mm/yyyy)
            const [day, month, year] = (consumption.date || '').split('/').map(Number);
            if (!day || !month || !year) continue;
            
            // Calcular cuántas cuotas han pasado desde el consumo hasta el mes objetivo
            const monthsSinceConsumption = (targetYear - year) * 12 + (targetMonth - (month - 1));
            
            // Si el consumo es anterior o en el mismo mes que el objetivo
            if (monthsSinceConsumption >= 0 && monthsSinceConsumption < consumption.installments) {
              const installmentNumber = monthsSinceConsumption + 1;
              
              // Verificar que esta cuota aún no se haya pagado completamente
              if (installmentNumber > consumption.currentInstallment) {
                // Esta cuota vence este mes (o debería vencer cerca del día de pago)
                installmentsDetail.push({
                  merchant: consumption.merchant || 'Consumo',
                  amount: consumption.monthlyPayment || 0,
                  installment: `${installmentNumber}/${consumption.installments}`
                });
                totalInstallmentsDue += consumption.monthlyPayment || 0;
              }
            }
          }

          // Calcular intereses sobre el saldo inicial
          const interest = (initialBalance * card.interestRate) / 100;

          // Calcular saldo final = saldo inicial + intereses + cuotas del mes
          const finalBalance = initialBalance + interest + totalInstallmentsDue;

          allProjections.push({
            month: targetMonth + 1,
            monthName: monthNames[targetMonth],
            year: targetYear,
            cardId: card.id,
            cardName: card.name,
            initialBalance,
            installmentsDue: totalInstallmentsDue,
            interest,
            finalBalance,
            installmentsDetail
          });
        }
      }

      setProjections(allProjections);
    } catch (err) {
      console.error('Error calculando proyecciones:', err);
      if (error) {
        error('Error al calcular proyecciones');
      }
    } finally {
      setLoadingProjections(false);
    }
  }, [cards, error]);

  // Calculadora y Proyección ya tienen accesos propios desde el menú principal
  // del dashboard (InterestCalculatorModal / CreditCardProjectionModal), así que
  // se quitan de esta navegación interna sin eliminar sus componentes ni lógica.
  const tabs = [
    { id: 'overview' as TabType, label: 'Resumen', icon: BarChart3 },
    { id: 'strategies' as TabType, label: 'Estrategias', icon: Target },
    { id: 'plan' as TabType, label: 'Plan de pago', icon: Calendar },
    { id: 'progress' as TabType, label: 'Progreso', icon: TrendingUp },
  ];

  const totalDebt = cards.reduce((sum, card) => sum + card.currentBalance, 0);
  const totalLimit = cards.reduce((sum, card) => sum + card.limit, 0);
  const utilizationRate = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;
  const avgInterestRate = cards.length > 0
    ? cards.reduce((sum, card) => sum + card.interestRate, 0) / cards.length
    : 0;

  // Presupuesto mensual que realmente generó el cronograma que se está mostrando
  // (el simulado si hay uno aplicado, si no el de la estrategia elegida).
  const activeMonthlyBudget = simulatedPlan
    ? (Number(simulatedBudget) || 0)
    : (selectedStrategy?.monthlyPayment ?? 0);

  // Comparación del plan simulado contra el plan base (nunca contra una simulación previa).
  const monthsSaved = basePlan && simulatedPlan ? basePlan.totalMonths - simulatedPlan.totalMonths : 0;
  const interestSaved = basePlan && simulatedPlan
    ? roundToCents(basePlan.totalInterest - simulatedPlan.totalInterest)
    : 0;

  // Copy corto para mostrar junto a las métricas: "5 meses antes · Ahorrás $X en intereses".
  const simulationIsNegative = monthsSaved < 0 || interestSaved < 0;
  const simulationComparisonText = [
    monthsSaved !== 0
      ? (monthsSaved > 0
        ? `${monthsSaved} ${monthsSaved === 1 ? 'mes' : 'meses'} antes`
        : `${Math.abs(monthsSaved)} ${Math.abs(monthsSaved) === 1 ? 'mes' : 'meses'} más`)
      : null,
    interestSaved !== 0
      ? (interestSaved > 0
        ? `Ahorrás ${formatCurrency(Math.round(interestSaved), { maximumFractionDigits: 0 })} en intereses`
        : `Pagarías ${formatCurrency(Math.round(Math.abs(interestSaved)), { maximumFractionDigits: 0 })} más en intereses`)
      : null,
  ].filter(Boolean).join(' · ');

  // Validación de los campos opcionales de "Datos de facturación" (solo visual/UX,
  // no cambia qué se envía a createCard: los valores vacíos siguen usando los mismos defaults de siempre)
  const getDayRangeError = (value: string): string | null => {
    if (!value) return null;
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 31) {
      return 'Ingresá un valor entre 1 y 31';
    }
    return null;
  };
  const getInterestRateError = (value: string): string | null => {
    if (!value) return null;
    const num = Number(value.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      return 'Ingresá un valor válido (0 o mayor)';
    }
    return null;
  };
  const cutDateError = getDayRangeError(quickForm.cutDate);
  const paymentDateError = getDayRangeError(quickForm.paymentDate);
  const interestRateError = getInterestRateError(quickForm.interestRate);

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
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${isMobile ? 'p-3' : 'p-6'}`}>
            {isMobile ? (
              // Layout vertical para móvil
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="p-1.5 bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] rounded-lg shrink-0">
                      <Wallet className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">Centro de Control</h2>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-tight">Gestiona tus tarjetas y sal de deudas inteligentemente</p>
              </div>
            ) : (
              // Layout horizontal para desktop
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] rounded-lg">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Centro de Control de Tarjetas</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Gestiona tus tarjetas y sal de deudas inteligentemente</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className={`flex ${isMobile ? 'gap-1' : 'gap-2'} overflow-x-auto ${isMobile ? '-mx-3 px-3' : ''}`}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center ${isMobile ? 'gap-1.5 px-2.5 py-1.5 text-xs' : 'gap-2 px-4 py-2'} rounded-lg transition-colors whitespace-nowrap
                      ${activeTab === tab.id
                        ? 'bg-[#FF3A5F] text-white font-semibold'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }
                      cursor-pointer
                    `}
                  >
                    <Icon className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Métricas principales */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Deuda Total</span>
                        <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center shrink-0">
                          <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-red-500 dark:text-red-400">
                        {formatCurrency(totalDebt)}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Utilización</span>
                        <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                          <Percent className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">
                        {utilizationRate.toFixed(1)}%
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Tasa Promedio</span>
                        <div className="w-9 h-9 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-orange-500 dark:text-orange-400">
                        {avgInterestRate.toFixed(2)}%
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Tarjetas</span>
                        <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center shrink-0">
                          <CreditCardIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-green-500 dark:text-green-400">
                        {cards.length}
                      </p>
                    </div>
                  </div>

                  {/* Lista de tarjetas */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Tus Tarjetas de Crédito
                      </h3>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Administra y agrega nuevas tarjetas.</p>
                        <button
                          onClick={() => setShowQuickAdd(true)}
                          className="px-4 py-2 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 text-white rounded-lg transition-all cursor-pointer"
                        >
                          + Nueva Tarjeta
                        </button>
                      </div>
                    </div>
                    <div className="space-y-4">
                    {cards.map((card) => {
                      const utilization = (card.currentBalance / card.limit) * 100;
                      return (
                        <div
                          key={card.id}
                          className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <CreditCardIcon className="w-5 h-5 text-blue-500" />
                                <h4 className="font-semibold text-gray-900 dark:text-white">{card.name}</h4>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{card.bank}</span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300">{card.cardNumber}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500 dark:text-gray-400">Deuda actual</p>
                              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                                {formatCurrency(card.currentBalance)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                de {formatCurrency(card.limit)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-300">Utilización</span>
                              <span className={`
                                font-semibold
                                ${utilization > 80 ? 'text-red-500' : utilization > 50 ? 'text-orange-500' : 'text-green-500'}
                              `}>
                                {utilization.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div
                                className={`
                                  h-2 rounded-full transition-all
                                  ${utilization > 80 ? 'bg-red-500' : utilization > 50 ? 'bg-orange-500' : 'bg-green-500'}
                                `}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                              <span>Corte: día {card.cutDate}</span>
                              <span>Pago: día {card.paymentDate}</span>
                              <span>Interés: {card.interestRate}%</span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => setShowConsumptions(card)}
                              className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 text-white rounded-lg transition-all cursor-pointer text-sm font-semibold flex items-center justify-center gap-1.5"
                            >
                              <DollarSign className="w-4 h-4" />
                              Ver consumos
                            </button>
                            <button
                              onClick={() => setShowImport({ open: true, cardId: card.id })}
                              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors cursor-pointer text-sm"
                            >
                              Importar PDF
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setOpenMenuCardId(openMenuCardId === card.id ? null : card.id)}
                                aria-label="Más acciones"
                                className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {openMenuCardId === card.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuCardId(null)} />
                                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
                                    <button
                                      onClick={() => {
                                        setOpenMenuCardId(null);
                                        setEditingCard(card);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      Editar
                                    </button>
                                    <button
                                      onClick={async () => {
                                        setOpenMenuCardId(null);
                                        if (confirm(`¿Estás seguro de que deseas eliminar la tarjeta "${card.name}"? Esta acción eliminará también todos sus consumos, pagos y plantillas relacionados.`)) {
                                          try {
                                            await deleteCard(card.id);
                                            success('Tarjeta eliminada exitosamente');
                                          } catch (err: any) {
                                            error(err?.message || 'Error al eliminar tarjeta');
                                          }
                                        }
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Eliminar
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'strategies' && (
                <motion.div
                  key="strategies"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      Estrategias de Pago
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      Comparás las estrategias y elegís cómo querés organizar el pago de tus deudas.
                    </p>

                    {(() => {
                      const STRATEGY_META = [
                        {
                          type: 'snowball' as const,
                          name: 'Método Bola de Nieve',
                          shortName: 'Bola de Nieve',
                          shortDescription: 'Prioriza primero la deuda con menor saldo para generar avances más rápidos.',
                          icon: Target,
                          accent: 'blue' as const,
                          pros: ['Motivación rápida', 'Resultados visibles pronto'],
                        },
                        {
                          type: 'avalanche' as const,
                          name: 'Método Avalancha',
                          shortName: 'Avalancha',
                          shortDescription: 'Prioriza primero la deuda con mayor tasa para reducir el costo total de intereses.',
                          icon: TrendingDown,
                          accent: 'purple' as const,
                          pros: ['Menor costo en intereses'],
                        },
                      ];

                      const accentClasses = {
                        blue: {
                          icon: 'text-blue-500 dark:text-blue-400',
                          iconBg: 'bg-blue-50 dark:bg-blue-900/20',
                          value: 'text-blue-600 dark:text-blue-400',
                        },
                        purple: {
                          icon: 'text-purple-500 dark:text-purple-400',
                          iconBg: 'bg-purple-50 dark:bg-purple-900/20',
                          value: 'text-purple-600 dark:text-purple-400',
                        },
                      };

                      const snowballData = strategyResults.find(s => s.type === 'snowball');
                      const avalancheData = strategyResults.find(s => s.type === 'avalanche');
                      const hasComparison = !!snowballData && !!avalancheData;

                      const recommendedType: 'snowball' | 'avalanche' | null = hasComparison
                        ? (avalancheData!.savings > 0 ? 'avalanche' : 'snowball')
                        : null;
                      const recommendedMeta = STRATEGY_META.find(m => m.type === recommendedType);
                      const recommendedData = hasComparison
                        ? (recommendedType === 'avalanche' ? avalancheData! : snowballData!)
                        : null;
                      const otherMeta = STRATEGY_META.find(m => m.type !== recommendedType);
                      const otherData = hasComparison
                        ? (recommendedType === 'avalanche' ? snowballData! : avalancheData!)
                        : null;

                      const interestDifference = recommendedData && otherData
                        ? Math.abs(otherData.totalInterest - recommendedData.totalInterest)
                        : 0;
                      const monthsDifference = recommendedData && otherData
                        ? otherData.totalMonths - recommendedData.totalMonths
                        : 0;

                      return (
                        <>
                          {recommendedMeta && interestDifference > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center shrink-0">
                                  <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                  <p className="font-semibold text-green-900 dark:text-green-100">
                                    FindIA recomienda: {recommendedMeta.name}
                                  </p>
                                  <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                                    Con tus deudas actuales, esta estrategia podría ahorrarte {formatCurrency(interestDifference)} en intereses frente a {otherMeta?.name}
                                    {monthsDifference > 0 && ` y terminar ${monthsDifference} ${monthsDifference === 1 ? 'mes' : 'meses'} antes`}
                                    {monthsDifference < 0 && ` aunque tarda ${Math.abs(monthsDifference)} ${Math.abs(monthsDifference) === 1 ? 'mes' : 'meses'} más`}.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {STRATEGY_META.map((meta) => {
                              const Icon = meta.icon;
                              const data = strategyResults.find(s => s.type === meta.type);
                              const other = strategyResults.find(s => s.type !== meta.type);
                              const otherMetaForCard = STRATEGY_META.find(m => m.type !== meta.type);
                              const isRecommended = recommendedType === meta.type;
                              const accent = accentClasses[meta.accent];
                              const diff = data && other ? Math.abs(data.totalInterest - other.totalInterest) : null;
                              const isCheaper = data && other ? data.totalInterest <= other.totalInterest : null;

                              return (
                                <div
                                  key={meta.type}
                                  className={`bg-white dark:bg-gray-800 rounded-xl p-6 border relative ${
                                    isRecommended
                                      ? 'border-green-300 dark:border-green-700 ring-1 ring-green-100 dark:ring-green-900/30'
                                      : 'border-gray-200 dark:border-gray-700'
                                  }`}
                                >
                                  {isRecommended && (
                                    <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                                      <Sparkles className="w-3 h-3" />
                                      Recomendada
                                    </span>
                                  )}

                                  <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${accent.iconBg}`}>
                                      <Icon className={`w-5 h-5 ${accent.icon}`} />
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{meta.name}</h4>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{meta.shortDescription}</p>

                                  {data ? (
                                    <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                                      <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Tiempo estimado</p>
                                        <p className="font-bold text-gray-900 dark:text-white">{data.totalMonths} meses</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Intereses totales</p>
                                        <p className={`font-bold ${accent.value}`}>{formatCurrency(data.totalInterest)}</p>
                                      </div>
                                      {diff !== null && diff > 0 && (
                                        <div className="col-span-2">
                                          <p className={`text-xs ${isCheaper ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {isCheaper
                                              ? `Ahorra ${formatCurrency(diff)} frente a ${otherMetaForCard?.shortName}`
                                              : `${formatCurrency(diff)} más en intereses que ${otherMetaForCard?.shortName}`}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Agregá tarjetas con saldo para calcular esta estrategia.</p>
                                    </div>
                                  )}

                                  <ul className="space-y-1.5 mb-4">
                                    {meta.pros.map((pro, i) => (
                                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                        <CheckCircle className={`w-4 h-4 shrink-0 ${accent.icon}`} />
                                        {pro}
                                      </li>
                                    ))}
                                  </ul>

                                  <button
                                    onClick={() => {
                                      if (!data) return;
                                      setSelectedStrategy(data);
                                      generatePaymentPlan(data);
                                      setActiveTab('plan');
                                    }}
                                    disabled={!data}
                                    className="w-full bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 disabled:opacity-50 text-white py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                                  >
                                    Ver plan
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </motion.div>
              )}

              {activeTab === 'plan' && (
                <motion.div
                  key="plan"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Plan de Pago Personalizado
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Tu plan paso a paso para salir de deudas
                      </p>
                    </div>
                    {!selectedStrategy && (
                      <button
                        onClick={() => setActiveTab('strategies')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Elegir Estrategia
                      </button>
                    )}
                  </div>

                  {paymentPlan.length > 0 ? (
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Ajustá tu pago mensual</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
                          Probá cuánto podrías destinar por mes y mirá cómo cambia tu plan.
                        </p>

                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                          <div>
                            <label htmlFor="simulated-monthly-budget" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                              Pago mensual
                            </label>
                            <input
                              id="simulated-monthly-budget"
                              type="text"
                              inputMode="numeric"
                              className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#FF3A5F]/30 focus:border-[#FF3A5F] transition-colors"
                              placeholder="$ 90.000"
                              value={simulatedBudget ? `$ ${formatNumber(Number(simulatedBudget), { maximumFractionDigits: 0 })}` : ''}
                              onChange={(e) => {
                                const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                                setSimulatedBudget(digitsOnly);
                                if (simulationWarning) setSimulationWarning(null);
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleSimulateBudget}
                              disabled={!simulatedBudget || Number(simulatedBudget) <= 0}
                              className="px-4 py-2 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                            >
                              Actualizar plan
                            </button>
                            {simulatedPlan && (
                              <button
                                onClick={handleResetSimulation}
                                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                              >
                                Restablecer
                              </button>
                            )}
                          </div>
                        </div>

                        {simulationWarning && (
                          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                            {simulationWarning}
                          </p>
                        )}
                      </div>

                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                        {simulatedPlan && !simulationWarning && simulationComparisonText && (
                          <div className={`mb-3 flex items-center gap-1.5 text-sm font-medium ${simulationIsNegative ? 'text-gray-700 dark:text-gray-300' : 'text-green-600 dark:text-green-400'}`}>
                            {simulationIsNegative ? <Info className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                            <span>{simulationComparisonText}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Tiempo total</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                              {paymentPlan[paymentPlan.length - 1]?.month ?? 0} meses
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Pago mensual</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                              {formatCurrency(activeMonthlyBudget)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Intereses totales</p>
                            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                              {formatCurrency(paymentPlan.reduce((sum, p) => sum + p.interestPaid, 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Fecha fin</p>
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">
                              {new Date(paymentPlan[paymentPlan.length - 1]?.date || '').toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                            <tr>
                              <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Mes</th>
                              <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Tarjeta</th>
                              <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Pago</th>
                              <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Capital</th>
                              <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Interés</th>
                              <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Restante</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentPlan.map((payment, index) => (
                              <tr key={index} className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-3 text-gray-600 dark:text-gray-300">{payment.month}</td>
                                <td className="p-3 font-medium text-gray-900 dark:text-white">{payment.cardName}</td>
                                <td className="p-3 text-right font-semibold text-gray-900 dark:text-white">
                                  {formatCurrency(payment.paymentAmount)}
                                </td>
                                <td className="p-3 text-right text-green-600 dark:text-green-400">
                                  {formatCurrency(payment.principalPaid)}
                                </td>
                                <td className="p-3 text-right text-orange-600 dark:text-orange-400">
                                  {formatCurrency(payment.interestPaid)}
                                </td>
                                <td className="p-3 text-right text-gray-600 dark:text-gray-300">
                                  {formatCurrency(payment.remainingBalance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-8 text-center">
                      <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        No hay un plan generado aún. Elige una estrategia de pago para ver tu plan personalizado.
                      </p>
                      <button
                        onClick={() => setActiveTab('strategies')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Ver Estrategias
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'calculator' && (
                <motion.div
                  key="calculator"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      Calculadora de Deuda
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      Simula diferentes escenarios y descubre cuánto tiempo necesitas para estar libre de deudas.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6 space-y-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Parámetros</h4>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Deuda Total
                        </label>
                        <input
                          type="number"
                          value={calculatorData.totalDebt}
                          onChange={(e) => setCalculatorData({ ...calculatorData, totalDebt: e.target.value })}
                          placeholder="0"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Disponible para Pagos Mensuales
                        </label>
                        <input
                          type="number"
                          value={calculatorData.availableForPayments}
                          onChange={(e) => setCalculatorData({ ...calculatorData, availableForPayments: e.target.value })}
                          placeholder="0"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label htmlFor="strategy-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Estrategia
                        </label>
                        <select
                          id="strategy-select"
                          value={calculatorData.strategy}
                          onChange={(e) => setCalculatorData({ ...calculatorData, strategy: e.target.value as 'snowball' | 'avalanche' })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white cursor-pointer"
                          aria-label="Estrategia de pago"
                        >
                          <option value="snowball">Bola de Nieve</option>
                          <option value="avalanche">Avalancha</option>
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          if (calculatorData.totalDebt && calculatorData.availableForPayments) {
                            // Calcular y mostrar resultados
                            success('Cálculo realizado');
                          } else {
                            error('Completa todos los campos');
                          }
                        }}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Calculator className="w-5 h-5" />
                        Calcular
                      </button>
                    </div>

                    <div className="bg-gradient-to-br from-[#FF3A5F]/10 to-[#FF007A]/10 dark:from-[#FF3A5F]/20 dark:to-[#FF007A]/20 border border-[#FF3A5F]/20 dark:border-[#FF3A5F]/30 rounded-xl p-6">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Resultados</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                          <span className="text-gray-600 dark:text-gray-300">Tiempo estimado</span>
                          <span className="font-bold text-lg text-gray-900 dark:text-white">-</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                          <span className="text-gray-600 dark:text-gray-300">Intereses totales</span>
                          <span className="font-bold text-lg text-gray-900 dark:text-white">-</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                          <span className="text-gray-600 dark:text-gray-300">Pago total</span>
                          <span className="font-bold text-lg text-gray-900 dark:text-white">-</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'progress' && (
                <CreditCardProgress
                  progressHistory={progressHistory}
                  totalDebt={totalDebt}
                  formatCurrency={formatCurrency}
                />
              )}

              {activeTab === 'projection' && (
                <motion.div
                  key="projection"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {cards.length === 0 ? (
                    <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-12 text-center">
                      <CreditCardIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No tienes tarjetas de crédito registradas
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Agrega al menos una tarjeta de crédito para poder ver la proyección mensual
                      </p>
                      <button
                        onClick={() => setShowQuickAdd(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer font-semibold"
                      >
                        Agregar Primera Tarjeta
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Proyección Mensual Completa
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300">
                            Visualiza cómo evolucionará tu saldo según las cuotas pendientes, intereses y nuevos consumos.
                          </p>
                        </div>
                    <button
                      onClick={() => {
                        if (cards.length === 0) {
                          error('Necesitas al menos una tarjeta de crédito para ver la proyección');
                          return;
                        }
                        setShowProjection(true);
                      }}
                      disabled={cards.length === 0}
                      className={`px-4 py-2 ${
                        cards.length === 0 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700 cursor-pointer'
                      } text-white rounded-lg transition-colors flex items-center gap-2`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      Ver Proyección Completa
                    </button>
                  </div>

                  {loadingProjections ? (
                    <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-12">
                      <p className="text-center text-gray-500 dark:text-gray-400">
                        Calculando proyecciones...
                      </p>
                    </div>
                  ) : projections.length === 0 ? (
                    <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-12">
                      <p className="text-center text-gray-500 dark:text-gray-400">
                        Haz clic en "Recalcular" para generar la proyección mensual basada en tus consumos y cuotas.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-full">
                          <thead>
                            <tr className="bg-green-600 dark:bg-green-700 text-white">
                              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold sticky left-0 z-10 bg-green-600 dark:bg-green-700">
                                TC
                              </th>
                              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold sticky left-[100px] z-10 bg-green-600 dark:bg-green-700">
                                Categoría
                              </th>
                              {Array.from(new Set(projections.map(p => `${p.year}-${p.month}`))).map((monthKey) => {
                                const firstProj = projections.find(p => `${p.year}-${p.month}` === monthKey);
                                return (
                                  <th
                                    key={monthKey}
                                    className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center font-semibold min-w-[120px]"
                                  >
                                    {firstProj?.monthName} {firstProj?.year}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Filas por tarjeta */}
                            {cards.map((card) => {
                              const cardProjections = projections.filter(p => p.cardId === card.id);
                              const monthKeys = Array.from(new Set(projections.map(p => `${p.year}-${p.month}`))).sort();
                              
                              // Deuda anterior (primer mes usa currentBalance, siguientes meses usan saldo anterior)
                              const previousDebtRow = monthKeys.map((monthKey, idx) => {
                                if (idx === 0) {
                                  return card.currentBalance;
                                }
                                const prevMonth = monthKeys[idx - 1];
                                const prevProj = cardProjections.find(p => `${p.year}-${p.month}` === prevMonth);
                                return prevProj?.finalBalance || 0;
                              });

                              // Cuotas del mes
                              const installmentsRow = monthKeys.map((monthKey) => {
                                const proj = cardProjections.find(p => `${p.year}-${p.month}` === monthKey);
                                return proj?.installmentsDue || 0;
                              });

                              // Intereses y Gastos
                              const interestRow = monthKeys.map((monthKey) => {
                                const proj = cardProjections.find(p => `${p.year}-${p.month}` === monthKey);
                                return proj?.interest || 0;
                              });

                              // Consumos del mes (0 por ahora, podría extenderse)
                              const consumptionsRow = monthKeys.map(() => 0);

                              // Gastos Fijos (0 por ahora, podría extenderse)
                              const fixedExpensesRow = monthKeys.map(() => 0);

                              // Total del mes
                              const monthlyTotalRow = monthKeys.map((monthKey, idx) => {
                                return installmentsRow[idx] + interestRow[idx] + consumptionsRow[idx] + fixedExpensesRow[idx];
                              });

                              // Total a Pagar
                              const totalToPayRow = monthKeys.map((_key, idx) => {
                                return previousDebtRow[idx] + monthlyTotalRow[idx];
                              });

                              // Pago del mes (0 por ahora, podría ser configurable)
                              const paymentRow = monthKeys.map(() => 0);

                              // Saldo
                              const balanceRow = monthKeys.map((_key, idx) => {
                                return totalToPayRow[idx] - paymentRow[idx];
                              });

                              return (
                                <React.Fragment key={card.id}>
                                  {/* Nombre de la tarjeta */}
                                  <tr className="bg-green-700 dark:bg-green-800 text-white">
                                    <td colSpan={monthKeys.length + 2} className="px-3 py-2 font-bold">
                                      {card.name}
                                    </td>
                                  </tr>
                                  
                                  {/* Deuda anterior */}
                                  <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                      Deuda anterior
                                    </td>
                                    {previousDebtRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>

                                  {/* Cuotas */}
                                  <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                      Cuotas
                                    </td>
                                    {installmentsRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>

                                  {/* Gastos Fijos */}
                                  <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                      Gastos Fijos
                                    </td>
                                    {fixedExpensesRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>

                                  {/* Consumos del mes */}
                                  <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                      Consumos del mes
                                    </td>
                                    {consumptionsRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>

                                  {/* Intereses y Gastos */}
                                  <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                      Intereses y Gastos
                                    </td>
                                    {interestRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>

                                  {/* Total del mes */}
                                  <tr className="bg-green-100 dark:bg-green-900/30">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-green-100 dark:bg-green-900/30 font-semibold"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-green-100 dark:bg-green-900/30 font-semibold">
                                      Total del mes
                                    </td>
                                    {monthlyTotalRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right font-semibold"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>

                                  {/* Total a Pagar */}
                                  <tr className="bg-green-100 dark:bg-green-900/30">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-green-100 dark:bg-green-900/30 font-semibold"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-green-100 dark:bg-green-900/30 font-semibold">
                                      Total a Pagar
                                    </td>
                                    {totalToPayRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right font-semibold"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>

                                  {/* Pago del mes */}
                                  <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                      Pago del mes
                                    </td>
                                    {paymentRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>

                                  {/* Saldo */}
                                  <tr className="bg-green-100 dark:bg-green-900/30">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-green-100 dark:bg-green-900/30 font-semibold"></td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-[100px] z-10 bg-green-100 dark:bg-green-900/30 font-semibold">
                                      Saldo
                                    </td>
                                    {balanceRow.map((amount, idx) => (
                                      <td
                                        key={idx}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right font-semibold"
                                      >
                                        {formatCurrency(amount)}
                                      </td>
                                    ))}
                                  </tr>
                                </React.Fragment>
                              );
                            })}

                            {/* Posición Global */}
                            <tr className="bg-green-600 dark:bg-green-700 text-white font-bold">
                              <td colSpan={2} className="border border-gray-300 dark:border-gray-600 px-3 py-2 sticky left-0 z-10 bg-green-600 dark:bg-green-700">
                                Posición Global
                              </td>
                              {Array.from(new Set(projections.map(p => `${p.year}-${p.month}`))).sort().map((monthKey, idx) => {
                                // Calcular el saldo global sumando todos los saldos de todas las tarjetas
                                const monthProjections = projections.filter(p => `${p.year}-${p.month}` === monthKey);
                                const totalBalance = cards.reduce((sum, card) => {
                                  const cardProj = monthProjections.find(p => p.cardId === card.id);
                                  if (!cardProj) return sum;
                                  
                                  // Calcular saldo de esta tarjeta para este mes
                                  const prevMonth = idx === 0 ? null : Array.from(new Set(projections.map(p => `${p.year}-${p.month}`))).sort()[idx - 1];
                                  let prevBalance = 0;
                                  if (idx === 0) {
                                    prevBalance = card.currentBalance;
                                  } else if (prevMonth) {
                                    const prevProj = projections.find(p => 
                                      p.cardId === card.id && 
                                      `${p.year}-${p.month}` === prevMonth
                                    );
                                    prevBalance = prevProj ? prevProj.finalBalance : card.currentBalance;
                                  }
                                  
                                  const totalToPay = prevBalance + (cardProj.installmentsDue || 0) + (cardProj.interest || 0);
                                  const payment = 0; // Por ahora sin pagos
                                  return sum + (totalToPay - payment);
                                }, 0);
                                
                                return (
                                  <td
                                    key={monthKey}
                                    className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right"
                                  >
                                    {formatCurrency(totalBalance)}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        {/* Quick Add Modal */}
        <AnimatePresence>
          {showQuickAdd && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 flex items-center justify-center p-4"
              onClick={() => setShowQuickAdd(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Nueva Tarjeta</h4>
                  <button onClick={() => setShowQuickAdd(false)} aria-label="Cerrar" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 inline mr-1" />
                    Ingresá los datos básicos de tu tarjeta. Después podés completar la información de facturación manualmente o importando tu resumen.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="quick-form-name" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Nombre de la Tarjeta *</label>
                    <input id="quick-form-name" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" placeholder="Ej: Visa Platinum" value={quickForm.name} onChange={(e)=>setQuickForm({...quickForm,name:e.target.value})} />
                  </div>

                  <div>
                    <label htmlFor="quick-form-bank-select" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Banco *</label>
                    <select
                      id="quick-form-bank-select"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white cursor-pointer"
                      value={quickForm.bank}
                      onChange={(e)=>setQuickForm({...quickForm,bank:e.target.value})}
                      aria-label="Seleccionar banco"
                    >
                      <option value="">Selecciona un banco</option>
                      {argentineBanks.map(b=> (
                        <option key={b.code} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quick-form-last4" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Últimos 4 dígitos (opcional)</label>
                    <input id="quick-form-last4" maxLength={4} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" placeholder="1234" value={quickForm.last4} onChange={(e)=>setQuickForm({...quickForm,last4:e.target.value.replace(/[^0-9]/g,'')})} />
                  </div>

                  <div>
                    <label htmlFor="quick-form-limit" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Límite *</label>
                    <input
                      id="quick-form-limit"
                      type="text"
                      inputMode="numeric"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      placeholder="$ 500.000"
                      value={quickForm.limit ? `$ ${formatNumber(Number(quickForm.limit), { maximumFractionDigits: 0 })}` : ''}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                        setQuickForm({ ...quickForm, limit: digitsOnly });
                      }}
                    />
                  </div>
                </div>

                {/* Datos de facturación (opcional) */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {!showBillingFields ? (
                    <button
                      type="button"
                      onClick={() => setShowBillingFields(true)}
                      className="text-sm text-[#FF3A5F] hover:text-[#FF007A] font-medium cursor-pointer"
                    >
                      + Agregar datos de facturación (opcional)
                    </button>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Datos de facturación (opcional)</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="quick-form-cutdate" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Día de cierre</label>
                          <input
                            id="quick-form-cutdate"
                            type="text"
                            inputMode="numeric"
                            className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white ${
                              cutDateError
                                ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/30'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                            placeholder="Ej: 15"
                            value={quickForm.cutDate}
                            onChange={(e) => setQuickForm({ ...quickForm, cutDate: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                          />
                          {cutDateError && (
                            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{cutDateError}</p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="quick-form-paymentdate" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Día de vencimiento</label>
                          <input
                            id="quick-form-paymentdate"
                            type="text"
                            inputMode="numeric"
                            className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white ${
                              paymentDateError
                                ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/30'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                            placeholder="Ej: 25"
                            value={quickForm.paymentDate}
                            onChange={(e) => setQuickForm({ ...quickForm, paymentDate: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                          />
                          {paymentDateError && (
                            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{paymentDateError}</p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="quick-form-interestrate" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Tasa de interés mensual</label>
                          <div className="relative">
                            <input
                              id="quick-form-interestrate"
                              type="text"
                              inputMode="decimal"
                              className={`w-full pl-3 pr-7 py-2 border rounded-lg dark:bg-gray-800 dark:text-white ${
                                interestRateError
                                  ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/30'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                              placeholder="Ej: 8,5"
                              value={quickForm.interestRate}
                              onChange={(e) => {
                                let v = e.target.value.replace(/[^0-9,]/g, '');
                                const parts = v.split(',');
                                if (parts.length > 2) {
                                  v = parts[0] + ',' + parts.slice(1).join('');
                                }
                                setQuickForm({ ...quickForm, interestRate: v });
                              }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none">%</span>
                          </div>
                          {interestRateError && (
                            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{interestRateError}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={()=>setShowQuickAdd(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer">Cancelar</button>
                  <button onClick={handleQuickCreate} disabled={quickCreating} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 disabled:opacity-50 text-white cursor-pointer">{quickCreating ? 'Creando...' : 'Crear'}</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Importar Resumen */}
        <CreditCardStatementImport isOpen={showImport.open} onClose={() => setShowImport({ open: false })} cardId={showImport.cardId || ''} />
        
        {/* Modal de edición de tarjeta */}
        {editingCard && (
          <EditCardModal
            card={editingCard}
            onClose={() => setEditingCard(null)}
            onSave={async (updatedData) => {
              try {
                await updateCard(editingCard.id, updatedData);
                success('Tarjeta actualizada exitosamente');
                setEditingCard(null);
                await fetchCards(); // Recargar tarjetas
              } catch {
                error('Error al actualizar tarjeta');
              }
            }}
          />
        )}

        {/* Modal de Consumos */}
        <CreditCardConsumptionModal
          isOpen={!!showConsumptions}
          onClose={() => setShowConsumptions(null)}
          selectedCard={showConsumptions}
          categories={categories}
          subcategories={subcategories}
        />

        {/* Modal de Proyección Independiente */}
        <CreditCardProjectionModal
          isOpen={showProjection}
          onClose={() => setShowProjection(false)}
          cards={cards}
          loading={loading}
          onCreateCard={() => setShowQuickAdd(true)}
        />
      </div>
    </AnimatePresence>
  );
}



