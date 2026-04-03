'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileText, AlertCircle, CheckCircle, Edit2, Settings } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { argentineBanks } from '@/lib/argentineBanks'
import type { PDFImportTemplate, SmartTemplate } from '@/types'
import PDFTemplateManager from './PDFTemplateManager'
import StatementCorrectionAssistant, { type EditableParsedLine } from './StatementCorrectionAssistant'
import { formatCurrency } from '@/lib/formatNumber'
import { useCategories } from '@/hooks/useCategories'
import { 
  learnPatternsFromText, 
  learnMerchantMappings, 
  applyMerchantMappings 
} from '@/lib/smartTemplateLearning'

type ParsedLine = {
  date: string // dd/mm/aaaa (formato original para mostrar)
  originalDate: string // Formato original del PDF (ej: "25-Jul-25")
  description: string
  montoPesos: number
  montoUSD: number
  installments?: { current: number; total: number } | null
  type: 'consumption' | 'interest' | 'fee'
}

interface Props {
  isOpen: boolean
  onClose: () => void
  cardId: string
}

// Utilidad: normalizar fecha a dd/mm/aaaa
function toDDMMYYYY(date: Date) {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

// Mapeo de meses abreviados en español e inglés
const MONTHS_ABBREV: Record<string, number> = {
  // Español
  'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
  // Inglés (los que no colisionan con español)
  'jan': 1, 'fev': 2, 'apr': 4, 'aug': 8, 'dec': 12,
}

// Función para convertir fecha con mes abreviado a dd/mm/yyyy
function parseDateWithMonth(dateStr: string): string | null {
  // Formato: DD-Mes-YY o DD-Mes-YYYY (ej: 25-Jul-25, 05-Ago-2025)
  const match = dateStr.match(/(\d{1,2})[-\/](\w{3})[-\/](\d{2,4})/i)
  if (!match) return null
  
  const day = parseInt(match[1])
  const monthAbbrev = match[2].toLowerCase()
  const year = parseInt(match[3])
  
  const month = MONTHS_ABBREV[monthAbbrev]
  if (!month) return null
  
  const fullYear = year < 100 ? 2000 + year : year
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear}`
}

// Detecta fecha dd/mm/aaaa, dd-mm-aaaa, o DD-Mes-YY
const DATE_RE = /(\b|\D)(\d{1,2})[\/\-](\d{1,2}|[A-Za-z]{3})[\/\-](\d{2,4})(\b|\D)/gi
// Detecta fechas con meses abreviados: DD-Mes-YY o DD-Mes-YYYY
const DATE_WITH_MONTH_RE = /(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{2,4})/gi
// Detecta importes (mejorado para formato argentino: punto miles, coma decimal)
const AMOUNT_RE = /([+-]?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|[+-]?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|[+-]?\d+(?:[.,]\d{2,3})?)/g
// Detecta cuotas "n/N", "n de N", "nn/nn"
const INSTALLMENTS_RE = /(\d{1,2})[\/\-](\d{1,2})|(\d{1,2})\s+de\s+(\d{1,2})/i
// Detecta intereses y cargos financieros
const INTEREST_KEYWORDS = /inter[eé]s|inter[eé]s\s*financ|financ|car\.?go\s*financ|mora|retenci[oó]n|iva|impuesto/i
// Detecta comisiones
const FEE_KEYWORDS = /comisi[oó]n|mantenimiento|cuota\s*de\s*manejo|anualidad/i

async function extractPdfText(file: File): Promise<string> {
  
  try {
    // Importación dinámica de pdfjs-dist para Next.js
    const pdfjsLib = await import('pdfjs-dist')
    
    // Configurar el worker - usar unpkg (más confiable que cdnjs)
    if (typeof window !== 'undefined') {
      const workerVersion = pdfjsLib.version || '5.4.296'
      // Usar unpkg como fuente del worker (más confiable)
      ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = 
        `https://unpkg.com/pdfjs-dist@${workerVersion}/build/pdf.worker.min.mjs`
    }
    
    const array = await file.arrayBuffer()
    
    // Cargar el PDF con configuración optimizada
    const pdf = await (pdfjsLib as any).getDocument({ 
      data: array,
      verbosity: 0 // Reducir logs
    }).promise
    
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((it: any) => it.str).join('\n') + '\n'
      text += pageText
    }
    
    return text
  } catch (error: any) {
    console.error('[extractPdfText] ERROR:', error)
    console.error('[extractPdfText] Stack:', error?.stack)
    throw error
  }
}

function parseByBank(bank: string, raw: string, template?: PDFImportTemplate): ParsedLine[] {
  const lines: ParsedLine[] = []
  // VERSIÓN DEL PARSER - Para verificar que se está usando el código actualizado
  // Dividir en líneas - ser más flexible con espacios y saltos de línea
  const rows = raw.split(/\r?\n+/).map(r => r.trim()).filter(Boolean)
  
  
  // NUEVA ESTRATEGIA: Buscar específicamente la sección "DETALLE DEL CONSUMO"
  // Esta es la única sección que contiene transacciones reales en formato tabular
  let detailStartIndex = -1
  let detailEndIndex = rows.length
  
  for (let i = 0; i < rows.length; i++) {
    const upperRow = rows[i].toUpperCase()
    if (upperRow.includes('DETALLE DEL CONSUMO')) {
      detailStartIndex = i
      break
    }
  }
  
  // Si no encontramos la sección, usar el método anterior como fallback
  if (detailStartIndex === -1) {
    return parseByBankLegacy(bank, raw, template)
  }
  
  // Buscar el final de la sección (SUBTOTAL o TOTAL A PAGAR después de encontrar transacciones)
  // También buscar "Cuotas a vencer" u otras secciones que marcan el fin del detalle
  for (let i = detailStartIndex + 1; i < rows.length; i++) {
    const upperRow = rows[i].toUpperCase()
    
    // Fin de sección si encuentra SUBTOTAL o TOTAL A PAGAR con números
    if ((upperRow.includes('SUBTOTAL') || upperRow.includes('TOTAL A PAGAR')) && /\d+[.,]\d+/.test(rows[i])) {
      detailEndIndex = i
      break
    }
    
    // También terminar si encontramos secciones claramente posteriores al detalle
    const endSectionKeywords = [
      'CUOTAS A VENCER',
      'OPCIONES DE FINANCIACION',
      'INFORMACION INSTITUCIONAL',
      'DESCRIPCIONES DE TASAS',
      'EL MONTO DE IVA'
    ]
    
    if (endSectionKeywords.some(keyword => upperRow.includes(keyword))) {
      // Retroceder un poco para asegurarnos de incluir el SUBTOTAL si existe
      detailEndIndex = Math.max(detailStartIndex + 10, i - 5)
      break
    }
  }
  
  // Extraer solo las líneas de la sección DETALLE DEL CONSUMO
  let detailRows = rows.slice(detailStartIndex, detailEndIndex)
  
  // IMPORTANTE: Guardar el detalleRows ORIGINAL antes de combinarlo (para buscar montos en líneas siguientes)
  const originalDetailRows = [...detailRows]
  
  // IMPORTANTE: En PDFs tabulares, las transacciones pueden estar en múltiples líneas
  // Necesitamos combinar líneas consecutivas que pertenecen a la misma transacción
  // Estrategia: Si una línea tiene fecha pero no tiene monto/comprobante, combinar con líneas siguientes
  const combinedDetailRows: string[] = []
  const combinedRowsMapping: Map<string, number> = new Map() // Mapea línea combinada -> índice original
  const dateRegexForCombining = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
  const hasAmountOrComprobante = (line: string) => {
    return /\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,}(?:,\d{2})/.test(line) || // Monto pesos
           /\d+,\d{2}/.test(line) || // Monto USD
           /\s\d{4,5}(?:\s|$)/.test(line) // Comprobante
  }
  
  let i = 0
  while (i < detailRows.length) {
    const currentLine = detailRows[i]
    const hasDate = dateRegexForCombining.test(currentLine)
    const originalIndex = i // Índice original en detailRows
    
    if (hasDate) {
      // Línea con fecha: intentar combinar con líneas siguientes hasta encontrar monto O otra fecha
      let combinedLine = currentLine
      let combined = false
      let linesCombined = 0
      let nextIndex = i + 1
      
      // Buscar hasta 10 líneas siguientes (muy agresivo para PDFs tabulares)
      for (let j = i + 1; j < Math.min(i + 11, detailRows.length) && !combined; j++) {
        const nextLine = detailRows[j]
        const nextHasDate = dateRegexForCombining.test(nextLine)
        
        if (nextHasDate && linesCombined > 0) {
          // La siguiente línea tiene fecha Y ya combinamos algo: guardar y detener
          combinedDetailRows.push(combinedLine)
          combinedRowsMapping.set(combinedLine, originalIndex)
          nextIndex = j - 1 // Ajustar índice para no procesar la línea siguiente dos veces
          combined = true
          break
        } else if (nextHasDate && linesCombined === 0) {
          // La siguiente línea tiene fecha y no hemos combinado nada
          // Esto significa que la línea actual solo tiene fecha, combinar de todos modos
          combinedLine += ' ' + nextLine
          linesCombined++
          combinedDetailRows.push(combinedLine)
          combinedRowsMapping.set(combinedLine, originalIndex)
          nextIndex = j
          combined = true
          break
        } else {
          // La siguiente línea no tiene fecha, combinarla
          combinedLine += ' ' + nextLine
          linesCombined++
          nextIndex = j + 1 // Actualizar para el siguiente intento
          
          // Si ahora tiene monto O comprobante, es una transacción completa
          if (hasAmountOrComprobante(combinedLine)) {
            combinedDetailRows.push(combinedLine)
            combinedRowsMapping.set(combinedLine, originalIndex)
            nextIndex = j + 1 // Saltar las líneas que combinamos
            combined = true
            break
          }
        }
      }
      
      if (!combined) {
        // Si no encontramos monto después de combinar, aún así incluir la línea combinada
        // (el filtro posterior validará si tiene la información necesaria)
        combinedDetailRows.push(combinedLine)
        combinedRowsMapping.set(combinedLine, originalIndex)
      }
      
      // Actualizar i al siguiente índice
      i = nextIndex
    } else {
      // Línea sin fecha: solo incluir si tiene monto (puede ser parte de una transacción anterior)
      // Pero solo si no es claramente un header
      const upperLine = currentLine.toUpperCase()
      if (!upperLine.includes('FECHA') && !upperLine.includes('REFERENCIA') && !upperLine.includes('COMPROBANTE')) {
        // Si tiene monto, puede ser continuación de una transacción
        if (hasAmountOrComprobante(currentLine)) {
          combinedDetailRows.push(currentLine)
          combinedRowsMapping.set(currentLine, originalIndex)
        }
      }
      i++
    }
  }
  
  detailRows = combinedDetailRows
  
  // PARSEO ESPECÍFICO PARA FORMATO TABULAR
  // Formato: FECHA DESCRIPCIÓN COMPROBANTE MONTO_PESOS MONTO_DOLARES
  // Ejemplo: "25-Jul-25 GOOGLE *Google O(USA,USD, 1,99) 00690 1,99"
  // Ejemplo: "25-Jul-25 DLO*Digital House AR 01512 63.104,00"
  
  // Declarar todas las regex ANTES de usarlas
  const dateRegex = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
  const dateRegexForFiltering = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
  // Regex para montos: formato argentino (punto miles, coma decimal) o USD (solo coma decimal)
  // Ejemplo: "63.104,00" (pesos) o "1,99" (USD)
  const pesosAmountRegex = /(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,}(?:,\d{2})?)/
  const usdAmountRegex = /(\d+,\d{2})/
  // Regex para comprobante (número de 4-5 dígitos)
  const comprobanteRegex = /\s(\d{4,5})\s/
  
  // Filtrar líneas que son headers o secciones (COMPRAS DEL MES, DEBITOS AUTOMATICOS, etc.)
  // Y validar que sean transacciones reales (tienen fecha + monto o comprobante)
  // También necesitamos un array paralelo con los índices originales para buscar montos después
  const transactionRowsWithIndices: Array<{ row: string; originalIndex: number }> = []
  
  for (let i = 0; i < detailRows.length; i++) {
    const row = detailRows[i]
    const upperRow = row.toUpperCase()
    
    // Ignorar headers
    if (upperRow.includes('FECHA') && upperRow.includes('REFERENCIA')) continue
    if (upperRow.includes('COMPRAS DEL MES')) continue
    if (upperRow.includes('DEBITOS AUTOMATICOS')) continue
    if (upperRow.includes('CUOTA DEL MES')) continue
    
    // Ignorar líneas que no tienen fecha
    const dateMatch = row.match(dateRegexForFiltering)
    if (!dateMatch) continue
    
    // Ignorar líneas que son claramente no-transacciones
    const dateIndex = row.indexOf(dateMatch[0])
    const textAfterDate = upperRow.substring(dateIndex + dateMatch[0].length).trim()
    
    const noTransactionKeywords = [
      'LLAMANDO AL 0800',
      'LLAMAR AL 0800',
      'CONTACTAR',
      'DIRIGIRSE',
      'UBICAR',
      'PAGUE SU RESUMEN',
      'ABONANDO EL PAGO',
      'DISPUTAR',
      'CUESTIONAR',
      'USTED DISPONE DE',
      'SEPTIEMBRE-25',
      'OCTUBRE-25',
      'NOVIEMBRE-25',
      'DICIEMBRE-25',
      'ENERO-26',
      'FEBRERO-26'
    ]
    
    if (noTransactionKeywords.some(keyword => textAfterDate.includes(keyword))) {
      continue
    }
    
    // Validar que sea una transacción real:
    // Debe tener al menos un monto (pesos o USD) O un comprobante (número de 4-5 dígitos)
    // O tener texto descriptivo sustancial después de la fecha (más de 5 caracteres)
    const hasPesos = pesosAmountRegex.test(row)
    const hasUSD = usdAmountRegex.test(row)
    const hasComprobante = /\s\d{4,5}(?:\s|$)/.test(row)
    const hasSubstantialDescription = textAfterDate.length > 5
    
    // Si tiene monto, comprobante, o descripción sustancial, es probablemente una transacción
    if (hasPesos || hasUSD || hasComprobante || hasSubstantialDescription) {
      const originalIndex = combinedRowsMapping.get(row) ?? i
      transactionRowsWithIndices.push({ row, originalIndex })
    } else {
    }
  }
  
  const transactionRows = transactionRowsWithIndices.map(item => item.row)
  
  // Procesar cada línea de transacción con su índice original
  for (let idx = 0; idx < transactionRowsWithIndices.length; idx++) {
    const { row, originalIndex } = transactionRowsWithIndices[idx]
    
    const dateMatch = row.match(dateRegex)
    if (!dateMatch) {
      continue
    }
    
    const originalDate = dateMatch[0].trim()
    let parsedDate = parseDateWithMonth(originalDate)
    
    // Si parseDateWithMonth no funcionó, intentar otros formatos
    if (!parsedDate) {
      const numericDateMatch = originalDate.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
      if (numericDateMatch) {
        const day = parseInt(numericDateMatch[1])
        const month = parseInt(numericDateMatch[2])
        const year = parseInt(numericDateMatch[3])
        const fullYear = year < 100 ? 2000 + year : year
        try {
          const date = new Date(fullYear, month - 1, day)
          if (!isNaN(date.getTime())) {
            parsedDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear}`
          }
        } catch (e) {
          // Ignorar errores de fecha
        }
      }
    }
    
    if (!parsedDate) {
      continue
    }
    
    // ESTRUCTURA TABULAR: FECHA | DESCRIPCIÓN | COMPROBANTE | PESOS | DÓLARES
    // Necesitamos extraer en el orden correcto, ignorando el COMPROBANTE
    
    // Obtener la posición de la fecha en la línea
    const dateIndex = dateMatch.index ?? row.indexOf(originalDate)
    
    // Paso 1: Extraer el comprobante (número de 4-5 dígitos separado por espacios, está después de la descripción)
    const remainingRow = row.substring(dateIndex + originalDate.length).trim()
    const comprobanteMatch = remainingRow.match(/\s(\d{4,5})(?:\s|$)/)
    let comprobanteEndIndex = 0
    
    if (comprobanteMatch) {
      comprobanteEndIndex = remainingRow.indexOf(comprobanteMatch[0]) + comprobanteMatch[0].length
    }
    
    // Paso 2: Extraer descripción (todo entre fecha y comprobante)
    let description = remainingRow.substring(0, comprobanteMatch ? remainingRow.indexOf(comprobanteMatch[0]) : remainingRow.length).trim()
    
    // Paso 3: Extraer montos DESPUÉS del comprobante (si existe)
    // El texto después del comprobante contiene PESOS y DÓLARES
    let textAfterComprobante = comprobanteMatch ? remainingRow.substring(comprobanteEndIndex).trim() : remainingRow
    
    // Buscar montos en la línea actual primero
    let usdMatches = textAfterComprobante.match(usdAmountRegex)
    let pesosMatches = textAfterComprobante.match(pesosAmountRegex)
    
    // Función para filtrar comprobantes de los matches
    const filterComprobantes = (matches: RegExpMatchArray | null): RegExpMatchArray | null => {
      if (!matches || matches.length === 0) return null
      const filtered = matches.filter(m => {
        const numericOnly = m.replace(/[.,]/g, '')
        // Si es un número de 4-5 dígitos sin punto miles ni coma decimal, es comprobante
        // O si es exactamente el mismo número que el comprobante detectado
        if (numericOnly.length >= 4 && numericOnly.length <= 5 && !m.includes('.') && !m.includes(',')) {
          return false
        }
        if (comprobanteMatch && m.includes(comprobanteMatch[1])) {
          return false
        }
        return true
      })
      return filtered.length > 0 ? filtered as any : null
    }
    
    // Filtrar comprobantes de los matches iniciales
    pesosMatches = filterComprobantes(pesosMatches)
    
    // Si no encontramos montos válidos en la línea actual, buscar en toda la línea (puede que estén antes del comprobante)
    // PERO solo si la línea no tiene números muy grandes que son parte del nombre del comercio
    if ((!usdMatches || usdMatches.length === 0) && (!pesosMatches || pesosMatches.length === 0)) {
      // Primero verificar que no hayamos encontrado un número grande que es parte del nombre
      // Si la línea tiene un número de 6+ dígitos sin punto miles, probablemente es parte del nombre
      const largeNumberInName = row.match(/\d{6,}/)
      if (largeNumberInName) {
        const largeNum = parseInt(largeNumberInName[0])
        // Si el número es muy grande (más de 100,000) y está en la descripción, probablemente no es un monto
        // Los montos típicos de consumos son menores a 1 millón, y si es mayor probablemente es parte del nombre
        if (largeNum > 100000) {
          // No buscar en toda la línea, esperar a buscar en líneas siguientes
        } else {
          // Buscar en toda la línea combinada (row puede tener múltiples líneas ya combinadas)
          usdMatches = row.match(usdAmountRegex)
          const allPesosMatches = row.match(pesosAmountRegex)
          
          // Filtrar comprobantes de los matches
          pesosMatches = filterComprobantes(allPesosMatches)
          
          textAfterComprobante = row // Usar toda la línea para búsqueda
        }
      } else {
        // Buscar en toda la línea combinada (row puede tener múltiples líneas ya combinadas)
        usdMatches = row.match(usdAmountRegex)
        const allPesosMatches = row.match(pesosAmountRegex)
        
        // Filtrar comprobantes de los matches
        pesosMatches = filterComprobantes(allPesosMatches)
        
        textAfterComprobante = row // Usar toda la línea para búsqueda
      }
    }
    
    // Verificar si tenemos montos válidos (no comprobantes, no números grandes en nombres)
    let hasValidAmounts = false
    
    // Primero filtrar pesosMatches si existen
    if (pesosMatches && pesosMatches.length > 0) {
      const validPesos = pesosMatches.filter(m => {
        const cleanAmount = m.replace(/\./g, '').replace(',', '.')
        const numericValue = parseFloat(cleanAmount) || 0
        // Filtrar números muy grandes (probablemente parte del nombre del comercio)
        if (numericValue > 1000000) {
          return false
        }
        const numericOnly = m.replace(/[.,]/g, '')
        if (numericOnly.length >= 6 && !m.includes('.')) {
          return false
        }
        return true
      })
      pesosMatches = validPesos.length > 0 ? validPesos as RegExpMatchArray : null
    }

    hasValidAmounts = !!(
      (usdMatches && usdMatches.length > 0) ||
      (pesosMatches && pesosMatches.length > 0)
    )
    
    // Si aún no encontramos montos válidos, buscar en las líneas siguientes del detalleRows ORIGINAL
    // (En PDFs tabulares, los montos pueden estar en líneas separadas)
    if (!hasValidAmounts) {
      // Usar directamente el originalIndex que ya tenemos del transactionRowsWithIndices[idx]
      if (originalIndex !== undefined && originalIndex >= 0 && originalIndex < originalDetailRows.length - 1) {
        
        // Buscar en las siguientes 10 líneas (más agresivo para PDFs tabulares)
        let foundAmountsInNextLine = false
        for (let k = originalIndex + 1; k < Math.min(originalIndex + 11, originalDetailRows.length); k++) {
          const nextDetailLine = originalDetailRows[k]
          const nextHasDate = dateRegex.test(nextDetailLine)
          
          // Si la siguiente línea tiene fecha, probablemente es otra transacción
          if (nextHasDate && k > originalIndex + 1) {
            break
          }
          
          // Buscar montos en la línea siguiente (puede que solo contenga montos)
          // Usar regex más flexible: buscar cualquier número que parezca monto (con coma decimal)
          // Incluir montos con punto miles (63.104,00) y montos pequeños sin punto miles (129,60)
          const flexiblePesosRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})/g // Con punto miles (63.104,00)
          const smallPesosRegex = /(\d{1,6},\d{2})(?:\s|$)/g // Sin punto miles pero con coma decimal (129,60)
          const nextUsdMatches = nextDetailLine.match(usdAmountRegex)
          
          // Combinar ambos tipos de matches
          const nextPesosMatchesWithThousands = [...(nextDetailLine.matchAll(flexiblePesosRegex) || [])].map(m => m[1])
          const nextPesosMatchesSmall = [...(nextDetailLine.matchAll(smallPesosRegex) || [])].map(m => m[1])
          const nextPesosMatches = [...nextPesosMatchesWithThousands, ...nextPesosMatchesSmall]
          
          // Filtrar comprobantes: si el match es solo el comprobante (4-5 dígitos sin punto miles), ignorarlo
          // También filtrar números muy grandes que son parte del nombre del comercio
          const validPesosMatches = nextPesosMatches.filter(m => {
            const numericOnly = m.replace(/[.,]/g, '')
            // Si es un número de 4-5 dígitos SIN coma decimal, probablemente es comprobante
            // Pero si tiene coma decimal (129,60), es un monto válido
            if (numericOnly.length >= 4 && numericOnly.length <= 5 && !m.includes(',') && !m.includes('.')) {
              return false // Es un número sin coma decimal, probablemente comprobante
            }
            // Si coincide con el comprobante detectado, ignorarlo
            if (comprobanteMatch && m.includes(comprobanteMatch[1])) {
              return false
            }
            // Si es un número de 6+ dígitos sin punto miles, probablemente es parte del nombre del comercio
            const cleanAmount = m.replace(/\./g, '').replace(',', '.')
            const numericValue = parseFloat(cleanAmount) || 0
            if (numericValue > 1000000 || (numericOnly.length >= 6 && !m.includes('.') && !m.includes(','))) {
              return false
            }
            return true
          })
          
          
          if ((nextUsdMatches && nextUsdMatches.length > 0) || validPesosMatches.length > 0) {
            usdMatches = nextUsdMatches
            pesosMatches = validPesosMatches.length > 0 ? validPesosMatches as any : null
            textAfterComprobante = nextDetailLine
            foundAmountsInNextLine = true
            break
          }
        }
        
        if (!foundAmountsInNextLine) {
        }
      } else {
      }
    }
    
    // Fallback final: buscar en toda la línea combinada
    const allUsdMatches = usdMatches || row.match(usdAmountRegex) || []
    
    // Si pesosMatches viene de líneas siguientes (es array), usarlo directamente
    // Si no, buscar en la línea actual
    let allPesosMatches: string[] = []
    if (pesosMatches && Array.isArray(pesosMatches)) {
      allPesosMatches = pesosMatches
    } else {
      // Buscar en la línea combinada usando regex flexible
      const flexiblePesosRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})/g
      const matches = [...(textAfterComprobante.matchAll(flexiblePesosRegex) || []), ...(row.matchAll(flexiblePesosRegex) || [])]
        .map(m => m[1])
        .filter((v, i, a) => a.indexOf(v) === i) // Eliminar duplicados
      
      // Filtrar comprobantes
      allPesosMatches = matches.filter(m => {
        const numericOnly = m.replace(/[.,]/g, '')
        if (numericOnly.length >= 4 && numericOnly.length <= 5 && !m.includes('.')) {
          return false
        }
        if (comprobanteMatch && m.includes(comprobanteMatch[1])) {
          return false
        }
        return true
      })
    }
    
    let montoPesos = 0
    let montoUSD = 0
    
    // Procesar monto PESOS
    if (allPesosMatches.length > 0) {
      // Filtrar montos que son parte del nombre del comercio (números muy grandes sin punto miles)
      const validPesosMatches = allPesosMatches.filter(m => {
        const cleanAmount = m.replace(/\./g, '').replace(',', '.')
        const numericValue = parseFloat(cleanAmount) || 0
        
        // Si es mayor a 1 millón, probablemente no es un monto válido de consumo
        if (numericValue > 1000000) {
          return false
        }
        
        // Si es un número de 6+ dígitos sin punto miles (ni coma decimal visible), probablemente es parte del nombre
        const numericOnly = m.replace(/[.,]/g, '')
        if (numericOnly.length >= 6 && !m.includes('.')) {
          return false
        }
        
        return true
      })
      
      if (validPesosMatches.length > 0) {
        // Si hay múltiples matches, usar el más grande (probablemente el monto principal)
        // O si hay solo uno, usarlo
        const pesosAmount = validPesosMatches.length === 1 
          ? validPesosMatches[0] 
          : validPesosMatches.reduce((max, current) => {
              const maxNum = parseFloat(max.replace(/\./g, '').replace(',', '.'))
              const currentNum = parseFloat(current.replace(/\./g, '').replace(',', '.'))
              return currentNum > maxNum ? current : max
            })
        const cleanPesos = pesosAmount.replace(/\./g, '').replace(',', '.')
        montoPesos = parseFloat(cleanPesos) || 0
      } else {
      }
    }
    
    // Procesar monto USD (formato: X,XX)
    // Debe ser un número pequeño con coma decimal (ej: 1,99, 2,99)
    // Los montos de 3+ dígitos (como 129,60) son PESOS, no USD
    if (allUsdMatches.length > 0) {
      const validUSDMatches = allUsdMatches.filter(m => {
        const index = row.indexOf(m)
        // Debe estar al final de la línea (columna DÓLARES) o dentro de paréntesis USD
        const isAtEnd = index > row.length * 0.7
        const isInParentheses = row.substring(Math.max(0, index - 20), index + 20).includes('USD')
        
        // Verificar que no sea un comprobante (números de 4-5 dígitos)
        const numericValue = m.replace(/[.,]/g, '')
        const isComprobante = numericValue.length >= 4 && numericValue.length <= 5 && !m.includes(',')
        
        // Los montos de USD suelen ser muy pequeños (menos de 100). Si es mayor, probablemente es PESOS
        const cleanAmount = m.replace(',', '.')
        const numericAmount = parseFloat(cleanAmount) || 0
        const isSmallAmount = numericAmount < 100
        
        return (isAtEnd || isInParentheses) && !isComprobante && isSmallAmount
      })
      
      if (validUSDMatches.length > 0) {
        // Tomar el último monto USD válido
        const usdAmount = validUSDMatches[validUSDMatches.length - 1]
        const cleanUSD = usdAmount.replace(',', '.')
        montoUSD = parseFloat(cleanUSD) || 0
      } else {
        // Si hay matches pero no pasaron el filtro, probablemente son PESOS pequeños sin punto miles
        // Agregarlos a allPesosMatches si no están ya
        for (const match of allUsdMatches) {
          const cleanAmount = match.replace(',', '.')
          const numericAmount = parseFloat(cleanAmount) || 0
          // Si es mayor o igual a 100, es PESOS
          if (numericAmount >= 100 && numericAmount < 1000000) {
            if (!allPesosMatches.includes(match)) {
              allPesosMatches.push(match)
            }
          }
        }
      }
    }
    
    // Si no encontramos montos explícitos, puede que el monto esté en la descripción
    // Ejemplo: "GOOGLE *Google O(USA,USD, 1,99)"
    if (montoPesos === 0 && montoUSD === 0) {
      // Buscar en la descripción por formato USD dentro de paréntesis
      const usdInDesc = row.match(/\(USA,USD,\s*(\d+,\d{2})\)/i)
      if (usdInDesc) {
        const cleanUSD = usdInDesc[1].replace(',', '.')
        montoUSD = parseFloat(cleanUSD) || 0
      }
    }
    
    // Limpiar descripción
    description = description.replace(/\s+/g, ' ').trim()
    
    // Si la descripción está vacía después de extraer el comprobante, puede que el comprobante esté mal detectado
    if (!description || description.length < 2) {
      // Fallback: usar todo después de la fecha hasta el primer monto encontrado
      const fallbackDesc = remainingRow.substring(0, Math.min(remainingRow.length, 100)).trim()
      if (fallbackDesc.length > 5) {
        description = fallbackDesc
      } else {
        description = 'Movimiento sin descripción'
      }
    }
    
    
    // Extraer cuotas del formato X/Y (puede estar en la descripción)
    let installments = null
    const cuotasMatch = description.match(/(\d{1,2})[\/\-](\d{1,2})/)
    if (cuotasMatch) {
      const current = Number(cuotasMatch[1])
      const total = Number(cuotasMatch[2])
      if (current && total && current <= total) {
        installments = { current, total }
        // Remover cuotas de la descripción para limpiarla
        description = description.replace(cuotasMatch[0], '').trim()
      }
    }
    
    // Detectar tipo
    const lowerDesc = description.toLowerCase()
    let type: 'consumption' | 'interest' | 'fee' = 'consumption'
    if (INTEREST_KEYWORDS.test(lowerDesc)) {
      type = 'interest'
    } else if (FEE_KEYWORDS.test(lowerDesc)) {
      type = 'fee'
    }
    
    // Solo agregar si hay al menos un monto válido
    if (montoPesos === 0 && montoUSD === 0) {
      continue
    }
    
    // Verificar duplicados
    const isDuplicate = lines.some(existing => {
      const sameDate = existing.date === parsedDate
      const descSimilar = existing.description.toLowerCase().trim() === description.toLowerCase().trim() ||
                          existing.description.toLowerCase().includes(description.substring(0, 15).toLowerCase()) ||
                          description.toLowerCase().includes(existing.description.substring(0, 15).toLowerCase())
      const amountSimilar = Math.abs(existing.montoPesos - montoPesos) < 0.01 || 
                           Math.abs(existing.montoUSD - montoUSD) < 0.01
      
      return sameDate && descSimilar && amountSimilar
    })
    
    if (isDuplicate) {
      continue
    }
    
    lines.push({
      date: parsedDate,
      originalDate: originalDate,
      description: description,
      montoPesos: Math.abs(montoPesos),
      montoUSD: Math.abs(montoUSD),
      installments,
      type,
    })
    
  }
  
  // AHORA: Buscar y parsear otras secciones importantes (Intereses, Impuestos, etc.)
  
  // Buscar secciones de intereses y cargos después del detalle de consumo
  // Estas secciones suelen aparecer después del SUBTOTAL y antes del TOTAL A PAGAR
  // Incluye variaciones para Visa y Mastercard
  // IMPORTANTE: Ordenar de más específico a menos específico para evitar falsos positivos
  const interestSections = [
    // Variantes específicas de Visa y Mastercard (deben empezar con la keyword)
    { keyword: '^INTERESES DE FINANCIACION', type: 'interest' as const },
    { keyword: '^INTERESES COMPENSATORIOS', type: 'interest' as const },
    { keyword: '^INTERESES PUNITORIOS', type: 'interest' as const },
    { keyword: '^IMPUESTO DE SELLOS', type: 'fee' as const },
    { keyword: '^PERCEPCION IVA DTO', type: 'fee' as const }, // PERCEPCION IVA DTO 354/18
    { keyword: '^PERCEP\\.AFIP RG', type: 'fee' as const }, // PERCEP.AFIP RG 4815
    { keyword: '^PERC IIBB SERV DIG', type: 'fee' as const }, // PERC IIBB SERV DIG CABA
    { keyword: '^I\\.V\\.A\\.', type: 'fee' as const }, // I.V.A. 21,0%
    // Palabras clave simples (pueden estar en cualquier parte, pero más abajo para evitar falsos positivos)
    { keyword: 'INTERESES', type: 'interest' as const }, // INTERESES (sin importar posición)
    { keyword: 'INTERES', type: 'interest' as const }, // INTERES (sin importar posición)
    // Impuestos y cargos
    { keyword: 'IMPUESTO', type: 'fee' as const }, // IMPUESTO (sin importar posición)
    { keyword: 'I\\.V\\.A\\.', type: 'fee' as const }, // I.V.A. (sin importar posición)
    { keyword: 'I\\.V\\.A', type: 'fee' as const }, // I.V.A (sin puntos finales)
    { keyword: 'IVA', type: 'fee' as const }, // IVA (sin puntos)
    { keyword: 'PERCEPCION', type: 'fee' as const }, // PERCEPCION (sin importar posición)
    { keyword: 'IIBB', type: 'fee' as const }, // IIBB (sin importar posición)
  ]
  
  // Buscar desde el final del detalle de consumo hasta el TOTAL A PAGAR
  // IMPORTANTE: Las líneas de intereses/impuestos pueden estar ANTES del TOTAL A PAGAR
  // Buscar desde ANTES del detalle también por si están en otra sección
  let otherSectionsStart = Math.max(0, detailStartIndex - 20) // Buscar desde 20 líneas antes del detalle
  let totalAPagarIndex = rows.length
  let opcionesFinanciacionStart = rows.length
  
  // PRIMERO: Buscar TOTAL A PAGAR (marcador de fin de secciones de intereses/impuestos)
  for (let i = detailEndIndex; i < rows.length; i++) {
    const upperRow = rows[i].toUpperCase()
    
    // Buscar TOTAL A PAGAR (puede estar en la línea o en líneas cercanas)
    if (upperRow.includes('TOTAL A PAGAR')) {
      // Verificar si tiene un monto en esta línea o en las siguientes 2 líneas
      let foundAmount = false
      for (let j = i; j < Math.min(i + 3, rows.length); j++) {
        if (/\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}/.test(rows[j])) {
          totalAPagarIndex = j
          foundAmount = true
          break
        }
      }
      if (foundAmount) break
    }
  }
  
  // SEGUNDO: Buscar OPCIONES DE FINANCIACION (debe estar después del TOTAL A PAGAR)
  for (let i = totalAPagarIndex; i < rows.length; i++) {
    const upperRow = rows[i].toUpperCase()
    if (upperRow.includes('OPCIONES DE FINANCIACION')) {
      opcionesFinanciacionStart = i
      break
    }
  }
  
  // NO limitar la búsqueda por OPCIONES DE FINANCIACION si está después del TOTAL A PAGAR
  // Las líneas de intereses están ANTES del TOTAL A PAGAR
  
  
  // Mostrar TODAS las líneas del rango para debugging completo
  // Buscar desde ANTES del detalle hasta el TOTAL A PAGAR
  if (otherSectionsStart < totalAPagarIndex && otherSectionsStart < rows.length) {
    const sampleStart = Math.max(0, otherSectionsStart)
    const sampleEnd = Math.min(totalAPagarIndex, rows.length)
    for (let idx = sampleStart; idx < sampleEnd; idx++) {
      const rowUpper = rows[idx].toUpperCase()
      const hasInterest = rowUpper.includes('INTERES') || rowUpper.includes('INTERESES')
      const hasImpuesto = rowUpper.includes('IMPUESTO')
      const hasIVA = rowUpper.includes('IVA') || rowUpper.includes('I.V.A')
      const hasPercepcion = rowUpper.includes('PERCEPCION')
      const hasIIBB = rowUpper.includes('IIBB')
      const markers = []
      if (hasInterest) markers.push('💡INTERES')
      if (hasImpuesto) markers.push('💡IMPUESTO')
      if (hasIVA) markers.push('💡IVA')
      if (hasPercepcion) markers.push('💡PERCEPCION')
      if (hasIIBB) markers.push('💡IIBB')
      const marker = markers.length > 0 ? ' ' + markers.join(' ') : ''
    }
  }
  
  // También buscar líneas ANTES del detalle que puedan contener intereses/impuestos
  // (por si están en una sección separada)
  if (detailStartIndex > 0) {
    const preDetailStart = Math.max(0, detailStartIndex - 50)
    let foundInterestBeforeDetail = false
    for (let idx = preDetailStart; idx < detailStartIndex; idx++) {
      const rowUpper = rows[idx].toUpperCase()
      const hasInterest = rowUpper.includes('INTERES') || rowUpper.includes('INTERESES')
      const hasImpuesto = rowUpper.includes('IMPUESTO')
      const hasIVA = rowUpper.includes('IVA') || rowUpper.includes('I.V.A')
      const hasPercepcion = rowUpper.includes('PERCEPCION')
      const hasIIBB = rowUpper.includes('IIBB')
      if (hasInterest || hasImpuesto || hasIVA || hasPercepcion || hasIIBB) {
        const markers = []
        if (hasInterest) markers.push('💡INTERES')
        if (hasImpuesto) markers.push('💡IMPUESTO')
        if (hasIVA) markers.push('💡IVA')
        if (hasPercepcion) markers.push('💡PERCEPCION')
        if (hasIIBB) markers.push('💡IIBB')
        const marker = markers.length > 0 ? ' ' + markers.join(' ') : ''
        foundInterestBeforeDetail = true
      }
    }
    if (foundInterestBeforeDetail) {
      otherSectionsStart = Math.min(otherSectionsStart, preDetailStart)
    }
  }
  
  // Buscar cada sección de interés/cargo
  
  for (let i = otherSectionsStart; i < totalAPagarIndex; i++) {
    const row = rows[i]
    const upperRow = row.toUpperCase().trim()
    
    // Log cada línea para debugging
    if (upperRow.includes('INTERES') || upperRow.includes('IMPUESTO') || upperRow.includes('IVA') || 
        upperRow.includes('PERCEPCION') || upperRow.includes('IIBB')) {
    }
    
    // PRIMERO: Filtrar líneas que claramente son parte de opciones de financiación
    // Verificar también en líneas anteriores cercanas para detectar el contexto
    let isOpcionFinanciacion = false
    for (let checkIdx = Math.max(0, i - 3); checkIdx <= i; checkIdx++) {
      const checkRow = rows[checkIdx]?.toUpperCase() || ''
      if (checkRow.includes('OPCIONES DE FINANCIACION') || 
          checkRow.includes('CUOTAS DE $') || 
          (checkRow.includes('CUOTAS') && checkRow.includes('TNA')) ||
          (checkRow.includes('TNA') && checkRow.includes('TEA'))) {
        isOpcionFinanciacion = true
        break
      }
    }
    
    if (isOpcionFinanciacion || upperRow.includes('TNA') || upperRow.includes('TEA') || 
        upperRow.includes('CFT') || upperRow.includes('CUOTAS DE $') || 
        (upperRow.includes('CUOTAS DE') && upperRow.includes('TNA')) ||
        upperRow.includes('CUOTAS DE $') || upperRow.match(/^\d+\s+CUOTAS/i)) {
      if (upperRow.includes('INTERES') || upperRow.includes('IMPUESTO')) {
      }
      continue
    }
    
    // SIMPLIFICAR: Primero buscar palabras clave de forma simple y directa
    // Buscar si esta línea contiene alguna de las secciones
    let foundSection = null
    let foundKeyword = ''
    
    for (const section of interestSections) {
      const trimmedUpperRow = upperRow.trim()
      let found = false
      
      // Simplificar: si la keyword empieza con ^, intentar buscar al inicio, pero si no funciona, buscar en cualquier parte
      if (section.keyword.startsWith('^')) {
        const searchPattern = section.keyword.substring(1).replace(/\\\./g, '.').replace(/\\/g, '')
        // Intentar al inicio primero
        if (trimmedUpperRow.startsWith(searchPattern) || trimmedUpperRow.includes(' ' + searchPattern)) {
          found = true
        } else {
          // Si no está al inicio, buscar en cualquier parte
          found = trimmedUpperRow.includes(searchPattern)
        }
      } else {
        // Palabra simple: buscar en cualquier parte
        const simpleKeyword = section.keyword.replace(/\\\./g, '.').replace(/\\/g, '').toUpperCase()
        found = trimmedUpperRow.includes(simpleKeyword)
      }
      
      if (found) {
        foundSection = section
        foundKeyword = section.keyword
        break // Usar la primera que encontremos
      }
    }
    
    // Si encontramos una sección, procesarla
    if (foundSection) {
      const section = foundSection
      
      // PRIMERO: Verificar que la línea NO sea solo una nota explicativa
      // Filtrar líneas que son explicaciones o notas sin montos reales
      // IMPORTANTE: Solo filtrar si contiene palabras específicas de nota explicativa
      const isExplanatoryNote = (upperRow.includes('NO PUEDE') && (upperRow.includes('DISCRIMINADO') || upperRow.includes('COMPUTARSE') || upperRow.includes('CREDITO FISCAL'))) ||
                                (upperRow.includes('NO SE PUEDE') && (upperRow.includes('DISCRIMINADO') || upperRow.includes('COMPUTARSE') || upperRow.includes('CREDITO FISCAL'))) ||
                                (upperRow.includes('NOTA:') && upperRow.includes('DISCRIMINADO')) ||
                                (upperRow.includes('OBSERVACION') && upperRow.includes('DISCRIMINADO'))
      
      if (isExplanatoryNote) {
        continue // Continuar con siguiente línea
      }
      
      // Verificar que la línea NO contenga términos de opciones de financiación
      if (upperRow.includes('TNA') || upperRow.includes('TEA') || upperRow.includes('CFT') || 
          upperRow.includes('CUOTAS DE $')) {
        continue // Continuar con siguiente línea
      }
      
      // AHORA: Buscar directamente el monto en la línea (más simple y directo)
      
      // Filtrar montos excesivamente grandes (más de 1 millón) que probablemente son opciones de financiación
      // Buscar montos en la línea actual PRIMERO (formato tabular), luego en siguientes líneas
      let montoEncontrado = 0
      let montoEncontradoEnLinea = -1
        
        // PRIMERO: Buscar monto en la MISMA línea (formato tabular común en Mastercard)
        // Patrones más flexibles para montos (incluye diferentes formatos)
        // IMPORTANTE: Buscar al final de la línea o después del texto descriptivo
        // El formato típico es: TEXTO MONTO (ej: "INTERESES DE FINANCIACION 171.828,46")
        const amountPatterns = [
          // PRIMERO: Buscar al final de la línea (más específico para formato tabular)
          /(\d{1,3}(?:\.\d{3})+,\d{2})\s*$/, // 171.828,46 al final
          /(\d{3,6},\d{2})\s*$/, // 480,54 al final
          // Formato argentino con puntos miles: 171.828,46 o 2.626,24 o 36.285,80
          /(\d{1,3}(?:\.\d{3})+,\d{2})/,
          // Números con coma decimal: cualquier número seguido de coma y 2 decimales
          /(\d+,\d{2})/, // 480,54 o 259,42 o 171.828,46
          // Formato alternativo: 1,234.56
          /(\d{1,3}(?:,\d{3})+\.\d{2})/,
          // Números simples con punto: 123.45
          /(\d+\.\d{2})/,
        ]
        
        // Buscar en la línea actual primero
        // Intentar buscar el monto al final de la línea (más común en formato tabular)
        for (const pattern of amountPatterns) {
          const amountMatch = row.match(pattern)
          if (amountMatch) {
            let cleanAmount = amountMatch[1].trim()
            
            // Normalizar formato: remover separadores de miles y convertir coma decimal a punto
            if (cleanAmount.includes('.')) {
              // Tiene punto: puede ser miles o decimal
              const parts = cleanAmount.split('.')
              if (parts.length === 2 && parts[1].length <= 3) {
                // Decimal: 123.45
                cleanAmount = cleanAmount.replace(',', '.')
              } else {
                // Miles: 1.234.567 o 1.234,56 o 171.828,46
                cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.')
              }
            } else if (cleanAmount.includes(',')) {
              // Solo coma: puede ser miles o decimal
              const parts = cleanAmount.split(',')
              if (parts.length === 2 && parts[1].length === 2) {
                // Decimal simple: 123,45 o 480,54 o 259,42
                // Verificar si tiene 3-6 dígitos antes de la coma (formato argentino común)
                const beforeComma = parts[0]
                if (beforeComma.length >= 3 && beforeComma.length <= 6) {
                  // Es un monto con coma decimal: 480,54 o 259,42
                  cleanAmount = cleanAmount.replace(',', '.')
                } else {
                  // Podría ser miles con coma
                  cleanAmount = cleanAmount.replace(/,/g, '').replace('.', '.')
                }
              } else {
                // Miles con coma: 1,234,567 o 1,234.56
                cleanAmount = cleanAmount.replace(/,/g, '').replace('.', '.')
              }
            }
            
            const parsedAmount = parseFloat(cleanAmount) || 0
            
            // Filtrar montos muy grandes (más de 1 millón = probable opción de financiación)
            // PERO: Para intereses e impuestos, permitir montos más grandes (hasta 2 millones)
            const maxAmount = section.type === 'interest' || section.type === 'fee' ? 2000000 : 1000000
            if (parsedAmount > 0 && parsedAmount <= maxAmount) {
              montoEncontrado = parsedAmount
              montoEncontradoEnLinea = i
              break
            } else {
            }
          }
        }
        
        // Si no encontramos monto, intentar buscar el último número que parezca un monto en la línea
        if (montoEncontrado === 0) {
          // Buscar TODOS los números que parezcan montos en la línea (más flexible)
          const allNumbers = row.match(/\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}/g)
          if (allNumbers && allNumbers.length > 0) {
            // Tomar el último número (más probable que sea el monto en formato tabular)
            const lastNumber = allNumbers[allNumbers.length - 1]
            
            // Normalizar el número
            let cleanAmount = lastNumber
            if (cleanAmount.includes('.')) {
              // Tiene puntos: son separadores de miles
              cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.')
            } else {
              // Solo coma: es decimal
              cleanAmount = cleanAmount.replace(',', '.')
            }
            
            const parsedAmount = parseFloat(cleanAmount) || 0
            
            const maxAmount = section.type === 'interest' || section.type === 'fee' ? 2000000 : 1000000
            if (parsedAmount > 0 && parsedAmount <= maxAmount) {
              montoEncontrado = parsedAmount
              montoEncontradoEnLinea = i
            } else {
            }
          } else {
          }
        }
        
        // Si no encontramos en la línea actual, buscar en siguientes 3 líneas
        if (montoEncontrado === 0) {
          for (let searchIdx = i + 1; searchIdx <= Math.min(i + 3, rows.length - 1); searchIdx++) {
            const searchRow = rows[searchIdx]
            
            for (const pattern of amountPatterns) {
              const amountMatch = searchRow.match(pattern)
              if (amountMatch) {
                let cleanAmount = amountMatch[1]
                // Normalizar formato: remover separadores de miles y convertir coma decimal a punto
                if (cleanAmount.includes('.')) {
                  // Tiene punto: puede ser miles o decimal
                  const parts = cleanAmount.split('.')
                  if (parts.length === 2 && parts[1].length <= 3) {
                    // Decimal: 123.45
                    cleanAmount = cleanAmount.replace(',', '.')
                  } else {
                    // Miles: 1.234.567 o 1.234,56
                    cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.')
                  }
                } else if (cleanAmount.includes(',')) {
                  // Solo coma: puede ser miles o decimal
                  const parts = cleanAmount.split(',')
                  if (parts.length === 2 && parts[1].length <= 3 && parts[0].length <= 4) {
                    // Decimal simple: 123,45
                    cleanAmount = cleanAmount.replace(',', '.')
                  } else {
                    // Miles con coma: 1,234,567 o 1,234.56
                    cleanAmount = cleanAmount.replace(/,/g, '').replace('.', '.')
                  }
                }
                
                const parsedAmount = parseFloat(cleanAmount) || 0
                
                // Filtrar montos muy grandes (más de 1 millón = probable opción de financiación)
                // PERO: Para intereses e impuestos, permitir montos más grandes (hasta 2 millones)
                const maxAmount = section.type === 'interest' || section.type === 'fee' ? 2000000 : 1000000
                if (parsedAmount > 0 && parsedAmount <= maxAmount) {
                  montoEncontrado = parsedAmount
                  montoEncontradoEnLinea = searchIdx
                  break
                }
              }
            }
            
            if (montoEncontrado > 0) {
              break // Salir del loop si encontramos un monto válido
            }
          }
        }
        
        // Verificar si encontramos un monto válido (con límite aumentado para intereses/impuestos)
        const maxAmount = section.type === 'interest' || section.type === 'fee' ? 2000000 : 1000000
        if (montoEncontrado > 0 && montoEncontrado <= maxAmount) {
          // Extraer descripción (limpiar la línea de números y espacios extra)
          // SIEMPRE usar la línea donde encontramos el keyword como descripción principal
          const descriptionRow = row // Usar la línea donde encontramos el keyword
          
          // Remover todos los patrones de montos posibles de la línea del keyword
          let description = descriptionRow
            .replace(/\d{1,3}(?:\.\d{3})+,\d{2}/g, '') // Formato argentino: 1.234,56
            .replace(/\d{1,3}(?:,\d{3})+\.\d{2}/g, '') // Formato alternativo: 1,234.56
            .replace(/\d{4,},\d{2}/g, '') // Números grandes con coma: 12345,67
            .replace(/\d+,\d{2}/g, '') // Números simples con coma: 123,45
            .replace(/\d+\.\d{2}/g, '') // Números simples con punto: 123.45
            .replace(/\d{6,}/g, '') // Números muy grandes sin separadores
            .replace(/\s+/g, ' ') // Normalizar espacios
            .trim()
          
          // Si la descripción está vacía o es muy corta, usar el keyword limpio
          if (!description || description.length < 3) {
            // Intentar buscar en líneas anteriores si la línea actual solo tiene el monto
            if (montoEncontradoEnLinea > i) {
              // El monto está en una línea siguiente, usar la línea actual como descripción
              description = row.replace(/\d{1,3}(?:\.\d{3})+,\d{2}|\d{6,},\d{2}/g, '').trim()
              description = description.replace(/\s+/g, ' ')
            }
            
            // Si aún está vacía, usar el keyword limpio
            if (!description || description.length < 3) {
              description = section.keyword
                .replace(/\\\./g, '.')
                .replace(/\\/g, '')
                .replace(/\^/g, '')
                .replace(/INTERESES?/gi, 'Intereses')
                .replace(/\\s\+/g, ' ')
            }
          }
          
          // Verificar que la descripción no contenga términos de opciones de financiación
          // PERO: Si es un impuesto real (IVA, IMPUESTO, PERCEPCION, IIBB), no filtrar por TNA/TEA
          const descUpper = description.toUpperCase()
          const isRealTax = section.type === 'fee' && (
            descUpper.includes('IVA') || 
            descUpper.includes('IMPUESTO') || 
            descUpper.includes('PERCEPCION') || 
            descUpper.includes('IIBB') ||
            section.keyword.toUpperCase().includes('IVA') ||
            section.keyword.toUpperCase().includes('IMPUESTO') ||
            section.keyword.toUpperCase().includes('PERCEPCION') ||
            section.keyword.toUpperCase().includes('IIBB')
          )
          
          // Verificar que la descripción NO sea una nota explicativa
          if (descUpper.includes('NO PUEDE') || 
              descUpper.includes('NO SE PUEDE') ||
              descUpper.includes('DISCRIMINADO') ||
              descUpper.includes('COMPUTARSE') ||
              descUpper.includes('CREDITO FISCAL') ||
              descUpper.includes('NOTA:') ||
              descUpper.includes('OBSERVACION')) {
            break
          }
          
          // Solo filtrar términos de financiación si NO es un impuesto real
          if (!isRealTax) {
            if (descUpper.includes('TNA') || descUpper.includes('TEA') || descUpper.includes('CFT') ||
                descUpper.includes('CUOTAS DE') || descUpper.includes('CUOTAS DE $') ||
                descUpper.match(/\d+\s+CUOTAS/i)) {
              break
            }
            
            // Verificar que la línea original no contenga términos de opciones de financiación
            if (upperRow.includes('CUOTAS DE $') || upperRow.match(/^\d+\s+CUOTAS/i)) {
              break
            }
          } else {
          }
          
          // Intentar encontrar una fecha asociada (puede estar en la misma línea o en líneas anteriores cercanas)
          let fecha = null
          for (let j = Math.max(0, i - 2); j <= i; j++) {
            const fechaMatch = rows[j].match(dateRegex)
            if (fechaMatch) {
              fecha = fechaMatch[0]
              break
            }
          }
          
          // Si no hay fecha específica, usar la fecha de corte del resumen (aproximada)
          // O usar una fecha genérica del mes
          const parsedDate = fecha ? parseDateWithMonth(fecha) : null
          
          if (!parsedDate) {
            // Intentar usar una fecha del detalle de consumos como referencia
            if (lines.length > 0) {
              // Usar la fecha más reciente de los consumos
              const latestConsumption = lines[lines.length - 1]
              fecha = latestConsumption.date
            } else {
              // Fecha genérica si no hay consumos
              fecha = new Date().toLocaleDateString('es-AR')
            }
          } else {
            fecha = parsedDate
          }
          
          // Verificar si ya existe una transacción similar para evitar duplicados
          const isDuplicate = lines.some(existing => 
            existing.description.toLowerCase().trim() === description.toLowerCase().trim() &&
            Math.abs(existing.montoPesos - montoEncontrado) < 0.01 &&
            existing.type === section.type
          )
          
          if (!isDuplicate) {
            lines.push({
              date: fecha,
              originalDate: fecha,
              description: description,
              montoPesos: montoEncontrado,
              montoUSD: 0,
              installments: null,
              type: section.type,
            })
            
          }
      } else {
        // Si no se encontró monto válido, puede ser que la sección esté mal formateada
      }
    }
  }
  
  
  if (lines.length === 0) {
  }
  
  return lines
}

// Función legacy como fallback si no se encuentra DETALLE DEL CONSUMO
function parseByBankLegacy(bank: string, raw: string, template?: PDFImportTemplate): ParsedLine[] {
  
  // Dividir en líneas primero
  const rows = raw.split(/\r?\n+/).map((r) => r.trim()).filter(Boolean)
  
  // Palabras clave a ignorar (no son transacciones)
  // Solo filtrar si la línea EMPIECE con estas palabras (más específico)
  const skipKeywords = [
    'TOTAL CONSUMOS DEL MES',
    'SUBTOTAL',
    'TOTAL A PAGAR',
    'SALDO PENDIENTE',
    'SALDO ANTERIOR',
    'SU PAGO',
    'CONSOLIDADO',
    'RESUMEN',
    'PERIODO',
    'FECHA DE CORTE',
    'FECHA DE PAGO'
  ]
  
  // Regex para fechas
  const dateRegexForFilter = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
  
  // Filtrar líneas manualmente en un bucle para evitar problemas de TDZ
  const filteredRowsArray: string[] = []
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx]
    // Si la línea tiene una fecha, es una transacción válida
    if (dateRegexForFilter.test(row)) {
      filteredRowsArray.push(row)
      continue
    }
    const upperRow = row.toUpperCase().trim()
    // Solo filtrar si la línea empieza con una de estas palabras clave
    let shouldSkip = false
    for (let k = 0; k < skipKeywords.length; k++) {
      const keyword = skipKeywords[k]
      if (upperRow.startsWith(keyword) || upperRow === keyword) {
        shouldSkip = true
        break
      }
    }
    if (!shouldSkip) {
      filteredRowsArray.push(row)
    }
  }
  
  let filteredRows = filteredRowsArray
  
  // Intentar combinar líneas consecutivas que puedan ser parte de una misma transacción
  // Si una línea tiene una fecha pero no tiene monto, combinar con líneas siguientes hasta encontrar monto
  const combinedRows: string[] = []
  const dateRegexForCombining = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
  const amountRegexForCombining = /(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+[.,]\d{1,3}|\$\s*\d+[.,]\d{2}|\$\d+[.,]\d{2})/
  
  for (let i = 0; i < filteredRows.length; i++) {
    const currentRow = filteredRows[i]
    const hasDate = dateRegexForCombining.test(currentRow)
    const hasAmount = amountRegexForCombining.test(currentRow)
    
    // Si la línea tiene fecha pero no tiene monto, intentar combinar con líneas siguientes
    if (hasDate && !hasAmount) {
      let combinedRow = currentRow
      let j = i + 1
      let combined = false
      let linesToSkip = 0
      
      // Buscar hasta 6 líneas siguientes o hasta encontrar otra fecha
      while (j < Math.min(i + 7, filteredRows.length) && !combined && linesToSkip < 6) {
        const nextRow = filteredRows[j]
        const nextHasDate = dateRegexForCombining.test(nextRow)
        const nextHasAmount = amountRegexForCombining.test(nextRow)
        
        if (!nextHasDate) {
          // La siguiente línea no tiene fecha, combinar
          combinedRow += ' ' + nextRow
          linesToSkip++
          if (nextHasAmount) {
            // Encontramos un monto, guardar la combinación y saltar líneas combinadas
            combinedRows.push(combinedRow)
            i += linesToSkip // Saltar las líneas que combinamos
            combined = true
            break
          }
          j++
        } else {
          // La siguiente línea tiene fecha, detener búsqueda
          // Pero si ya combinamos algo, guardarlo
          if (linesToSkip > 0) {
            combinedRows.push(combinedRow)
            i += linesToSkip
            combined = true
            break
          }
          break
        }
      }
      
      if (combined) {
        continue
      }
      
      // Si no encontramos monto en las siguientes líneas, aún así incluir la línea original
      // El parsing posterior intentará buscar en más líneas
      combinedRows.push(currentRow)
    } else {
      combinedRows.push(currentRow)
    }
  }
  filteredRows = combinedRows
  
  
  // Mostrar ejemplos de líneas con fechas para debugging
  const dateExamples = filteredRows.filter(row => /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/.test(row)).slice(0, 10)
  
  // Regex mejorado para detectar fechas: múltiples formatos
  // Formato 1: DD-MMM-YY o DD-MMM-YYYY (ej: 25-Jul-25, 25-Jul-2025)
  // Formato 2: DD/MM/YYYY o DD-MM-YYYY
  // Formato 3: DD MMM YY (con espacios)
  const dateRegexes = [
    /(\d{1,2}[-/]\w{3}[-/]\d{2,4})/i,  // DD-MMM-YY o DD-MMM-YYYY
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,  // DD/MM/YYYY o DD-MM-YYYY
    /(\d{1,2}\s+\w{3}\s+\d{2,4})/i      // DD MMM YY (con espacios)
  ]
  
  const lines: ParsedLine[] = []

  // Debug: contar líneas procesadas
  let linesProcessed = 0
  let datesFound = 0
  let validTransactions = 0
  
  // DEBUG: Mostrar ejemplos de líneas con fechas y sus siguientes líneas ANTES de procesar
  const dateExampleRegex = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
  let exampleCount = 0
  for (let i = 0; i < filteredRows.length && exampleCount < 10; i++) {
    const testRow = filteredRows[i]
    if (dateExampleRegex.test(testRow)) {
      exampleCount++
    }
  }
  
  // Para cada línea, buscar si empieza con fecha
  for (let i = 0; i < filteredRows.length; i++) {
    const row = filteredRows[i]
    linesProcessed++
    
    // Buscar fecha en la línea usando múltiples regex
    let dateMatch: RegExpMatchArray | null = null
    let dateRegexUsed = null
    
    for (const regex of dateRegexes) {
      const match = row.match(regex)
      if (match && match[0]) {
        dateMatch = match
        dateRegexUsed = regex
        break
      }
    }
    
    if (!dateMatch || !dateMatch[0]) continue
    datesFound++
    
    // Verificar que la fecha esté al inicio o cerca del inicio (más flexible: hasta 50 caracteres)
    const dateIndex = row.indexOf(dateMatch[0])
    if (dateIndex > 50) {
      // Si la fecha está muy lejos, verificar si hay texto antes que indique que no es una transacción
      const beforeDate = row.substring(0, dateIndex).trim().toUpperCase()
      // Solo ignorar si tiene palabras clave de encabezado
      const isHeader = skipKeywords.some(keyword => beforeDate.includes(keyword)) || 
                       /^(PERIODO|RESUMEN|FECHA|CORTE|PAGO|DESDE|HASTA)/.test(beforeDate)
      if (isHeader) {
        continue
      }
    }
    
    const originalDate = dateMatch[0].trim() // Ej: "25-Jul-25", "25/07/2025", etc.
    
    // Convertir fecha a formato dd/mm/yyyy
    let parsedDate = parseDateWithMonth(originalDate)
    
    // Si parseDateWithMonth no funcionó, intentar otros formatos
    if (!parsedDate) {
      // Intentar formato DD/MM/YYYY o DD-MM-YYYY
      const numericDateMatch = originalDate.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
      if (numericDateMatch) {
        const day = parseInt(numericDateMatch[1])
        const month = parseInt(numericDateMatch[2])
        const year = parseInt(numericDateMatch[3])
        const fullYear = year < 100 ? 2000 + year : year
        try {
          const date = new Date(fullYear, month - 1, day)
          if (!isNaN(date.getTime())) {
            parsedDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear}`
          }
        } catch (e) {
          // Ignorar errores de fecha
        }
      }
    }
    
    if (!parsedDate) {
      continue // Si no se puede parsear, saltar
    }
    
    // Remover la fecha de la línea para obtener descripción y monto
    let remainingRow = row.substring(dateIndex + originalDate.length).trim()
    
    // Si la fecha está seguida de "- " o " - ", puede que sea parte de una descripción
    // Ejemplo: "19/08/2025- AUBASA"
    if (remainingRow.startsWith('-') || remainingRow.startsWith(' -')) {
      // Mantener la descripción que viene después del guión
      remainingRow = remainingRow.replace(/^[- ]+/, '').trim()
    }
    
    // Buscar todos los números en la línea (montos)
    // Regex mejorado: captura números con formato argentino (punto miles, coma decimal) o inglés
    // También captura números simples con decimales y enteros grandes
    // Incluye formatos con $ y sin signos
    const amountRegex = /([+-]?\d{1,3}(?:\.\d{3})+(?:,\d{2})?|[+-]?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|[+-]?\d+[.,]\d{1,3}|[+-]?\d{4,}|\d+[.,]\d{2}|[+-]?\$?\s*\d+[.,]\d{2}|\$\s?\d+(?:[.,]\d{2})?)/g
    let amountMatches = remainingRow.match(amountRegex)
    
    // Si no encuentra montos en la línea actual o remainingRow está casi vacío, buscar en líneas siguientes
    const dateRegexForAmountSearch = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
    if (!amountMatches || amountMatches.length === 0 || remainingRow.length < 5) {
      let extendedRow = remainingRow
      let linesCombined = 0
      let foundAmount = false
      const isDateOnly = remainingRow.length < 5
      const hasDescription = remainingRow.length > 5 && remainingRow.length < 100
      
      // Si la línea solo tiene fecha, buscar más agresivamente
      if (isDateOnly) {
      } else if (hasDescription) {
      }
      
      // Intentar combinar con líneas siguientes (hasta 25 líneas si es solo fecha, o hasta encontrar otra fecha)
      // Si ya tiene descripción, buscar más agresivamente porque el monto debe estar cerca
      const maxLinesToSearch = isDateOnly ? 25 : (hasDescription ? 18 : 15)
      for (let j = i + 1; j < Math.min(i + maxLinesToSearch + 1, filteredRows.length) && linesCombined < maxLinesToSearch && !foundAmount; j++) {
        const nextRow = filteredRows[j]
        const nextHasDate = dateRegexForAmountSearch.test(nextRow)
        
        if (!nextHasDate) {
          // La siguiente línea no tiene fecha, probablemente es continuación de la transacción
          if (extendedRow.length > 0) {
            extendedRow += ' ' + nextRow
          } else {
            extendedRow = nextRow
          }
          linesCombined++
          
          // Verificar si ahora tiene monto
          const extendedMatches = extendedRow.match(amountRegex)
          if (extendedMatches && extendedMatches.length > 0) {
            // Validar que el monto sea razonable
            const lastMatch = extendedMatches[extendedMatches.length - 1]
            const cleanAmount = lastMatch.replace(/[$\s]/g, '')
            // Manejar formato argentino (punto miles, coma decimal)
            let numericValue = 0
            if (cleanAmount.includes(',')) {
              // Formato argentino: 1.234,56
              numericValue = parseFloat(cleanAmount.replace(/\./g, '').replace(',', '.')) || 0
            } else if (cleanAmount.includes('.')) {
              // Puede ser formato inglés o miles
              const parts = cleanAmount.split('.')
              if (parts.length === 2 && parts[1].length <= 3) {
                // Probablemente decimal: 123.45
                numericValue = parseFloat(cleanAmount) || 0
              } else {
                // Probablemente miles: 1.234.567
                numericValue = parseFloat(cleanAmount.replace(/\./g, '')) || 0
              }
            } else {
              numericValue = parseFloat(cleanAmount) || 0
            }
            
            if (numericValue > 0.01 && numericValue < 10000000) {
              amountMatches = extendedMatches
              remainingRow = extendedRow
              foundAmount = true
              break
            }
          }
        } else {
          // La siguiente línea tiene fecha
          // Si nuestra línea solo tenía fecha y aún no encontramos monto, 
          // puede que la descripción/monto esté en líneas intermedias que no detectamos
          // O puede que la estructura sea: fecha1, descripción, monto, fecha2
          if (isDateOnly && linesCombined === 0) {
            // Intentar buscar en líneas anteriores (por si el formato es fecha-descr-monto)
            // O buscar en líneas entre esta fecha y la siguiente
            let descWithAmount = ''
            const searchBackwards = false
            
            // Primero intentar buscar entre líneas
            for (let k = i + 1; k < j; k++) {
              const intermediateRow = filteredRows[k]
              if (descWithAmount.length > 0) {
                descWithAmount += ' ' + intermediateRow
              } else {
                descWithAmount = intermediateRow
              }
            }
            
            // Verificar si tiene monto
            const intermediateMatches = descWithAmount.match(amountRegex)
            if (intermediateMatches && intermediateMatches.length > 0) {
              const lastMatch = intermediateMatches[intermediateMatches.length - 1]
              const cleanAmount = lastMatch.replace(/[$\s]/g, '')
              const numericValue = parseFloat(cleanAmount.replace(',', '.')) || 0
              
              if (numericValue > 0.01 && numericValue < 10000000) {
                amountMatches = intermediateMatches
                remainingRow = descWithAmount
                foundAmount = true
                break
              }
            }
            
            // Si no encontramos, intentar con la siguiente fecha y sus líneas
            let descWithAmount2 = nextRow
            for (let k = j + 1; k < Math.min(j + 5, filteredRows.length); k++) {
              const furtherRow = filteredRows[k]
              if (!dateRegexForAmountSearch.test(furtherRow)) {
                descWithAmount2 += ' ' + furtherRow
                const furtherMatches = descWithAmount2.match(amountRegex)
                if (furtherMatches && furtherMatches.length > 0) {
                  const lastMatch = furtherMatches[furtherMatches.length - 1]
                  const cleanAmount = lastMatch.replace(/[$\s]/g, '')
                  const numericValue = parseFloat(cleanAmount.replace(',', '.')) || 0
                  
                  if (numericValue > 0.01 && numericValue < 10000000) {
                    amountMatches = furtherMatches
                    remainingRow = descWithAmount2
                    foundAmount = true
                    break
                  }
                }
              } else {
                break
              }
            }
            if (foundAmount) {
              break
            }
          }
          // Detener búsqueda si la siguiente línea tiene fecha y ya buscamos
          break
        }
      }
      
      if (!foundAmount && linesCombined > 0) {
      }
    }
    
    if (!amountMatches || amountMatches.length === 0) {
      // Último intento desesperado: buscar cualquier número que parezca un monto en las siguientes líneas
      // Esto maneja casos donde el formato del PDF es completamente diferente
      
      // Buscar en las siguientes 20 líneas cualquier número que parezca un monto válido
      for (let j = i + 1; j < Math.min(i + 21, filteredRows.length); j++) {
        const nextRow = filteredRows[j]
        const nextHasDate = dateRegexForAmountSearch.test(nextRow)
        
        // Buscar cualquier número en esta línea (más permisivo)
        const anyNumbers = nextRow.match(/\d+[.,]\d{2,3}|\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,}/g)
        
        if (anyNumbers && anyNumbers.length > 0) {
          // Verificar cada número para ver si es un monto válido
          for (const num of anyNumbers) {
            const cleanNum = num.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')
            const numericValue = parseFloat(cleanNum) || 0
            
            // Validar que sea un monto razonable de transacción
            if (numericValue > 0.01 && numericValue < 10000000 && numericValue !== Math.floor(numericValue)) {
              // Tiene decimales, probablemente es un monto
              amountMatches = [num]
              
              // Si la línea no tiene fecha, usarla como descripción completa
              if (!nextHasDate) {
                remainingRow = nextRow
                break
              } else {
                // Tiene fecha, pero el monto puede ser de nuestra transacción
                // Usar la línea anterior si existe y no tiene fecha
                if (j > i + 1) {
                  const prevRow = filteredRows[j - 1]
                  if (!dateRegexForAmountSearch.test(prevRow)) {
                    remainingRow = prevRow + ' ' + nextRow
                  } else {
                    remainingRow = nextRow
                  }
                } else {
                  remainingRow = nextRow
                }
                break
              }
            }
          }
          
          if (amountMatches && amountMatches.length > 0) {
            break
          }
        }
        
        // Si encontramos otra fecha y ya buscamos 10+ líneas, detener
        if (nextHasDate && j > i + 10) {
          break
        }
      }
      
      if (!amountMatches || amountMatches.length === 0) {
        // Debug: mostrar las siguientes 15 líneas para diagnóstico completo
        if (i + 1 < filteredRows.length) {
        }
        
        // ÚLTIMO INTENTO: buscar cualquier patrón numérico en las siguientes 30 líneas
        for (let j = i + 1; j < Math.min(i + 31, filteredRows.length); j++) {
          const nextRow = filteredRows[j]
          // Buscar cualquier número que pueda ser un monto
          const allNumbers = nextRow.match(/\d+(?:[.,]\d+)?/g)
          if (allNumbers) {
            for (const num of allNumbers) {
              const cleanNum = num.replace(/[$\s]/g, '')
              let numericValue = 0
              
              // Intentar parsear el número
              if (cleanNum.includes(',')) {
                // Formato con coma: puede ser decimal argentino o miles
                const parts = cleanNum.split(',')
                if (parts.length === 2 && parts[1].length <= 3) {
                  // Probablemente decimal: 1,99 o 1234,56
                  numericValue = parseFloat(cleanNum.replace(/\./g, '').replace(',', '.')) || 0
                } else {
                  // Miles con coma
                  numericValue = parseFloat(cleanNum.replace(/\./g, '').replace(',', '')) || 0
                }
              } else if (cleanNum.includes('.')) {
                const parts = cleanNum.split('.')
                if (parts.length === 2 && parts[1].length <= 3) {
                  // Probablemente decimal: 1.99
                  numericValue = parseFloat(cleanNum) || 0
                } else {
                  // Miles con punto
                  numericValue = parseFloat(cleanNum.replace(/\./g, '')) || 0
                }
              } else {
                numericValue = parseFloat(cleanNum) || 0
              }
              
              // Si es un monto razonable (más de $0.01 y menos de $10M)
              if (numericValue > 0.01 && numericValue < 10000000) {
                // Verificar si parece un monto (tiene decimales o es >= 10)
                const hasDecimals = numericValue !== Math.floor(numericValue)
                const looksLikeAmount = hasDecimals || numericValue >= 10
                
                if (looksLikeAmount) {
                  // Intentar usar este número como monto
                  amountMatches = [num]
                  remainingRow = nextRow
                  break
                }
              }
            }
            if (amountMatches && amountMatches.length > 0) break
          }
          
          // Si encontramos otra fecha después de buscar 5+ líneas, probablemente esta transacción no tiene monto
          const nextHasDate = dateRegexForAmountSearch.test(nextRow)
          if (nextHasDate && j > i + 5) {
            break
          }
        }
        
        // Si después de todo aún no encontramos monto, saltar esta transacción
        if (!amountMatches || amountMatches.length === 0) {
          continue
        } else {
        }
      }
    }
    
    // Tomar el último número como monto
    const lastAmount = amountMatches[amountMatches.length - 1]
    
    // Remover el último monto para obtener la descripción
    const lastAmountIndex = remainingRow.lastIndexOf(lastAmount)
    let description = remainingRow.substring(0, lastAmountIndex).trim()
    
    // Limpiar descripción: remover números sobrantes al final
    description = description.replace(/\s+\d+$/, '').trim()
    
    if (!description || description.length < 2) {
      description = 'Movimiento sin descripción'
    }
    
    // Determinar si es PESOS o USD
    let montoPesos = 0
    let montoUSD = 0
    
    // Normalizar el monto y determinar si es PESOS o USD
    let norm = lastAmount.replace(/[$\s]/g, '').trim()
    
    // Contar puntos y comas para determinar formato
    const dotCount = (norm.match(/\./g) || []).length
    const commaCount = (norm.match(/,/g) || []).length
    const digitCount = norm.replace(/[.,]/g, '').length
    
    // Determinar formato:
    // - Múltiples puntos = separador de miles (formato argentino: 1.234.567,89)
    // - Punto + coma = punto miles, coma decimal (formato argentino: 1.234,56)
    // - Solo coma con pocos dígitos = probablemente USD (ej: 1,99)
    // - Sin separadores y muchos dígitos = probablemente PESOS
    
    const hasMultipleDots = dotCount > 1
    const hasDotAndComma = dotCount > 0 && commaCount > 0
    const hasOnlyComma = commaCount > 0 && dotCount === 0
    const hasOnlyDot = dotCount === 1 && commaCount === 0
    
    if (hasMultipleDots || hasDotAndComma) {
      // Formato argentino: punto miles, coma decimal = PESOS
      // Ejemplo: 1.234.567,89 o 1.234,56
      norm = norm.replace(/\./g, '').replace(',', '.')
      montoPesos = parseFloat(norm) || 0
    } else if (hasOnlyComma && digitCount <= 4) {
      // Solo coma decimal y pocos dígitos = USD
      // Ejemplo: 1,99
      norm = norm.replace(',', '.')
      montoUSD = parseFloat(norm) || 0
    } else if (hasOnlyDot) {
      // Un solo punto: verificar si es decimal o miles
      const parts = norm.split('.')
      if (parts[1] && parts[1].length <= 3 && parts[0].length <= 3) {
        // Probablemente decimal (formato inglés): ej. 99.99
        montoUSD = parseFloat(norm) || 0
      } else if (parts[0].length > 3) {
        // Muchos dígitos antes del punto = miles, asumir PESOS
        norm = norm.replace('.', '')
        montoPesos = parseFloat(norm) || 0
      } else {
        // Por defecto tratar como decimal
        montoUSD = parseFloat(norm) || 0
      }
    } else {
      // Sin separadores o formato desconocido
      const numericValue = parseFloat(norm.replace(/[.,]/g, '.')) || 0
      if (numericValue > 0) {
        // Si tiene muchos dígitos o es grande, probablemente PESOS
        if (digitCount > 4 || numericValue > 1000) {
          montoPesos = numericValue
        } else {
          montoUSD = numericValue
        }
      }
    }
    
    // Solo agregar si hay al menos un monto válido
    if (montoPesos === 0 && montoUSD === 0) continue
    
    // Buscar cuotas en la descripción o línea siguiente
    let installments = null
    const cuotasMatch = description.match(/(\d{1,2})[\/\-](\d{1,2})|(\d{1,2})\s+de\s+(\d{1,2})/i)
    if (cuotasMatch) {
      const current = Number(cuotasMatch[1] || cuotasMatch[3])
      const total = Number(cuotasMatch[2] || cuotasMatch[4])
      if (current && total && current <= total) {
        installments = { current, total }
      }
    }
    
    // Si no se encontró en la descripción, buscar en la línea siguiente
    if (!installments && i + 1 < filteredRows.length) {
      const nextRow = filteredRows[i + 1]
      const nextCuotasMatch = nextRow.match(/(\d{1,2})[\/\-](\d{1,2})|(\d{1,2})\s+de\s+(\d{1,2})/i)
      if (nextCuotasMatch) {
        const current = Number(nextCuotasMatch[1] || nextCuotasMatch[3])
        const total = Number(nextCuotasMatch[2] || nextCuotasMatch[4])
        if (current && total && current <= total) {
          installments = { current, total }
        }
      }
    }
    
    // Detectar tipo
    const lowerDesc = description.toLowerCase()
    let type: 'consumption' | 'interest' | 'fee' = 'consumption'
    if (INTEREST_KEYWORDS.test(lowerDesc)) {
      type = 'interest'
    } else if (FEE_KEYWORDS.test(lowerDesc)) {
      type = 'fee'
    }
    
    // Solo agregar si hay al menos un monto válido
    if (montoPesos === 0 && montoUSD === 0) {
      continue
    }
    
    validTransactions++
    
    // Verificar duplicados antes de agregar (por fecha, descripción y monto similar)
    const isDuplicate = lines.some(existing => {
      const sameDate = existing.date === parsedDate
      const descSimilar = existing.description.toLowerCase().trim() === description.toLowerCase().trim() ||
                          existing.description.toLowerCase().includes(description.substring(0, 10).toLowerCase()) ||
                          description.toLowerCase().includes(existing.description.substring(0, 10).toLowerCase())
      const amountSimilar = Math.abs(existing.montoPesos - montoPesos) < 0.01 || 
                           Math.abs(existing.montoUSD - montoUSD) < 0.01
      
      return sameDate && descSimilar && amountSimilar
    })
    
    if (isDuplicate) {
      continue
    }
    
    lines.push({
      date: parsedDate,
      originalDate: originalDate,
      description: description,
      montoPesos: Math.abs(montoPesos),
      montoUSD: Math.abs(montoUSD),
      installments,
      type,
    })
    
  }
  
  // Debug: mostrar estadísticas detalladas
  
  if (lines.length === 0 && datesFound > 0) {
  }
  
  if (lines.length === 0 && datesFound === 0) {
  }

  return lines
}

export default function CreditCardStatementImport({ isOpen, onClose, cardId }: Props) {
  const { error, success } = useToastContext()
  const { categories, fetchCategories } = useCategories()
  const [bank, setBank] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedLine[]>([])
  const [editableRows, setEditableRows] = useState<EditableParsedLine[]>([])
  const [saving, setSaving] = useState(false)
  const [rawText, setRawText] = useState<string>('')
  const [showRawText, setShowRawText] = useState(false)
  const [templates, setTemplates] = useState<PDFImportTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [smartTemplate, setSmartTemplate] = useState<SmartTemplate | null>(null)
  const [loadingSmartTemplate, setLoadingSmartTemplate] = useState(false)
  const [showCorrectionAssistant, setShowCorrectionAssistant] = useState(false)

  // Cargar categorías, templates y smart template al abrir el modal
  useEffect(() => {
    if (isOpen && cardId) {
      fetchCategories()
      loadTemplates()
      loadSmartTemplate()
    }
  }, [isOpen, cardId])

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const res = await fetch(`/api/credit-cards/${cardId}/templates`)
      const data = await res.json()
      if (data.success) {
        setTemplates(data.templates || [])
        // Seleccionar el primer template si hay uno
        if (data.templates && data.templates.length > 0) {
          setSelectedTemplate(data.templates[0].id)
        }
      }
    } catch (e) {
      console.error('Error cargando templates:', e)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const loadSmartTemplate = async () => {
    try {
      setLoadingSmartTemplate(true)
      const res = await fetch(`/api/credit-cards/${cardId}/smart-template`)
      const data = await res.json()
      if (data.success && data.smartTemplate) {
        setSmartTemplate(data.smartTemplate)
      }
    } catch (e) {
      console.error('Error cargando smart template:', e)
    } finally {
      setLoadingSmartTemplate(false)
    }
  }

  const handleParse = async () => {
    try {
      if (!file) {
        console.error('[PDF Import] No hay archivo seleccionado')
        error('Selecciona un archivo PDF')
        return
      }
      if (!bank) {
        console.error('[PDF Import] No hay banco seleccionado')
        error('Selecciona un banco')
        return
      }
      
      setParsing(true)
      
      const text = await extractPdfText(file)
      setRawText(text) // Guardar texto crudo para debug y aprendizaje
      
      // Mostrar muestra del texto extraído
      if (text.length > 0) {
      } else {
        console.error('[PDF Import] El PDF no contiene texto extraíble. El PDF podría estar escaneado.')
        error('El PDF no contiene texto. Puede ser un PDF escaneado. Intenta con un PDF con texto seleccionable.')
        setParsing(false)
        return
      }
      
      // Buscar template seleccionado o smart template
      const template = smartTemplate || templates.find(t => t.id === selectedTemplate)
      
      const parsed = parseByBank(bank, text, template)
      
      // Aplicar mapeos de comercios para autocategorización
      let editableParsedRows: EditableParsedLine[]
      if (smartTemplate?.mapeoComercios) {
        editableParsedRows = applyMerchantMappings(parsed, smartTemplate.mapeoComercios)
      } else {
        // Crear filas editables sin mapeos
        editableParsedRows = parsed.map((row, i) => ({
          id: `row-${i}`,
          ...row,
          categoryId: undefined,
          subcategoryId: undefined,
          ignored: false,
        }))
      }
      
      setRows(parsed) // Mantener para compatibilidad
      setEditableRows(editableParsedRows)
      setShowCorrectionAssistant(true)
      
      if (parsed.length === 0) {
        error('No se detectaron movimientos. Abre la consola del navegador (F12) para ver detalles del parsing.')
      } else {
        const templateName = smartTemplate ? 'Plantilla Inteligente' : template?.name
        success(`Se detectaron ${parsed.length} movimientos${templateName ? ` usando ${templateName}` : ''}`)
      }
    } catch (e: any) {
      console.error('[PDF Import] Error:', e)
      console.error('[PDF Import] Stack:', e?.stack)
      error(`No se pudo leer el PDF: ${e?.message || 'Error desconocido'}`)
    } finally {
      setParsing(false)
    }
  }

  const handleSaveWithLearning = async (rowsToSave: EditableParsedLine[]) => {
    if (rowsToSave.length === 0) return
    try {
      setSaving(true)
      
      // Convertir rows a formato esperado por la API (agregar amount calculado)
      const itemsToSave = rowsToSave.map(row => ({
        date: row.date,
        originalDate: row.originalDate,
        description: row.description,
        montoPesos: row.montoPesos,
        montoUSD: row.montoUSD,
        installments: row.installments,
        type: row.type,
        amount: row.montoPesos > 0 ? row.montoPesos : row.montoUSD,
        categoryId: row.categoryId,
        subcategoryId: row.subcategoryId,
      }))
      
      // Guardar consumos
      const res = await fetch(`/api/credit-cards/${cardId}/consumptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSave })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      
      // Aprender de las correcciones del usuario
      if (rawText) {
        const learnedPatterns = learnPatternsFromText(rawText)
        const merchantMappings = learnMerchantMappings(
          rowsToSave,
          smartTemplate?.mapeoComercios
        )
        
        // Actualizar smart template
        const updatedSmartTemplate = {
          creditCardId: cardId,
          ...learnedPatterns,
          mapeoComercios: merchantMappings,
          name: smartTemplate?.name || 'Plantilla Inteligente',
        }
        
        // Guardar smart template
        try {
          const templateRes = await fetch(`/api/credit-cards/${cardId}/smart-template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedSmartTemplate)
          })
          
          if (templateRes.ok) {
            const templateData = await templateRes.json()
            if (templateData.success) {
              setSmartTemplate(templateData.smartTemplate)
            }
          }
        } catch (templateError) {
          console.error('Error guardando smart template:', templateError)
          // No fallar el guardado si hay error en el template
        }
      }
      
      // Mostrar mensaje con información de duplicados si hay
      if (data.message) {
        success(data.message)
      } else {
        success(`Se importaron ${rowsToSave.length} movimientos y se actualizó la plantilla inteligente`)
      }
      
      // Cerrar y limpiar
      setRows([])
      setEditableRows([])
      setRawText('')
      setFile(null)
      setShowCorrectionAssistant(false)
      onClose()
    } catch (e) {
      console.error(e)
      error('No se pudo guardar el resumen')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div key="modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div className="absolute inset-0 bg-black/50" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Importar Resumen (PDF)</h3>
            <button onClick={onClose} aria-label="Cerrar" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="template-select" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Template (Opcional)</label>
                  <select 
                    id="template-select"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" 
                    value={selectedTemplate} 
                    onChange={e=>setSelectedTemplate(e.target.value)}
                    disabled={loadingTemplates}
                    aria-label="Seleccionar template"
                  >
                    <option value="">Sin template (usar por defecto)</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {templates.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      No hay templates configurados. Los templates ayudan a mejorar la precisión de la extracción.
                    </p>
                  )}
                  <button
                    onClick={() => setShowTemplateManager(true)}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    Gestionar Templates
                  </button>
                </div>
                <div>
                  <label htmlFor="bank-select" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Banco</label>
                  <select 
                    id="bank-select"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" 
                    value={bank} 
                    onChange={e=>setBank(e.target.value)}
                    aria-label="Seleccionar banco"
                  >
                    <option value="">Selecciona</option>
                    {argentineBanks.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Archivo PDF</label>
                <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="w-full" />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={handleParse}
                disabled={!file || !bank || parsing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                <Upload className="w-4 h-4"/> 
                {parsing ? 'Analizando...' : 'Analizar'}
              </button>
              {smartTemplate && (
                <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-xs text-purple-700 dark:text-purple-300">
                  🧠 Plantilla Inteligente activa ({smartTemplate.totalImports || 0} importaciones)
                </div>
              )}
              {rawText && (
                <button onClick={() => setShowRawText(!showRawText)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 cursor-pointer flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4"/> 
                  {showRawText ? 'Ocultar' : 'Ver'} texto del PDF
                </button>
              )}
            </div>
            {showRawText && rawText && (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900 max-h-60 overflow-auto">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {rawText.substring(0, 5000)}{rawText.length > 5000 ? '...\n\n(Texto truncado, primeros 5000 caracteres)' : ''}
                </pre>
              </div>
            )}
            {showCorrectionAssistant && editableRows.length > 0 ? (
              <StatementCorrectionAssistant
                rows={editableRows}
                onRowsChange={setEditableRows}
                onSave={handleSaveWithLearning}
                onCancel={() => {
                  setShowCorrectionAssistant(false)
                  setEditableRows([])
                  setRows([])
                }}
                categories={categories}
                saving={saving}
              />
            ) : rows.length > 0 ? (
              <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="p-2 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300">
                  Revisa y edita los datos antes de importar. Haz clic en cualquier celda para editarla.
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">Descripción</th>
                      <th className="p-2 text-right">PESOS</th>
                      <th className="p-2 text-right">USD</th>
                      <th className="p-2 text-left">Cuotas</th>
                      <th className="p-2 text-left">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-2">{r.date}</td>
                        <td className="p-2">{r.description}</td>
                        <td className="p-2 text-right">{r.montoPesos > 0 ? formatCurrency(r.montoPesos, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                        <td className="p-2 text-right">{r.montoUSD > 0 ? `$${r.montoUSD.toFixed(2)}` : '-'}</td>
                        <td className="p-2">{r.installments ? `${r.installments.current}/${r.installments.total}` : '-'}</td>
                        <td className="p-2">{r.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Sube un PDF y presiona Analizar. Fechas en formato dd/mm/aaaa.</div>
            )}
          </div>
        </motion.div>
      </motion.div>
      
      {showTemplateManager && (
        <PDFTemplateManager
          key="template-manager"
          isOpen={showTemplateManager}
          onClose={() => {
            setShowTemplateManager(false)
            loadTemplates()
          }}
          cardId={cardId}
          onTemplateSelected={(templateId) => {
            setSelectedTemplate(templateId)
            success('Template seleccionado')
          }}
        />
      )}
    </AnimatePresence>
  )
}


