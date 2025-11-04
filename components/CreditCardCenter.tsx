'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CreditCard, 
  TrendingDown, 
  Target, 
  Calculator, 
  BarChart3, 
  AlertCircle,
  CheckCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  Sparkles,
  Clock,
  Percent,
  Zap,
  Trophy,
  Info,
  Play,
  ChevronRight,
  Wallet,
  Edit2,
  Trash2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
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
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan[]>([]);
  const [progressHistory, setProgressHistory] = useState<Array<{ date: string; totalDebt: number; paid: number }>>([]);
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
  
  const { success, error } = useToastContext();
  const { cards, loading, fetchCards, createCard, updateCard, deleteCard, makePayment, fetchPayments } = useCreditCards();
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
  const [quickForm, setQuickForm] = useState({
    name: '',
    bank: '',
    last4: '',
    limit: '',
  });

  const handleQuickCreate = async () => {
    try {
      if (!quickForm.name || !quickForm.bank || !quickForm.limit) {
        error('Completa nombre, banco y límite');
        return;
      }
      await createCard({
        name: quickForm.name,
        bank: quickForm.bank,
        cardNumber: quickForm.last4 ? `**** **** **** ${quickForm.last4}` : '**** **** **** ****',
        limit: Number(quickForm.limit),
        currentBalance: 0, // Se actualizará al importar el PDF
        cutDate: 1, // Se actualizará al importar el PDF
        paymentDate: 1, // Se actualizará al importar el PDF
        interestRate: 0, // Se actualizará al importar el PDF
        status: 'active',
      } as any);
      success('Tarjeta creada. Importa un resumen PDF para completar los datos.');
      setShowQuickAdd(false);
      setQuickForm({ name: '', bank: '', last4: '', limit: '' });
      fetchCards();
    } catch (e) {
      error('No se pudo crear la tarjeta');
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
          console.log(`Deuda "${debt.name}" puede ser una tarjeta de crédito. Balance: ${debt.balance}`);
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

  // Cargar historial de progreso para gráficos
  const loadProgressHistory = useCallback(async () => {
    try {
      // Obtener pagos de todas las tarjetas para construir historial
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
        } catch (err) {
          console.log(`Error cargando pagos de tarjeta ${card.id}:`, err);
        }
      }
      
      // Ordenar por fecha y construir historial acumulado
      allPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let totalPaid = 0;
      const initialDebt = cards.reduce((sum, c) => sum + c.currentBalance, 0);
      
      const history = allPayments.map(payment => {
        totalPaid += payment.amount;
        return {
          date: payment.date,
          totalDebt: Math.max(0, initialDebt - totalPaid),
          paid: totalPaid,
        };
      });
      
      // Agregar punto inicial si no hay historial
      if (history.length === 0 && cards.length > 0) {
        history.push({
          date: new Date().toISOString(),
          totalDebt: initialDebt,
          paid: 0,
        });
      }
      
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

    // Calcular tiempos e intereses (simplificado)
    const totalDebt = cards.reduce((sum, c) => sum + c.currentBalance, 0);
    const avgInterest = cards.reduce((sum, c) => sum + c.interestRate, 0) / cards.length;
    const monthlyPayment = totalDebt * 0.1; // 10% del total como ejemplo

    const snowballMonths = Math.ceil(totalDebt / monthlyPayment);
    const avalancheMonths = Math.ceil(totalDebt / (monthlyPayment * 1.05)); // Ligeramente más rápido

    const strategies: PaymentStrategy[] = [
      {
        type: 'snowball',
        name: 'Método Bola de Nieve',
        description: 'Paga primero la deuda más pequeña para generar impulso psicológico',
        priority: snowballPriority.map(p => p.priority),
        totalMonths: snowballMonths,
        totalInterest: (totalDebt * avgInterest * snowballMonths) / 100,
        monthlyPayment: monthlyPayment,
        savings: 0
      },
      {
        type: 'avalanche',
        name: 'Método Avalancha',
        description: 'Paga primero la tarjeta con mayor tasa de interés para ahorrar más dinero',
        priority: avalanchePriority.map(p => p.priority),
        totalMonths: avalancheMonths,
        totalInterest: (totalDebt * avgInterest * avalancheMonths) / 100 * 0.95,
        monthlyPayment: monthlyPayment * 1.05,
        savings: (totalDebt * avgInterest * snowballMonths) / 100 - (totalDebt * avgInterest * avalancheMonths) / 100 * 0.95
      }
    ];

    // Auto-seleccionar la mejor estrategia (avalancha si ahorra dinero)
    const bestStrategy = strategies[1].savings > 0 ? strategies[1] : strategies[0];
    setSelectedStrategy(bestStrategy);
  };

  const generatePaymentPlan = (strategy: PaymentStrategy) => {
    if (!strategy || cards.length === 0) return;

    const plan: PaymentPlan[] = [];
    const cardCopies = cards.map(c => ({ ...c, remainingBalance: c.currentBalance }));
    const priorityOrder = strategy.type === 'snowball'
      ? [...cardCopies].sort((a, b) => a.currentBalance - b.currentBalance)
      : [...cardCopies].sort((a, b) => b.interestRate - a.interestRate);

    let month = 1;
    const monthlyTotal = strategy.monthlyPayment;

    while (cardCopies.some(c => c.remainingBalance > 0) && month <= 36) {
      let remainingPayment = monthlyTotal;

      for (const card of priorityOrder) {
        if (card.remainingBalance <= 0) continue;
        if (remainingPayment <= 0) break;

        const interestPayment = (card.remainingBalance * card.interestRate) / 100;
        const principalPayment = Math.min(remainingPayment - interestPayment, card.remainingBalance);

        card.remainingBalance -= principalPayment;
        remainingPayment -= (principalPayment + interestPayment);

        plan.push({
          month,
          date: new Date(new Date().getFullYear(), new Date().getMonth() + month - 1, card.paymentDate).toISOString(),
          cardId: card.id,
          cardName: card.name,
          paymentAmount: principalPayment + interestPayment,
          remainingBalance: card.remainingBalance,
          interestPaid: interestPayment,
          principalPaid: principalPayment
        });
      }

      month++;
    }

    setPaymentPlan(plan);
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
            
            const consumptionDate = new Date(year, month - 1, day);
            
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

  const tabs = [
    { id: 'overview' as TabType, label: 'Vista General', icon: BarChart3 },
    { id: 'strategies' as TabType, label: 'Estrategias', icon: Target },
    { id: 'plan' as TabType, label: 'Plan de Pago', icon: Calendar },
    { id: 'calculator' as TabType, label: 'Calculadora', icon: Calculator },
    { id: 'progress' as TabType, label: 'Progreso', icon: TrendingUp },
    { id: 'projection' as TabType, label: 'Proyección', icon: TrendingUp }
  ];

  const totalDebt = cards.reduce((sum, card) => sum + card.currentBalance, 0);
  const totalLimit = cards.reduce((sum, card) => sum + card.limit, 0);
  const utilizationRate = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;
  const avgInterestRate = cards.length > 0
    ? cards.reduce((sum, card) => sum + card.interestRate, 0) / cards.length
    : 0;

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
          <div className="bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] text-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Wallet className="w-6 h-6" />
                <div>
                  <h2 className="text-2xl font-bold">Centro de Control de Tarjetas</h2>
                  <p className="text-blue-100 text-sm">Gestiona tus tarjetas y sal de deudas inteligentemente</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap
                      ${activeTab === tab.id
                        ? 'bg-white text-blue-600 font-semibold'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                      }
                      cursor-pointer
                    `}
                  >
                    <Icon className="w-4 h-4" />
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
                    <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-red-600 dark:text-red-400 font-medium">Deuda Total</span>
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      </div>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                        {formatCurrency(totalDebt)}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Utilización</span>
                        <Percent className="w-5 h-5 text-blue-500" />
                      </div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {utilizationRate.toFixed(1)}%
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Tasa Promedio</span>
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                      </div>
                      <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                        {avgInterestRate.toFixed(2)}%
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">Tarjetas</span>
                        <CreditCard className="w-5 h-5 text-green-500" />
                      </div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {cards.length}
                      </p>
                    </div>
                  </div>

                  {/* Lista de tarjetas */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Tus Tarjetas de Crédito
                    </h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Administra y agrega nuevas tarjetas.</p>
                      <button
                        onClick={() => setShowQuickAdd(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                      >
                        + Nueva Tarjeta
                      </button>
                    </div>
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
                                <CreditCard className="w-5 h-5 text-blue-500" />
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
                          <div className="mt-3 flex gap-2 flex-wrap">
                            <button onClick={() => setEditingCard(card)} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer text-sm flex items-center gap-1">
                              <Edit2 className="w-3 h-3" />
                              Editar
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm(`¿Estás seguro de que deseas eliminar la tarjeta "${card.name}"? Esta acción eliminará también todos sus consumos, pagos y plantillas relacionados.`)) {
                                  try {
                                    await deleteCard(card.id);
                                    success('Tarjeta eliminada exitosamente');
                                  } catch (err: any) {
                                    error(err?.message || 'Error al eliminar tarjeta');
                                  }
                                }
                              }}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer text-sm flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Eliminar
                            </button>
                            <button onClick={() => setShowImport({ open: true, cardId: card.id })} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer text-sm">Importar PDF</button>
                            <button onClick={() => setShowConsumptions(card)} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer text-sm flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Ver Consumos
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                      Elige la mejor estrategia para ti. Compara ambos métodos y ve cuál te conviene más.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        {
                          type: 'snowball',
                          name: 'Método Bola de Nieve',
                          description: 'Paga primero la deuda más pequeña. Genera impulso psicológico al ver progreso rápido.',
                          icon: Target,
                          color: 'from-blue-500 to-cyan-500',
                          pros: ['Motivación rápida', 'Fácil de seguir', 'Ver resultados pronto'],
                          cons: ['Puede costar más en intereses']
                        },
                        {
                          type: 'avalanche',
                          name: 'Método Avalancha',
                          description: 'Paga primero la tarjeta con mayor tasa de interés. Ahorra más dinero en el largo plazo.',
                          icon: TrendingDown,
                          color: 'from-purple-500 to-pink-500',
                          pros: ['Ahorra más intereses', 'Más eficiente financieramente', 'Acaba antes'],
                          cons: ['Menos motivación inicial']
                        }
                      ].map((strategy) => {
                        const Icon = strategy.icon;
                        const strategyData = selectedStrategy && selectedStrategy.type === strategy.type 
                          ? selectedStrategy 
                          : null;
                        
                        return (
                          <div
                            key={strategy.type}
                            className={`bg-gradient-to-br ${strategy.color} rounded-xl p-6 text-white relative overflow-hidden`}
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                            <div className="relative">
                              <div className="flex items-center gap-3 mb-3">
                                <Icon className="w-6 h-6" />
                                <h4 className="text-xl font-bold">{strategy.name}</h4>
                              </div>
                              <p className="text-white/90 mb-4">{strategy.description}</p>

                              {strategyData && (
                                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4">
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <p className="text-white/70">Tiempo estimado</p>
                                      <p className="font-bold text-lg">{strategyData.totalMonths} meses</p>
                                    </div>
                                    <div>
                                      <p className="text-white/70">Intereses totales</p>
                                      <p className="font-bold text-lg">{formatCurrency(strategyData.totalInterest)}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2 mb-4">
                                <p className="font-semibold text-sm">Ventajas:</p>
                                <ul className="space-y-1 text-sm">
                                  {strategy.pros.map((pro, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4" />
                                      {pro}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <button
                                onClick={() => {
                                  if (selectedStrategy && selectedStrategy.type === strategy.type) {
                                    generatePaymentPlan(selectedStrategy);
                                    setActiveTab('plan');
                                  }
                                }}
                                className="w-full bg-white text-gray-900 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center gap-2"
                              >
                                {selectedStrategy?.type === strategy.type ? 'Ver Plan' : 'Aplicar Estrategia'}
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedStrategy && selectedStrategy.savings > 0 && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mt-6">
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <div>
                            <p className="font-semibold text-green-900 dark:text-green-100">
                              Recomendación: Método Avalancha
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Podrías ahorrar {formatCurrency(selectedStrategy.savings)} en intereses
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Tiempo total</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                              {Math.ceil(paymentPlan.length / cards.length)} meses
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Pago mensual</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                              {formatCurrency(selectedStrategy?.monthlyPayment || 0)}
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Estrategia
                        </label>
                        <select
                          value={calculatorData.strategy}
                          onChange={(e) => setCalculatorData({ ...calculatorData, strategy: e.target.value as 'snowball' | 'avalanche' })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white cursor-pointer"
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
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      Seguimiento de Progreso
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      Visualiza tu progreso y celebra tus logros en el camino hacia la libertad financiera.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="font-semibold text-gray-900 dark:text-white">Deuda Pagada</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        ${progressHistory.length > 0 ? formatCurrency(progressHistory[progressHistory.length - 1].paid) : formatCurrency(0)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {progressHistory.length > 0 
                          ? `de ${formatCurrency(progressHistory[0].totalDebt + progressHistory[0].paid)} (${formatCurrency(totalDebt)} actual)`
                          : `de ${formatCurrency(totalDebt)}`
                        }
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-gray-900 dark:text-white">Tiempo Restante</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {selectedStrategy ? `${selectedStrategy.totalMonths} meses` : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">según tu plan actual</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="font-semibold text-gray-900 dark:text-white">Intereses Ahorrados</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                        $0
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">con tu estrategia</p>
                    </div>
                  </div>

                  {/* Gráficos de progreso */}
                  {progressHistory.length > 0 ? (
                    <div className="space-y-6">
                      {/* Gráfico de reducción de deuda */}
                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Evolución de la Deuda
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={progressHistory.map(h => ({
                            date: new Date(h.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
                            deuda: h.totalDebt,
                            pagado: h.paid,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              stroke="#6b7280"
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#6b7280"
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                              formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="deuda" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              name="Deuda Total"
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="pagado" 
                              stroke="#10b981" 
                              strokeWidth={2}
                              name="Pagado"
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Gráfico de distribución por tarjeta */}
                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Distribución de Deuda por Tarjeta
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={cards.filter(c => c.currentBalance > 0).map(c => ({
                                name: c.name,
                                value: c.currentBalance,
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {cards.map((entry, index) => {
                                const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];
                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                              })}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number) => formatCurrency(value)}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6">
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        Los gráficos de progreso se generarán cuando comiences a registrar pagos.
                      </p>
                    </div>
                  )}
                </motion.div>
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
                      <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
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
                              const totalToPayRow = monthKeys.map((idx) => {
                                return previousDebtRow[idx] + monthlyTotalRow[idx];
                              });

                              // Pago del mes (0 por ahora, podría ser configurable)
                              const paymentRow = monthKeys.map(() => 0);

                              // Saldo
                              const balanceRow = monthKeys.map((idx) => {
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
                  <button onClick={() => setShowQuickAdd(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 inline mr-1" />
                    Solo completa los datos generales de la tarjeta. El saldo actual, fecha de cierre, vencimiento e intereses se cargarán automáticamente al importar un resumen PDF.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Nombre de la Tarjeta *</label>
                    <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" placeholder="Ej: Visa Platinum" value={quickForm.name} onChange={(e)=>setQuickForm({...quickForm,name:e.target.value})} />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Banco *</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white cursor-pointer"
                      value={quickForm.bank}
                      onChange={(e)=>setQuickForm({...quickForm,bank:e.target.value})}
                    >
                      <option value="">Selecciona un banco</option>
                      {argentineBanks.map(b=> (
                        <option key={b.code} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Últimos 4 dígitos (opcional)</label>
                    <input maxLength={4} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" placeholder="1234" value={quickForm.last4} onChange={(e)=>setQuickForm({...quickForm,last4:e.target.value.replace(/[^0-9]/g,'')})} />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Límite *</label>
                    <input type="number" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" placeholder="500000" value={quickForm.limit} onChange={(e)=>setQuickForm({...quickForm,limit:e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={()=>setShowQuickAdd(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer">Cancelar</button>
                  <button onClick={handleQuickCreate} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">Crear</button>
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
              } catch (err) {
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
        />
      </div>
    </AnimatePresence>
  );
}



