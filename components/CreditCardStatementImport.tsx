'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { argentineBanks } from '@/lib/argentineBanks'

type ParsedLine = {
  date: string // dd/mm/aaaa
  description: string
  amount: number
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

// Detecta fecha dd/mm/aaaa o dd-mm-aaaa
const DATE_RE = /(\b|\D)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(\b|\D)/g
// Detecta importes (positivos y negativos, con coma o punto, con o sin símbolo $)
const AMOUNT_RE = /([+-]?\$?\s*\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?)/g
// Detecta cuotas "n de N" o "n/N"
const INSTALLMENTS_RE = /(\d{1,2})\s*(?:de|\/|-|DE)\s*(\d{1,2})/i
// Detecta intereses y cargos financieros
const INTEREST_KEYWORDS = /inter[eé]s|inter[eé]s\s*financ|financ|car\.?go\s*financ|mora|retenci[oó]n|iva|impuesto/i
// Detecta comisiones
const FEE_KEYWORDS = /comisi[oó]n|mantenimiento|cuota\s*de\s*manejo|anualidad/i

async function extractPdfText(file: File): Promise<string> {
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
    text += content.items.map((it: any) => it.str).join('\n') + '\n'
  }
  return text
}

function parseByBank(bank: string, raw: string): ParsedLine[] {
  const lines: ParsedLine[] = []
  // Dividir en líneas y mantener contexto de líneas anteriores
  const rows = raw.split(/\n+/).map(r => r.trim()).filter(Boolean)
  
  // Buscar todas las fechas primero
  const dateMatches: Array<{ index: number; date: string; row: string }> = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    // Buscar todas las fechas en la línea
    let match
    const dateRegex = /(\b|\D)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(\b|\D)/g
    while ((match = dateRegex.exec(row)) !== null) {
      const date = `${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}/${match[4].length === 2 ? '20' + match[4] : match[4]}`
      dateMatches.push({ index: i, date, row })
    }
  }

  // Para cada fecha encontrada, buscar su monto y descripción
  for (const { index, date, row } of dateMatches) {
    // Buscar importes en un rango de líneas (línea actual + 2 siguientes)
    let amountStr: string | null = null
    let amountIndex = index
    const searchRange = [index, index + 1, index + 2].filter(i => i < rows.length)
    
    for (const i of searchRange) {
      const line = rows[i]
      // Buscar todos los montos en la línea
      const amounts = line.match(AMOUNT_RE) || []
      if (amounts.length > 0) {
        // Tomar el último monto (suele ser el importe total)
        amountStr = amounts[amounts.length - 1]
        amountIndex = i
        break
      }
    }
    
    if (!amountStr) continue
    
    // Normalizar el monto (quitar $, espacios, y normalizar decimal)
    const norm = amountStr.replace(/\$|\s/g, '').replace(/\./g, '').replace(',', '.')
    const amount = Number(norm)
    
    if (isNaN(amount) || amount === 0) continue

    // Construir descripción desde múltiples líneas si es necesario
    let description = ''
    const descRange = [index, index + 1, index + 2, index + 3].filter(i => i < rows.length)
    
    for (const i of descRange) {
      const line = rows[i]
      // Remover fecha y monto de la línea para obtener descripción
      let cleanLine = line
        .replace(/(\b|\D)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(\b|\D)/g, '')
        .replace(AMOUNT_RE, '')
        .trim()
      
      if (cleanLine && cleanLine.length > 2) {
        description += (description ? ' ' : '') + cleanLine
      }
    }
    
    description = description.trim() || 'Movimiento'

    // Buscar cuotas en las líneas cercanas
    let installments = null
    for (const i of descRange) {
      const instMatch = rows[i].match(INSTALLMENTS_RE)
      if (instMatch) {
        installments = { current: Number(instMatch[1]), total: Number(instMatch[2]) }
        break
      }
    }

    // Detectar tipo: interés, fee o consumo
    let type: 'consumption' | 'interest' | 'fee' = 'consumption'
    const combinedText = descRange.map(i => rows[i]).join(' ').toLowerCase()
    
    if (INTEREST_KEYWORDS.test(combinedText)) {
      type = 'interest'
    } else if (FEE_KEYWORDS.test(combinedText)) {
      type = 'fee'
    }

    lines.push({
      date,
      description,
      amount: Math.abs(amount), // Siempre guardar valor absoluto
      installments,
      type,
    })
  }

  return lines
}

export default function CreditCardStatementImport({ isOpen, onClose, cardId }: Props) {
  const { error, success } = useToastContext()
  const [bank, setBank] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedLine[]>([])
  const [saving, setSaving] = useState(false)
  const [rawText, setRawText] = useState<string>('')
  const [showRawText, setShowRawText] = useState(false)

  const handleParse = async () => {
    try {
      if (!file || !bank) {
        error('Selecciona banco y archivo PDF')
        return
      }
      setParsing(true)
      const text = await extractPdfText(file)
      setRawText(text) // Guardar texto crudo para debug
      const parsed = parseByBank(bank, text)
      setRows(parsed)
      if (parsed.length === 0) {
        error('No se detectaron movimientos. Revisa el formato del PDF o prueba con otro banco.')
      } else {
        success(`Se detectaron ${parsed.length} movimientos`)
      }
    } catch (e) {
      console.error(e)
      error('No se pudo leer el PDF')
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async () => {
    if (rows.length === 0) return
    try {
      setSaving(true)
      const res = await fetch(`/api/credit-cards/${cardId}/consumptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows })
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Banco</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" value={bank} onChange={e=>setBank(e.target.value)}>
                  <option value="">Selecciona</option>
                  {argentineBanks.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Archivo PDF</label>
                <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="w-full" />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleParse} disabled={!file || !bank || parsing} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer flex items-center gap-2">
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
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">Descripción</th>
                      <th className="p-2 text-right">Monto</th>
                      <th className="p-2 text-left">Cuotas</th>
                      <th className="p-2 text-left">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=> (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="p-2">{r.date}</td>
                        <td className="p-2">{r.description}</td>
                        <td className="p-2 text-right">${r.amount.toLocaleString('es-CO')}</td>
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
      </div>
    </AnimatePresence>
  )
}


