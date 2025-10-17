import { motion } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react'

interface FeedbackMessageProps {
  type: 'loading' | 'success' | 'error' | 'info'
  title?: string
  message: string
  icon?: boolean
  className?: string
}

export const FeedbackMessage: React.FC<FeedbackMessageProps> = ({
  type,
  title,
  message,
  icon = true,
  className = ''
}) => {
  const getConfig = () => {
    switch (type) {
      case 'loading':
        return {
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
          icon: (
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )
        }
      case 'success':
        return {
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
          icon: <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
        }
      case 'error':
        return {
          bgColor: 'bg-red-50',
          textColor: 'text-red-700',
          borderColor: 'border-red-200',
          icon: <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
        }
      case 'info':
        return {
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
          icon: <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
        }
      default:
        return {
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200',
          icon: <XCircle className="h-5 w-5 text-gray-600 flex-shrink-0" />
        }
    }
  }

  const config = getConfig()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className={`p-4 rounded-lg border flex items-start space-x-3 ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
    >
      {icon && config.icon}
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold text-sm mb-1">
            {title}
          </p>
        )}
        <p className="text-sm leading-relaxed">
          {message}
        </p>
      </div>
    </motion.div>
  )
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'white' | 'gray'
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'blue',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  }

  const colorClasses = {
    blue: 'border-blue-600 border-t-transparent',
    white: 'border-white border-t-transparent',
    gray: 'border-gray-600 border-t-transparent'
  }

  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin ${className}`}
    />
  )
}

interface ButtonWithLoadingProps {
  isLoading: boolean
  loadingText?: string
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const ButtonWithLoading: React.FC<ButtonWithLoadingProps> = ({
  isLoading,
  loadingText,
  children,
  disabled,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = ''
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 focus:ring-blue-500'
      case 'secondary':
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500'
      case 'danger':
        return 'bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 focus:ring-red-500'
      default:
        return 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 focus:ring-blue-500'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'py-2 px-3 text-sm'
      case 'md':
        return 'py-3 px-4 text-base'
      case 'lg':
        return 'py-4 px-6 text-lg'
      default:
        return 'py-3 px-4 text-base'
    }
  }

  const variantClasses = getVariantClasses()
  const sizeClasses = getSizeClasses()
  const isDisabled = disabled || isLoading

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${variantClasses} ${sizeClasses} ${className}`}
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
    >
      {isLoading ? (
        <div className="flex items-center justify-center space-x-2">
          <LoadingSpinner 
            size="sm" 
            color={variant === 'secondary' ? 'gray' : 'white'} 
          />
          <span>{loadingText || 'Cargando...'}</span>
        </div>
      ) : (
        children
      )}
    </motion.button>
  )
}