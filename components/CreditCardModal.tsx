'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Edit2, Trash2, CreditCard, Calendar, DollarSign, AlertCircle, CheckCircle, Clock, Search, ChevronDown } from 'lucide-react'
import { useToastContext } from '@/components/Toast'
import { argentineBanks, searchBanks } from '@/lib/argentineBanks'

interface CreditCard {
  id: string
  name: string
  bank: string
  cardNumber: string
  limit: number
  currentBalance: number
  cutDate: number // Día del mes (1-31)
  paymentDate: number // Día del mes (1-31)
  interestRate: number // Tasa de interés mensual
  status: 'active' | 'blocked' | 'expired'
  createdAt: string
}

interface CreditCardModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCard?: (card: CreditCard) => void
}

export default function CreditCardModal({ 
  isOpen, 
  onClose, 
  onSelectCard 
}: CreditCardModalProps) {
  const [cards, setCards] = useState<CreditCard[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [showBankDropdown, setShowBankDropdown] = useState(false)
  const [bankSearchQuery, setBankSearchQuery] = useState('')
  const [filteredBanks, setFilteredBanks] = useState(argentineBanks)
  const { success, error } = useToastContext()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    bank: '',
    cardNumber: '',
    limit: '',
    currentBalance: '',
    cutDate: '',
    paymentDate: '',
    interestRate: '',
    status: 'active' as 'active' | 'blocked' | 'expired'
  })

  // Cargar tarjetas existentes
  useEffect(() => {
    if (isOpen) {
      loadCards()
    }
  }, [isOpen])

  // Filtrar bancos cuando cambia la búsqueda
  useEffect(() => {
    setFilteredBanks(searchBanks(bankSearchQuery))
  }, [bankSearchQuery])

  // Cerrar dropdown cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.bank-dropdown-container')) {
        setShowBankDropdown(false)
      }
    }

    if (showBankDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showBankDropdown])

  const handleBankSearch = (query: string) => {
    setBankSearchQuery(query)
  }

  const handleBankSelect = (bankName: string) => {
    setFormData(prev => ({ ...prev, bank: bankName }))
    setShowBankDropdown(false)
    setBankSearchQuery('')
  }

  const loadCards = async () => {
    try {
      setLoading(true)
      // Por ahora simulamos datos, después conectaremos con la API
      const mockCards: CreditCard[] = [
        {
          id: '1',
          name: 'Visa Platinum',
          bank: 'Bancolombia',
          cardNumber: '**** **** **** 1234',
          limit: 5000000,
          currentBalance: 1200000,
          cutDate: 15,
          paymentDate: 25,
          interestRate: 2.5,
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Mastercard Gold',
          bank: 'BBVA',
          cardNumber: '**** **** **** 5678',
          limit: 3000000,
          currentBalance: 800000,
          cutDate: 20,
          paymentDate: 30,
          interestRate: 2.8,
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ]
      setCards(mockCards)
    } catch (err) {
      error('Error al cargar tarjetas')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCard = async () => {
    if (!formData.name || !formData.bank || !formData.limit) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      setLoading(true)
      const newCard: CreditCard = {
        id: Date.now().toString(),
        name: formData.name,
        bank: formData.bank,
        cardNumber: formData.cardNumber || '**** **** **** ****',
        limit: parseFloat(formData.limit),
        currentBalance: parseFloat(formData.currentBalance) || 0,
        cutDate: parseInt(formData.cutDate) || 15,
        paymentDate: parseInt(formData.paymentDate) || 25,
        interestRate: parseFloat(formData.interestRate) || 2.5,
        status: formData.status,
        createdAt: new Date().toISOString()
      }

      setCards(prev => [...prev, newCard])
      success('Tarjeta creada exitosamente')
      resetForm()
      setShowCreateForm(false)
    } catch (err) {
      error('Error al crear tarjeta')
    } finally {
      setLoading(false)
    }
  }

  const handleEditCard = async () => {
    if (!editingCard || !formData.name || !formData.bank || !formData.limit) {
      error('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      setLoading(true)
      const updatedCard: CreditCard = {
        ...editingCard,
        name: formData.name,
        bank: formData.bank,
        cardNumber: formData.cardNumber || editingCard.cardNumber,
        limit: parseFloat(formData.limit),
        currentBalance: parseFloat(formData.currentBalance),
        cutDate: parseInt(formData.cutDate),
        paymentDate: parseInt(formData.paymentDate),
        interestRate: parseFloat(formData.interestRate),
        status: formData.status
      }

      setCards(prev => prev.map(c => c.id === editingCard.id ? updatedCard : c))
      success('Tarjeta actualizada exitosamente')
      resetForm()
      setEditingCard(null)
    } catch (err) {
      error('Error al actualizar tarjeta')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    try {
      setCards(prev => prev.filter(c => c.id !== cardId))
      success('Tarjeta eliminada exitosamente')
    } catch (err) {
      error('Error al eliminar tarjeta')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      bank: '',
      cardNumber: '',
      limit: '',
      currentBalance: '',
      cutDate: '',
      paymentDate: '',
      interestRate: '',
      status: 'active'
    })
  }

  const startEdit = (card: CreditCard) => {
    setFormData({
      name: card.name,
      bank: card.bank,
      cardNumber: card.cardNumber,
      limit: card.limit.toString(),
      currentBalance: card.currentBalance.toString(),
      cutDate: card.cutDate.toString(),
      paymentDate: card.paymentDate.toString(),
      interestRate: card.interestRate.toString(),
      status: card.status
    })
    setEditingCard(card)
    setShowCreateForm(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'blocked': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'expired': return <Clock className="w-4 h-4 text-yellow-500" />
      default: return <CheckCircle className="w-4 h-4 text-green-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activa'
      case 'blocked': return 'Bloqueada'
      case 'expired': return 'Vencida'
      default: return 'Activa'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'blocked': return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'expired': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      default: return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }
  }

  const getAvailableCredit = (card: CreditCard) => {
    return card.limit - card.currentBalance
  }

  const getUtilizationPercentage = (card: CreditCard) => {
    return (card.currentBalance / card.limit) * 100
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
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Administración de Tarjetas de Crédito
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Gestiona tus tarjetas de crédito, límites y fechas importantes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resetForm()
                    setShowCreateForm(true)
                    setEditingCard(null)
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Tarjeta
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
                    {editingCard ? 'Editar Tarjeta' : 'Nueva Tarjeta de Crédito'}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nombre de la Tarjeta *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="Ej: Visa Platinum, Mastercard Gold..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Banco *
                      </label>
                      <div className="relative bank-dropdown-container">
                        <input
                          type="text"
                          value={formData.bank}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, bank: e.target.value }))
                            handleBankSearch(e.target.value)
                            setShowBankDropdown(true)
                          }}
                          onFocus={() => setShowBankDropdown(true)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          placeholder="Buscar banco..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowBankDropdown(!showBankDropdown)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>
                        
                        {showBankDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredBanks.length > 0 ? (
                              filteredBanks.map((bank) => (
                                <button
                                  key={bank.code}
                                  type="button"
                                  onClick={() => handleBankSelect(bank.name)}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-sm"
                                >
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {bank.name}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {bank.code}
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                No se encontraron bancos
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Número de Tarjeta
                      </label>
                      <input
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="**** **** **** 1234"
                        maxLength={19}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Límite de Crédito *
                      </label>
                      <input
                        type="number"
                        value={formData.limit}
                        onChange={(e) => setFormData(prev => ({ ...prev, limit: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="5000000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Saldo Actual
                      </label>
                      <input
                        type="number"
                        value={formData.currentBalance}
                        onChange={(e) => setFormData(prev => ({ ...prev, currentBalance: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Día de Corte
                      </label>
                      <select
                        value={formData.cutDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, cutDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Día de Pago
                      </label>
                      <select
                        value={formData.paymentDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tasa de Interés (% mensual)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.interestRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, interestRate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="2.5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Estado
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="active">Activa</option>
                        <option value="blocked">Bloqueada</option>
                        <option value="expired">Vencida</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={editingCard ? handleEditCard : handleCreateCard}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      {loading ? 'Guardando...' : (editingCard ? 'Actualizar' : 'Crear Tarjeta')}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingCard(null)
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
              /* Cards List */
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando tarjetas...</p>
                  </div>
                ) : cards.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No tienes tarjetas registradas
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Registra tu primera tarjeta de crédito para comenzar
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold cursor-pointer"
                    >
                      Registrar Primera Tarjeta
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {cards.map((card, index) => (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`p-6 rounded-xl border transition-all duration-200 ${getStatusColor(card.status)}`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                              <h5 className="font-semibold text-gray-900 dark:text-white text-lg">
                                {card.name}
                              </h5>
                              {getStatusIcon(card.status)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              {card.bank} • {card.cardNumber}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {getStatusText(card.status)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-white/50 dark:bg-gray-600/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Límite</div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              ${card.limit.toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-white/50 dark:bg-gray-600/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo</div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              ${card.currentBalance.toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-white/50 dark:bg-gray-600/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Disponible</div>
                            <div className="font-semibold text-green-600 dark:text-green-400">
                              ${getAvailableCredit(card).toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-white/50 dark:bg-gray-600/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Utilización</div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {getUtilizationPercentage(card).toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3 h-3" />
                            Corte: {card.cutDate}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3 h-3" />
                            Pago: {card.paymentDate}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <DollarSign className="w-3 h-3" />
                            {card.interestRate}% mensual
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {onSelectCard && (
                            <button
                              onClick={() => onSelectCard(card)}
                              className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold cursor-pointer"
                            >
                              Seleccionar
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(card)}
                            className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCard(card.id)}
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
