'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Calendar,
  Target,
  Award,
  Clock,
  Zap
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Debt } from '@/types';

interface AnalyticsDashboardProps {
  debts: Debt[];
  className?: string;
}

const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  gradient: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ debts, className = '' }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'3m' | '6m' | '12m' | 'all'>('6m');

  // Cálculos principales adaptados a la estructura existente
  const analytics = useMemo(() => {
    const totalOriginalDebt = debts.reduce((sum, debt) => sum + debt.originalAmount, 0);
    const totalCurrentDebt = debts.reduce((sum, debt) => sum + debt.currentAmount, 0);
    const totalPaid = totalOriginalDebt - totalCurrentDebt;
    const progressPercentage = totalOriginalDebt > 0 ? (totalPaid / totalOriginalDebt) * 100 : 0;
    
    // Simular datos de progreso mensual basado en las fechas de creación
    const now = new Date();
    let startDate: Date;
    
    switch (selectedTimeRange) {
      case '3m':
        startDate = subMonths(now, 3);
        break;
      case '6m':
        startDate = subMonths(now, 6);
        break;
      case '12m':
        startDate = subMonths(now, 12);
        break;
      default:
        startDate = debts.length > 0 ? new Date(debts[0].createdAt) : subMonths(now, 6);
    }

    // Generar datos simulados de progreso mensual
    const monthlyProgress = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(now)
    }).map((month, index) => {
      const monthStr = format(month, 'yyyy-MM');
      const monthProgress = Math.min(progressPercentage, (index + 1) * (progressPercentage / 6));
      const monthlyPaid = index === 0 ? totalPaid * 0.1 : totalPaid * 0.15;
      
      return {
        month: format(month, 'MMM yyyy', { locale: es }),
        monthKey: monthStr,
        totalPaid: monthlyPaid,
        remainingDebt: Math.max(0, totalOriginalDebt - (totalPaid * (index + 1) / 6)),
        cumulativePaid: totalPaid * (index + 1) / 6,
        progressPercentage: monthProgress
      };
    });

    // Distribución por categorías
    const categoryData = debts.reduce((acc: Record<string, { total: number; paid: number; remaining: number }>, debt) => {
      const category = debt.category || 'Otros';
      const paid = debt.originalAmount - debt.currentAmount;
      
      if (!acc[category]) {
        acc[category] = { total: 0, paid: 0, remaining: 0 };
      }
      
      acc[category].total += debt.originalAmount;
      acc[category].paid += paid;
      acc[category].remaining += debt.currentAmount;
      
      return acc;
    }, {});

    const categoryChartData = Object.entries(categoryData).map(([category, data]) => ({
      category,
      total: data.total,
      paid: data.paid,
      remaining: data.remaining,
      percentage: data.total > 0 ? (data.paid / data.total) * 100 : 0
    }));

    // Distribución por tipo de deuda
    const typeData = debts.reduce((acc: Record<string, number>, debt) => {
      const typeLabels = {
        credit_card: 'Tarjeta de Crédito',
        loan: 'Préstamo',
        mortgage: 'Hipoteca',
        other: 'Otros'
      };
      
      const type = typeLabels[debt.type] || 'Otros';
      acc[type] = (acc[type] || 0) + debt.currentAmount;
      return acc;
    }, {});

    const typeChartData = Object.entries(typeData).map(([type, amount]) => ({
      type,
      amount,
      percentage: totalCurrentDebt > 0 ? (amount / totalCurrentDebt) * 100 : 0
    }));

    // Estimaciones
    const averageMonthlyPayment = totalPaid / 6; // Asumiendo 6 meses de datos
    const monthsToFinish = averageMonthlyPayment > 0 ? Math.ceil(totalCurrentDebt / averageMonthlyPayment) : 0;
    const projectedFinishDate = monthsToFinish > 0 
      ? new Date(now.getTime() + monthsToFinish * 30 * 24 * 60 * 60 * 1000)
      : null;

    return {
      totalOriginalDebt,
      totalCurrentDebt,
      totalPaid,
      progressPercentage,
      monthlyProgress,
      categoryChartData,
      typeChartData,
      averageMonthlyPayment,
      monthsToFinish,
      projectedFinishDate,
      debtCount: debts.length,
      activeDebts: debts.filter(debt => debt.currentAmount > 0).length
    };
  }, [debts, selectedTimeRange]);

  return (
    <motion.div
      className={`space-y-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <TrendingUp className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" />
            Analytics Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Análisis detallado de tu progreso financiero
          </p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[
            { key: '3m', label: '3M' },
            { key: '6m', label: '6M' },
            { key: '12m', label: '1A' },
            { key: 'all', label: 'Todo' }
          ].map((range) => (
            <button
              key={range.key}
              onClick={() => setSelectedTimeRange(range.key as '3m' | '6m' | '12m' | 'all')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all cursor-pointer ${
                selectedTimeRange === range.key
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Pagado</p>
              <p className="text-2xl font-bold">
                ${analytics.totalPaid.toLocaleString()}
              </p>
              <p className="text-blue-100 text-xs mt-1">
                {analytics.progressPercentage.toFixed(1)}% completado
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-200" />
          </div>
        </motion.div>

        <motion.div
          className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Deuda Restante</p>
              <p className="text-2xl font-bold">
                ${analytics.totalCurrentDebt.toLocaleString()}
              </p>
              <p className="text-green-100 text-xs mt-1">
                {analytics.activeDebts} deudas activas
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-green-200" />
          </div>
        </motion.div>

        <motion.div
          className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Promedio Mensual</p>
              <p className="text-2xl font-bold">
                ${analytics.averageMonthlyPayment.toLocaleString()}
              </p>
              <p className="text-purple-100 text-xs mt-1">
                Estimado
              </p>
            </div>
            <Calendar className="h-8 w-8 text-purple-200" />
          </div>
        </motion.div>

        <motion.div
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Tiempo Estimado</p>
              <p className="text-2xl font-bold">
                {analytics.monthsToFinish > 0 ? `${analytics.monthsToFinish}m` : '∞'}
              </p>
              <p className="text-orange-100 text-xs mt-1">
                {analytics.projectedFinishDate 
                  ? format(analytics.projectedFinishDate, 'MMM yyyy', { locale: es })
                  : 'Proyección'
                }
              </p>
            </div>
            <Target className="h-8 w-8 text-orange-200" />
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Over Time */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            Progreso Temporal
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics.monthlyProgress}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name === 'cumulativePaid' ? 'Total Pagado' : 'Deuda Restante'
                ]}
              />
              <Area
                type="monotone"
                dataKey="cumulativePaid"
                stackId="1"
                stroke={COLORS.primary}
                fill={COLORS.primary}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="remainingDebt"
                stackId="1"
                stroke={COLORS.danger}
                fill={COLORS.danger}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Category Distribution */}
        <motion.div
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Award className="h-5 w-5 mr-2 text-purple-600" />
            Por Categorías
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.categoryChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="remaining"
                labelLine={false}
              >
                {analytics.categoryChartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS.gradient[index % COLORS.gradient.length]} 
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Restante']}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Type Distribution */}
        <motion.div
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Zap className="h-5 w-5 mr-2 text-green-600" />
            Por Tipo de Deuda
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.typeChartData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                type="number"
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <YAxis 
                type="category"
                dataKey="type"
                stroke="#6b7280"
                fontSize={12}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monto']}
              />
              <Bar 
                dataKey="amount" 
                fill={COLORS.secondary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Progress Percentage */}
        <motion.div
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-orange-600" />
            Progreso General
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.monthlyProgress}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Progreso']}
              />
              <Line
                type="monotone"
                dataKey="progressPercentage"
                stroke={COLORS.secondary}
                strokeWidth={3}
                dot={{ fill: COLORS.secondary, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: COLORS.secondary }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Summary Insights */}
      <motion.div
        className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-6 border border-gray-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Award className="h-5 w-5 mr-2 text-blue-600" />
          Insights y Recomendaciones
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h4 className="font-medium text-blue-900 mb-2">🎯 Progreso Actual</h4>
            <p className="text-blue-700 text-sm">
              Has completado el <strong>{analytics.progressPercentage.toFixed(1)}%</strong> de tus deudas. 
              ¡Excelente progreso!
            </p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h4 className="font-medium text-green-900 mb-2">💪 Consistencia</h4>
            <p className="text-green-700 text-sm">
              Tu promedio mensual estimado es de <strong>${analytics.averageMonthlyPayment.toLocaleString()}</strong>. 
              Mantén este ritmo.
            </p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <h4 className="font-medium text-purple-900 mb-2">🎊 Proyección</h4>
            <p className="text-purple-700 text-sm">
              {analytics.monthsToFinish > 0 
                ? `Podrías estar libre de deudas en ${analytics.monthsToFinish} meses.`
                : 'Continúa pagando para ver proyecciones.'
              }
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AnalyticsDashboard;