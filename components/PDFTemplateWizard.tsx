'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileText, ChevronRight, ChevronLeft, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import type { PDFImportTemplate } from '@/types'

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  
  if (typeof window !== 'undefined') {
    const workerVersion = pdfjsLib.version || '5.4.296'
    ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = 
      `https://unpkg.com/pdfjs-dist@${workerVersion}/build/pdf.worker.min.mjs`
  }
  
  const array = await file.arrayBuffer()
  const pdf = await (pdfjsLib as any).getDocument({ 
    data: array,
    verbosity: 0
  }).promise
  
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it: any) => it.str).join('\n') + '\n'
  }
  return text
}

interface Props {
  isOpen: boolean
  onClose: () => void
  cardId: string
  onTemplateCreated?: (template: PDFImportTemplate) => void
}

type WizardStep = 'upload' | 'preview' | 'patterns' | 'keywords' | 'summary'

export default function PDFTemplateWizard({ isOpen, onClose, cardId, onTemplateCreated }: Props) {
  const { error, success } = useToastContext()
  const [step, setStep] = useState<WizardStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rawText, setRawText] = useState<string>('')
  const [extracting, setExtracting] = useState(false)
  const [showTextPreview, setShowTextPreview] = useState(false)
  
  const [templateData, setTemplateData] = useState<Partial<PDFImportTemplate>>({
    name: '',
    dateFormat: 'dd/mm/yyyy',
    amountDecimalSeparator: ',',
    amountThousandsSeparator: '.',
    searchRange: 3,
    interestKeywords: ['interés', 'interés financ', 'financ', 'cargo financ', 'mora', 'retención', 'iva', 'impuesto'],
    feeKeywords: ['comisión', 'mantenimiento', 'cuota de manejo', 'anualidad'],
    skipLines: [],
  })

  const [datePattern, setDatePattern] = useState('/(\\b|\\D)(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{2,4})(\\b|\\D)/g')
  const [amountPattern, setAmountPattern] = useState('/([+-]?\\$?\\s*\\d{1,3}(?:[\\.,]\\d{3})*(?:[\\.,]\\d{2})?)/g')
  const [installmentsPattern, setInstallmentsPattern] = useState('/(\\d{1,2})\\s*(?:de|\\/|-|DE)\\s*(\\d{1,2})/i')

  const handleFileUpload = async () => {
    if (!file) {
      error('Selecciona un archivo PDF')
      return
    }

    try {
      setExtracting(true)
      const text = await extractPdfText(file)
      setRawText(text)
      setStep('preview')
      
      // Auto-detectar patrones si es posible
      detectPatterns(text)
    } catch (e) {
      console.error(e)
      error('Error leyendo el PDF')
    } finally {
      setExtracting(false)
    }
  }

  const detectPatterns = (text: string) => {
    // Detectar formato de fecha más común
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
    if (dateMatch) {
      const separator = dateMatch[0].includes('/') ? '/' : '-'
      if (separator === '-') {
        setTemplateData({ ...templateData, dateFormat: 'dd-mm-yyyy' })
      }
    }

    // Detectar separadores numéricos
    const amountMatch = text.match(/\d{1,3}([.,])\d{3}([.,])\d{2}/)
    if (amountMatch) {
      if (amountMatch[1] === '.') {
        setTemplateData({ 
          ...templateData, 
          amountThousandsSeparator: '.',
          amountDecimalSeparator: ','
        })
      } else if (amountMatch[1] === ',' && amountMatch[2] === '.') {
        setTemplateData({ 
          ...templateData, 
          amountThousandsSeparator: ',',
          amountDecimalSeparator: '.'
        })
      }
    }
  }

  const handleNext = () => {
    if (step === 'upload') {
      if (!file) {
        error('Sube un PDF primero')
        return
      }
      handleFileUpload()
      return
    }
    
    if (step === 'preview') {
      setStep('patterns')
    } else if (step === 'patterns') {
      setStep('keywords')
    } else if (step === 'keywords') {
      setStep('summary')
    }
  }

  const handleBack = () => {
    if (step === 'preview') {
      setStep('upload')
    } else if (step === 'patterns') {
      setStep('preview')
    } else if (step === 'keywords') {
      setStep('patterns')
    } else if (step === 'summary') {
      setStep('keywords')
    }
  }

  const handleCreate = async () => {
    if (!templateData.name) {
      error('El nombre del template es requerido')
      return
    }

    try {
      const res = await fetch(`/api/credit-cards/${cardId}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...templateData,
          datePattern,
          amountPattern,
          installmentsPattern,
        })
      })

      const data = await res.json()
      if (data.success) {
        success('Template creado exitosamente')
        if (onTemplateCreated) {
          onTemplateCreated(data.template)
        }
        handleClose()
      } else {
        error(data.error || 'Error creando template')
      }
    } catch (e) {
      console.error('Error creando template:', e)
      error('Error creando template')
    }
  }

  const handleClose = () => {
    setStep('upload')
    setFile(null)
    setRawText('')
    setShowTextPreview(false)
    setTemplateData({
      name: '',
      dateFormat: 'dd/mm/yyyy',
      amountDecimalSeparator: ',',
      amountThousandsSeparator: '.',
      searchRange: 3,
      interestKeywords: ['interés', 'interés financ', 'financ', 'cargo financ', 'mora', 'retención', 'iva', 'impuesto'],
      feeKeywords: ['comisión', 'mantenimiento', 'cuota de manejo', 'anualidad'],
      skipLines: [],
    })
    onClose()
  }

  const extractSampleLines = () => {
    if (!rawText) return []
    const lines = rawText.split('\n').filter(l => l.trim().length > 10).slice(0, 10)
    return lines
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div className="absolute inset-0 bg-black/50" onClick={handleClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.95, opacity: 0 }} 
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asistente para Crear Template</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Paso {step === 'upload' ? 1 : step === 'preview' ? 2 : step === 'patterns' ? 3 : step === 'keywords' ? 4 : 5} de 5
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-160px)]">
            {/* Paso 1: Upload */}
            {step === 'upload' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">1. Subir PDF de Ejemplo</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Sube un resumen de tarjeta PDF para que el asistente pueda analizar su formato y sugerir la configuración.
                  </p>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Seleccionar PDF
                    </label>
                    {file && (
                      <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{file.name}</p>
                    )}
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Nombre del Template *</label>
                    <input
                      type="text"
                      value={templateData.name}
                      onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      placeholder="Ej: Santander Visa"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Paso 2: Preview */}
            {step === 'preview' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">2. Vista Previa del Texto</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Revisa el texto extraído del PDF. Esto ayudará a identificar los patrones correctos.
                  </p>
                  <div className="flex justify-between items-center mb-2">
                    <button
                      onClick={() => setShowTextPreview(!showTextPreview)}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      {showTextPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showTextPreview ? 'Ocultar' : 'Mostrar'} texto completo
                    </button>
                  </div>
                  {showTextPreview ? (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 max-h-96 overflow-auto">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {rawText.substring(0, 10000)}{rawText.length > 10000 ? '\n\n...(Texto truncado)' : ''}
                      </pre>
                    </div>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 max-h-96 overflow-auto">
                      <div className="space-y-2">
                        {extractSampleLines().map((line, i) => (
                          <div key={i} className="text-xs text-gray-700 dark:text-gray-300 font-mono p-2 bg-white dark:bg-gray-800 rounded">
                            {line}
                          </div>
                        ))}
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                          ... (mostrando primeras 10 líneas)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Paso 3: Patterns */}
            {step === 'patterns' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">3. Configurar Patrones</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Configura los patrones regex que identifican fechas, montos y cuotas en tu PDF.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Formato de Fecha</label>
                      <select
                        value={templateData.dateFormat}
                        onChange={(e) => setTemplateData({ ...templateData, dateFormat: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      >
                        <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                        <option value="dd-mm-yyyy">dd-mm-yyyy</option>
                        <option value="mm/dd/yyyy">mm/dd/yyyy</option>
                        <option value="yyyy-mm-dd">yyyy-mm-dd</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Patrón Regex para Fechas</label>
                      <input
                        type="text"
                        value={datePattern}
                        onChange={(e) => setDatePattern(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Patrón para detectar fechas en el texto
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Separador Decimal</label>
                        <select
                          value={templateData.amountDecimalSeparator}
                          onChange={(e) => setTemplateData({ ...templateData, amountDecimalSeparator: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                        >
                          <option value=",">Coma (,)</option>
                          <option value=".">Punto (.)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Separador de Miles</label>
                        <select
                          value={templateData.amountThousandsSeparator}
                          onChange={(e) => setTemplateData({ ...templateData, amountThousandsSeparator: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                        >
                          <option value=".">Punto (.)</option>
                          <option value=",">Coma (,)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Patrón Regex para Montos</label>
                      <input
                        type="text"
                        value={amountPattern}
                        onChange={(e) => setAmountPattern(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Patrón Regex para Cuotas</label>
                      <input
                        type="text"
                        value={installmentsPattern}
                        onChange={(e) => setInstallmentsPattern(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Rango de Búsqueda (líneas)</label>
                      <input
                        type="number"
                        value={templateData.searchRange}
                        onChange={(e) => setTemplateData({ ...templateData, searchRange: parseInt(e.target.value) || 3 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 4: Keywords */}
            {step === 'keywords' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">4. Palabras Clave</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Define las palabras clave que identifican intereses y comisiones.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                        Palabras Clave para Intereses (separadas por comas)
                      </label>
                      <input
                        type="text"
                        value={(templateData.interestKeywords || []).join(', ')}
                        onChange={(e) => setTemplateData({ 
                          ...templateData, 
                          interestKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                        placeholder="interés, interés financ, mora, iva"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                        Palabras Clave para Comisiones (separadas por comas)
                      </label>
                      <input
                        type="text"
                        value={(templateData.feeKeywords || []).join(', ')}
                        onChange={(e) => setTemplateData({ 
                          ...templateData, 
                          feeKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                        placeholder="comisión, mantenimiento, anualidad"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Líneas a Ignorar (separadas por comas)
                    </label>
                    <input
                      type="text"
                      value={(templateData.skipLines || []).join(', ')}
                      onChange={(e) => setTemplateData({ 
                        ...templateData, 
                        skipLines: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      placeholder="TOTAL, SALDO ANTERIOR, RESUMEN"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Las líneas que contengan estos textos serán ignoradas
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 5: Summary */}
            {step === 'summary' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">5. Resumen</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Revisa la configuración del template antes de crearlo.
                  </p>
                  
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Nombre:</span>
                        <p className="text-gray-900 dark:text-white">{templateData.name}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Formato Fecha:</span>
                        <p className="text-gray-900 dark:text-white">{templateData.dateFormat}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Separadores:</span>
                        <p className="text-gray-900 dark:text-white">
                          Miles: {templateData.amountThousandsSeparator}, Decimal: {templateData.amountDecimalSeparator}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Rango Búsqueda:</span>
                        <p className="text-gray-900 dark:text-white">{templateData.searchRange} líneas</p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Palabras Clave Intereses:</span>
                        <p className="text-gray-900 dark:text-white">{(templateData.interestKeywords || []).join(', ')}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Palabras Clave Comisiones:</span>
                        <p className="text-gray-900 dark:text-white">{(templateData.feeKeywords || []).join(', ')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <button
              onClick={handleBack}
              disabled={step === 'upload'}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Atrás
            </button>
            
            {step !== 'summary' ? (
              <button
                onClick={handleNext}
                disabled={step === 'upload' && !file}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {step === 'upload' && extracting ? 'Extrayendo...' : 'Siguiente'}
                {step !== 'upload' && <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={!templateData.name}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Crear Template
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

