'use client'

import { useState } from 'react'
import { exportService, ExportData, ExportOptions } from '@/lib/exportService'

export function useExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportData = async (data: ExportData, options: ExportOptions) => {
    setIsExporting(true)
    setError(null)

    try {
      await exportService.export(data, options)
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al exportar'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsExporting(false)
    }
  }

  const clearError = () => setError(null)

  return {
    isExporting,
    error,
    exportData,
    clearError
  }
}
