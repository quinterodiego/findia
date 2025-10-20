"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react'

interface TourStep {
  id: string
  title: string
  description: string
  target: string // CSS selector
  position: 'top' | 'bottom' | 'left' | 'right'
  highlight?: boolean
}

const newUserTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a FindIA! 👋',
    description: 'Te ayudaremos a rastrear y eliminar tus deudas de manera inteligente. ¡Empecemos con un tour rápido!',
    target: 'body',
    position: 'top'
  },
  {
    id: 'stats',
    title: 'Panel de Estadísticas 📊',
    description: 'Aquí verás un resumen de todas tus deudas: total adeudado, cuánto has pagado, tus pagos mensuales y tu progreso general.',
    target: '[data-tour="stats"]',
    position: 'bottom',
    highlight: true
  },
  {
    id: 'progress',
    title: 'Barra de Progreso 📈',
    description: 'Esta barra muestra visualmente qué tan cerca estás de ser libre de deudas. ¡Cada pago la hará crecer!',
    target: '[data-tour="progress"]',
    position: 'bottom',
    highlight: true
  },
  {
    id: 'add-debt',
    title: 'Agregar Deudas 💳',
    description: 'Haz clic aquí para registrar una nueva deuda. Ingresa el monto, interés y pago mínimo mensual.',
    target: '[data-tour="add-debt"]',
    position: 'left',
    highlight: true
  },
  {
    id: 'debt-list',
    title: 'Lista de Deudas 📋',
    description: 'Aquí aparecerán todas tus deudas organizadas. Podrás ver el progreso de cada una y registrar pagos.',
    target: '[data-tour="debt-list"]',
    position: 'top',
    highlight: true
  },
  {
    id: 'theme-toggle',
    title: 'Personalización 🌙',
    description: 'Cambia entre tema claro y oscuro según tu preferencia. ¡Perfecto para usar de noche!',
    target: '[data-tour="theme-toggle"]',
    position: 'bottom',
    highlight: true
  },
  {
    id: 'complete',
    title: '¡Listo para empezar! 🎉',
    description: '¡Ya conoces lo básico! Ahora agrega tu primera deuda para comenzar tu camino hacia la libertad financiera.',
    target: 'body',
    position: 'top'
  }
]

const existingUserTourSteps: TourStep[] = [
  {
    id: 'welcome-back',
    title: '¡Tour de FindIA! 👋',
    description: 'Te mostramos las características principales de la aplicación para sacarle el máximo provecho.',
    target: 'body',
    position: 'top'
  },
  {
    id: 'stats',
    title: 'Resumen Financiero 📊',
    description: 'Estas cards muestran el estado actual de tus finanzas: deudas totales, dinero ya pagado, pagos mensuales y progreso.',
    target: '[data-tour="stats"]',
    position: 'bottom',
    highlight: true
  },
  {
    id: 'progress',
    title: 'Tu Progreso 📈',
    description: 'Esta barra visual te motiva mostrando qué tan cerca estás de eliminar todas tus deudas. ¡Sigue así!',
    target: '[data-tour="progress"]',
    position: 'bottom',
    highlight: true
  },
  {
    id: 'debt-list',
    title: 'Gestión de Deudas 📋',
    description: 'Aquí gestionas todas tus deudas. Puedes ver el progreso individual y registrar nuevos pagos para cada una.',
    target: '[data-tour="debt-list"]',
    position: 'top',
    highlight: true
  },
  {
    id: 'add-debt',
    title: 'Agregar Más Deudas 💳',
    description: 'Si tienes más deudas que agregar, usa este botón. Mientras más completo sea tu registro, mejor será tu control.',
    target: '[data-tour="add-debt"]',
    position: 'left',
    highlight: true
  },
  {
    id: 'theme-toggle',
    title: 'Personalización 🌙',
    description: 'Personaliza tu experiencia cambiando entre modo claro y oscuro según tu preferencia.',
    target: '[data-tour="theme-toggle"]',
    position: 'bottom',
    highlight: true
  },
  {
    id: 'complete',
    title: '¡Excelente! 🎉',
    description: '¡Ya dominas FindIA! Recuerda: la consistencia es clave. Registra tus pagos regularmente y celebra cada progreso.',
    target: 'body',
    position: 'top'
  }
]

interface TourGuideProps {
  isVisible: boolean
  onComplete: () => void
  onSkip: () => void
  hasDebts?: boolean
}

export default function TourGuide({ isVisible, onComplete, onSkip, hasDebts = false }: TourGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetPosition, setTargetPosition] = useState<{x: number, y: number, width: number, height: number} | null>(null)

  // Seleccionar el tour apropiado según si el usuario tiene deudas
  const tourSteps = hasDebts ? existingUserTourSteps : newUserTourSteps

  useEffect(() => {
    if (!isVisible) return

    const updateTargetPosition = () => {
      const step = tourSteps[currentStep]
      const target = document.querySelector(step.target)
      
      if (target && step.target !== 'body') {
        const rect = target.getBoundingClientRect()
        setTargetPosition({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        })
      } else {
        setTargetPosition(null)
      }
    }

    updateTargetPosition()
    window.addEventListener('resize', updateTargetPosition)
    return () => window.removeEventListener('resize', updateTargetPosition)
  }, [currentStep, isVisible, tourSteps])

  const currentStepData = tourSteps[currentStep]
  const isLastStep = currentStep === tourSteps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(0, prev - 1))
  }

  const getTooltipPosition = () => {
    if (!targetPosition) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const { x, y, width, height } = targetPosition
    const tooltipOffset = 20

    switch (currentStepData.position) {
      case 'top':
        return { top: y - tooltipOffset, left: x + width / 2, transform: 'translate(-50%, -100%)' }
      case 'bottom':
        return { top: y + height + tooltipOffset, left: x + width / 2, transform: 'translate(-50%, 0%)' }
      case 'left':
        return { top: y + height / 2, left: x - tooltipOffset, transform: 'translate(-100%, -50%)' }
      case 'right':
        return { top: y + height / 2, left: x + width + tooltipOffset, transform: 'translate(0%, -50%)' }
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50">
        {/* Overlay con highlight */}
        <div className="absolute inset-0 bg-black/50">
          {targetPosition && currentStepData.highlight && (
            <div
              className="absolute bg-transparent border-4 border-blue-500 rounded-lg shadow-2xl"
              style={{
                left: targetPosition.x - 8,
                top: targetPosition.y - 8,
                width: targetPosition.width + 16,
                height: targetPosition.height + 16,
                boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.5)',
                clipPath: 'polygon(0% 0%, 0% 100%, 40px 100%, 40px 40px, calc(100% - 40px) 40px, calc(100% - 40px) 100%, 100% 100%, 100% 0%)'
              }}
            />
          )}
        </div>

        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm border border-gray-200 dark:border-gray-700"
          style={getTooltipPosition()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {currentStepData.title}
            </h3>
            <button
              onClick={onSkip}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Descripción */}
          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            {currentStepData.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center space-x-2 mb-6">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-blue-500'
                    : index < currentStep
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Botones */}
          <div className="flex justify-between items-center">
            <div>
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Anterior
                </button>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={onSkip}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white cursor-pointer"
              >
                Saltar tour
              </button>
              <button
                onClick={handleNext}
                className="flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 cursor-pointer"
              >
                {isLastStep ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    ¡Empezar!
                  </>
                ) : (
                  <>
                    Siguiente
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}