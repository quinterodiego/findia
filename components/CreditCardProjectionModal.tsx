'use client'

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, TrendingUp, ChevronRight, RefreshCw } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { useCreditCards } from '@/hooks/useCreditCards'
import { formatCurrency } from '@/lib/formatNumber'
import { parseCivilDate } from '@/lib/formatDate'
import type { CreditCard, CreditCardConsumption, CreditCardPayment } from '@/types'

interface CreditCardProjectionModalProps {
  isOpen: boolean
  onClose: () => void
  cards?: CreditCard[] // Opcional para evitar errores si no se pasa
  loading?: boolean // Estado de carga de las tarjetas
  onCreateCard?: () => void // Función para crear una tarjeta
}

interface ProjectionData {
  month: number
  monthName: string
  year: number
  cardId: string
  cardName: string
  previousDebt: number // Deuda anterior (saldo del mes anterior)
  previousDebtARS: number
  previousDebtUSD: number
  installments: number // Cuotas que vencen
  installmentsARS: number
  installmentsUSD: number
  fixedExpenses: number // Gastos fijos (categoría "Gasto Fijo")
  fixedExpensesARS: number
  fixedExpensesUSD: number
  variableExpenses: number // Gastos variables (categoría "Gasto Variable")
  consumptions: number // Nuevos consumos del mes (sin categoría específica o otros)
  consumptionsARS: number
  consumptionsUSD: number
  interest: number // Intereses calculados
  interestARS: number
  interestUSD: number
  monthlyTotal: number // Total del mes
  monthlyTotalARS: number
  monthlyTotalUSD: number
  totalToPay: number // Total a pagar
  totalToPayARS: number
  totalToPayUSD: number
  payment: number // Pago del mes
  paymentARS: number
  paymentUSD: number
  balance: number // Saldo final
  balanceARS: number
  balanceUSD: number
  installmentsDetail: Array<{ merchant: string; amount: number; installment: string; amountARS?: number; amountUSD?: number }>
  fixedExpensesDetail: Array<{ merchant: string; amount: number; date: string; amountARS?: number; amountUSD?: number }>
  consumptionsDetail: Array<{ merchant: string; amount: number; date: string; amountARS?: number; amountUSD?: number }>
  interestDetail: Array<{ merchant: string; amount: number; date: string; amountARS?: number; amountUSD?: number }>
}

/** Redondea a centavos para evitar arrastre de ruido de punto flotante entre meses encadenados. */
const roundToCents = (value: number): number => Math.round(value * 100) / 100

export default function CreditCardProjectionModal({
  isOpen, 
  onClose, 
  cards = [],
  loading: cardsLoading = false,
  onCreateCard
}: CreditCardProjectionModalProps) {
  const { error } = useToastContext()
  const { fetchCards, fetchPayments } = useCreditCards()
  const [projections, setProjections] = useState<ProjectionData[]>([])
  const [loading, setLoading] = useState(false)
  const [allConsumptions, setAllConsumptions] = useState<Record<string, CreditCardConsumption[]>>({})
  // Pagos reales (CreditCardPayments) por tarjeta, para el mes actual. Fuente única: el mismo
  // fetchPayments() que ya usan Gestión de Pagos y el resto de la app — no se duplica lógica.
  const [allPayments, setAllPayments] = useState<Record<string, CreditCardPayment[]>>({})
  // Tarjetas recién obtenidas al abrir el modal (currentBalance fresco). Si todavía no llegaron,
  // se usa el prop `cards` como fallback para no bloquear el primer render.
  const [freshCards, setFreshCards] = useState<CreditCard[]>([])
  const effectiveCards = freshCards.length > 0 ? freshCards : cards
  const [visibleMonthOffset, setVisibleMonthOffset] = useState(0) // Offset desde el mes actual (0 = mes actual)
  const monthsToShow = 8 // Mostrar mes actual + 7 meses más
  // Estado para almacenar pagos personalizados: key = `${cardId}-${year}-${month}`
  const [payments, setPayments] = useState<Record<string, { ars: number; usd: number }>>({})
  // Estado para almacenar gastos fijos personalizados: key = `${cardId}-${year}-${month}`
  const [fixedExpensesCustom, setFixedExpensesCustom] = useState<Record<string, { ars: number; usd: number }>>({})
  // Estado para almacenar intereses personalizados: key = `${cardId}-${year}-${month}`
  const [interestCustom, setInterestCustom] = useState<Record<string, { ars: number; usd: number }>>({})
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean
    category: 'Cuotas' | 'Gastos Fijos' | 'Consumos del mes' | 'Intereses y Gastos' | null
    cardId: string
    month: number
    year: number
    monthKey: string
  }>({
    isOpen: false,
    category: null,
    cardId: '',
    month: 0,
    year: 0,
    monthKey: ''
  })
  
  // Detectar si es móvil
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint de Tailwind
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Altura real de la primera fila del thead (mes/año), medida para poder anclar
  // la segunda fila (ARS/USD) justo debajo sin superponerse ni dejar un hueco.
  const monthHeaderRowRef = useRef<HTMLTableRowElement>(null)
  const [monthHeaderHeight, setMonthHeaderHeight] = useState(36)

  useLayoutEffect(() => {
    const measure = () => {
      if (monthHeaderRowRef.current) {
        setMonthHeaderHeight(monthHeaderRowRef.current.getBoundingClientRect().height)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isMobile, loading, projections.length])

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen || detailModal.isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, detailModal.isOpen])

  const loadAllConsumptions = async (cardsToUse: CreditCard[]): Promise<Record<string, CreditCardConsumption[]>> => {
    const consumptionsMap: Record<string, CreditCardConsumption[]> = {}

    for (const card of cardsToUse) {
      try {
        const response = await fetch(`/api/credit-cards/${card.id}/consumptions`)
        const data = await response.json()
        consumptionsMap[card.id] = response.ok && Array.isArray(data.consumptions) ? data.consumptions : []
      } catch (err) {
        console.error(`[Proyección] ❌ Error cargando consumos para tarjeta ${card.id}:`, err)
        consumptionsMap[card.id] = []
      }
    }

    setAllConsumptions(consumptionsMap)
    return consumptionsMap
  }

  // Pagos reales (CreditCardPayments), vía el mismo fetchPayments() que ya usa Gestión de Pagos —
  // no se duplica lógica ni se crea otra fuente de datos.
  const loadAllPayments = async (cardsToUse: CreditCard[]): Promise<Record<string, CreditCardPayment[]>> => {
    const paymentsMap: Record<string, CreditCardPayment[]> = {}

    for (const card of cardsToUse) {
      try {
        paymentsMap[card.id] = await fetchPayments(card.id)
      } catch (err) {
        console.error(`[Proyección] ❌ Error cargando pagos para tarjeta ${card.id}:`, err)
        paymentsMap[card.id] = []
      }
    }

    setAllPayments(paymentsMap)
    return paymentsMap
  }

  const calculateProjections = useCallback(async (forceReload = false) => {
    let cardsToUse = freshCards.length > 0 ? freshCards : cards
    if (!cardsToUse || cardsToUse.length === 0) {
      error('Necesitas al menos una tarjeta de crédito para calcular la proyección')
      return
    }

    setLoading(true)
    try {
      // Al forzar (abrir el modal o "Recalcular"), traer currentBalance fresco antes de calcular
      // — reutiliza fetchCards(), no se crea ningún fetch nuevo.
      if (forceReload) {
        const latestCards = await fetchCards().catch(() => [] as CreditCard[])
        if (latestCards.length > 0) {
          setFreshCards(latestCards)
          cardsToUse = latestCards
        }
      }

      // Recargar consumos/pagos solo si se fuerza o si todavía no hay nada cargado
      const consumptionsToUse = forceReload || Object.keys(allConsumptions).length === 0
        ? await loadAllConsumptions(cardsToUse)
        : allConsumptions
      const paymentsToUse = forceReload || Object.keys(allPayments).length === 0
        ? await loadAllPayments(cardsToUse)
        : allPayments

      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth()
      const currentYear = currentDate.getFullYear()

      const allProjections: ProjectionData[] = []

      // Mes actual + 12 meses futuros. Ya no se calculan meses anteriores: ese rango mostraba
      // una simulación hacia adelante partiendo del currentBalance de hoy, no historial real.
      const monthsForward = 12

      // Helper: inferir categoría si no fue asignada en la importación
      const inferCategory = (c: CreditCardConsumption): 'Cuotas' | 'Gasto Fijo' | 'Consumo del Mes' | 'Intereses' => {
        // Si tiene más de 1 cuota => Cuotas
        if ((c.installments || 0) > 1) return 'Cuotas'
        
        // Verificar si es un consumo de tipo "Intereses"
        const merchant = (c.merchant || '').toUpperCase()
        const description = (c.description || '').toUpperCase()
        const interestKeywords = ['INTERES', 'INTERÉS', 'INTERESES', 'IVA', 'PERCEPCION', 'PERCEP', 'IMPUESTO', 'SELLOS']
        if (interestKeywords.some(k => merchant.includes(k) || description.includes(k))) {
          return 'Intereses'
        }
        
        // Palabras clave simples para fijos (suscripciones/servicios)
        const merchantLower = merchant.toLowerCase()
        const fixedKeywords = ['netflix', 'spotify', 'hbo', 'disney', 'telecentro', 'personal', 'movistar', 'claro', 'internet', 'wifi']
        if (fixedKeywords.some(k => merchantLower.includes(k))) return 'Gasto Fijo'
        
        return 'Consumo del Mes'
      }

      for (let monthOffset = 0; monthOffset <= monthsForward; monthOffset++) {
        // Calcular mes y año objetivo
        let targetMonth = currentMonth + monthOffset
        let targetYear = currentYear

        // Ajustar año si el mes se sale del rango [0-11]
        while (targetMonth < 0) {
          targetMonth += 12
          targetYear -= 1
        }
        while (targetMonth >= 12) {
          targetMonth -= 12
          targetYear += 1
        }

        // Para cada tarjeta
        for (const card of cardsToUse) {
          const consumptions = consumptionsToUse[card.id] || []

          // Pagos reales (CreditCardPayments) de esta tarjeta fechados dentro del mes objetivo.
          // Solo tiene sentido para el mes actual: createCreditCardPayment() ya descontó estos
          // pagos de card.currentBalance al registrarse, así que se usan para RECONSTRUIR la
          // deuda previa al pago (no para volver a restarlos, lo que los descontaría dos veces).
          const realPaymentsThisMonth = roundToCents((paymentsToUse[card.id] || [])
            .filter(p => {
              const parsed = parseCivilDate(p.date)
              return parsed && parsed.year === targetYear && parsed.month === targetMonth + 1
            })
            .reduce((sum, p) => sum + p.amount, 0))

          // Calcular saldo inicial (Deuda anterior)
          let previousDebt = monthOffset === 0 ? roundToCents(card.currentBalance + realPaymentsThisMonth) : 0
          let previousDebtARS = monthOffset === 0 ? roundToCents(card.currentBalance + realPaymentsThisMonth) : 0 // Por ahora asumir todo en pesos
          let previousDebtUSD = 0

          if (monthOffset !== 0) {
            // Buscar la proyección del mes anterior para esta tarjeta (siempre existe: el rango
            // ahora arranca en el mes actual y avanza secuencialmente hacia adelante)
            let prevMonth = targetMonth - 1
            let prevYear = targetYear

            if (prevMonth < 0) {
              prevMonth = 11
              prevYear -= 1
            }

            const prevProj = allProjections.find(p =>
              p.cardId === card.id &&
              p.year === prevYear &&
              p.month === prevMonth + 1 // Los meses en ProjectionData son 1-12, no 0-11
            )

            if (prevProj) {
              previousDebt = prevProj.balance
              previousDebtARS = prevProj.balanceARS || prevProj.balance
              previousDebtUSD = prevProj.balanceUSD || 0
            } else {
              // Fallback defensivo (no debería ocurrir dado el rango secuencial de arriba)
              previousDebt = card.currentBalance
              previousDebtARS = card.currentBalance
              previousDebtUSD = 0
            }
          }

          // Calcular cuotas que vencen este mes
          // Solo incluir consumos con categoría "Cuotas"
          const installmentsDetail: Array<{ merchant: string; amount: number; installment: string; amountARS?: number; amountUSD?: number }> = []
          let totalInstallments = 0
          let totalInstallmentsARS = 0
          let totalInstallmentsUSD = 0


          for (const consumption of consumptions) {
            const rawCategory = (consumption.categoryId || '').trim()
            const hasMultipleInstallments = (consumption.installments || 0) > 1
            
            // IMPORTANTE: Si un consumo tiene múltiples cuotas, forzar categoría "Cuotas"
            // Esto asegura que todos los consumos en cuotas se incluyan en la proyección
            // independientemente de la categoría asignada al cargarlo
            const effectiveCategory = hasMultipleInstallments 
              ? 'Cuotas' 
              : (rawCategory || inferCategory(consumption))
            
            // Debug: Log detallado para todos los consumos en cuotas o que deberían estar en cuotas
            if (monthOffset === 0 || monthOffset === 1 || hasMultipleInstallments) {
            }
            
            // Solo incluir consumos con categoría "Cuotas"
            if (effectiveCategory !== 'Cuotas') {
              continue
            }
            
            // Parsear fecha del consumo - soportar múltiples formatos
            let dateParts: string[] = []
            let parsedDate: Date | null = null
            let civilParsed: { year: number; month: number; day: number } | null = null

            if (consumption.date.includes('/')) {
              dateParts = consumption.date.split('/')
            } else if (consumption.date.includes('-') && consumption.date.length >= 10) {
              // Formato ISO (YYYY-MM-DD): fecha CIVIL, sin pasar por Date/UTC
              civilParsed = parseCivilDate(consumption.date)
            } else {
              // Intentar parsear directamente
              parsedDate = new Date(consumption.date)
            }

            let consumptionMonth = -1
            let consumptionYear = -1

            if (dateParts.length === 3) {
              const [day, month, year] = dateParts.map(Number)
              if (day && month && year) {
                consumptionMonth = month - 1 // JavaScript months are 0-indexed
                consumptionYear = year < 100 ? 2000 + year : year
              }
            } else if (civilParsed) {
              consumptionMonth = civilParsed.month - 1
              consumptionYear = civilParsed.year
            } else if (parsedDate && !isNaN(parsedDate.getTime())) {
              consumptionMonth = parsedDate.getMonth()
              consumptionYear = parsedDate.getFullYear()
            } else {
              continue
            }

            // Calcular cuántos meses han pasado desde el consumo hasta el mes objetivo
            const monthsDiff = (targetYear - consumptionYear) * 12 + (targetMonth - consumptionMonth)
            
            // La primera cuota vence el mes siguiente al consumo (monthsDiff = 1 corresponde a cuota 1)
            // Por lo tanto, installmentNumber = monthsDiff
            // Pero debemos asegurarnos de que monthsDiff >= 1 (al menos un mes después del consumo)
            const installmentNumber = monthsDiff
            
            // Debug detallado
            if (monthOffset === 0 || monthOffset === 1) {
            }
            
            // El calendario manda: una compra de N cuotas genera COMO MÁXIMO N cargos, nunca más.
            // monthsDiff >= 1 => al menos pasó un mes desde la compra (primera cuota).
            // installmentNumber <= consumption.installments => todavía existe esa cuota en el calendario.
            // Fuera de ese rango (installmentNumber > installments) la cuota simplemente no existe —
            // ya no se "extiende" la compra más allá de su última cuota por estar "vencida e impaga".
            const isWithinInstallmentRange = monthsDiff >= 1 && installmentNumber <= consumption.installments

            if (isWithinInstallmentRange) {
              // currentInstallment sigue actuando como filtro de estado (no repetir una cuota que
              // ya se marcó como avanzada/pagada), pero nunca puede crear cuotas más allá de la última.
              if (installmentNumber > (consumption.currentInstallment || 0)) {
                // El amount ya es la cuota mensual, no el total
                // Para calcular el total original: amount * installments
                // monthlyPayment es un valor tipeado por el usuario al cargar el consumo (no lo
                // calculamos dividiendo amount/installments) — solo lo normalizamos a centavos acá.
                const monthlyPayment = roundToCents(consumption.monthlyPayment || consumption.amount || 0)
                const totalOriginal = monthlyPayment * (consumption.installments || 1)

                // Obtener montos por moneda
                const consumptionAny = consumption as any
                const montoPesosRaw = consumptionAny.montoPesos !== undefined && consumptionAny.montoPesos !== null ? consumptionAny.montoPesos : null
                const montoUSDRaw = consumptionAny.montoUSD !== undefined && consumptionAny.montoUSD !== null ? consumptionAny.montoUSD : null

                const montoPesos = montoPesosRaw !== null ? montoPesosRaw : (montoUSDRaw !== null ? 0 : monthlyPayment)
                const montoUSD = montoUSDRaw !== null ? montoUSDRaw : 0

                // Si montoUSD > 0, entonces el consumo está en USD
                // Si montoUSD = 0 y montoPesos > 0, entonces está en ARS
                // Si ambos son 0 o null, asumir ARS
                const amountARS = roundToCents(montoUSD > 0 ? 0 : (montoPesos > 0 ? montoPesos : monthlyPayment))
                const amountUSD = roundToCents(montoUSD > 0 ? montoUSD : 0)

                installmentsDetail.push({
                  merchant: consumption.merchant || 'Consumo',
                  amount: monthlyPayment,
                  installment: `${installmentNumber}/${consumption.installments}`,
                  amountARS,
                  amountUSD
                })
                totalInstallments = roundToCents(totalInstallments + monthlyPayment)
                totalInstallmentsARS = roundToCents(totalInstallmentsARS + amountARS)
                totalInstallmentsUSD = roundToCents(totalInstallmentsUSD + amountUSD)
                
              } else {
              }
            } else {
              if (monthOffset === 0 || monthOffset === 1) {
              }
            }
          }
          

          // Calcular nuevos consumos del mes
          // Solo incluir consumos con categoría "Consumo del Mes"
          // IMPORTANTE: Para el mes actual (monthOffset === 0), incluimos TODOS los consumos cargados
          // que aún tienen saldo pendiente (independientemente de cuándo fueron hechos)
          // Esto permite ver el total de consumos activos en el resumen cargado
          // Para meses futuros: incluir solo consumos hechos en ese mes específico
          let newConsumptions = 0
          let newConsumptionsARS = 0
          let newConsumptionsUSD = 0
          const consumptionsDetail: Array<{ merchant: string; amount: number; date: string; amountARS?: number; amountUSD?: number }> = []
          
          
          for (const consumption of consumptions) {
            if (!consumption.date) continue
            
            const rawCategory = (consumption.categoryId || '').trim()
            const effectiveCategory = rawCategory || inferCategory(consumption)
            
            // Debug: Log de categoría
            if (monthOffset === 0) {
            }
            
            // Solo incluir consumos con categoría "Consumo del Mes"
            if (effectiveCategory !== 'Consumo del Mes') {
              continue
            }
            
            // Intentar parsear fecha en formato dd/mm/yyyy
            let dateParts: string[] = []
            let parsedDate: Date | null = null
            let civilParsed: { year: number; month: number; day: number } | null = null

            // Si es formato dd/mm/yyyy
            if (consumption.date.includes('/')) {
              dateParts = consumption.date.split('/')
            }
            // Si es formato ISO (YYYY-MM-DD): fecha CIVIL, sin pasar por Date/UTC
            else if (consumption.date.includes('-') && consumption.date.length >= 10) {
              civilParsed = parseCivilDate(consumption.date)
            }
            // Intentar parsear directamente
            else {
              parsedDate = new Date(consumption.date)
            }

            let consumptionMonth = -1
            let consumptionYear = -1

            if (dateParts.length === 3) {
              const [day, month, year] = dateParts.map(Number)
              if (day && month && year) {
                consumptionMonth = month - 1 // JavaScript months are 0-indexed
                consumptionYear = year < 100 ? 2000 + year : year // Manejar años de 2 dígitos
              }
            } else if (civilParsed) {
              consumptionMonth = civilParsed.month - 1
              consumptionYear = civilParsed.year
            } else if (parsedDate && !isNaN(parsedDate.getTime())) {
              consumptionMonth = parsedDate.getMonth()
              consumptionYear = parsedDate.getFullYear()
            } else {
              continue
            }
            
            // "Consumo del Mes" pertenece únicamente al mes/año exacto de su fecha — sin excepción
            // para el mes actual. Un consumo de un mes anterior ya está reflejado en la Deuda
            // anterior (currentBalance); volver a sumarlo acá sería contarlo dos veces.
            if (consumptionMonth === targetMonth && consumptionYear === targetYear) {
              const consumptionAny = consumption as any
              const montoPesosRaw = consumptionAny.montoPesos !== undefined && consumptionAny.montoPesos !== null ? consumptionAny.montoPesos : null
              const montoUSDRaw = consumptionAny.montoUSD !== undefined && consumptionAny.montoUSD !== null ? consumptionAny.montoUSD : null

              const montoPesos = montoPesosRaw !== null ? montoPesosRaw : (montoUSDRaw !== null ? 0 : consumption.amount || 0)
              const montoUSD = montoUSDRaw !== null ? montoUSDRaw : 0

              // Si montoUSD > 0, entonces el consumo está en USD
              // Si montoUSD = 0 y montoPesos > 0, entonces está en ARS
              // Si ambos son 0 o null, asumir ARS
              const amountARS = roundToCents(montoUSD > 0 ? 0 : (montoPesos > 0 ? montoPesos : consumption.amount || 0))
              const amountUSD = roundToCents(montoUSD > 0 ? montoUSD : 0)

              newConsumptions = roundToCents(newConsumptions + (consumption.amount || 0))
              newConsumptionsARS = roundToCents(newConsumptionsARS + amountARS)
              newConsumptionsUSD = roundToCents(newConsumptionsUSD + amountUSD)
              consumptionsDetail.push({
                merchant: consumption.merchant || 'Consumo',
                amount: consumption.amount || 0,
                date: consumption.date,
                amountARS,
                amountUSD
              })
            }
          }
          

          // Calcular intereses: verificar primero si hay un valor personalizado para este mes
          const interestKey = `${card.id}-${targetYear}-${targetMonth + 1}`
          const customInterest = interestCustom[interestKey]
          
          let interest = 0
          let interestARS = 0
          let interestUSD = 0
          const interestDetail: Array<{ merchant: string; amount: number; date: string; amountARS?: number; amountUSD?: number }> = []
          
          // Si hay un valor personalizado, usarlo
          if (customInterest) {
            interestARS = roundToCents(customInterest.ars)
            interestUSD = roundToCents(customInterest.usd)
            interest = roundToCents(interestARS + interestUSD)
            interestDetail.push({
              merchant: 'Interés personalizado',
              amount: interest,
              date: `${targetMonth + 1}/${targetYear}`,
              amountARS: interestARS,
              amountUSD: interestUSD
            })
          } else {
            // Calcular intereses sobre el saldo pendiente
            // Los intereses se calculan sobre: Deuda anterior + Cuotas pendientes que aún no vencieron + Nuevos consumos del mes
            // Esto representa el saldo total pendiente antes de cualquier pago en este mes
            const balanceForInterest = roundToCents(previousDebt + totalInstallments + newConsumptions)

            // Verificar que la tasa de interés esté definida y sea mayor a 0
            const interestRate = card.interestRate || 0
            const calculatedInterest = balanceForInterest > 0 && interestRate > 0
              ? roundToCents((balanceForInterest * interestRate) / 100)
              : 0
            
            // Sumar consumos con categoría "Intereses"
            let interestConsumptions = 0
            let interestConsumptionsARS = 0
            let interestConsumptionsUSD = 0
            
            // Agregar interés calculado si existe (se asume en pesos por defecto)
            if (calculatedInterest > 0) {
              interestConsumptionsARS += calculatedInterest
              interestDetail.push({
                merchant: 'Interés calculado',
                amount: calculatedInterest,
                date: `${targetMonth + 1}/${targetYear}`,
                amountARS: calculatedInterest,
                amountUSD: 0
              })
            }
            
            for (const consumption of consumptions) {
              const rawCategory = (consumption.categoryId || '').trim()
              const effectiveCategory = rawCategory || inferCategory(consumption)
              
              // Solo incluir consumos con categoría "Intereses"
              if (effectiveCategory !== 'Intereses') {
                continue
              }

              // Parsear fecha del consumo
              let dateParts: string[] = []
              let parsedDate: Date | null = null
              let civilParsed: { year: number; month: number; day: number } | null = null

              if (consumption.date.includes('/')) {
                dateParts = consumption.date.split('/')
              } else if (consumption.date.includes('-') && consumption.date.length >= 10) {
                // Formato ISO (YYYY-MM-DD): fecha CIVIL, sin pasar por Date/UTC
                civilParsed = parseCivilDate(consumption.date)
              } else {
                parsedDate = new Date(consumption.date)
              }

              let consumptionMonth = -1
              let consumptionYear = -1

              if (dateParts.length === 3) {
                const [day, month, year] = dateParts.map(Number)
                if (day && month && year) {
                  consumptionMonth = month - 1
                  consumptionYear = year < 100 ? 2000 + year : year
                }
              } else if (civilParsed) {
                consumptionMonth = civilParsed.month - 1
                consumptionYear = civilParsed.year
              } else if (parsedDate && !isNaN(parsedDate.getTime())) {
                consumptionMonth = parsedDate.getMonth()
                consumptionYear = parsedDate.getFullYear()
              } else {
                continue
              }

              // Un interés/gasto es un evento PUNTUAL: solo corresponde al mes/año exacto de su
              // fecha, nunca se repite en meses futuros (a diferencia de "Gasto Fijo", que sí es
              // recurrente por naturaleza y no se toca acá).
              const shouldInclude = consumptionMonth === targetMonth && consumptionYear === targetYear

              if (shouldInclude) {
                const consumptionAny = consumption as any
                const montoPesosRaw = consumptionAny.montoPesos !== undefined && consumptionAny.montoPesos !== null ? consumptionAny.montoPesos : null
                const montoUSDRaw = consumptionAny.montoUSD !== undefined && consumptionAny.montoUSD !== null ? consumptionAny.montoUSD : null
                
                const montoPesos = montoPesosRaw !== null ? montoPesosRaw : (montoUSDRaw !== null ? 0 : consumption.amount || 0)
                const montoUSD = montoUSDRaw !== null ? montoUSDRaw : 0
                
                // Si montoUSD > 0, entonces el consumo está en USD
                // Si montoUSD = 0 y montoPesos > 0, entonces está en ARS
                // Si ambos son 0 o null, asumir ARS
                const amountARS = roundToCents(montoUSD > 0 ? 0 : (montoPesos > 0 ? montoPesos : consumption.amount || 0))
                const amountUSD = roundToCents(montoUSD > 0 ? montoUSD : 0)

                interestConsumptions = roundToCents(interestConsumptions + (consumption.amount || 0))
                interestConsumptionsARS = roundToCents(interestConsumptionsARS + amountARS)
                interestConsumptionsUSD = roundToCents(interestConsumptionsUSD + amountUSD)
                interestDetail.push({
                  merchant: consumption.merchant || 'Interés',
                  amount: consumption.amount || 0,
                  date: consumption.date,
                  amountARS,
                  amountUSD
                })
              }
            }

            // El interés total es el calculado más los consumos de tipo "Intereses"
            interest = roundToCents(calculatedInterest + interestConsumptions)
            interestARS = roundToCents(interestConsumptionsARS)
            interestUSD = roundToCents(interestConsumptionsUSD)
          }

          // Calcular gastos fijos: solo consumos con categoría "Gasto Fijo"
          // Verificar primero si hay un valor personalizado para este mes
          const fixedExpensesKey = `${card.id}-${targetYear}-${targetMonth + 1}`
          const customFixedExpenses = fixedExpensesCustom[fixedExpensesKey]
          
          let fixedExpenses = 0
          let fixedExpensesARS = 0
          let fixedExpensesUSD = 0
          const fixedExpensesDetail: Array<{ merchant: string; amount: number; date: string; amountARS?: number; amountUSD?: number }> = []
          
          // Si hay un valor personalizado, usarlo
          if (customFixedExpenses) {
            fixedExpensesARS = roundToCents(customFixedExpenses.ars)
            fixedExpensesUSD = roundToCents(customFixedExpenses.usd)
            fixedExpenses = roundToCents(fixedExpensesARS + fixedExpensesUSD)
            fixedExpensesDetail.push({
              merchant: 'Gasto Fijo personalizado',
              amount: fixedExpenses,
              date: `${targetMonth + 1}/${targetYear}`,
              amountARS: fixedExpensesARS,
              amountUSD: fixedExpensesUSD
            })
          } else {
            // Calcular desde los consumos registrados
            for (const consumption of consumptions) {
              const rawCategory = (consumption.categoryId || '').trim()
              const effectiveCategory = rawCategory || inferCategory(consumption)
              
              // Solo incluir consumos con categoría "Gasto Fijo"
              if (effectiveCategory !== 'Gasto Fijo') {
                continue
              }

              // Parsear fecha del consumo
              let dateParts: string[] = []
              let parsedDate: Date | null = null
              let civilParsed: { year: number; month: number; day: number } | null = null

              if (consumption.date.includes('/')) {
                dateParts = consumption.date.split('/')
              } else if (consumption.date.includes('-') && consumption.date.length >= 10) {
                // Formato ISO (YYYY-MM-DD): fecha CIVIL, sin pasar por Date/UTC
                civilParsed = parseCivilDate(consumption.date)
              } else {
                parsedDate = new Date(consumption.date)
              }

              let consumptionMonth = -1
              let consumptionYear = -1

              if (dateParts.length === 3) {
                const [day, month, year] = dateParts.map(Number)
                if (day && month && year) {
                  consumptionMonth = month - 1
                  consumptionYear = year < 100 ? 2000 + year : year
                }
              } else if (civilParsed) {
                consumptionMonth = civilParsed.month - 1
                consumptionYear = civilParsed.year
              } else if (parsedDate && !isNaN(parsedDate.getTime())) {
                consumptionMonth = parsedDate.getMonth()
                consumptionYear = parsedDate.getFullYear()
              } else {
                continue
              }
              
              // Un Gasto Fijo se proyecta desde el MES/AÑO de su fecha de inicio (sin importar el
              // día) y en todos los meses futuros del horizonte. Comparación por mes/año, no por
              // fecha completa — así un gasto cargado el 15 ya aparece ese mismo mes, no recién
              // el siguiente. La recurrencia hacia adelante sigue siendo indefinida (sin fecha de fin).
              const startMonthIndex = consumptionYear * 12 + consumptionMonth
              const targetMonthIndex = targetYear * 12 + targetMonth
              const shouldInclude = targetMonthIndex >= startMonthIndex

              if (shouldInclude) {
                const consumptionAny = consumption as any
                const montoPesosRaw = consumptionAny.montoPesos !== undefined && consumptionAny.montoPesos !== null ? consumptionAny.montoPesos : null
                const montoUSDRaw = consumptionAny.montoUSD !== undefined && consumptionAny.montoUSD !== null ? consumptionAny.montoUSD : null
                
                const montoPesos = montoPesosRaw !== null ? montoPesosRaw : (montoUSDRaw !== null ? 0 : consumption.amount || 0)
                const montoUSD = montoUSDRaw !== null ? montoUSDRaw : 0
                
                // Si montoUSD > 0, entonces el consumo está en USD
                // Si montoUSD = 0 y montoPesos > 0, entonces está en ARS
                // Si ambos son 0 o null, asumir ARS
                const amountARS = roundToCents(montoUSD > 0 ? 0 : (montoPesos > 0 ? montoPesos : consumption.amount || 0))
                const amountUSD = roundToCents(montoUSD > 0 ? montoUSD : 0)

                fixedExpenses = roundToCents(fixedExpenses + (consumption.amount || 0))
                fixedExpensesARS = roundToCents(fixedExpensesARS + amountARS)
                fixedExpensesUSD = roundToCents(fixedExpensesUSD + amountUSD)
                fixedExpensesDetail.push({
                  merchant: consumption.merchant || 'Gasto Fijo',
                  amount: consumption.amount || 0,
                  date: consumption.date,
                  amountARS,
                  amountUSD
                })
              }
            }
          }

          // Debug logs detallados
          if (monthOffset === 0 || monthOffset === 1) {
          }

          // Total del mes = cuotas + consumos nuevos + intereses + gastos fijos
          const monthlyTotal = roundToCents(totalInstallments + newConsumptions + interest + fixedExpenses)
          const monthlyTotalARS = roundToCents(totalInstallmentsARS + newConsumptionsARS + interestARS + fixedExpensesARS)
          const monthlyTotalUSD = roundToCents(totalInstallmentsUSD + newConsumptionsUSD + interestUSD + fixedExpensesUSD)

          // Total a Pagar = Deuda anterior + Total del mes
          const totalToPay = roundToCents(previousDebt + monthlyTotal)
          const totalToPayARS = roundToCents(previousDebtARS + monthlyTotalARS)
          const totalToPayUSD = roundToCents(previousDebtUSD + monthlyTotalUSD)

          // Pago del mes: en el mes actual es el pago REAL (CreditCardPayments), no editable.
          // En meses futuros sigue siendo una simulación manual, como hasta ahora.
          const paymentKey = `${card.id}-${targetYear}-${targetMonth + 1}`
          const customPayment = payments[paymentKey]
          const payment = monthOffset === 0 ? realPaymentsThisMonth : roundToCents(customPayment ? (customPayment.ars + customPayment.usd) : 0)
          const paymentARS = monthOffset === 0 ? realPaymentsThisMonth : roundToCents(customPayment?.ars || 0)
          const paymentUSD = monthOffset === 0 ? 0 : roundToCents(customPayment?.usd || 0)

          // Saldo = Total a Pagar - Pago del mes. Este valor alimenta la Deuda anterior del mes
          // siguiente, así que queda redondeado a centavos acá — es el punto crítico para que no
          // se arrastre ruido de punto flotante de un mes al otro.
          const balance = roundToCents(totalToPay - payment)
          const balanceARS = roundToCents(totalToPayARS - paymentARS)
          const balanceUSD = roundToCents(totalToPayUSD - paymentUSD)

          allProjections.push({
            month: targetMonth + 1,
            monthName: monthNames[targetMonth],
            year: targetYear,
            cardId: card.id,
            cardName: card.name,
            previousDebt,
            previousDebtARS,
            previousDebtUSD,
            installments: totalInstallments,
            installmentsARS: totalInstallmentsARS,
            installmentsUSD: totalInstallmentsUSD,
            fixedExpenses,
            fixedExpensesARS,
            fixedExpensesUSD,
            variableExpenses: 0, // Ya no se usa, pero mantengo para compatibilidad
            consumptions: newConsumptions,
            consumptionsARS: newConsumptionsARS,
            consumptionsUSD: newConsumptionsUSD,
            interest,
            interestARS,
            interestUSD,
            monthlyTotal,
            monthlyTotalARS,
            monthlyTotalUSD,
            totalToPay,
            totalToPayARS,
            totalToPayUSD,
            payment,
            paymentARS,
            paymentUSD,
            balance,
            balanceARS,
            balanceUSD,
            installmentsDetail,
            fixedExpensesDetail,
            consumptionsDetail,
            interestDetail
          })
        }
      }

      setProjections(allProjections)
    } catch (err) {
      console.error('Error calculando proyecciones:', err)
      error('Error al calcular proyecciones')
    } finally {
      setLoading(false)
    }
  }, [cards, freshCards, allConsumptions, allPayments, payments, fixedExpensesCustom, interestCustom, error, fetchCards, fetchPayments])

  // Al abrir el modal, traer siempre datos frescos (tarjetas, consumos y pagos reales) antes de calcular.
  useEffect(() => {
    if (isOpen && cards && cards.length > 0) {
      calculateProjections(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  // Si está cargando, mostrar indicador de carga
  if (cardsLoading) {
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
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <X 
              onClick={onClose}
              className="absolute top-4 right-4 w-6 h-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Cargando tarjetas...</p>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    )
  }

  // Si no hay tarjetas, mostrar mensaje
  if (!effectiveCards || effectiveCards.length === 0) {
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
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <X 
              onClick={onClose}
              className="absolute top-4 right-4 w-6 h-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
            />
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No hay tarjetas de crédito
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Necesitas al menos una tarjeta de crédito registrada para ver la proyección mensual.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              La proyección te muestra cómo evolucionará tu saldo mes a mes, incluyendo cuotas pendientes, gastos fijos, consumos e intereses.
            </p>
            <div className="flex gap-3 justify-center">
              {onCreateCard && (
                <button
                  onClick={() => {
                    onClose()
                    onCreateCard()
                  }}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer font-semibold"
                >
                  Crear Tarjeta
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors cursor-pointer font-semibold"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
              </div>
      </AnimatePresence>
    )
  }

  // Ordenar meses cronológicamente: año-mes (YYYY-MM) para orden natural
  const allMonthKeys = projections && projections.length > 0
    ? Array.from(new Set(projections.map(p => {
        const monthStr = String(p.month).padStart(2, '0')
        return `${p.year}-${monthStr}`
      }))).sort()
    : []

  // El mes actual siempre es el primero del rango: la proyección ya no genera meses anteriores.
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1 // 1-12
  const currentYear = currentDate.getFullYear()
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  // visibleMonthOffset nunca es negativo: no existe navegación hacia meses anteriores.
  const maxStartIndex = Math.max(0, allMonthKeys.length - monthsToShow)
  const startIndex = Math.max(0, Math.min(maxStartIndex, visibleMonthOffset))

  // Obtener el rango de meses visibles
  const visibleMonthKeys = allMonthKeys.length > 0
    ? allMonthKeys.slice(startIndex, startIndex + monthsToShow)
    : []

  const canGoForward = startIndex < maxStartIndex
  const canGoToCurrentMonth = visibleMonthOffset > 0

  return (
    <AnimatePresence>
      <div key="projection-modal" className="fixed inset-0 z-[60] flex items-center justify-center p-2">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full h-full max-w-[98vw] max-h-[98vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className={`bg-gradient-to-r from-green-600 to-green-700 text-white ${isMobile ? 'p-2' : 'p-4'} shrink-0`}>
            {isMobile ? (
              // Layout vertical para móvil
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <h2 className="text-base font-bold truncate">Proyección Mensual</h2>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => calculateProjections(true)}
                      disabled={loading}
                      className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Actualizar"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={onClose}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-green-100 text-xs">Visualiza cómo evolucionará tu saldo mensualmente</p>
              </div>
            ) : (
              // Layout horizontal para desktop
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <TrendingUp className="w-6 h-6 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold truncate">Proyección Mensual Completa</h2>
                    <p className="text-green-100 text-sm">Visualiza cómo evolucionará tu saldo mensualmente</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => calculateProjections(true)}
                    disabled={loading}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    {loading ? 'Calculando...' : 'Recalcular'}
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className={`bg-green-50 dark:bg-green-900/20 ${isMobile ? 'px-2 py-1.5' : 'px-4 py-2'} flex items-center justify-between border-b border-green-200 dark:border-green-800 shrink-0`}>
            <div className="flex items-center gap-1 md:gap-2 flex-1 md:flex-none">
                    <button
                onClick={() => setVisibleMonthOffset(0)}
                disabled={!canGoToCurrentMonth}
                className="px-2 md:px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer text-xs md:text-sm"
              >
                <span className="hidden md:inline">Mes Actual</span>
                <span className="md:hidden">Hoy</span>
                    </button>
                    <button
                onClick={() => setVisibleMonthOffset(Math.min(maxStartIndex, visibleMonthOffset + 1))}
                disabled={!canGoForward}
                className="px-2 md:px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer flex items-center gap-0.5 md:gap-1 text-xs md:text-sm"
                    >
                <span className="hidden md:inline">Siguiente</span>
                <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                  </div>
            {isMobile ? (
              <div className="text-xs text-green-700 dark:text-green-300 font-medium">
                {(() => {
                  if (!visibleMonthKeys || visibleMonthKeys.length === 0) {
                    return 'Cargando...'
                  }
                  const displayedMonthKey = visibleMonthKeys[0]
                  if (!displayedMonthKey) {
                    return 'Cargando...'
                  }
                  const [year, month] = displayedMonthKey.split('-').map(Number)
                  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                  return `${monthNames[month - 1]} ${year}`
                })()}
              </div>
            ) : (
              <div className="text-xs md:text-sm text-green-700 dark:text-green-300">
                {visibleMonthKeys && visibleMonthKeys.length > 0 ? `Mostrando ${visibleMonthKeys.length} meses` : 'Cargando...'}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400">Calculando proyecciones...</p>
                    </div>
            ) : projections.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400">Cargando consumos...</p>
                    </div>
            ) : (
              <div className="h-full overflow-auto bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl">
                  <table className="w-full border-collapse text-xs md:text-sm lg:text-base tabular-nums">
                    <thead>
                      {/* Primera fila: Mes/Año */}
                      <tr ref={monthHeaderRowRef} className="bg-green-600 dark:bg-green-700 text-white">
                        <th rowSpan={2} className="hidden md:table-cell border border-gray-300 dark:border-gray-600 px-1 md:px-2 py-1 md:py-2 text-left font-semibold sticky left-0 top-0 z-30 bg-green-600 dark:bg-green-700 min-w-[40px] md:min-w-[60px] text-xs md:text-sm">
                          TC
                        </th>
                        <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 pl-3 pr-2 py-1 md:pl-4 md:pr-2 md:py-2 text-left font-semibold sticky left-0 md:left-[60px] top-0 z-30 bg-green-600 dark:bg-green-700 min-w-[130px] md:min-w-[150px] lg:min-w-[160px] text-xs md:text-sm">
                          Categoría
                        </th>
                        {visibleMonthKeys.map((monthKey: string) => {
                          // Parsear año y mes del key (formato: YYYY-MM)
                          const [year, month] = monthKey.split('-').map(Number)
                          // Formato corto: MM-YY (ej: 11-25 para Noviembre 2025)
                          const shortYear = String(year).slice(-2)
                          const shortMonth = String(month).padStart(2, '0')
                          const monthYearShort = `${shortMonth}-${shortYear}`
                          const isCurrentMonth = monthKey === currentMonthKey
                          
                          return (
                            <th
                              key={monthKey}
                              colSpan={2}
                              className={`sticky top-0 z-20 border-2 border-l-4 border-l-green-900 dark:border-l-green-950 px-2 py-1 text-center font-semibold ${
                                isCurrentMonth
                                  ? 'shadow-lg'
                                  : 'border-gray-300 dark:border-gray-600 bg-green-700 dark:bg-green-800'
                              }`}
                              style={isCurrentMonth ? {
                                backgroundColor: '#66BB6A',
                                borderColor: '#66BB6A'
                              } : {}}
                            >
                              {isCurrentMonth && <span className="text-yellow-300 mr-1">●</span>}
                              {monthYearShort}
                            </th>
                          )
                        })}
                      </tr>
                      {/* Segunda fila: Monedas */}
                      <tr className="bg-green-600 dark:bg-green-700 text-white">
                        {visibleMonthKeys.map((monthKey: string) => {
                          const isCurrentMonth = monthKey === currentMonthKey
                          return (
                            <React.Fragment key={monthKey}>
                              <th
                                className={`sticky z-20 border-2 px-2 py-1 text-center font-semibold min-w-[90px] ${
                                  isCurrentMonth
                                    ? ''
                                    : 'border-gray-300 dark:border-gray-600 bg-green-700 dark:bg-green-800'
                                }`}
                                style={{
                                  top: monthHeaderHeight,
                                  ...(isCurrentMonth ? { backgroundColor: '#66BB6A', borderColor: '#66BB6A' } : {})
                                }}
                              >
                                ARS
                              </th>
                              <th
                                className={`sticky z-20 border-2 px-2 py-1 text-center font-semibold min-w-[90px] ${
                                  isCurrentMonth
                                    ? ''
                                    : 'border-gray-300 dark:border-gray-600 bg-green-700 dark:bg-green-800'
                                }`}
                                style={{
                                  top: monthHeaderHeight,
                                  ...(isCurrentMonth ? { backgroundColor: '#66BB6A', borderColor: '#66BB6A' } : {})
                                }}
                              >
                                USD
                              </th>
                            </React.Fragment>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Filas por tarjeta */}
                      {effectiveCards.map((card) => {
                        const cardProjections = projections.filter(p => p.cardId === card.id)

                        // Deuda anterior
                        const previousDebtRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            ars: proj?.previousDebtARS || proj?.previousDebt || 0,
                            usd: proj?.previousDebtUSD || 0
                          }
                        })

                        // Cuotas
                        const installmentsRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            // No usar proj?.installments como fallback para evitar duplicación
                            ars: proj?.installmentsARS ?? 0,
                            usd: proj?.installmentsUSD ?? 0,
                            proj
                          }
                        })

                        // Gastos Fijos
                        const fixedExpensesRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            // No usar proj?.fixedExpenses como fallback para evitar duplicación
                            ars: proj?.fixedExpensesARS ?? 0,
                            usd: proj?.fixedExpensesUSD ?? 0,
                            proj
                          }
                        })

                        // Consumos del mes
                        const consumptionsRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            // No usar proj?.consumptions como fallback para evitar duplicación
                            // Si consumptionsARS es 0, debe mostrar 0 (no el total general)
                            ars: proj?.consumptionsARS ?? 0,
                            usd: proj?.consumptionsUSD ?? 0,
                            proj
                          }
                        })

                        // Intereses y Gastos
                        const interestRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            // No usar proj?.interest como fallback para evitar duplicación
                            ars: proj?.interestARS ?? 0,
                            usd: proj?.interestUSD ?? 0,
                            proj
                          }
                        })

                        // Total del mes
                        const monthlyTotalRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            ars: proj?.monthlyTotalARS || proj?.monthlyTotal || 0,
                            usd: proj?.monthlyTotalUSD || 0
                          }
                        })

                        // Total a Pagar
                        const totalToPayRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            ars: proj?.totalToPayARS || proj?.totalToPay || 0,
                            usd: proj?.totalToPayUSD || 0
                          }
                        })

                        // Pago del mes
                        const paymentRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            ars: proj?.paymentARS || proj?.payment || 0,
                            usd: proj?.paymentUSD || 0
                          }
                        })

                        // Saldo
                        const balanceRow = visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const proj = cardProjections.find(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          return {
                            ars: proj?.balanceARS || proj?.balance || 0,
                            usd: proj?.balanceUSD || 0
                          }
                        })

                        // Funciones helper para formatear y parsear números (reutilizables)
                        const formatAmountForInput = (value: number): string => {
                          if (!value || value === 0) return ''
                          // Formatear con punto para miles y coma para decimales
                          const parts = value.toString().split('.')
                          const integerPart = parts[0]
                          const decimalPart = parts[1] || ''
                          const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                          return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger
                        }
                        
                        const parseAmount = (value: string): number => {
                          if (!value || value.trim() === '') return 0
                          // Reemplazar punto (miles) y coma (decimal) por formato estándar
                          const normalized = value.replace(/\./g, '').replace(',', '.')
                          const parsed = parseFloat(normalized)
                          return isNaN(parsed) ? 0 : parsed
                        }

                        return (
                          <React.Fragment key={card.id}>
                            {/* Nombre de la tarjeta */}
                            <tr className="bg-green-700 dark:bg-green-800 text-white">
                              <td className="hidden md:table-cell sticky left-0 z-10 bg-green-700 dark:bg-green-800 px-2 py-1.5"></td>
                              <td className="sticky left-0 md:left-[60px] z-10 bg-green-700 dark:bg-green-800 px-2 py-1.5 font-bold whitespace-nowrap">
                                {card.name}
                              </td>
                              <td colSpan={visibleMonthKeys.length * 2} className="bg-green-700 dark:bg-green-800 px-2 py-1.5"></td>
                            </tr>
                            
                            {/* Deuda anterior */}
                            <tr className="bg-gray-50 dark:bg-gray-800">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                Deuda anterior
                              </td>
                              {previousDebtRow.map((amount: { ars: number; usd: number }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const isCurrentMonth = monthKey === currentMonthKey
                                return (
                                  <React.Fragment key={`${card.id}-previous-${monthKey}`}>
                                    <td 
                                      className={`border-2 px-2 py-1.5 text-right ${
                                        isCurrentMonth ? '' : 'border-gray-300 dark:border-gray-600'
                                      }`}
                                      style={isCurrentMonth ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                    >
                                      {formatCurrency(amount.ars)}
                                    </td>
                                    <td
                                      className={`border-2 px-2 py-1.5 text-right ${
                                        isCurrentMonth ? '' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                      }`}
                                      style={isCurrentMonth ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                    >
                                      {formatCurrency(amount.usd)}
                                    </td>
                                  </React.Fragment>
                                )
                              })}
                            </tr>

                            {/* Cuotas */}
                            <tr className="bg-gray-50 dark:bg-gray-800">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                Cuotas
                              </td>
                              {installmentsRow.map((item: { ars: number; usd: number; proj?: any }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const [year, month] = monthKey.split('-').map(Number)
                                const hasDetails = item.proj?.installmentsDetail && item.proj.installmentsDetail.length > 0
                                return (
                                  <React.Fragment key={`${card.id}-installments-${monthKey}`}>
                                    <td
                                      onClick={() => hasDetails && setDetailModal({
                                        isOpen: true,
                                        category: 'Cuotas',
                                        cardId: card.id,
                                        month: month,
                                        year: year,
                                        monthKey: monthKey
                                      })}
                                      className={`border-2 px-2 py-1.5 text-right ${
                                        monthKey === currentMonthKey ? '' : 'border-gray-300 dark:border-gray-600'
                                      } ${hasDetails ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors' : ''}`}
                                      style={monthKey === currentMonthKey ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                      title={hasDetails ? 'Click para ver detalles' : ''}
                                    >
                                      {formatCurrency(item.ars)}
                                    </td>
                                    <td
                                      onClick={() => hasDetails && setDetailModal({
                                        isOpen: true,
                                        category: 'Cuotas',
                                        cardId: card.id,
                                        month: month,
                                        year: year,
                                        monthKey: monthKey
                                      })}
                                      className={`border-2 px-2 py-1.5 text-right ${
                                        monthKey === currentMonthKey ? '' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                      } ${hasDetails ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors' : ''}`}
                                      style={monthKey === currentMonthKey ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                      title={hasDetails ? 'Click para ver detalles' : ''}
                                    >
                                      {formatCurrency(item.usd)}
                                    </td>
                                  </React.Fragment>
                                )
                              })}
                            </tr>

                            {/* Gastos Fijos */}
                            <tr className="bg-gray-50 dark:bg-gray-800">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                Gastos Fijos
                              </td>
                              {fixedExpensesRow.map((item: { ars: number; usd: number; proj?: any }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const [year, month] = monthKey.split('-').map(Number)
                                const hasDetails = item.proj?.fixedExpensesDetail && item.proj.fixedExpensesDetail.length > 0
                                const isFutureMonth = monthKey > currentMonthKey
                                const fixedExpensesKey = `${card.id}-${year}-${month}`
                                
                                const handleFixedExpensesChange = (currency: 'ars' | 'usd', value: string) => {
                                  const numValue = parseAmount(value)
                                  setFixedExpensesCustom(prev => ({
                                    ...prev,
                                    [fixedExpensesKey]: {
                                      ars: currency === 'ars' ? numValue : (prev[fixedExpensesKey]?.ars ?? item.ars),
                                      usd: currency === 'usd' ? numValue : (prev[fixedExpensesKey]?.usd ?? item.usd)
                                    }
                                  }))
                                }
                                
                                const currentFixedExpensesARS = fixedExpensesCustom[fixedExpensesKey]?.ars ?? item.ars
                                const currentFixedExpensesUSD = fixedExpensesCustom[fixedExpensesKey]?.usd ?? item.usd
                                
                                return (
                                  <React.Fragment key={`${card.id}-fixed-${monthKey}`}>
                                    {isFutureMonth ? (
                                      <>
                                        <td
                                          className="border-2 border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right hover:bg-white dark:hover:bg-gray-600/40 transition-colors"
                                        >
                      <input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatAmountForInput(currentFixedExpensesARS)}
                                            onChange={(e) => handleFixedExpensesChange('ars', e.target.value)}
                                            onBlur={() => {
                                              setTimeout(() => calculateProjections(), 100)
                                            }}
                                            className="w-full text-right bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5 dark:text-white"
                        placeholder="$0"
                      />
                                        </td>
                                        <td
                                          className="border-2 border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 text-right hover:bg-white dark:hover:bg-gray-600/40 transition-colors"
                                        >
                      <input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatAmountForInput(currentFixedExpensesUSD)}
                                            onChange={(e) => handleFixedExpensesChange('usd', e.target.value)}
                                            onBlur={() => {
                                              setTimeout(() => calculateProjections(), 100)
                                            }}
                                            className="w-full text-right bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5 dark:text-white"
                        placeholder="$0"
                      />
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td
                                          onClick={() => hasDetails && setDetailModal({
                                            isOpen: true,
                                            category: 'Gastos Fijos',
                                            cardId: card.id,
                                            month: month,
                                            year: year,
                                            monthKey: monthKey
                                          })}
                                          className={`border-2 px-2 py-1.5 text-right ${
                                            monthKey === currentMonthKey ? '' : 'border-gray-300 dark:border-gray-600'
                                          } ${hasDetails ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors' : ''}`}
                                          style={monthKey === currentMonthKey ? {
                                            backgroundColor: '#E8F5E9',
                                            borderColor: '#66BB6A'
                                          } : {}}
                                          title={hasDetails ? 'Click para ver detalles' : ''}
                                        >
                                          {formatCurrency(item.ars)}
                                        </td>
                                        <td
                                          onClick={() => hasDetails && setDetailModal({
                                            isOpen: true,
                                            category: 'Gastos Fijos',
                                            cardId: card.id,
                                            month: month,
                                            year: year,
                                            monthKey: monthKey
                                          })}
                                          className={`border-2 px-2 py-1.5 text-right ${
                                            monthKey === currentMonthKey ? '' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                          } ${hasDetails ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors' : ''}`}
                                          style={monthKey === currentMonthKey ? {
                                            backgroundColor: '#E8F5E9',
                                            borderColor: '#66BB6A'
                                          } : {}}
                                          title={hasDetails ? 'Click para ver detalles' : ''}
                                        >
                                          {formatCurrency(item.usd)}
                                        </td>
                                      </>
                                    )}
                                  </React.Fragment>
                                )
                              })}
                            </tr>

                            {/* Consumos del mes */}
                            <tr className="bg-gray-50 dark:bg-gray-800">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                Consumos del mes
                              </td>
                              {consumptionsRow.map((item: { ars: number; usd: number; proj?: any }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const [year, month] = monthKey.split('-').map(Number)
                                const hasDetails = item.proj?.consumptionsDetail && item.proj.consumptionsDetail.length > 0
                                return (
                                  <React.Fragment key={`${card.id}-consumptions-${monthKey}`}>
                                    <td
                                      onClick={() => hasDetails && setDetailModal({
                                        isOpen: true,
                                        category: 'Consumos del mes',
                                        cardId: card.id,
                                        month: month,
                                        year: year,
                                        monthKey: monthKey
                                      })}
                                      className={`border-2 px-2 py-1.5 text-right ${
                                        monthKey === currentMonthKey ? '' : 'border-gray-300 dark:border-gray-600'
                                      } ${hasDetails ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors' : ''}`}
                                      style={monthKey === currentMonthKey ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                      title={hasDetails ? 'Click para ver detalles' : ''}
                                    >
                                      {formatCurrency(item.ars)}
                                    </td>
                                    <td
                                      onClick={() => hasDetails && setDetailModal({
                                        isOpen: true,
                                        category: 'Consumos del mes',
                                        cardId: card.id,
                                        month: month,
                                        year: year,
                                        monthKey: monthKey
                                      })}
                                      className={`border-2 px-2 py-1.5 text-right ${
                                        monthKey === currentMonthKey ? '' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                      } ${hasDetails ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors' : ''}`}
                                      style={monthKey === currentMonthKey ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                      title={hasDetails ? 'Click para ver detalles' : ''}
                                    >
                                      {formatCurrency(item.usd)}
                                    </td>
                                  </React.Fragment>
                                )
                              })}
                            </tr>

                            {/* Intereses y Gastos */}
                            <tr className="bg-gray-50 dark:bg-gray-800">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-gray-50 dark:bg-gray-800 font-medium">
                                Intereses y Gastos
                              </td>
                              {interestRow.map((item: { ars: number; usd: number; proj?: any }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const [year, month] = monthKey.split('-').map(Number)
                                const hasDetails = item.proj?.interestDetail && item.proj.interestDetail.length > 0
                                const isFutureMonth = monthKey > currentMonthKey
                                const interestKey = `${card.id}-${year}-${month}`
                                
                                const handleInterestChange = (currency: 'ars' | 'usd', value: string) => {
                                  const numValue = parseAmount(value)
                                  setInterestCustom(prev => ({
                                    ...prev,
                                    [interestKey]: {
                                      ars: currency === 'ars' ? numValue : (prev[interestKey]?.ars ?? item.ars),
                                      usd: currency === 'usd' ? numValue : (prev[interestKey]?.usd ?? item.usd)
                                    }
                                  }))
                                }
                                
                                const currentInterestARS = interestCustom[interestKey]?.ars ?? item.ars
                                const currentInterestUSD = interestCustom[interestKey]?.usd ?? item.usd
                                
                                return (
                                  <React.Fragment key={`${card.id}-interest-${monthKey}`}>
                                    {isFutureMonth ? (
                                      <>
                                        <td
                                          className="border-2 border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right hover:bg-white dark:hover:bg-gray-600/40 transition-colors"
                                        >
                      <input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatAmountForInput(currentInterestARS)}
                                            onChange={(e) => handleInterestChange('ars', e.target.value)}
                                            onBlur={() => {
                                              setTimeout(() => calculateProjections(), 100)
                                            }}
                                            className="w-full text-right bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5 dark:text-white"
                                            placeholder="$0"
                                          />
                                        </td>
                                        <td
                                          className="border-2 border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 text-right hover:bg-white dark:hover:bg-gray-600/40 transition-colors"
                                        >
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatAmountForInput(currentInterestUSD)}
                                            onChange={(e) => handleInterestChange('usd', e.target.value)}
                                            onBlur={() => {
                                              setTimeout(() => calculateProjections(), 100)
                                            }}
                                            className="w-full text-right bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5 dark:text-white"
                                            placeholder="$0"
                                          />
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td
                                          onClick={() => hasDetails && setDetailModal({
                                            isOpen: true,
                                            category: 'Intereses y Gastos',
                                            cardId: card.id,
                                            month: month,
                                            year: year,
                                            monthKey: monthKey
                                          })}
                                          className={`border-2 px-2 py-1.5 text-right ${
                                            monthKey === currentMonthKey ? '' : 'border-gray-300 dark:border-gray-600'
                                          } ${hasDetails ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors' : ''}`}
                                          style={monthKey === currentMonthKey ? {
                                            backgroundColor: '#E8F5E9',
                                            borderColor: '#66BB6A'
                                          } : {}}
                                          title={hasDetails ? 'Click para ver detalles' : ''}
                                        >
                                          {formatCurrency(item.ars)}
                                        </td>
                                        <td
                                          onClick={() => hasDetails && setDetailModal({
                                            isOpen: true,
                                            category: 'Intereses y Gastos',
                                            cardId: card.id,
                                            month: month,
                                            year: year,
                                            monthKey: monthKey
                                          })}
                                          className={`border-2 px-2 py-1.5 text-right ${
                                            monthKey === currentMonthKey ? '' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                          } ${hasDetails ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors' : ''}`}
                                          style={monthKey === currentMonthKey ? {
                                            backgroundColor: '#E8F5E9',
                                            borderColor: '#66BB6A'
                                          } : {}}
                                          title={hasDetails ? 'Click para ver detalles' : ''}
                                        >
                                          {formatCurrency(item.usd)}
                                        </td>
                                      </>
                                    )}
                                  </React.Fragment>
                                )
                              })}
                            </tr>

                            {/* Total del mes — primera fila de resumen: cierra el bloque de conceptos del mes */}
                            <tr className="bg-green-100 dark:bg-green-900/30">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 border-t-2 border-t-green-300 dark:border-t-green-800 px-2 py-1.5 sticky left-0 z-10 bg-green-100 dark:bg-green-950 font-semibold"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 border-t-2 border-t-green-300 dark:border-t-green-800 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-green-100 dark:bg-green-950 font-semibold">
                                Total del mes
                              </td>
                              {monthlyTotalRow.map((item: { ars: number; usd: number }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const isCurrentMonth = monthKey === currentMonthKey
                                return (
                                  <React.Fragment key={`${card.id}-monthlyTotal-${monthKey}`}>
                                    <td
                                      className={`border-2 border-t-green-300 dark:border-t-green-800 px-2 py-1.5 text-right font-semibold ${
                                        isCurrentMonth ? '' : 'border-gray-300 dark:border-gray-600'
                                      }`}
                                      style={isCurrentMonth ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                    >
                                      {formatCurrency(item.ars)}
                                    </td>
                                    <td
                                      className={`border-2 border-t-green-300 dark:border-t-green-800 px-2 py-1.5 text-right font-semibold ${
                                        isCurrentMonth ? '' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                      }`}
                                      style={isCurrentMonth ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                    >
                                      {formatCurrency(item.usd)}
                                    </td>
                                  </React.Fragment>
                                )
                              })}
                            </tr>

                            {/* Total a Pagar — el número acumulado más relevante de la fila: máximo peso visual */}
                            <tr className="bg-green-100 dark:bg-green-900/30">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 z-10 bg-green-100 dark:bg-green-950 font-bold"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-green-100 dark:bg-green-950 font-bold">
                                Total a Pagar
                              </td>
                              {totalToPayRow.map((item: { ars: number; usd: number }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const isCurrentMonth = monthKey === currentMonthKey
                                return (
                                  <React.Fragment key={`${card.id}-totalToPay-${monthKey}`}>
                                    <td
                                      className={`border-2 px-2 py-1.5 text-right font-bold ${
                                        isCurrentMonth ? '' : 'border-gray-300 dark:border-gray-600'
                                      }`}
                                      style={isCurrentMonth ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                    >
                                      {formatCurrency(item.ars)}
                                    </td>
                                    <td
                                      className={`border-2 px-2 py-1.5 text-right font-bold ${
                                        isCurrentMonth ? '' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                      }`}
                                      style={isCurrentMonth ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                    >
                                      {formatCurrency(item.usd)}
                                    </td>
                                  </React.Fragment>
                                )
                              })}
                            </tr>

                            {/* Pago del mes — única fila de salida de dinero real/manual: diferenciada, pero deliberadamente NO verde */}
                            <tr className="bg-gray-100 dark:bg-gray-700/60">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 border-t-2 border-t-gray-400 dark:border-t-gray-500 px-2 py-1.5 sticky left-0 z-10 bg-gray-100 dark:bg-gray-700 font-semibold"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 border-t-2 border-t-gray-400 dark:border-t-gray-500 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-gray-100 dark:bg-gray-700 font-semibold">
                                Pago del mes
                              </td>
                              {paymentRow.map((item: { ars: number; usd: number }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const [year, month] = monthKey.split('-').map(Number)
                                const isCurrentMonth = monthKey === currentMonthKey
                                const paymentKey = `${card.id}-${year}-${month}`
                                
                                const handlePaymentChange = (currency: 'ars' | 'usd', value: string) => {
                                  const numValue = parseAmount(value)
                                  setPayments(prev => ({
                                    ...prev,
                                    [paymentKey]: {
                                      ars: currency === 'ars' ? numValue : (prev[paymentKey]?.ars ?? 0),
                                      usd: currency === 'usd' ? numValue : (prev[paymentKey]?.usd ?? 0)
                                    }
                                  }))
                                }
                                
                                // Obtener el valor actual del pago (personalizado o del item)
                                const currentPaymentARS = payments[paymentKey]?.ars ?? item.ars
                                const currentPaymentUSD = payments[paymentKey]?.usd ?? item.usd
                                
                                return (
                                  <React.Fragment key={`${card.id}-payment-${monthKey}`}>
                                    {isCurrentMonth ? (
                                      <>
                                        {/* Mes actual: pago REAL (CreditCardPayments), no editable acá — se registra desde Gestión de Pagos */}
                                        <td
                                          className="border-2 px-2 py-1.5 text-right"
                                          style={{
                                            backgroundColor: '#E8F5E9',
                                            borderColor: '#66BB6A'
                                          }}
                                          title="Pago real registrado en Gestión de Pagos de Tarjeta"
                                        >
                                          {formatCurrency(item.ars)}
                                        </td>
                                        <td
                                          className="border-2 px-2 py-1.5 text-right"
                                          style={{
                                            backgroundColor: '#E8F5E9',
                                            borderColor: '#66BB6A'
                                          }}
                                          title="Pago real registrado en Gestión de Pagos de Tarjeta"
                                        >
                                          {formatCurrency(item.usd)}
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        {/* Meses futuros: simulación manual, no persiste ni afecta el saldo real */}
                                        <td className="border-2 px-2 py-1.5 text-right border-gray-300 dark:border-gray-600 border-t-2 border-t-gray-400 dark:border-t-gray-500 hover:bg-white dark:hover:bg-gray-600/40 transition-colors">
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatAmountForInput(currentPaymentARS)}
                                            onChange={(e) => handlePaymentChange('ars', e.target.value)}
                                            onBlur={() => {
                                              // Recalcular proyecciones cuando se pierde el foco
                                              setTimeout(() => calculateProjections(), 100)
                                            }}
                                            className="w-full text-right bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5 dark:text-white"
                                            placeholder="$0"
                                            title="Pago proyectado (simulación manual, no se guarda)"
                                          />
                                        </td>
                                        <td className="border-2 px-2 py-1.5 text-right border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600 border-t-2 border-t-gray-400 dark:border-t-gray-500 hover:bg-white dark:hover:bg-gray-600/40 transition-colors">
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatAmountForInput(currentPaymentUSD)}
                                            onChange={(e) => handlePaymentChange('usd', e.target.value)}
                                            onBlur={() => {
                                              // Recalcular proyecciones cuando se pierde el foco
                                              setTimeout(() => calculateProjections(), 100)
                                            }}
                                            className="w-full text-right bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5 dark:text-white"
                                            placeholder="$0"
                                            title="Pago proyectado (simulación manual, no se guarda)"
                                          />
                                        </td>
                                      </>
                                    )}
                                  </React.Fragment>
                                )
                              })}
                            </tr>

                            {/* Saldo — número final: mayor peso visual, borde superior que cierra el bloque de resumen */}
                            <tr className="bg-green-100 dark:bg-green-900/30">
                              <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 border-t-2 border-t-green-400 dark:border-t-green-600 px-2 py-1.5 sticky left-0 z-10 bg-green-100 dark:bg-green-950 font-bold"></td>
                              <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 border-t-2 border-t-green-400 dark:border-t-green-600 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-green-100 dark:bg-green-950 font-bold">
                                Saldo
                              </td>
                              {balanceRow.map((item: { ars: number; usd: number }, idx: number) => {
                                const monthKey = visibleMonthKeys[idx]
                                const isCurrentMonth = monthKey === currentMonthKey
                                return (
                                  <React.Fragment key={`${card.id}-balance-${monthKey}`}>
                                    <td
                                      className={`border-2 border-t-green-400 dark:border-t-green-600 px-2 py-1.5 text-right font-bold ${
                                        isCurrentMonth ? '' : 'border-gray-300 dark:border-gray-600'
                                      }`}
                                      style={isCurrentMonth ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                    >
                                      {formatCurrency(item.ars)}
                                    </td>
                                    <td
                                      className={`border-2 border-t-green-400 dark:border-t-green-600 px-2 py-1.5 text-right font-bold ${
                                        isCurrentMonth ? '' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                      }`}
                                      style={isCurrentMonth ? {
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#66BB6A'
                                      } : {}}
                                    >
                                      {formatCurrency(item.usd)}
                                    </td>
                                  </React.Fragment>
                                )
                              })}
                            </tr>
                          </React.Fragment>
                        )
                      })}

                      {/* Posición Global */}
                      <tr className="bg-green-600 dark:bg-green-700 text-white font-bold">
                        <td className="hidden md:table-cell border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 z-10 bg-green-600 dark:bg-green-700"></td>
                        <td className="border border-gray-300 dark:border-gray-600 border-r-2 border-r-gray-400 dark:border-r-gray-500 px-2 py-1.5 sticky left-0 md:left-[60px] z-10 bg-green-600 dark:bg-green-700">
                          Posición Global
                        </td>
                        {visibleMonthKeys.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-').map(Number)
                          const isCurrentMonth = monthKey === currentMonthKey
                          const monthProjections = projections.filter(p => {
                            const projMonth = String(p.month).padStart(2, '0')
                            return p.year === year && projMonth === String(month).padStart(2, '0')
                          })
                          const totalBalanceARS = monthProjections.reduce((sum, p) => sum + (p.balanceARS || p.balance || 0), 0)
                          const totalBalanceUSD = monthProjections.reduce((sum, p) => sum + (p.balanceUSD || 0), 0)
                          
                          return (
                            <React.Fragment key={monthKey}>
                              <td
                                className={`border-2 px-2 py-1.5 text-right ${
                                  isCurrentMonth ? 'text-gray-900' : 'border-gray-300 dark:border-gray-600'
                                }`}
                                style={isCurrentMonth ? {
                                  backgroundColor: '#E8F5E9',
                                  borderColor: '#66BB6A'
                                } : {}}
                              >
                                {formatCurrency(totalBalanceARS)}
                              </td>
                              <td
                                className={`border-2 px-2 py-1.5 text-right ${
                                  isCurrentMonth ? 'text-gray-900' : 'border-r-2 border-r-gray-400 dark:border-r-gray-500 border-gray-300 dark:border-gray-600'
                                }`}
                                style={isCurrentMonth ? {
                                  backgroundColor: '#E8F5E9',
                                  borderColor: '#66BB6A'
                                } : {}}
                              >
                                {formatCurrency(totalBalanceUSD)}
                              </td>
                            </React.Fragment>
                          )
                        })}
                      </tr>
                        </tbody>
                      </table>
                    </div>
            )}
                  </div>
        </motion.div>
                </div>

      {/* Modal de Desglose */}
      <AnimatePresence key="detail-modal-animate">
        {detailModal.isOpen && detailModal.category && (
          <div key="detail-modal" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDetailModal({ ...detailModal, isOpen: false })}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del Modal */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold">Desglose de {detailModal.category}</h3>
                  {(() => {
                    const proj = projections.find(p => {
                      const projMonth = String(p.month).padStart(2, '0')
                      return p.cardId === detailModal.cardId && 
                             p.year === detailModal.year && 
                             projMonth === String(detailModal.month).padStart(2, '0')
                    })
                    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                    const card = effectiveCards.find(c => c.id === detailModal.cardId)
                    return (
                      <p className="text-blue-100 text-sm mt-1">
                        {card?.name} - {monthNames[detailModal.month - 1]} {detailModal.year}
                      </p>
                    )
                  })()}
                </div>
                <button
                  onClick={() => setDetailModal({ ...detailModal, isOpen: false })}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                    </div>

              {/* Contenido del Modal */}
              <div className="flex-1 overflow-auto p-4">
                {(() => {
                  const proj = projections.find(p => {
                    const projMonth = String(p.month).padStart(2, '0')
                    return p.cardId === detailModal.cardId && 
                           p.year === detailModal.year && 
                           projMonth === String(detailModal.month).padStart(2, '0')
                  })
                  
                  if (!proj) {
                    return (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No se encontraron detalles para esta categoría
                    </div>
                    )
                  }

                  let details: Array<{ merchant: string; amount: number; installment?: string; date?: string; amountARS?: number; amountUSD?: number }> = []
                  let total = 0
                  let totalARS = 0
                  let totalUSD = 0

                  switch (detailModal.category) {
                    case 'Cuotas':
                      details = proj.installmentsDetail || []
                      // Calcular totales desde los detalles para evitar duplicación
                      totalARS = details.reduce((sum, item) => sum + (item.amountARS || 0), 0)
                      totalUSD = details.reduce((sum, item) => sum + (item.amountUSD || 0), 0)
                      total = totalARS + totalUSD
                      break
                    case 'Gastos Fijos':
                      details = proj.fixedExpensesDetail || []
                      // Calcular totales desde los detalles para evitar duplicación
                      totalARS = details.reduce((sum, item) => sum + (item.amountARS || 0), 0)
                      totalUSD = details.reduce((sum, item) => sum + (item.amountUSD || 0), 0)
                      total = totalARS + totalUSD
                      break
                    case 'Consumos del mes':
                      details = proj.consumptionsDetail || []
                      // Calcular totales desde los detalles para evitar duplicación
                      totalARS = details.reduce((sum, item) => sum + (item.amountARS || 0), 0)
                      totalUSD = details.reduce((sum, item) => sum + (item.amountUSD || 0), 0)
                      total = totalARS + totalUSD
                      break
                    case 'Intereses y Gastos':
                      details = proj.interestDetail || []
                      // Calcular totales desde los detalles para evitar duplicación
                      totalARS = details.reduce((sum, item) => sum + (item.amountARS || 0), 0)
                      totalUSD = details.reduce((sum, item) => sum + (item.amountUSD || 0), 0)
                      total = totalARS + totalUSD
                      break
                  }

                  if (details.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No hay items para mostrar
                    </div>
                    )
                  }

                  return (
                    <div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                              <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-left font-semibold">
                                {detailModal.category === 'Cuotas' ? 'Comercio' : 'Descripción'}
                            </th>
                              {detailModal.category === 'Cuotas' && (
                                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center font-semibold">
                                  Cuota
                            </th>
                              )}
                              {(detailModal.category === 'Gastos Fijos' || detailModal.category === 'Consumos del mes' || detailModal.category === 'Intereses y Gastos') && (
                                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-left font-semibold">
                                  Fecha
                            </th>
                              )}
                              <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right font-semibold">
                                ARS
                              </th>
                              <th className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right font-semibold">
                                USD
                            </th>
                          </tr>
                        </thead>
                          <tbody>
                            {details.map((item, idx) => (
                              <tr key={`${detailModal.category}-${detailModal.cardId}-${detailModal.monthKey}-${idx}`} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5">
                                  {item.merchant}
                              </td>
                                {detailModal.category === 'Cuotas' && item.installment && (
                                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center">
                                    {item.installment}
                              </td>
                                )}
                                {(detailModal.category === 'Gastos Fijos' || detailModal.category === 'Consumos del mes' || detailModal.category === 'Intereses y Gastos') && item.date && (
                                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5">
                                    {item.date}
                              </td>
                                )}
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right font-medium">
                                  {formatCurrency(item.amountARS !== undefined ? item.amountARS : item.amount)}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right font-medium">
                                  {formatCurrency(item.amountUSD !== undefined ? item.amountUSD : 0)}
                              </td>
                            </tr>
                          ))}
                            <tr className="bg-blue-50 dark:bg-blue-900/20 font-semibold">
                              <td 
                                colSpan={2}
                                className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right"
                              >
                                Total:
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right font-semibold">
                                {formatCurrency(totalARS)}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-right font-semibold">
                                {formatCurrency(totalUSD)}
                              </td>
                            </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )
                })()}
          </div>
        </motion.div>
      </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}
