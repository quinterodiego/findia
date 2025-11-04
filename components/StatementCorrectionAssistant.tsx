'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Save, X, Eye, EyeOff, Plus } from 'lucide-react'
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
  const [savedRows, setSavedRows] = useState<Set<string>>(new Set())
  const [showAddInterestFee, setShowAddInterestFee] = useState(false)
  // Estados locales para los valores de los inputs mientras se editan
  // Usamos un Map para almacenar los valores por fila
  const [editingAmounts, setEditingAmounts] = useState<Map<string, string>>(new Map())
  const [editingInstallmentsMap, setEditingInstallmentsMap] = useState<Map<string, string>>(new Map())
  const [editingCurrency, setEditingCurrency] = useState<Map<string, 'pesos' | 'usd'>>(new Map())
  
  // Normaliza strings de montos con formato AR/US a número: '243.573,49' => 243573.49, '1,23' => 1.23
  const normalizeAmountString = (raw: string): number | null => {
    if (!raw) return 0
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '-') return 0
    // Eliminar separadores de miles '.' y convertir coma decimal a punto
    const normalized = trimmed.replace(/\./g, '').replace(/,/g, '.')
    const num = parseFloat(normalized)
    return isNaN(num) ? null : num
  }
  
  // Usar refs para mantener los valores más recientes sin depender de closures
  const editingAmountsRef = useRef<Map<string, string>>(new Map())
  const editingCurrencyRef = useRef<Map<string, 'pesos' | 'usd'>>(new Map())
  const rowsRef = useRef(rows)
  
  // Sincronizar refs con estados
  useEffect(() => {
    editingAmountsRef.current = editingAmounts
  }, [editingAmounts])
  
  useEffect(() => {
    editingCurrencyRef.current = editingCurrency
  }, [editingCurrency])
  
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const visibleRows = showIgnored ? rows : rows.filter(r => !r.ignored)

  const updateRow = (id: string, field: keyof EditableParsedLine, value: any) => {
    // Usar rowsRef para obtener el valor más actualizado
    const currentRows = rowsRef.current
    const newRows = currentRows.map(row => {
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
    // Actualizar el ref inmediatamente para que las siguientes llamadas a updateRow usen los valores actualizados
    rowsRef.current = newRows
    onRowsChange(newRows)
  }

  const toggleIgnore = (id: string) => {
    updateRow(id, 'ignored', !rows.find(r => r.id === id)?.ignored)
  }

  // Función auxiliar para sincronizar y cerrar la edición de una fila
  const syncAndCloseEditing = (rowId: string) => {
    // Usar refs para obtener los valores más actuales sin depender de closures
    const finalValue = editingAmountsRef.current.get(rowId)
    const currentCurrency = editingCurrencyRef.current.get(rowId)
    const row = rowsRef.current.find(r => r.id === rowId)
    
    if (row) {
      const currency = currentCurrency ?? (row.montoPesos > 0 ? 'pesos' : 'usd')
      
      // Sincronizar el valor del monto si existe
      if (finalValue !== undefined && finalValue !== '') {
        const parsed = (() => {
          const t = finalValue.trim()
          if (t === '' || t === '-') return 0
          const normalized = t.replace(/\./g, '').replace(/,/g, '.')
          const n = parseFloat(normalized)
          return isNaN(n) ? null : n
        })()
        if (parsed !== null) {
          if (parsed > 0) {
            // Actualizar ambos campos en una sola operación para evitar estados intermedios
            const currentRows = rowsRef.current
            const updatedRows = currentRows.map(r => {
              if (r.id === rowId) {
                if (currency === 'pesos') {
                  return { ...r, montoPesos: parsed, montoUSD: 0 }
                } else {
                  return { ...r, montoUSD: parsed, montoPesos: 0 }
                }
              }
              return r
            })
            rowsRef.current = updatedRows
            onRowsChange(updatedRows)
          } else {
            const currentRows = rowsRef.current
            const updatedRows = currentRows.map(r => {
              if (r.id === rowId) {
                if (currency === 'pesos') {
                  return { ...r, montoPesos: 0 }
                } else {
                  return { ...r, montoUSD: 0 }
                }
              }
              return r
            })
            rowsRef.current = updatedRows
            onRowsChange(updatedRows)
          }
        }
      }
      
      // Sincronizar la moneda si existe
      if (currentCurrency !== undefined) {
        // Ya está actualizada en rows cuando se cambia la moneda, pero nos aseguramos
        if (currentCurrency === 'pesos' && row.montoUSD > 0) {
          // Si la moneda es pesos pero hay montoUSD, mover a montoPesos
          const amountToMove = row.montoUSD
          updateRow(rowId, 'montoPesos', amountToMove)
          updateRow(rowId, 'montoUSD', 0)
        } else if (currentCurrency === 'usd' && row.montoPesos > 0) {
          // Si la moneda es USD pero hay montoPesos, mover a montoUSD
          const amountToMove = row.montoPesos
          updateRow(rowId, 'montoUSD', amountToMove)
          updateRow(rowId, 'montoPesos', 0)
        }
      }
    }
    
    // Cerrar la edición y limpiar estados locales
    setSavedRows(prev => new Set(prev).add(rowId))
    setEditingRow(null)
    
    // Limpiar editingAmounts
    setEditingAmounts(prev => {
      const newMap = new Map(prev)
      newMap.delete(rowId)
      return newMap
    })
    
    // Limpiar editingCurrency
    setEditingCurrency(prev => {
      const newMap = new Map(prev)
      newMap.delete(rowId)
      return newMap
    })
  }

  const addInterestOrFee = () => {
    const today = new Date().toLocaleDateString('es-AR')
    const newRow: EditableParsedLine = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: today,
      originalDate: today,
      description: 'Intereses/Impuestos/Comisiones',
      montoPesos: 0,
      montoUSD: 0,
      installments: null,
      type: 'fee', // Tipo por defecto, el usuario puede cambiarlo
      ignored: false,
    }
    const newRows = [...rows, newRow]
    onRowsChange(newRows)
    setEditingRow(newRow.id) // Abrir edición inmediatamente
    setShowAddInterestFee(false)
  }

  const handleSave = async () => {
    // Filtrar solo los que no están ignorados
    const rowsToSave = rows.filter(r => !r.ignored)
    await onSave(rowsToSave)
  }

  // Cerrar edición cuando se hace click fuera de la fila editada (solo usando click, no mousedown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      if (!editingRow) return
      
      // Si el click es en un input, select, textarea o cualquier elemento interactivo dentro de la fila editada, nunca cerrar
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON'
      const clickedRow = target.closest('tr')
      const isInEditingRow = clickedRow && clickedRow.getAttribute('data-row-id') === editingRow
      
      if (isInputElement && isInEditingRow) {
        return // No cerrar si es un elemento de input dentro de la fila editada
      }
      
      const tableElement = target.closest('table')
      
      // Solo cerrar si:
      // 1. Está fuera de la tabla completamente
      // 2. O está en otra fila diferente
      if (!tableElement || (clickedRow && !isInEditingRow)) {
        syncAndCloseEditing(editingRow)
      }
    }

    if (editingRow) {
      // Usar click en lugar de mousedown, y con un delay para dar tiempo a que los inputs reciban el focus
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 500) // Delay más largo
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [editingRow])

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

      {/* Panel para agregar intereses/impuestos manualmente */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={addInterestOrFee}
          className="px-3 py-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/50 flex items-center gap-2 border border-purple-300 dark:border-purple-700"
        >
          <Plus className="w-4 h-4" />
          + Agregar Intereses/Impuestos
        </button>
      </div>

      <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <p className="text-sm text-purple-700 dark:text-purple-300">
          <strong>💡 Primera vez:</strong> Agrega manualmente los intereses e impuestos del resumen. 
          Puedes editar el tipo (Interés/Comisión) y la categoría desde la tabla. En los siguientes meses, la app los reconocerá automáticamente.
        </p>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-visible">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-right">Monto</th>
              <th className="p-2 text-left">Moneda</th>
              <th className="p-2 text-left">Cuotas</th>
              <th className="p-2 text-left">Categoría</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isEditing = editingRow === row.id
              // Determinar la moneda: usar la del estado local si existe, sino calcular desde los montos
              const currency = editingCurrency.get(row.id) ?? (row.montoPesos > 0 ? 'pesos' : 'usd')
              const amount = currency === 'pesos' ? row.montoPesos : row.montoUSD

              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  className={`border-t border-gray-200 dark:border-gray-700 ${
                    isEditing ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  } ${row.ignored ? 'opacity-50' : ''} ${savedRows.has(row.id) && !isEditing ? 'bg-green-50 dark:bg-green-900/10' : ''}`}
                >
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.date}
                        onChange={e => updateRow(row.id, 'date', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                        onBlur={(e) => {
                          const currentRowEl = (e.currentTarget as HTMLElement).closest('tr')
                          setTimeout(() => {
                            const next = document.activeElement as HTMLElement | null
                            const inSameRow = next && currentRowEl ? currentRowEl.contains(next) : false
                            if (!inSameRow) {
                              setSavedRows(prev => new Set(prev).add(row.id))
                              setEditingRow(null)
                            }
                          }, 100)
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setEditingRow(row.id)
                        }}
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
                        onBlur={(e) => {
                          const currentRowEl = (e.currentTarget as HTMLElement).closest('tr')
                          setTimeout(() => {
                            const next = document.activeElement as HTMLElement | null
                            const inSameRow = next && currentRowEl ? currentRowEl.contains(next) : false
                            if (!inSameRow) {
                              setSavedRows(prev => new Set(prev).add(row.id))
                              setEditingRow(null)
                            }
                          }, 100)
                        }}
                      />
                    ) : (
                      <span
                        className="cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setEditingRow(row.id)
                        }}
                        title={row.description}
                      >
                        {row.description.length > 40 ? `${row.description.substring(0, 40)}...` : row.description}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingAmounts.has(row.id) 
                          ? editingAmounts.get(row.id)! 
                          : (amount > 0 ? (currency === 'pesos' ? amount.toString().replace('.', ',') : amount.toFixed(2)) : '')}
                        onChange={e => {
                          const inputValue = e.target.value
                          
                          // Actualizar el estado local SIEMPRE (sin importar si es válido o no)
                          setEditingAmounts(prev => {
                            const newMap = new Map(prev)
                            newMap.set(row.id, inputValue)
                            return newMap
                          })
                          
                          // Usar la moneda del estado local si existe, sino calcular desde los montos
                          const currentCurrency = editingCurrency.get(row.id) ?? (row.montoPesos > 0 ? 'pesos' : 'usd')
                          
                          // Actualizar rows solo si hay un valor válido, pero SIEMPRE mantener editingAmounts
                          const parsed = normalizeAmountString(inputValue)
                          if (parsed === 0 || parsed === null) {
                            if (currentCurrency === 'pesos') {
                              updateRow(row.id, 'montoPesos', 0)
                            } else {
                              updateRow(row.id, 'montoUSD', 0)
                            }
                          } else {
                            const numVal = parsed
                            if (currentCurrency === 'pesos') {
                              updateRow(row.id, 'montoPesos', numVal)
                              if (numVal > 0) {
                                  updateRow(row.id, 'montoUSD', 0)
                              }
                            } else {
                              updateRow(row.id, 'montoUSD', numVal)
                              if (numVal > 0) {
                                updateRow(row.id, 'montoPesos', 0)
                              }
                            }
                            // Si el parseo falla (por ejemplo, el usuario está escribiendo "10."), 
                            // no actualizamos rows pero mantenemos editingAmounts con el valor exacto escrito
                          }
                        }}
                        onFocus={(e) => {
                          // Inicializar el valor local solo si no existe ya uno guardado
                          if (!editingAmounts.has(row.id)) {
                            const currentCurrency = editingCurrency.get(row.id) ?? (row.montoPesos > 0 ? 'pesos' : 'usd')
                            const currentAmount = currentCurrency === 'pesos' ? row.montoPesos : row.montoUSD
                            const amountStr = currentAmount > 0 ? (currentCurrency === 'pesos' ? currentAmount.toString().replace('.', ',') : currentAmount.toFixed(2)) : ''
                            setEditingAmounts(prev => {
                              const newMap = new Map(prev)
                              newMap.set(row.id, amountStr)
                              return newMap
                            })
                          }
                          // Inicializar la moneda si no existe
                          if (!editingCurrency.has(row.id)) {
                            const currentCurrency = row.montoPesos > 0 ? 'pesos' : 'usd'
                            setEditingCurrency(prev => {
                              const newMap = new Map(prev)
                              newMap.set(row.id, currentCurrency)
                              return newMap
                            })
                          }
                          e.target.select()
                        }}
                        onKeyDown={(e) => {
                          // Prevenir que Enter cierre la edición
                          if (e.key === 'Enter') {
                            e.preventDefault()
                          }
                        }}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-right text-sm"
                        onBlur={(e) => {
                          const currentRowEl = (e.currentTarget as HTMLElement).closest('tr')
                          setTimeout(() => {
                            const next = document.activeElement as HTMLElement | null
                            const inSameRow = next && currentRowEl ? currentRowEl.contains(next) : false
                            if (!inSameRow) {
                              syncAndCloseEditing(row.id)
                            }
                          }, 200)
                        }}
                        placeholder={currency === 'pesos' ? 'ARS' : 'USD'}
                      />
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => {
                          setEditingRow(row.id)
                          // Inicializar el valor local al activar edición
                          const currentCurrency = row.montoPesos > 0 ? 'pesos' : 'usd'
                          const currentAmount = currentCurrency === 'pesos' ? row.montoPesos : row.montoUSD
                          const amountStr = currentAmount > 0 ? (currentCurrency === 'pesos' ? currentAmount.toString().replace('.', ',') : currentAmount.toFixed(2)) : ''
                          setEditingAmounts(prev => {
                            const newMap = new Map(prev)
                            newMap.set(row.id, amountStr)
                            return newMap
                          })
                          // Inicializar la moneda
                          setEditingCurrency(prev => {
                            const newMap = new Map(prev)
                            newMap.set(row.id, currentCurrency)
                            return newMap
                          })
                        }}
                      >
                        {currency === 'pesos' 
                          ? formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <select
                        value={currency}
                        onChange={e => {
                          const newCurrency = e.target.value as 'pesos' | 'usd'
                          // Guardar la moneda seleccionada en el estado local
                          setEditingCurrency(prev => {
                            const newMap = new Map(prev)
                            newMap.set(row.id, newCurrency)
                            return newMap
                          })
                          
                          // Obtener el monto actual basado en la moneda anterior
                          const currentCurrency = editingCurrency.get(row.id) ?? (row.montoPesos > 0 ? 'pesos' : 'usd')
                          const currentAmount = currentCurrency === 'pesos' ? row.montoPesos : row.montoUSD
                          
                          // Si hay un valor en editingAmounts, usarlo; sino usar el monto actual
                          let amountToUse: number
                          if (editingAmounts.has(row.id)) {
                            const parsedValue = normalizeAmountString(editingAmounts.get(row.id)!)
                            amountToUse = parsedValue === null ? currentAmount : parsedValue
                          } else {
                            amountToUse = currentAmount
                          }
                          
                          if (newCurrency === 'pesos') {
                            // Cambiar a pesos: mantener el monto, mover a montoPesos
                            updateRow(row.id, 'montoPesos', amountToUse)
                            updateRow(row.id, 'montoUSD', 0)
                            // Mantener el valor actual de editingAmounts sin cambiar el formato
                            // Solo actualizar si no existe un valor en editingAmounts
                            if (!editingAmounts.has(row.id)) {
                              setEditingAmounts(prev => {
                                const newMap = new Map(prev)
                                newMap.set(row.id, amountToUse > 0 ? amountToUse.toString().replace('.', ',') : '')
                                return newMap
                              })
                            }
                          } else {
                            // Cambiar a USD: mantener el monto, mover a montoUSD
                            updateRow(row.id, 'montoUSD', amountToUse)
                            updateRow(row.id, 'montoPesos', 0)
                            // Mantener el valor actual de editingAmounts sin cambiar el formato
                            // Solo actualizar si no existe un valor en editingAmounts
                            if (!editingAmounts.has(row.id)) {
                              setEditingAmounts(prev => {
                                const newMap = new Map(prev)
                                newMap.set(row.id, amountToUse > 0 ? amountToUse.toFixed(2) : '')
                                return newMap
                              })
                            }
                          }
                        }}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                        onBlur={(e) => {
                          const currentRowEl = (e.currentTarget as HTMLElement).closest('tr')
                          setTimeout(() => {
                            const next = document.activeElement as HTMLElement | null
                            const inSameRow = next && currentRowEl ? currentRowEl.contains(next) : false
                            if (!inSameRow) {
                              syncAndCloseEditing(row.id)
                            }
                          }, 200)
                        }}
                      >
                        <option value="pesos">PESOS</option>
                        <option value="usd">DÓLARES</option>
                      </select>
                    ) : (
                      <span
                        className="cursor-pointer inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                        onClick={() => {
                          setEditingRow(row.id)
                          // Inicializar la moneda al activar edición
                          const currentCurrency = row.montoPesos > 0 ? 'pesos' : 'usd'
                          setEditingCurrency(prev => {
                            const newMap = new Map(prev)
                            newMap.set(row.id, currentCurrency)
                            return newMap
                          })
                        }}
                      >
                        <span className={`px-2 py-0.5 rounded ${
                          currency === 'pesos' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                          {currency === 'pesos' ? 'ARS' : 'USD'}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        placeholder="1/1"
                        value={editingInstallmentsMap.get(row.id) ?? (row.installments ? `${row.installments.current}/${row.installments.total}` : '')}
                        onChange={e => {
                          const value = e.target.value
                          // Actualizar el estado local para esta fila
                          setEditingInstallmentsMap(prev => {
                            const newMap = new Map(prev)
                            newMap.set(row.id, value)
                            return newMap
                          })
                          
                          const trimmed = value.trim()
                          if (trimmed === '' || trimmed === '-') {
                            updateRow(row.id, 'installments', null)
                          } else {
                            updateRow(row.id, 'installments', trimmed)
                          }
                        }}
                        onFocus={(e) => {
                          // Inicializar el valor local solo si no existe ya uno guardado
                          if (!editingInstallmentsMap.has(row.id)) {
                            const currentInstallments = row.installments ? `${row.installments.current}/${row.installments.total}` : ''
                            setEditingInstallmentsMap(prev => {
                              const newMap = new Map(prev)
                              newMap.set(row.id, currentInstallments)
                              return newMap
                            })
                          }
                          e.target.select()
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '') {
                            updateRow(row.id, 'installments', null)
                          }
                          const currentRowEl = (e.currentTarget as HTMLElement).closest('tr')
                          setTimeout(() => {
                            const next = document.activeElement as HTMLElement | null
                            const inSameRow = next && currentRowEl ? currentRowEl.contains(next) : false
                            if (!inSameRow) {
                              setSavedRows(prev => new Set(prev).add(row.id))
                              setEditingRow(null)
                              setEditingInstallmentsMap(prev => {
                                const newMap = new Map(prev)
                                newMap.delete(row.id)
                                return newMap
                              })
                            }
                          }, 200)
                        }}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                      />
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => {
                          setEditingRow(row.id)
                          // Inicializar el valor local al activar edición
                          const currentInstallments = row.installments ? `${row.installments.current}/${row.installments.total}` : ''
                          setEditingInstallmentsMap(prev => {
                            const newMap = new Map(prev)
                            newMap.set(row.id, currentInstallments)
                            return newMap
                          })
                        }}
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
                        onBlur={(e) => {
                          const currentRowEl = (e.currentTarget as HTMLElement).closest('tr')
                          setTimeout(() => {
                            const next = document.activeElement as HTMLElement | null
                            const inSameRow = next && currentRowEl ? currentRowEl.contains(next) : false
                            if (!inSameRow) {
                              syncAndCloseEditing(row.id)
                            }
                          }, 200)
                        }}
                      >
                        <option value="">Seleccionar categoría</option>
                        <option value="Cuotas">Cuotas</option>
                        <option value="Gasto Fijo">Gasto Fijo</option>
                        <option value="Consumo del Mes">Consumo del Mes</option>
                      </select>
                    ) : (
                      <span
                        className="cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setEditingRow(row.id)
                        }}
                      >
                        {row.categoryId || <span className="text-gray-400">-</span>}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <select
                        value={row.type}
                        onChange={e => updateRow(row.id, 'type', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-sm"
                        onBlur={(e) => {
                          const currentRowEl = (e.currentTarget as HTMLElement).closest('tr')
                          setTimeout(() => {
                            const next = document.activeElement as HTMLElement | null
                            const inSameRow = next && currentRowEl ? currentRowEl.contains(next) : false
                            if (!inSameRow) {
                              syncAndCloseEditing(row.id)
                            }
                          }, 200)
                        }}
                      >
                        <option value="consumption">Consumo</option>
                        <option value="interest">Interés</option>
                        <option value="fee">Comisión</option>
                      </select>
                    ) : (
                      <span
                        className="cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setEditingRow(row.id)
                        }}
                      >
                        {row.type === 'consumption' ? 'Consumo' : row.type === 'interest' ? 'Interés' : row.type === 'fee' ? 'Comisión' : '-'}
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


