'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, X, Eye, EyeOff } from 'lucide-react'
import { formatCurrency } from '@/lib/formatNumber'
import type { Category } from '@/types'

export type EditableParsedLine = {
  id: string
  date: string
  originalDate: string
  description: string
  montoPesos: number
  montoUSD: number
  installments?: { current: number; total: number } | null
  type: 'consumption' | 'interest' | 'fee'
  categoryId?: string
  subcategoryId?: string
  ignored?: boolean // Para marcar consumos que se ignoran
}

interface Props {
  rows: EditableParsedLine[]
  onRowsChange: (rows: EditableParsedLine[]) => void
  onSave: (rows: EditableParsedLine[]) => Promise<void>
  onCancel: () => void
  categories: Category[]
  subcategories?: any[]
  saving?: boolean
}

export default function StatementCorrectionAssistant({
  rows,
  onRowsChange,
  onSave,
  onCancel,
  categories,
  subcategories = [],
  saving = false
}: Props) {
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [showIgnored, setShowIgnored] = useState(false)

  const visibleRows = showIgnored ? rows : rows.filter(r => !r.ignored)

  const updateRow = (id: string, field: keyof EditableParsedLine, value: any) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        if (field === 'installments') {
          if (typeof value === 'string' && value.includes('/')) {
            const [current, total] = value.split('/').map(n => parseInt(n.trim()))
            return { ...row, installments: { current, total } }
          } else {
            return { ...row, installments: value }
          }
        }
        return { ...row, [field]: value }
      }
      return row
    })
    onRowsChange(newRows)
  }

  const toggleIgnore = (id: string) => {
    updateRow(id, 'ignored', !rows.find(r => r.id === id)?.ignored)
  }

  const handleSave = async () => {
    // Filtrar solo los que no están ignorados
    const rowsToSave = rows.filter(r => !r.ignored)
    await onSave(rowsToSave)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            Corrección Asistida ({visibleRows.length} transacciones)
          </h4>
          <button
            onClick={() => setShowIgnored(!showIgnored)}
            className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {showIgnored ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showIgnored ? 'Ocultar' : 'Mostrar'} ignorados ({rows.filter(r => r.ignored).length})
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || visibleRows.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : `Confirmar y guardar (${visibleRows.length})`}
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        💡 <strong>Consejo:</strong> Haz clic en cualquier celda para editarla. Los cambios se guardan automáticamente en la plantilla inteligente.
      </div>

      <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-right">Monto</th>
              <th className="p-2 text-left">Cuotas</th>
              <th className="p-2 text-left">Categoría</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isEditing = editingRow === row.id
              const amount = row.montoPesos > 0 ? row.montoPesos : row.montoUSD
              const currency = row.montoPesos > 0 ? 'pesos' : 'usd'
              const category = categories.find(c => c.id === row.categoryId)

              return (
                <tr
                  key={row.id}
                  className={`border-t border-gray-200 dark:border-gray-700 ${
                    isEditing ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  } ${row.ignored ? 'opacity-50' : ''}`}
                >
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.date}
                        onChange={e => updateRow(row.id, 'date', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                        onBlur={() => setEditingRow(null)}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => setEditingRow(row.id)}
                      >
                        {row.date}
                      </span>
                    )}
                  </td>
                  <td className="p-2 min-w-[200px]">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.description}
                        onChange={e => updateRow(row.id, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                        onBlur={() => setEditingRow(null)}
                      />
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => setEditingRow(row.id)}
                        title={row.description}
                      >
                        {row.description.length > 40 ? `${row.description.substring(0, 40)}...` : row.description}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={currency === 'pesos' ? (amount > 0 ? amount.toString().replace('.', ',') : '') : ''}
                          onChange={e => {
                            const val = e.target.value.replace(',', '.')
                            updateRow(row.id, 'montoPesos', parseFloat(val) || 0)
                            if (parseFloat(val) > 0) {
                              updateRow(row.id, 'montoUSD', 0)
                            }
                          }}
                          className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-right text-sm"
                          onBlur={() => setEditingRow(null)}
                          placeholder="ARS"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={currency === 'usd' ? (amount > 0 ? amount.toFixed(2) : '') : ''}
                          onChange={e => {
                            const val = e.target.value
                            updateRow(row.id, 'montoUSD', parseFloat(val) || 0)
                            if (parseFloat(val) > 0) {
                              updateRow(row.id, 'montoPesos', 0)
                            }
                          }}
                          className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-right text-sm"
                          onBlur={() => setEditingRow(null)}
                          placeholder="USD"
                        />
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => setEditingRow(row.id)}
                      >
                        {currency === 'pesos' 
                          ? formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : `$${amount.toFixed(2)} USD`
                        }
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        placeholder="1/1"
                        value={row.installments ? `${row.installments.current}/${row.installments.total}` : ''}
                        onChange={e => updateRow(row.id, 'installments', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                        onBlur={() => setEditingRow(null)}
                      />
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => setEditingRow(row.id)}
                      >
                        {row.installments ? `${row.installments.current}/${row.installments.total}` : '-'}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <select
                        value={row.categoryId || ''}
                        onChange={e => updateRow(row.id, 'categoryId', e.target.value || undefined)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                        onBlur={() => setEditingRow(null)}
                      >
                        <option value="">Sin categoría</option>
                        {categories
                          .filter(c => c.type === 'expense')
                          .map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => setEditingRow(row.id)}
                      >
                        {category ? (
                          <span className="inline-flex items-center gap-1">
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <select
                        value={row.type}
                        onChange={e => updateRow(row.id, 'type', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                        onBlur={() => setEditingRow(null)}
                      >
                        <option value="consumption">Consumo</option>
                        <option value="interest">Interés</option>
                        <option value="fee">Comisión</option>
                      </select>
                    ) : (
                      <span
                        className="cursor-pointer text-xs"
                        onClick={() => setEditingRow(row.id)}
                      >
                        {row.type === 'consumption' ? '✓' : row.type === 'interest' ? 'ℹ' : '⚙'}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => toggleIgnore(row.id)}
                      className={`px-2 py-1 text-xs rounded ${
                        row.ignored
                          ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      } hover:opacity-80`}
                      title={row.ignored ? 'Mostrar' : 'Ignorar'}
                    >
                      {row.ignored ? 'Mostrar' : 'Ignorar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {visibleRows.length === 0 && (
        <div className="text-center py-8 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg">
          No hay transacciones para mostrar
        </div>
      )}
    </div>
  )
}

