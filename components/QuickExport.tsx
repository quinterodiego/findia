'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, Table } from 'lucide-react'
import { exportService, ExportData, ExportOptions } from '@/lib/exportService'
import { useToastContext } from '@/components/Toast'

interface QuickExportProps {
  data: ExportData
}

export default function QuickExport({ data }: QuickExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { success, error } = useToastContext()

  const handleQuickExport = async (format: 'pdf' | 'excel') => {
    setIsExporting(true)
    
    try {
      const options: ExportOptions = {
        format,
        includeStats: true,
        includeCharts: false
      }

      await exportService.export(data, options)
      
      success(
        'Exportación exitosa',
        `Reporte ${format.toUpperCase()} generado correctamente`
      )
    } catch (error) {
      console.error('Error en la exportación:', error)
      error(
        'Error en la exportación',
        'No se pudo generar el archivo. Inténtalo de nuevo.'
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">Exportar:</span>
      <div className="flex gap-1">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleQuickExport('pdf')}
          disabled={isExporting}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exportar a PDF"
        >
          <FileText className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleQuickExport('excel')}
          disabled={isExporting}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exportar a Excel"
        >
          <Table className="w-4 h-4" />
        </motion.button>
      </div>
      {isExporting && (
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  )
}
