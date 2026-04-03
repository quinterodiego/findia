'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, DollarSign, Calendar, Tag, FileText, Calculator, AlertCircle, Edit2, Trash2, Save } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { formatCurrency, formatNumber } from '@/lib/formatNumber'

interface CreditCardConsumption {
  id: string
  cardId: string
  cardName: string
  merchant: string
  amount: number
  date: string
  category: string
  subcategory: string
  installments: number
  currentInstallment: number
  monthlyPayment: number
  description?: string
  createdAt: string
}

interface CreditCardConsumptionModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCard?: any
  categories: any[]
  subcategories: any[]
}

export default function CreditCardConsumptionModal({ 
  isOpen, 
  onClose, 
  selectedCard,
  categories = [],
  subcategories = []
}: CreditCardConsumptionModalProps) {
  const [consumptions, setConsumptions] = useState<CreditCardConsumption[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToastContext()

  // Debug: Verificar que categorías y subcategorías se reciben correctamente
  useEffect(() => {
    if (isOpen) {
    }
  }, [isOpen, categories, subcategories])

  // Form state
  const [formData, setFormData] = useState({
    cardId: '',
    cardName: '',
    merchant: '',
    amount: '',
    currency: 'pesos' as 'pesos' | 'usd',
    date: new Date().toISOString().split('T')[0],
    category: '',
    subcategory: '',
    installments: '1',
    description: ''
  })

  // Filtrar subcategorías basadas en la categoría seleccionada
  const availableSubcategories = useMemo(() => {
    
    if (!formData.category || !categories.length || !subcategories.length) {
      return []
    }
    
    const selectedCategory = categories.find(cat => cat.name === formData.category)
    if (!selectedCategory) {
      return []
    }
    
    
    const filtered = subcategories.filter(sub => {
      const matches = sub.categoryId === selectedCategory.id
      return matches
    })
    
    return filtered
  }, [formData.category, categories, subcategories])

  // Cargar consumos existentes
  useEffect(() => {
    if (isOpen) {
      loadConsumptions()
      if (selectedCard) {
        setFormData(prev => ({
          ...prev,
          cardId: selectedCard.id,
          cardName: selectedCard.name
        }))
      }
    }
  }, [isOpen, selectedCard])

  const loadConsumptions = async () => {
    if (!selectedCard?.id) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/credit-cards/${selectedCard.id}/consumptions`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar consumos')
      }
      
      // Convertir los datos de la API al formato esperado por el componente
      const formattedConsumptions: CreditCardConsumption[] = (data.consumptions || []).map((c: any) => {
        const consumption = {
          id: c.id,
          cardId: c.creditCardId,
          cardName: selectedCard.name || 'Tarjeta',
          merchant: c.merchant || 'Movimiento',
          amount: c.amount || 0,
          date: c.date || new Date().toISOString().split('T')[0],
          category: c.categoryId || '',
          subcategory: c.subcategoryId || '',
          installments: c.installments || 1,
          currentInstallment: c.currentInstallment || 1,
          monthlyPayment: c.monthlyPayment || c.amount || 0,
          description: c.description || '',
          createdAt: c.createdAt || new Date().toISOString(),
          // Agregar información de moneda si existe
          montoPesos: c.montoPesos !== undefined && c.montoPesos !== null ? parseFloat(c.montoPesos) : undefined,
          montoUSD: c.montoUSD !== undefined && c.montoUSD !== null ? parseFloat(c.montoUSD) : undefined
        } as any
        return consumption
      })
      
      setConsumptions(formattedConsumptions)
    } catch (err) {
      console.error('Error cargando consumos:', err)
      error('Error al cargar consumos')
      setConsumptions([])
    } finally {
      setLoading(false)
    }
  }

  // Función helper para convertir formato argentino (punto miles, coma decimal) a número
  // Formato: "243.573,49" -> 243573.49
  const normalizeAmount = (value: string): string => {
    if (!value) return '0'
    // Remover puntos (separador de miles) y convertir coma a punto (decimal)
    return value.replace(/\./g, '').replace(',', '.')
  }

  // Función helper para validar y formatear el input de monto
  // Permite: punto (.) como separador de miles, coma (,) como separador decimal
  const handleAmountChange = (value: string, setFormData: React.Dispatch<React.SetStateAction<any>>) => {
    // Permitir solo números, punto y coma
    const cleaned = value.replace(/[^\d,.]/g, '')
    
    // Separar la parte entera y decimal
    const hasComa = cleaned.includes(',')
    const hasPunto = cleaned.includes('.')
    
    if (hasComa && hasPunto) {
      // Si tiene ambos, la coma debe ser el decimal y los puntos los miles
      // Ejemplo: "243.573,49"
      const parts = cleaned.split(',')
      if (parts.length > 2) {
        // Múltiples comas, solo permitir una
        const integerPart = parts[0].replace(/\./g, '')
        const decimalPart = parts.slice(1).join('').replace(/\./g, '')
        // Formatear con puntos cada 3 dígitos
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        setFormData((prev: any) => ({ ...prev, amount: `${formattedInteger},${decimalPart}` }))
        return
      }
      // Formatear la parte entera con puntos cada 3 dígitos
      const integerPart = parts[0].replace(/\./g, '')
      const decimalPart = parts[1] || ''
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      setFormData((prev: any) => ({ ...prev, amount: `${formattedInteger},${decimalPart}` }))
      return
    } else if (hasComa) {
      // Solo tiene coma (decimal), formatear miles con puntos
      const parts = cleaned.split(',')
      const integerPart = parts[0]
      const decimalPart = parts[1] || ''
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      setFormData((prev: any) => ({ ...prev, amount: `${formattedInteger},${decimalPart}` }))
      return
    } else if (hasPunto) {
      // Solo tiene punto, verificar si es decimal o miles
      // Si el último punto está seguido de 1-2 dígitos, es decimal
      const lastPuntoIndex = cleaned.lastIndexOf('.')
      const afterLastPunto = cleaned.substring(lastPuntoIndex + 1)
      
      if (afterLastPunto.length <= 2 && cleaned.split('.').length === 2) {
        // Probablemente es decimal (formato inglés), convertir a formato argentino
        const parts = cleaned.split('.')
        const integerPart = parts[0]
        const decimalPart = parts[1] || ''
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        setFormData((prev: any) => ({ ...prev, amount: `${formattedInteger},${decimalPart}` }))
        return
      } else {
        // Es formato de miles, mantener y agregar puntos cada 3 dígitos
        const integerPart = cleaned.replace(/\./g, '')
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        setFormData((prev: any) => ({ ...prev, amount: formattedInteger }))
        return
      }
    } else {
      // Solo números, formatear con puntos cada 3 dígitos
      const formatted = cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      setFormData((prev: any) => ({ ...prev, amount: formatted }))
      return
    }
  }

  const handleCreateConsumption = async () => {
    // Determinar si es un consumo de tipo "Intereses" para no requerir categoría
    const merchantUpper = (formData.merchant || '').toUpperCase()
    const descriptionUpper = (formData.description || '').toUpperCase()
    const isInterest = merchantUpper.includes('INTERES') || 
                      merchantUpper.includes('INTERÉS') || 
                      descriptionUpper.includes('INTERES') || 
                      descriptionUpper.includes('INTERÉS') ||
                      formData.category === 'Intereses'
    
    // Validar campos obligatorios: los intereses no requieren categoría, pero si se selecciona "Intereses", está bien
    const requiresCategory = !isInterest && !formData.category
    
    if (!formData.cardId || !formData.merchant || !formData.amount || requiresCategory) {
      const missingFields = []
      if (!formData.cardId) missingFields.push('Tarjeta')
      if (!formData.merchant) missingFields.push('Comercio')
      if (!formData.amount) missingFields.push('Monto')
      if (requiresCategory) missingFields.push('Categoría')
      error(`Por favor completa los siguientes campos: ${missingFields.join(', ')}`)
      return
    }

    try {
      setLoading(true)
      const installments = parseInt(formData.installments)
      // Normalizar el monto: convertir coma a punto para parseFloat
      const amount = parseFloat(normalizeAmount(formData.amount))
      if (isNaN(amount)) {
        error('Por favor ingresa un monto válido')
        return
      }
      // El amount ya es la cuota mensual, no el total
      // Para calcular el total original: amount * installments
      const monthlyPayment = amount

      // Convertir fecha de yyyy-mm-dd a dd/mm/yyyy
      let formattedDate = formData.date
      if (formattedDate.includes('-')) {
        const [year, month, day] = formattedDate.split('-')
        formattedDate = `${day}/${month}/${year}`
      }

      // Guardar la categoría directamente como categoryId (Consumo o Intereses)
      const categoryId = formData.category || ''

      const response = await fetch(`/api/credit-cards/${formData.cardId}/consumptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            description: formData.merchant,
            amount: amount,
            montoPesos: formData.currency === 'pesos' ? amount : 0,
            montoUSD: formData.currency === 'usd' ? amount : 0,
            date: formattedDate,
            installments: {
              total: installments,
              current: 1
            },
            type: formData.description || '',
            categoryId: categoryId,
            subcategoryId: ''
          }],
          skipDuplicates: false
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar consumo')
      }

      // Recargar consumos desde la API
      await loadConsumptions()

      success('Consumo registrado exitosamente')
      resetForm()
      setShowCreateForm(false)
    } catch (err: any) {
      console.error('Error registrando consumo:', err)
      error(err?.message || 'Error al registrar consumo')
    } finally {
      setLoading(false)
    }
  }

  // Función para determinar si un consumo es de tipo "Intereses"
  const isInterestConsumption = (consumption: CreditCardConsumption): boolean => {
    const merchant = (consumption.merchant || '').toUpperCase()
    const description = (consumption.description || '').toUpperCase()
    const categoryId = ((consumption as any).categoryId || consumption.category || '').toUpperCase()
    
    // Verificar si contiene palabras clave de intereses
    const interestKeywords = ['INTERES', 'INTERÉS', 'INTERESES']
    return interestKeywords.some(keyword => 
      merchant.includes(keyword) || 
      description.includes(keyword) || 
      categoryId === keyword
    )
  }

  const handleEditConsumption = (consumption: CreditCardConsumption) => {
    
    setEditingId(consumption.id)
    // Convertir fecha de dd/mm/yyyy a yyyy-mm-dd si es necesario
    let dateValue = consumption.date
    if (consumption.date.includes('/')) {
      const [day, month, year] = consumption.date.split('/')
      dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    } else if (!consumption.date.includes('-')) {
      // Si no es formato conocido, usar la fecha actual como fallback
      dateValue = new Date().toISOString().split('T')[0]
    }
    
    // La categoría viene como categoryId (string: "Consumo" o "Intereses", o "Cuotas", "Gasto Fijo", "Consumo del Mes")
    // o como category
    let categoryName = (consumption as any).categoryId || consumption.category || ''
    
    // Normalizar categorías: permitir las nuevas opciones también
    const validCategories = ['Consumo', 'Intereses', 'Cuotas', 'Gasto Fijo', 'Consumo del Mes']
    if (categoryName && !validCategories.includes(categoryName)) {
      categoryName = ''
    }
    
    // Determinar la moneda: si el consumo tiene montoUSD > 0 es usd, sino pesos
    // Si no hay información de moneda guardada, asumir pesos por defecto
    const montoPesos = (consumption as any).montoPesos
    const montoUSD = (consumption as any).montoUSD
    const consumptionCurrency = montoUSD && montoUSD > 0 ? 'usd' : 'pesos'
    
    
    // Usar monthlyPayment si existe, ya que es la cuota mensual correcta
    // Si monthlyPayment no existe o es 0, usar amount como fallback
    // Esto es para consumos antiguos que pueden tener el valor dividido en amount
    const monthlyPaymentValue = consumption.monthlyPayment && consumption.monthlyPayment > 0 
      ? consumption.monthlyPayment 
      : consumption.amount
    
    // Formatear el monto con formato argentino: punto para miles, coma para decimales
    const formatAmountArgentine = (value: number): string => {
      if (!value || isNaN(value)) return ''
      const parts = value.toString().split('.')
      const integerPart = parts[0]
      const decimalPart = parts[1] || ''
      // Formatear parte entera con puntos cada 3 dígitos
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      // Si hay decimales, agregar coma
      return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger
    }
    
    const formDataToSet = {
      cardId: consumption.cardId || (consumption as any).creditCardId || selectedCard?.id || '',
      cardName: consumption.cardName || selectedCard?.name || '',
      merchant: consumption.merchant || '',
      amount: monthlyPaymentValue ? formatAmountArgentine(monthlyPaymentValue) : '',
      currency: consumptionCurrency as 'pesos' | 'usd',
      date: dateValue,
      category: categoryName,
      subcategory: '', // Ya no usamos subcategorías
      installments: consumption.installments ? consumption.installments.toString() : '1',
      description: consumption.description || ''
    }
    
    
    
    setFormData(formDataToSet)
    setShowCreateForm(false)
  }

  const handleUpdateConsumption = async () => {
    // Validar campos obligatorios con valores por defecto si están vacíos
    const cardId = formData.cardId || selectedCard?.id || ''
    const merchant = formData.merchant || ''
    const amount = formData.amount || ''
    const category = formData.category || ''
    
    // Obtener el consumo original para verificar si es de tipo "Intereses"
    const originalConsumption = consumptions.find(c => c.id === editingId)
    const isInterest = originalConsumption ? isInterestConsumption(originalConsumption) : false
    
    // También verificar si el merchant o description actuales contienen "INTERES" o si la categoría seleccionada es "Intereses"
    const merchantUpper = merchant.toUpperCase()
    const descriptionUpper = (formData.description || '').toUpperCase()
    const isCurrentInterest = merchantUpper.includes('INTERES') || 
                             merchantUpper.includes('INTERÉS') || 
                             descriptionUpper.includes('INTERES') || 
                             descriptionUpper.includes('INTERÉS') ||
                             category === 'Intereses'
    
    // Los consumos de tipo "Intereses" no requieren categoría (pero si se selecciona "Intereses", está bien)
    const requiresCategory = !isInterest && !isCurrentInterest
    
    // Si falta algún campo obligatorio, mostrar error
    if (!cardId || !merchant || !amount || (requiresCategory && !category)) {
      const missingFields = []
      if (!cardId) missingFields.push('Tarjeta')
      if (!merchant) missingFields.push('Comercio')
      if (!amount) missingFields.push('Monto')
      if (requiresCategory && !category) missingFields.push('Categoría')
      error(`Por favor completa los siguientes campos: ${missingFields.join(', ')}`)
      return
    }

    if (!editingId) return

    try {
      setLoading(true)
      const installments = parseInt(formData.installments)
      // Normalizar el monto: convertir coma a punto para parseFloat
      const amount = parseFloat(normalizeAmount(formData.amount))
      if (isNaN(amount)) {
        error('Por favor ingresa un monto válido')
        return
      }
      // El amount ya es la cuota mensual, no el total
      // Para calcular el total original: amount * installments
      const monthlyPayment = amount

      // Convertir fecha de yyyy-mm-dd a dd/mm/yyyy
      let formattedDate = formData.date
      if (formattedDate.includes('-')) {
        const [year, month, day] = formattedDate.split('-')
        formattedDate = `${day}/${month}/${year}`
      }

      // Guardar la categoría directamente como categoryId
      const categoryId = category || ''
      const subcategoryId = '' // Ya no usamos subcategorías

      // Preparar los montos según la moneda seleccionada
      const montoPesos = formData.currency === 'pesos' ? amount : 0
      const montoUSD = formData.currency === 'usd' ? amount : 0

      const response = await fetch(`/api/credit-cards/${cardId}/consumptions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: merchant,
          amount: amount,
          installments: installments,
          currentInstallment: consumptions.find(c => c.id === editingId)?.currentInstallment || 1,
          monthlyPayment: monthlyPayment,
          date: formattedDate,
          categoryId: categoryId,
          subcategoryId: subcategoryId,
          description: formData.description,
          montoPesos: montoPesos,
          montoUSD: montoUSD
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar consumo')
      }

      // Actualizar en el estado local incluyendo los montos de moneda
      setConsumptions(prev => prev.map(c => {
        if (c.id === editingId) {
          const updated = {
            ...c,
            merchant: formData.merchant,
            amount: amount,
            installments: installments,
            monthlyPayment: monthlyPayment,
            date: formattedDate,
            category: categoryId, // Guardar la categoría seleccionada
            subcategory: '',
            description: formData.description
          }
          // Agregar los montos de moneda al objeto actualizado
          ;(updated as any).montoPesos = montoPesos
          ;(updated as any).montoUSD = montoUSD
          return updated
        }
        return c
      }))

      // Recargar consumos desde el servidor para asegurar que tenemos los valores más actualizados
      await loadConsumptions()

      success('Consumo actualizado exitosamente')
      resetForm()
      setEditingId(null)
    } catch (err: any) {
      console.error('Error actualizando consumo:', err)
      error(err?.message || 'Error al actualizar consumo')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteConsumption = async (consumptionId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este consumo?')) {
      return
    }

    // TODO: Implementar endpoint DELETE
    // Por ahora solo eliminamos del estado local
    setConsumptions(prev => prev.filter(c => c.id !== consumptionId))
    success('Consumo eliminado exitosamente')
  }

  const resetForm = () => {
    setFormData({
      cardId: selectedCard?.id || '',
      cardName: selectedCard?.name || '',
      merchant: '',
      amount: '',
      currency: 'pesos',
      date: new Date().toISOString().split('T')[0],
      category: '',
      subcategory: '',
      installments: '1',
      description: ''
    })
    setEditingId(null)
  }

  const getInstallmentStatus = (consumption: CreditCardConsumption) => {
    if (consumption.installments === 1) {
      return 'Pago único'
    }
    return `${consumption.currentInstallment}/${consumption.installments} cuotas`
  }

  const getRemainingPayments = (consumption: CreditCardConsumption) => {
    if (consumption.installments === 1) {
      return 0
    }
    return consumption.installments - consumption.currentInstallment
  }

  const getTotalRemaining = (consumption: CreditCardConsumption) => {
    return consumption.monthlyPayment * getRemainingPayments(consumption)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          // Solo cerrar si el click es directamente en el contenedor (backdrop), no en el modal
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
      >
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-none"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Consumos de Tarjeta de Crédito
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCard ? `Registra consumos para ${selectedCard.name}` : 'Registra y gestiona tus consumos'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resetForm()
                    setShowCreateForm(true)
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  Nuevo Consumo
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
              /* Create Form */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Registrar Nuevo Consumo
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Comercio/Establecimiento *
                      </label>
                      <input
                        type="text"
                        value={formData.merchant}
                        onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="Ej: Amazon, Supermercado, Restaurante..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monto *
                      </label>
                      <input
                        type="text"
                        value={formData.amount}
                        onChange={(e) => handleAmountChange(e.target.value, setFormData)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="0,00"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Moneda *
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as 'pesos' | 'usd' }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer"
                      >
                        <option value="pesos">Pesos (ARS)</option>
                        <option value="usd">Dólares (USD)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha *
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Número de Cuotas
                      </label>
                      <select
                        value={formData.installments}
                        onChange={(e) => setFormData(prev => ({ ...prev, installments: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>
                            {num === 1 ? 'Pago único' : `${num} cuotas`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      // Determinar si este consumo es de tipo "Intereses" para hacer opcional la categoría
                      const merchantUpper = (formData.merchant || '').toUpperCase()
                      const descriptionUpper = (formData.description || '').toUpperCase()
                      const isInterest = merchantUpper.includes('INTERES') || 
                                        merchantUpper.includes('INTERÉS') || 
                                        descriptionUpper.includes('INTERES') || 
                                        descriptionUpper.includes('INTERÉS') ||
                                        formData.category === 'Intereses'
                      const requiresCategory = !isInterest
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Categoría {requiresCategory ? '*' : ''}
                          </label>
                          <select
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value, subcategory: '' }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer"
                          >
                            <option value="">Seleccionar categoría</option>
                            <option value="Intereses">Intereses</option>
                            <option value="Cuotas">Cuotas</option>
                            <option value="Gasto Fijo">Gasto Fijo</option>
                            <option value="Consumo del Mes">Consumo del Mes</option>
                          </select>
                          {!requiresCategory && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              La categoría no es obligatoria para intereses
                            </p>
                          )}
                        </div>
                      )
                    })()}
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
                      placeholder="Detalles adicionales del consumo..."
                    />
                  </div>

                  {/* Resumen de cuotas */}
                  {formData.amount && formData.installments && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Resumen de Cuotas
                      </h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Cuota mensual:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {formatCurrency(parseFloat(normalizeAmount(formData.amount || '0')))}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Cuotas:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {formData.installments === '1' ? 'Pago único' : `${formData.installments} cuotas`}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Pago mensual:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {formatCurrency(parseFloat(normalizeAmount(formData.amount || '0')))}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Total a pagar:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100 ml-2">
                            {formatCurrency(parseFloat(normalizeAmount(formData.amount || '0')) * parseInt(formData.installments || '1'))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={handleCreateConsumption}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {loading ? 'Registrando...' : 'Registrar Consumo'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false)
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
              /* Consumptions List */
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando consumos...</p>
                  </div>
                ) : consumptions.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No tienes consumos registrados
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Registra tu primer consumo para comenzar
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Registrar Primer Consumo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {consumptions.map((consumption, index) => (
                      <motion.div
                        key={consumption.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`bg-white dark:bg-gray-700 rounded-xl p-4 border ${
                          editingId === consumption.id 
                            ? 'border-blue-500 dark:border-blue-500 shadow-lg' 
                            : 'border-gray-200 dark:border-gray-600 hover:shadow-lg'
                        } transition-all duration-200`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-gray-900 dark:text-white">
                                {consumption.merchant}
                              </h5>
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full">
                                {consumption.cardName}
                              </span>
                            </div>
                            {editingId === consumption.id ? (
                              /* Edit Form Inline */
                              <div 
                                className="space-y-4 mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg relative"
                                style={{ zIndex: 100 }}
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Comercio *
                                    </label>
                                    <input
                                      type="text"
                                      value={formData.merchant}
                                      onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Monto *
                                    </label>
                                    <input
                                      type="text"
                                      value={formData.amount}
                                      onChange={(e) => handleAmountChange(e.target.value, setFormData)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      placeholder="0,00"
                                      inputMode="decimal"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Moneda *
                                    </label>
                                    <select
                                      value={formData.currency}
                                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as 'pesos' | 'usd' }))}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                                    >
                                      <option value="pesos">Pesos (ARS)</option>
                                      <option value="usd">Dólares (USD)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Fecha *
                                    </label>
                                    <input
                                      type="date"
                                      value={formData.date.includes('/') 
                                        ? (() => {
                                            const [day, month, year] = formData.date.split('/')
                                            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                                          })()
                                        : formData.date}
                                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                                      min="2000-01-01"
                                      max="2099-12-31"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Cuotas
                                    </label>
                                    <select
                                      value={formData.installments}
                                      onChange={(e) => setFormData(prev => ({ ...prev, installments: e.target.value }))}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                                    >
                                      {Array.from({ length: 24 }, (_, i) => i + 1).map(num => (
                                        <option key={num} value={num}>
                                          {num === 1 ? 'Pago único' : `${num} cuotas`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  {(() => {
                                    // Determinar si este consumo es de tipo "Intereses"
                                    const currentConsumption = consumptions.find(c => c.id === editingId)
                                    const isInterest = currentConsumption ? isInterestConsumption(currentConsumption) : false
                                    const merchantUpper = (formData.merchant || '').toUpperCase()
                                    const descriptionUpper = (formData.description || '').toUpperCase()
                                    const isCurrentInterest = merchantUpper.includes('INTERES') || 
                                                             merchantUpper.includes('INTERÉS') || 
                                                             descriptionUpper.includes('INTERES') || 
                                                             descriptionUpper.includes('INTERÉS')
                                    const requiresCategory = !isInterest && !isCurrentInterest
                                    
                                    return (
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                          Categoría {requiresCategory ? '*' : ''}
                                        </label>
                                        <select
                                          value={formData.category || ''}
                                          onChange={(e) => {
                                            setFormData(prev => ({ ...prev, category: e.target.value, subcategory: '' }))
                                          }}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                                        >
                                          <option value="">Seleccionar categoría</option>
                                          <option value="Intereses">Intereses</option>
                                          <option value="Cuotas">Cuotas</option>
                                          <option value="Gasto Fijo">Gasto Fijo</option>
                                          <option value="Consumo del Mes">Consumo del Mes</option>
                                        </select>
                                        {!requiresCategory && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            La categoría no es obligatoria para intereses
                                          </p>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Descripción
                                  </label>
                                  <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    rows={2}
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  <span className="flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    {consumption.category}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {consumption.date.includes('/') 
                                      ? consumption.date 
                                      : new Date(consumption.date).toLocaleDateString('es-CO')}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calculator className="w-3 h-3" />
                                    {getInstallmentStatus(consumption)}
                                  </span>
                                </div>
                                {consumption.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                    {consumption.description}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-right flex flex-col items-end gap-2 ml-4">
                            {!editingId || editingId !== consumption.id ? (
                              <>
                                <div>
                                  <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                    {formatCurrency(consumption.monthlyPayment || consumption.amount)}
                                  </div>
                                  {consumption.installments > 1 && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {formatCurrency((consumption.monthlyPayment || consumption.amount) * (consumption.installments || 1))} total ({consumption.installments} cuotas)
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditConsumption(consumption)}
                                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer"
                                    title="Editar consumo"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConsumption(consumption.id)}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar consumo"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleUpdateConsumption}
                                  disabled={loading}
                                  className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Guardar cambios"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    resetForm()
                                    setEditingId(null)
                                  }}
                                  className="p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors cursor-pointer"
                                  title="Cancelar edición"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress bar for installments */}
                        {consumption.installments > 1 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                              <span>Progreso de cuotas</span>
                              <span>{consumption.currentInstallment}/{consumption.installments}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(consumption.currentInstallment / consumption.installments) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Remaining payments info */}
                        {getRemainingPayments(consumption) > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>Pendiente: {getRemainingPayments(consumption)} cuotas</span>
                            </div>
                            <div className="font-semibold text-orange-600 dark:text-orange-400">
                              {formatCurrency(getTotalRemaining(consumption))}
                            </div>
                          </div>
                        )}
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
