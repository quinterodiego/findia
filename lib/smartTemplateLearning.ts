import type { SmartTemplate, MerchantMapping } from '@/types'
import type { EditableParsedLine } from '@/components/StatementCorrectionAssistant'

// Tipo para línea parseada básica (sin campos de corrección asistida)
type ParsedLine = {
  date: string
  originalDate: string
  description: string
  montoPesos: number
  montoUSD: number
  installments?: { current: number; total: number } | null
  type: 'consumption' | 'interest' | 'fee'
}

/**
 * Aprende patrones del texto extraído del PDF
 */
export function learnPatternsFromText(rawText: string): Partial<SmartTemplate> {
  const lines = rawText.split(/\n+/).map(r => r.trim()).filter(Boolean)
  
  // Aprender patrón de fecha más común
  const datePatterns: Record<string, number> = {}
  const dateRegexes = [
    /(\d{2}-\w{3}-\d{2})/i,  // DD-MMM-YY
    /(\d{2}\/\d{2}\/\d{4})/,  // DD/MM/YYYY
    /(\d{1,2}-\w{3}-\d{2,4})/i  // DD-MMM-YY o DD-MMM-YYYY
  ]
  
  for (const line of lines) {
    for (const regex of dateRegexes) {
      const match = line.match(regex)
      if (match) {
        const pattern = regex.source
        datePatterns[pattern] = (datePatterns[pattern] || 0) + 1
        break
      }
    }
  }
  
  const mostCommonDatePattern = Object.entries(datePatterns)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
  
  // Aprender patrón de monto más común
  const amountPatterns: Record<string, number> = {}
  const amountRegexes = [
    /(-?\d{1,3}(?:\.\d{3})*,\d{2})/,  // Formato argentino: 1.234,56
    /(-?\d{1,3}(?:,\d{3})*\.\d{2})/,  // Formato inglés: 1,234.56
    /(-?\d+[.,]\d{2})/                 // Formato simple: 123,45 o 123.45
  ]
  
  for (const line of lines) {
    for (const regex of amountRegexes) {
      const match = line.match(regex)
      if (match) {
        const pattern = regex.source
        amountPatterns[pattern] = (amountPatterns[pattern] || 0) + 1
        break
      }
    }
  }
  
  const mostCommonAmountPattern = Object.entries(amountPatterns)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
  
  // Buscar sección de consumos
  const sectionStartKeywords = ['DETALLE DEL CONSUMO', 'CONSUMOS', 'MOVIMIENTOS', 'TRANSACCIONES']
  const sectionEndKeywords = ['SUBTOTAL', 'TOTAL CONSUMOS', 'RESUMEN', 'TOTAL']
  
  let seccionConsumosStart: string | undefined
  let seccionConsumosEnd: string | undefined
  
  for (const keyword of sectionStartKeywords) {
    if (rawText.includes(keyword)) {
      seccionConsumosStart = keyword
      break
    }
  }
  
  for (const keyword of sectionEndKeywords) {
    if (rawText.includes(keyword)) {
      seccionConsumosEnd = keyword
      break
    }
  }
  
  return {
    regexFecha: mostCommonDatePattern,
    regexMonto: mostCommonAmountPattern,
    seccionConsumosStart,
    seccionConsumosEnd,
  }
}

/**
 * Aprende mapeos de comercios a partir de las correcciones del usuario
 */
export function learnMerchantMappings(
  rows: EditableParsedLine[],
  existingMappings?: Record<string, MerchantMapping>
): Record<string, MerchantMapping> {
  const mappings: Record<string, MerchantMapping> = existingMappings || {}
  
  for (const row of rows) {
    if (!row.ignored && row.description) {
      const merchantName = row.description.trim()
      
      // Normalizar el nombre del comercio (remover caracteres especiales)
      const normalizedName = merchantName
        .replace(/[*]/g, '')
        .replace(/\s+/g, ' ')
        .toUpperCase()
        .trim()
      
      if (!mappings[normalizedName]) {
        mappings[normalizedName] = {
          merchantName: normalizedName,
          categoryId: row.categoryId,
          subcategoryId: row.subcategoryId,
          currency: row.montoPesos > 0 ? 'pesos' : 'usd',
          isSubscription: false,
          frequency: 1,
          lastSeen: new Date().toISOString(),
        }
      } else {
        // Actualizar frecuencia y última vez visto
        const existing = mappings[normalizedName]
        existing.frequency = (existing.frequency || 0) + 1
        existing.lastSeen = new Date().toISOString()
        
        // Actualizar categoría si el usuario la cambió (usar la más reciente)
        if (row.categoryId) {
          existing.categoryId = row.categoryId
        }
        if (row.subcategoryId) {
          existing.subcategoryId = row.subcategoryId
        }
      }
    }
  }
  
  return mappings
}

/**
 * Aplica mapeos de comercios a las filas parseadas (autocategorización)
 */
export function applyMerchantMappings(
  rows: ParsedLine[],
  mappings: Record<string, MerchantMapping>
): EditableParsedLine[] {
  return rows.map((row, index) => {
    const merchantName = row.description.trim()
    
    // Intentar encontrar un mapeo (puede ser exacto o por substring)
    let mapping: MerchantMapping | undefined
    
    // Primero intentar exacto
    const normalizedName = merchantName
      .replace(/[*]/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase()
      .trim()
    
    mapping = mappings[normalizedName]
    
    // Si no hay exacto, buscar por substring
    if (!mapping) {
      for (const [key, value] of Object.entries(mappings)) {
        if (normalizedName.includes(key) || key.includes(normalizedName)) {
          mapping = value
          break
        }
      }
    }
    
    return {
      id: `row-${index}`,
      ...row,
      categoryId: mapping?.categoryId,
      subcategoryId: mapping?.subcategoryId,
      ignored: false,
    } as EditableParsedLine
  })
}


