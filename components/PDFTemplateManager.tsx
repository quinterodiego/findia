'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Edit2, Trash2, Save, Settings, FileText, AlertCircle, Wand2 } from 'lucide-react'
import PDFTemplateWizard from './PDFTemplateWizard'
import { useToastContext } from '@/components/Toast'
import type { PDFImportTemplate } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  cardId: string
  onTemplateSelected?: (templateId: string) => void
}

export default function PDFTemplateManager({ isOpen, onClose, cardId, onTemplateSelected }: Props) {
  const { error, success } = useToastContext()
  const [templates, setTemplates] = useState<PDFImportTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PDFImportTemplate | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen, cardId])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/credit-cards/${cardId}/templates`)
      const data = await res.json()
      if (data.success) {
        setTemplates(data.templates || [])
      }
    } catch (e) {
      console.error('Error cargando templates:', e)
      error('Error cargando templates')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('¿Estás seguro de eliminar este template?')) return

    try {
      const res = await fetch(`/api/credit-cards/${cardId}/templates/${templateId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        success('Template eliminado')
        loadTemplates()
      } else {
        error(data.error || 'Error eliminando template')
      }
    } catch (e) {
      console.error('Error eliminando template:', e)
      error('Error eliminando template')
    }
  }

  const handleSave = async (template: Partial<PDFImportTemplate>) => {
    try {
      const isEdit = editingTemplate?.id
      const url = isEdit
        ? `/api/credit-cards/${cardId}/templates/${editingTemplate.id}`
        : `/api/credit-cards/${cardId}/templates`
      
      const method = isEdit ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name || 'Template sin nombre',
          datePattern: template.datePattern || undefined,
          amountPattern: template.amountPattern || undefined,
          descriptionPattern: template.descriptionPattern || undefined,
          installmentsPattern: template.installmentsPattern || undefined,
          interestKeywords: template.interestKeywords || undefined,
          feeKeywords: template.feeKeywords || undefined,
          dateFormat: template.dateFormat || undefined,
          amountDecimalSeparator: template.amountDecimalSeparator || undefined,
          amountThousandsSeparator: template.amountThousandsSeparator || undefined,
          searchRange: template.searchRange || undefined,
          skipLines: template.skipLines || undefined,
        })
      })

      const data = await res.json()
      if (data.success) {
        success(isEdit ? 'Template actualizado' : 'Template creado')
        setEditingTemplate(null)
        setShowCreateForm(false)
        loadTemplates()
      } else {
        error(data.error || `Error ${isEdit ? 'actualizando' : 'creando'} template`)
      }
    } catch (e) {
      console.error('Error guardando template:', e)
      error('Error guardando template')
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div className="absolute inset-0 bg-black/50" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.95, opacity: 0 }} 
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gestión de Templates PDF</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            {loading ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-300">Cargando templates...</div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Los templates mejoran la precisión de la extracción de datos del PDF
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowWizard(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer flex items-center gap-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      Asistente
                    </button>
                    <button
                      onClick={() => {
                        setEditingTemplate({
                          id: '',
                          creditCardId: cardId,
                          userId: '',
                          name: '',
                          createdAt: '',
                          updatedAt: '',
                        })
                        setShowCreateForm(true)
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Crear Manual
                    </button>
                  </div>
                </div>

                {(showCreateForm || editingTemplate) && (
                  <TemplateForm
                    template={editingTemplate}
                    onSave={handleSave}
                    onCancel={() => {
                      setEditingTemplate(null)
                      setShowCreateForm(false)
                    }}
                  />
                )}

                {templates.length === 0 && !showCreateForm ? (
                  <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <FileText className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 dark:text-gray-300 mb-4">No hay templates configurados</p>
                    <button
                      onClick={() => {
                        setEditingTemplate({
                          id: '',
                          creditCardId: cardId,
                          userId: '',
                          name: '',
                          createdAt: '',
                          updatedAt: '',
                        })
                        setShowCreateForm(true)
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                    >
                      Crear Primer Template
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onEdit={() => setEditingTemplate(template)}
                        onDelete={() => handleDelete(template.id)}
                        onSelect={() => {
                          if (onTemplateSelected) {
                            onTemplateSelected(template.id)
                            onClose()
                          }
                        }}
                        canSelect={!!onTemplateSelected}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <PDFTemplateWizard
            isOpen={showWizard}
            onClose={() => {
              setShowWizard(false)
              loadTemplates()
            }}
            cardId={cardId}
            onTemplateCreated={() => {
              setShowWizard(false)
              loadTemplates()
            }}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onSelect,
  canSelect,
}: {
  template: PDFImportTemplate
  onEdit: () => void
  onDelete: () => void
  onSelect?: () => void
  canSelect?: boolean
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{template.name}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
            {template.dateFormat && (
              <div><span className="font-medium">Formato fecha:</span> {template.dateFormat}</div>
            )}
            {template.amountDecimalSeparator && (
              <div><span className="font-medium">Decimal:</span> {template.amountDecimalSeparator}</div>
            )}
            {template.searchRange && (
              <div><span className="font-medium">Rango búsqueda:</span> {template.searchRange} líneas</div>
            )}
          </div>
          {template.datePattern && (
            <div className="mt-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Patrón fecha:</span>
              <code className="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                {template.datePattern.substring(0, 50)}{template.datePattern.length > 50 ? '...' : ''}
              </code>
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          {canSelect && onSelect && (
            <button
              onClick={onSelect}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer"
            >
              Usar
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplateForm({
  template,
  onSave,
  onCancel,
}: {
  template: PDFImportTemplate | null
  onSave: (template: Partial<PDFImportTemplate>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<Partial<PDFImportTemplate>>({
    name: template?.name || '',
    datePattern: template?.datePattern || '/(\\b|\\D)(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{2,4})(\\b|\\D)/g',
    amountPattern: template?.amountPattern || '/([+-]?\\$?\\s*\\d{1,3}(?:[\\.,]\\d{3})*(?:[\\.,]\\d{2})?)/g',
    installmentsPattern: template?.installmentsPattern || '/(\\d{1,2})\\s*(?:de|\\/|-|DE)\\s*(\\d{1,2})/i',
    interestKeywords: template?.interestKeywords || ['interés', 'interés financ', 'financ', 'cargo financ', 'mora', 'retención', 'iva', 'impuesto'],
    feeKeywords: template?.feeKeywords || ['comisión', 'mantenimiento', 'cuota de manejo', 'anualidad'],
    dateFormat: template?.dateFormat || 'dd/mm/yyyy',
    amountDecimalSeparator: template?.amountDecimalSeparator || ',',
    amountThousandsSeparator: template?.amountThousandsSeparator || '.',
    searchRange: template?.searchRange || 3,
    skipLines: template?.skipLines || [],
  })

  const [skipLinesText, setSkipLinesText] = useState((formData.skipLines || []).join(', '))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      skipLines: skipLinesText ? skipLinesText.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">
          {template?.id ? 'Editar Template' : 'Nuevo Template'}
        </h4>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Nombre del Template *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
            placeholder="Ej: Santander Visa"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Formato de Fecha</label>
          <select
            value={formData.dateFormat}
            onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
          >
            <option value="dd/mm/yyyy">dd/mm/yyyy</option>
            <option value="dd-mm-yyyy">dd-mm-yyyy</option>
            <option value="mm/dd/yyyy">mm/dd/yyyy</option>
            <option value="yyyy-mm-dd">yyyy-mm-dd</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Separador Decimal</label>
          <select
            value={formData.amountDecimalSeparator}
            onChange={(e) => setFormData({ ...formData, amountDecimalSeparator: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
          >
            <option value=",">Coma (,)</option>
            <option value=".">Punto (.)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Separador de Miles</label>
          <select
            value={formData.amountThousandsSeparator}
            onChange={(e) => setFormData({ ...formData, amountThousandsSeparator: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
          >
            <option value=".">Punto (.)</option>
            <option value=",">Coma (,)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Rango de Búsqueda (líneas)</label>
          <input
            type="number"
            value={formData.searchRange}
            onChange={(e) => setFormData({ ...formData, searchRange: parseInt(e.target.value) || 3 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
            min="1"
            max="10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Patrón Regex para Fechas</label>
        <input
          type="text"
          value={formData.datePattern}
          onChange={(e) => setFormData({ ...formData, datePattern: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
          placeholder="/(\b|\D)(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})(\b|\D)/g"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Patrón Regex para Montos</label>
        <input
          type="text"
          value={formData.amountPattern}
          onChange={(e) => setFormData({ ...formData, amountPattern: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
          placeholder="/([+-]?\$?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Patrón Regex para Cuotas</label>
        <input
          type="text"
          value={formData.installmentsPattern}
          onChange={(e) => setFormData({ ...formData, installmentsPattern: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
          placeholder="/(\d{1,2})\s*(?:de|\/|-|DE)\s*(\d{1,2})/i"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Palabras Clave para Intereses (separadas por comas)</label>
          <input
            type="text"
            value={(formData.interestKeywords || []).join(', ')}
            onChange={(e) => setFormData({ 
              ...formData, 
              interestKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
            placeholder="interés, interés financ, mora, iva"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Palabras Clave para Comisiones (separadas por comas)</label>
          <input
            type="text"
            value={(formData.feeKeywords || []).join(', ')}
            onChange={(e) => setFormData({ 
              ...formData, 
              feeKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
            placeholder="comisión, mantenimiento, anualidad"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Líneas a Ignorar (separadas por comas)</label>
        <input
          type="text"
          value={skipLinesText}
          onChange={(e) => setSkipLinesText(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
          placeholder="TOTAL, SALDO ANTERIOR, RESUMEN"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Las líneas que contengan estos textos serán ignoradas durante la extracción
        </p>
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {template?.id ? 'Actualizar' : 'Crear'} Template
        </button>
      </div>
    </form>
  )
}

