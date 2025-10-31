'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Edit2, Trash2, Copy, Calendar, DollarSign, Tag, FileText } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { formatCurrency } from '@/lib/formatNumber'

interface ExpenseTemplate {
  id: string
  name: string
  amount: number
  category: string
  subcategory: string
  expenseType: 'fixed' | 'variable'
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  description?: string
  createdAt: string
}

interface ExpenseTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyTemplate: (template: ExpenseTemplate) => void
  categories: any[]
  subcategories: any[]
}

export default function ExpenseTemplateModal({ 
  isOpen, 
  onClose, 
  onApplyTemplate, 
  categories, 
  subcategories 
}: ExpenseTemplateModalProps) {
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ExpenseTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: '',
    subcategory: '',
    expenseType: 'fixed' as 'fixed' | 'variable',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    description: ''
  })

  // Cargar plantillas existentes
  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      // Por ahora simulamos datos, después conectaremos con la API
      const mockTemplates: ExpenseTemplate[] = [
        {
          id: '1',
          name: 'Alquiler',
          amount: 800000,
          category: 'Vivienda',
          subcategory: 'Alquiler',
          expenseType: 'fixed',
          frequency: 'monthly',
          description: 'Pago mensual de alquiler',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Servicios Públicos',
          amount: 150000,
          category: 'Servicios',
          subcategory: 'Servicios Públicos',
          expenseType: 'fixed',
          frequency: 'monthly',
          description: 'Luz, agua, gas',
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Netflix',
          amount: 25000,
          category: 'Entretenimiento',
          subcategory: 'Streaming',
          expenseType: 'fixed',
          frequency: 'monthly',
          description: 'Suscripción mensual',
          createdAt: new Date().toISOString()
        }
      ]
      setTemplates(mockTemplates)
    } catch (err) {
      error('Error al cargar plantillas')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!formData.name || !formData.amount || !formData.category) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      setLoading(true)
      const newTemplate: ExpenseTemplate = {
        id: Date.now().toString(),
        name: formData.name,
        amount: parseFloat(formData.amount),
        category: formData.category,
        subcategory: formData.subcategory,
        expenseType: formData.expenseType,
        frequency: formData.frequency,
        description: formData.description,
        createdAt: new Date().toISOString()
      }

      setTemplates(prev => [...prev, newTemplate])
      success('Plantilla creada exitosamente')
      resetForm()
      setShowCreateForm(false)
    } catch (err) {
      error('Error al crear plantilla')
    } finally {
      setLoading(false)
    }
  }

  const handleEditTemplate = async () => {
    if (!editingTemplate || !formData.name || !formData.amount || !formData.category) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      setLoading(true)
      const updatedTemplate: ExpenseTemplate = {
        ...editingTemplate,
        name: formData.name,
        amount: parseFloat(formData.amount),
        category: formData.category,
        subcategory: formData.subcategory,
        expenseType: formData.expenseType,
        frequency: formData.frequency,
        description: formData.description
      }

      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updatedTemplate : t))
      success('Plantilla actualizada exitosamente')
      resetForm()
      setEditingTemplate(null)
    } catch (err) {
      error('Error al actualizar plantilla')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      success('Plantilla eliminada exitosamente')
    } catch (err) {
      error('Error al eliminar plantilla')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      amount: '',
      category: '',
      subcategory: '',
      expenseType: 'fixed',
      frequency: 'monthly',
      description: ''
    })
  }

  const startEdit = (template: ExpenseTemplate) => {
    setFormData({
      name: template.name,
      amount: template.amount.toString(),
      category: template.category,
      subcategory: template.subcategory,
      expenseType: template.expenseType,
      frequency: template.frequency,
      description: template.description || ''
    })
    setEditingTemplate(template)
    setShowCreateForm(true)
  }

  const getFrequencyIcon = (frequency: string) => {
    switch (frequency) {
      case 'daily': return '📅'
      case 'weekly': return '📆'
      case 'monthly': return '🗓️'
      case 'yearly': return '📊'
      default: return '📅'
    }
  }

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Diario'
      case 'weekly': return 'Semanal'
      case 'monthly': return 'Mensual'
      case 'yearly': return 'Anual'
      default: return 'Mensual'
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Plantillas de Gastos Recurrentes
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Crea y gestiona plantillas para gastos que se repiten frecuentemente
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resetForm()
                    setShowCreateForm(true)
                    setEditingTemplate(null)
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Plantilla
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {showCreateForm ? (
              /* Create/Edit Form */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nombre del Gasto *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="Ej: Alquiler, Netflix, Servicios..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monto *
                      </label>
                      <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Categoría *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value, subcategory: '' }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Seleccionar categoría</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Subcategoría
                      </label>
                      <select
                        value={formData.subcategory}
                        onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        disabled={!formData.category}
                      >
                        <option value="">Seleccionar subcategoría</option>
                        {subcategories
                          .filter(sub => sub.category === formData.category)
                          .map(sub => (
                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipo de Gasto
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, expenseType: 'fixed' }))}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            formData.expenseType === 'fixed'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Fijo
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, expenseType: 'variable' }))}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            formData.expenseType === 'variable'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Variable
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Frecuencia
                      </label>
                      <select
                        value={formData.frequency}
                        onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="daily">Diario</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensual</option>
                        <option value="yearly">Anual</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      rows={3}
                      placeholder="Descripción adicional del gasto..."
                    />
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={editingTemplate ? handleEditTemplate : handleCreateTemplate}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {loading ? 'Guardando...' : (editingTemplate ? 'Actualizar' : 'Crear Plantilla')}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingTemplate(null)
                        resetForm()
                      }}
                      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Templates List */
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando plantillas...</p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No tienes plantillas creadas
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Crea tu primera plantilla para gastos recurrentes
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Crear Primera Plantilla
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template, index) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {template.name}
                            </h5>
                            <p className="text-2xl font-bold text-blue-500 dark:text-blue-400 mb-2">
                              {formatCurrency(template.amount)}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {template.category}
                              </span>
                              <span className="flex items-center gap-1">
                                {getFrequencyIcon(template.frequency)}
                                {getFrequencyText(template.frequency)}
                              </span>
                            </div>
                            {template.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onApplyTemplate(template)}
                            className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                            Usar
                          </button>
                          <button
                            onClick={() => startEdit(template)}
                            className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="px-3 py-2 bg-red-200 dark:bg-red-900/20 hover:bg-red-300 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
