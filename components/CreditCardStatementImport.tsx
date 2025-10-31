'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileText, AlertCircle, CheckCircle, Edit2, Settings } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { argentineBanks } from '@/lib/argentineBanks'
import type { PDFImportTemplate } from '@/types'
import PDFTemplateManager from './PDFTemplateManager'
import { formatCurrency } from '@/lib/formatNumber'

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

// Mapeo de meses abreviados en español
const MONTHS_ABBREV: Record<string, number> = {
  'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
  'jan': 1, 'fev': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
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
  console.log('[extractPdfText] Iniciando extracción...')
  
  try {
    // Importación dinámica de pdfjs-dist para Next.js
    console.log('[extractPdfText] Importando pdfjs-dist...')
    const pdfjsLib = await import('pdfjs-dist')
    console.log('[extractPdfText] pdfjs-dist importado, versión:', pdfjsLib.version)
    
    // Configurar el worker - usar unpkg (más confiable que cdnjs)
    if (typeof window !== 'undefined') {
      const workerVersion = pdfjsLib.version || '5.4.296'
      // Usar unpkg como fuente del worker (más confiable)
      ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = 
        `https://unpkg.com/pdfjs-dist@${workerVersion}/build/pdf.worker.min.mjs`
      console.log('[extractPdfText] Worker configurado')
    }
    
    console.log('[extractPdfText] Convirtiendo archivo a ArrayBuffer...')
    const array = await file.arrayBuffer()
    console.log('[extractPdfText] ArrayBuffer obtenido, tamaño:', array.byteLength)
    
    // Cargar el PDF con configuración optimizada
    console.log('[extractPdfText] Cargando PDF...')
    const pdf = await (pdfjsLib as any).getDocument({ 
      data: array,
      verbosity: 0 // Reducir logs
    }).promise
    console.log('[extractPdfText] PDF cargado, páginas:', pdf.numPages)
    
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`[extractPdfText] Procesando página ${i}/${pdf.numPages}...`)
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((it: any) => it.str).join('\n') + '\n'
      text += pageText
      console.log(`[extractPdfText] Página ${i} procesada, texto extraído: ${pageText.length} caracteres`)
    }
    
    console.log('[extractPdfText] Extracción completada, texto total:', text.length, 'caracteres')
    return text
  } catch (error: any) {
    console.error('[extractPdfText] ERROR:', error)
    console.error('[extractPdfText] Stack:', error?.stack)
    throw error
  }
}

function parseByBank(bank: string, raw: string, template?: PDFImportTemplate): ParsedLine[] {
  const lines: ParsedLine[] = []
  // Dividir en líneas
  const rows = raw.split(/\n+/).map(r => r.trim()).filter(Boolean)
  
  console.log('[PDF Parsing] Total de líneas extraídas del PDF:', rows.length)
  console.log('[PDF Parsing] Primeras 20 líneas:', rows.slice(0, 20))
  
  // Palabras clave a ignorar (no son transacciones)
  // Solo filtrar si la línea EMPIECE con estas palabras (más específico)
  const skipKeywords = [
    'TOTAL CONSUMOS DEL MES',
    'SUBTOTAL',
    'TOTAL A PAGAR',
    'SALDO PENDIENTE',
    'SALDO ANTERIOR',
    'SU PAGO',
    'CONSOLIDADO'
  ]
  
  // Filtrar líneas que empiecen con palabras clave a ignorar
  // PERO mantener líneas que tienen fechas (son transacciones válidas)
  const dateRegexForFilter = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
  const filteredRows = rows.filter(row => {
    // Si la línea tiene una fecha, es una transacción válida
    if (dateRegexForFilter.test(row)) {
      return true
    }
    const upperRow = row.toUpperCase().trim()
    // Solo filtrar si la línea empieza con una de estas palabras clave
    const shouldSkip = skipKeywords.some(keyword => {
      return upperRow.startsWith(keyword) || upperRow === keyword
    })
    return !shouldSkip
  })
  
  console.log('[PDF Parsing] Líneas después del filtrado:', filteredRows.length)
  
  // Regex mejorado para detectar fechas: múltiples formatos
  // Formato 1: DD-MMM-YY o DD-MMM-YYYY (ej: 25-Jul-25, 25-Jul-2025)
  // Formato 2: DD/MM/YYYY o DD-MM-YYYY
  // Formato 3: DD MMM YY (con espacios)
  const dateRegexes = [
    /(\d{1,2}[-/]\w{3}[-/]\d{2,4})/i,  // DD-MMM-YY o DD-MMM-YYYY
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,  // DD/MM/YYYY o DD-MM-YYYY
    /(\d{1,2}\s+\w{3}\s+\d{2,4})/i      // DD MMM YY (con espacios)
  ]
  
  // Debug: contar líneas procesadas
  let linesProcessed = 0
  let datesFound = 0
  let validTransactions = 0
  
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
    
    // Verificar que la fecha esté al inicio o cerca del inicio (más flexible: hasta 20 caracteres)
    const dateIndex = row.indexOf(dateMatch[0])
    if (dateIndex > 20) {
      // Si la fecha está muy lejos, verificar si hay texto antes que indique que no es una transacción
      const beforeDate = row.substring(0, dateIndex).trim()
      if (beforeDate.length > 10 || /^[A-Z]{2,}/.test(beforeDate)) {
        continue // Probablemente no es una fila de consumo
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
      console.log('[PDF Parsing] No se pudo parsear fecha:', originalDate, 'en línea:', row.substring(0, 100))
      continue // Si no se puede parsear, saltar
    }
    
    // Remover la fecha de la línea para obtener descripción y monto
    let remainingRow = row.substring(dateIndex + originalDate.length).trim()
    
    // Buscar todos los números en la línea (montos)
    // Regex mejorado: captura números con formato argentino (punto miles, coma decimal) o inglés
    // También captura números simples con decimales
    const amountRegex = /([+-]?\d{1,3}(?:\.\d{3})+(?:,\d{2})?|[+-]?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|[+-]?\d+[.,]\d{1,3}|[+-]?\d{4,})/g
    const amountMatches = remainingRow.match(amountRegex)
    
    if (!amountMatches || amountMatches.length === 0) {
      console.log('[PDF Parsing] No se encontró monto en línea con fecha:', originalDate, '| Línea:', row.substring(0, 100))
      continue
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
      console.log('[PDF Parsing] Se saltó transacción porque no se pudo determinar monto:', originalDate, description.substring(0, 50))
      continue
    }
    
    validTransactions++
    
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
  console.log(`[PDF Parsing] Estadísticas:`)
  console.log(`  - Líneas totales procesadas: ${linesProcessed}`)
  console.log(`  - Fechas encontradas: ${datesFound}`)
  console.log(`  - Transacciones válidas creadas: ${validTransactions}`)
  console.log(`  - Transacciones finales: ${lines.length}`)
  
  if (lines.length === 0 && datesFound > 0) {
    console.warn('[PDF Parsing] Se encontraron fechas pero no se crearon transacciones. Revisa el formato de montos.')
  }
  
  if (lines.length === 0 && datesFound === 0) {
    console.warn('[PDF Parsing] No se encontraron fechas. Revisa el formato del PDF.')
    console.log('[PDF Parsing] Muestra de líneas sin filtrar:', rows.slice(0, 30))
  }

  return lines
}

export default function CreditCardStatementImport({ isOpen, onClose, cardId }: Props) {
  const { error, success } = useToastContext()
  const [bank, setBank] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedLine[]>([])
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [rawText, setRawText] = useState<string>('')
  const [showRawText, setShowRawText] = useState(false)
  const [templates, setTemplates] = useState<PDFImportTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showTemplateManager, setShowTemplateManager] = useState(false)

  // Cargar templates al abrir el modal
  useEffect(() => {
    if (isOpen && cardId) {
      loadTemplates()
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

  const handleParse = async () => {
    alert('handleParse ejecutado!')
    console.log('=== HANDLE PARSE EJECUTADO ===')
    console.log('File:', file?.name)
    console.log('Bank:', bank)
    
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
      console.log('[PDF Import] ===== INICIANDO EXTRACCIÓN DE PDF =====')
      console.log('[PDF Import] Archivo:', file.name, '| Tamaño:', file.size, 'bytes')
      
      const text = await extractPdfText(file)
      console.log('[PDF Import] Texto extraído. Longitud:', text.length, 'caracteres')
      setRawText(text) // Guardar texto crudo para debug
      
      // Mostrar muestra del texto extraído
      if (text.length > 0) {
        console.log('[PDF Import] Muestra del texto (primeros 500 caracteres):', text.substring(0, 500))
      } else {
        console.error('[PDF Import] El PDF no contiene texto extraíble. El PDF podría estar escaneado.')
        error('El PDF no contiene texto. Puede ser un PDF escaneado. Intenta con un PDF con texto seleccionable.')
        setParsing(false)
        return
      }
      
      // Buscar template seleccionado
      const template = templates.find(t => t.id === selectedTemplate)
      
      console.log('[PDF Import] Iniciando parsing con banco:', bank)
      const parsed = parseByBank(bank, text, template)
      console.log('[PDF Import] Parsing completado. Resultado:', parsed.length, 'transacciones')
      
      setRows(parsed)
      if (parsed.length === 0) {
        console.warn('[PDF Import] No se detectaron movimientos. Revisa la consola para más detalles.')
        error('No se detectaron movimientos. Abre la consola del navegador (F12) para ver detalles del parsing.')
      } else {
        success(`Se detectaron ${parsed.length} movimientos${template ? ` usando template "${template.name}"` : ''}`)
      }
    } catch (e: any) {
      console.error('[PDF Import] Error:', e)
      console.error('[PDF Import] Stack:', e?.stack)
      error(`No se pudo leer el PDF: ${e?.message || 'Error desconocido'}`)
    } finally {
      setParsing(false)
    }
  }

  const updateRow = (index: number, field: keyof ParsedLine, value: any) => {
    const newRows = [...rows]
    if (field === 'installments') {
      if (typeof value === 'string' && value.includes('/')) {
        const [current, total] = value.split('/').map(n => parseInt(n.trim()))
        newRows[index].installments = { current, total }
      } else {
        newRows[index].installments = value
      }
    } else {
      (newRows[index] as any)[field] = value
    }
    setRows(newRows)
  }

  const handleSave = async () => {
    if (rows.length === 0) return
    try {
      setSaving(true)
      // Convertir rows a formato esperado por la API (agregar amount calculado)
      const itemsToSave = rows.map(row => ({
        ...row,
        amount: row.montoPesos > 0 ? row.montoPesos : row.montoUSD, // Usar PESOS como principal, o USD si no hay PESOS
      }))
      
      const res = await fetch(`/api/credit-cards/${cardId}/consumptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSave })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      
      // Mostrar mensaje con información de duplicados si hay
      if (data.message) {
        success(data.message)
      } else {
        success(`Se importaron ${rows.length} movimientos`)
      }
      
      // Cerrar y limpiar
      setRows([])
      setRawText('')
      setFile(null)
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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div className="absolute inset-0 bg-black/50" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Importar Resumen (PDF)</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Template (Opcional)</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" 
                    value={selectedTemplate} 
                    onChange={e=>setSelectedTemplate(e.target.value)}
                    disabled={loadingTemplates}
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
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Banco</label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" value={bank} onChange={e=>setBank(e.target.value)}>
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
              {console.log('[RENDER] Estado del botón Analizar:', { hasFile: !!file, hasBank: !!bank, parsing, file: file?.name, bank })}
              <button onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                alert(`Botón clickeado! File: ${file?.name || 'no file'}, Bank: ${bank || 'no bank'}`)
                console.log('===== BOTÓN ANALIZAR CLICKEADO =====')
                console.log('Event:', e)
                console.log('File:', file)
                console.log('Bank:', bank)
                console.log('Parsing:', parsing)
                handleParse()
              }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer flex items-center gap-2" style={{ opacity: (!file || !bank || parsing) ? 0.5 : 1 }}>
                <Upload className="w-4 h-4"/> 
                {parsing ? 'Analizando...' : 'Analizar'}
              </button>
              {rows.length>0 && (
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer flex items-center gap-2">
                  <CheckCircle className="w-4 h-4"/> 
                  {saving ? 'Importando...' : `Importar ${rows.length} movimientos`}
                </button>
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
            {rows.length>0 ? (
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
                      <th className="p-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=> (
                      <tr key={i} className={`border-t border-gray-200 dark:border-gray-700 ${editingRow === i ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                        <td className="p-2">
                          {editingRow === i ? (
                            <input
                              type="text"
                              value={r.date}
                              onChange={e => updateRow(i, 'date', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
                              onBlur={() => setEditingRow(null)}
                              autoFocus
                            />
                          ) : (
                            <span className="cursor-pointer" onClick={() => setEditingRow(i)}>{r.date}</span>
                          )}
                        </td>
                        <td className="p-2">
                          {editingRow === i ? (
                            <input
                              type="text"
                              value={r.description}
                              onChange={e => updateRow(i, 'description', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
                              onBlur={() => setEditingRow(null)}
                            />
                          ) : (
                            <span className="cursor-pointer" onClick={() => setEditingRow(i)}>{r.description}</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {editingRow === i ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={r.montoPesos === 0 ? '' : r.montoPesos.toString().replace('.', ',')}
                              onChange={e => {
                                const val = e.target.value.replace(',', '.')
                                updateRow(i, 'montoPesos', parseFloat(val) || 0)
                              }}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-right"
                              onBlur={() => setEditingRow(null)}
                              placeholder="0,00"
                            />
                          ) : (
                            <span className="cursor-pointer" onClick={() => setEditingRow(i)}>
                              {r.montoPesos > 0 ? formatCurrency(r.montoPesos, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {editingRow === i ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={r.montoUSD === 0 ? '' : r.montoUSD.toString().replace('.', ',')}
                              onChange={e => {
                                const val = e.target.value.replace(',', '.')
                                updateRow(i, 'montoUSD', parseFloat(val) || 0)
                              }}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-right"
                              onBlur={() => setEditingRow(null)}
                              placeholder="0,00"
                            />
                          ) : (
                            <span className="cursor-pointer" onClick={() => setEditingRow(i)}>
                              {r.montoUSD > 0 ? `$${r.montoUSD.toFixed(2)}` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {editingRow === i ? (
                            <input
                              type="text"
                              placeholder="1/1"
                              value={r.installments ? `${r.installments.current}/${r.installments.total}` : ''}
                              onChange={e => updateRow(i, 'installments', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
                              onBlur={() => setEditingRow(null)}
                            />
                          ) : (
                            <span className="cursor-pointer" onClick={() => setEditingRow(i)}>
                              {r.installments ? `${r.installments.current}/${r.installments.total}` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {editingRow === i ? (
                            <select
                              value={r.type}
                              onChange={e => updateRow(i, 'type', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
                              onBlur={() => setEditingRow(null)}
                            >
                              <option value="consumption">Consumo</option>
                              <option value="interest">Interés</option>
                              <option value="fee">Comisión</option>
                            </select>
                          ) : (
                            <span className="cursor-pointer" onClick={() => setEditingRow(i)}>{r.type}</span>
                          )}
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => {
                              const newRows = rows.filter((_, idx) => idx !== i)
                              setRows(newRows)
                              setEditingRow(null)
                            }}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-xs"
                          >
                            Eliminar
                          </button>
                        </td>
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
      </div>

      <PDFTemplateManager
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
    </AnimatePresence>
  )
}


