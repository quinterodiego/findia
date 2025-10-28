'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Table, Calendar, BarChart3, Download } from 'lucide-react'
import { exportService, ExportData, ExportOptions } from '@/lib/exportService'
import { useToast } from '@/components/Toast'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  data: ExportData
}

export default function ExportModal({ isOpen, onClose, data }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf')
  const [includeStats, setIncludeStats] = useState(true)
  const [includeCharts, setIncludeCharts] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const { showToast } = useToast()

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const options: ExportOptions = {
        format: exportFormat,
        includeStats,
        includeCharts,
        dateRange: dateRange.start && dateRange.end ? {
          start: dateRange.start,
          end: dateRange.end
        } : undefined
      }

      await exportService.export(data, options)
      
      // Mostrar mensaje de éxito
      showToast({
        type: 'success',
        title: 'Exportación exitosa',
        message: `Archivo ${exportFormat.toUpperCase()} generado correctamente`
      })
      onClose()
    } catch (error) {
      console.error('Error en la exportación:', error)
      // Mostrar mensaje de error
      showToast({
        type: 'error',
        title: 'Error en la exportación',
        message: 'No se pudo generar el archivo. Inténtalo de nuevo.'
      })
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

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
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-semibold">Exportar Datos</h2>
                  <p className="text-white/80 text-sm">Genera reportes en PDF o Excel</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Formato de exportación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Formato de exportación
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportFormat('pdf')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    exportFormat === 'pdf'
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                  }`}
                >
                  <FileText className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">PDF</div>
                  <div className="text-xs opacity-75">Reporte visual</div>
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('excel')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    exportFormat === 'excel'
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Table className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">Excel</div>
                  <div className="text-xs opacity-75">Datos tabulares</div>
                </button>
              </div>
            </div>

            {/* Opciones de contenido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Contenido a incluir
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStats}
                    onChange={(e) => setIncludeStats(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Resumen financiero</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Gráficos y análisis</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Rango de fechas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Rango de fechas (opcional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Desde</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Resumen de datos */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Datos a exportar:</h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>• {data.incomes.length} ingresos</div>
                <div>• {data.expenses.length} gastos</div>
                <div>• {data.debts.length} deudas</div>
                <div>• {data.goals.length} metas</div>
                {includeStats && <div>• Resumen financiero</div>}
                {includeCharts && <div>• Gráficos y análisis</div>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Exportar
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
