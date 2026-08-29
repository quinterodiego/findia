'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calculator } from 'lucide-react'
import { useCreditCards } from '@/hooks/useCreditCards'
import { formatCurrency, formatNumber } from '@/lib/formatNumber'

interface InterestCalculatorModalProps {
  isOpen: boolean
  onClose: () => void
}

const MAX_MONTHS = 120 // 10 años: horizonte exploratorio razonable, más allá deja de ser útil

interface MonthlyBreakdownEntry {
  month: number
  startingBalance: number
  interest: number
  endingBalance: number
}

interface CompoundInterestResult {
  initialAmount: number
  monthlyRate: number
  months: number
  totalInterest: number
  finalAmount: number
  breakdown: MonthlyBreakdownEntry[]
}

const roundToCents = (value: number): number => Math.round(value * 100) / 100

/**
 * Motor único de esta calculadora: interés compuesto mensual, misma convención que
 * simulateDebtPayoff() (CreditCardCenter.tsx) usa para CreditCard.interestRate —
 * un porcentaje MENSUAL aplicado directo sobre el saldo de cada período.
 */
function calculateCompoundInterest(initialAmount: number, monthlyRatePercent: number, months: number): CompoundInterestResult {
  const breakdown: MonthlyBreakdownEntry[] = []
  let balance = initialAmount

  for (let month = 1; month <= months; month++) {
    const startingBalance = balance
    const interest = roundToCents(startingBalance * (monthlyRatePercent / 100))
    balance = roundToCents(startingBalance + interest)
    breakdown.push({ month, startingBalance, interest, endingBalance: balance })
  }

  return {
    initialAmount,
    monthlyRate: monthlyRatePercent,
    months,
    totalInterest: roundToCents(balance - initialAmount),
    finalAmount: balance,
    breakdown,
  }
}

const formatRate = (rate: number): string => `${formatNumber(rate, { maximumFractionDigits: 2 })}%`

export default function InterestCalculatorModal({
  isOpen,
  onClose,
}: InterestCalculatorModalProps) {
  const { cards, fetchCards } = useCreditCards()

  const [selectedCardId, setSelectedCardId] = useState('')
  const [amount, setAmount] = useState('') // dígitos crudos, mismo patrón que "Límite" en Nueva Tarjeta
  const [monthlyRate, setMonthlyRate] = useState('') // string con coma decimal admitida
  const [months, setMonths] = useState('') // dígitos crudos, sin decimales posibles
  const [errors, setErrors] = useState<{ amount?: string; rate?: string; months?: string }>({})
  const [result, setResult] = useState<CompoundInterestResult | null>(null)

  // Simulación puramente temporal: cerrar el modal descarta todo. Como el componente
  // padre mantiene esta instancia montada entre aperturas, hay que resetear a mano.
  useEffect(() => {
    if (!isOpen) return
    fetchCards()
    setSelectedCardId('')
    setAmount('')
    setMonthlyRate('')
    setMonths('')
    setErrors({})
    setResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleCardSelect = (cardId: string) => {
    setSelectedCardId(cardId)
    setResult(null)
    const card = cards.find(c => c.id === cardId)
    if (card) {
      setMonthlyRate(String(card.interestRate).replace('.', ','))
    }
  }

  const handleCalculate = () => {
    const errs: { amount?: string; rate?: string; months?: string } = {}

    const amountNum = Number(amount)
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      errs.amount = 'Ingresá un monto válido, mayor a $0.'
    }

    const rateNum = Number(monthlyRate.replace(',', '.'))
    if (!monthlyRate || !Number.isFinite(rateNum) || rateNum <= 0) {
      errs.rate = 'Ingresá una tasa mensual válida, mayor a 0%.'
    }

    const monthsNum = Number(months)
    if (!months || !Number.isInteger(monthsNum) || monthsNum < 1) {
      errs.months = 'Ingresá una cantidad de meses entera, de 1 en adelante.'
    } else if (monthsNum > MAX_MONTHS) {
      errs.months = `El período no puede superar los ${MAX_MONTHS} meses.`
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setResult(null)
      return
    }

    setErrors({})
    setResult(calculateCompoundInterest(amountNum, rateNum, monthsNum))
  }

  const selectedCard = cards.find(c => c.id === selectedCardId)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Calculadora de Intereses
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Simulá cuánto puede crecer un monto según la tasa mensual y el tiempo.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)] space-y-6">
            {/* Selector opcional de tarjeta */}
            <div>
              <label htmlFor="ic-card-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Usar datos de una tarjeta (opcional)
              </label>
              <select
                id="ic-card-select"
                value={selectedCardId}
                onChange={(e) => handleCardSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF3A5F]/30 focus:border-[#FF3A5F] bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer"
              >
                <option value="">Ninguna / Cálculo manual</option>
                {cards.map(card => (
                  <option key={card.id} value={card.id}>{card.name}</option>
                ))}
              </select>
              {selectedCard && (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Tasa configurada en esta tarjeta: {formatRate(selectedCard.interestRate)} mensual
                </p>
              )}
            </div>

            {/* Formulario */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="ic-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monto
                </label>
                <input
                  id="ic-amount"
                  type="text"
                  inputMode="numeric"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF3A5F]/30 focus:border-[#FF3A5F] bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${errors.amount ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="$ 100.000"
                  value={amount ? `$ ${formatNumber(Number(amount), { maximumFractionDigits: 0 })}` : ''}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^0-9]/g, '')
                    setAmount(digitsOnly)
                    setErrors(prev => ({ ...prev, amount: undefined }))
                    setResult(null)
                  }}
                />
                {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
              </div>

              <div>
                <label htmlFor="ic-rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tasa mensual (%)
                </label>
                <div className="relative">
                  <input
                    id="ic-rate"
                    type="text"
                    inputMode="decimal"
                    className={`w-full pl-3 pr-7 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF3A5F]/30 focus:border-[#FF3A5F] bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${errors.rate ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                    placeholder="Ej: 8,5"
                    value={monthlyRate}
                    onChange={(e) => {
                      let v = e.target.value.replace(/[^0-9,]/g, '')
                      const parts = v.split(',')
                      if (parts.length > 2) v = parts[0] + ',' + parts.slice(1).join('')
                      setMonthlyRate(v)
                      setErrors(prev => ({ ...prev, rate: undefined }))
                      setResult(null)
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none">%</span>
                </div>
                {errors.rate && <p className="mt-1 text-xs text-red-500">{errors.rate}</p>}
              </div>

              <div>
                <label htmlFor="ic-months" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meses
                </label>
                <input
                  id="ic-months"
                  type="text"
                  inputMode="numeric"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF3A5F]/30 focus:border-[#FF3A5F] bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${errors.months ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Ej: 3"
                  value={months}
                  onChange={(e) => {
                    setMonths(e.target.value.replace(/[^0-9]/g, ''))
                    setErrors(prev => ({ ...prev, months: undefined }))
                    setResult(null)
                  }}
                />
                {errors.months && <p className="mt-1 text-xs text-red-500">{errors.months}</p>}
              </div>
            </div>

            <button
              onClick={handleCalculate}
              className="px-6 py-2 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 transition-opacity text-white rounded-lg font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              Calcular
            </button>

            {/* Resultado */}
            {result ? (
              <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white pt-4">Resultado</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Monto inicial</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(result.initialAmount)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Interés generado</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(result.totalInterest)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Monto final</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(result.finalAmount)}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {result.months} {result.months === 1 ? 'mes' : 'meses'} · Tasa {formatRate(result.monthlyRate)} mensual
                </p>

                {/* Desglose mes a mes */}
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Desglose mes a mes</h5>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                        <tr>
                          <th className="text-left p-2.5 font-semibold text-gray-700 dark:text-gray-300">Mes</th>
                          <th className="text-right p-2.5 font-semibold text-gray-700 dark:text-gray-300">Saldo inicial</th>
                          <th className="text-right p-2.5 font-semibold text-gray-700 dark:text-gray-300">Interés</th>
                          <th className="text-right p-2.5 font-semibold text-gray-700 dark:text-gray-300">Saldo final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.breakdown.map(row => (
                          <tr key={row.month} className="border-t border-gray-100 dark:border-gray-700">
                            <td className="p-2.5 text-gray-600 dark:text-gray-300">{row.month}</td>
                            <td className="p-2.5 text-right text-gray-700 dark:text-gray-300">{formatCurrency(row.startingBalance)}</td>
                            <td className="p-2.5 text-right text-green-600 dark:text-green-400">{formatCurrency(row.interest)}</td>
                            <td className="p-2.5 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(row.endingBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-5 border-t border-gray-100 dark:border-gray-700">
                <Calculator className="w-7 h-7 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Completá los datos y presioná &ldquo;Calcular&rdquo; para ver el resultado.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
