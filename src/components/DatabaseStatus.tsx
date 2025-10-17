import React from 'react'
import { motion } from 'framer-motion'
import findiaSheets from '@/lib/findiaSheets'

interface DatabaseStatusProps {
  className?: string
}

export const DatabaseStatus: React.FC<DatabaseStatusProps> = ({ 
  className = '' 
}) => {
  const isConfigured = findiaSheets.isConfigured()
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm
        ${isConfigured 
          ? 'bg-green-50 text-green-700 border border-green-200' 
          : 'bg-orange-50 text-orange-700 border border-orange-200'
        }
        ${className}
      `}
    >
      {/* Indicador visual */}
      <div className={`
        w-2 h-2 rounded-full flex-shrink-0
        ${isConfigured ? 'bg-green-500' : 'bg-orange-500'}
      `}>
        {isConfigured && (
          <motion.div
            className="w-full h-full bg-green-400 rounded-full"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [1, 0.7, 1] 
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              repeatType: "reverse" 
            }}
          />
        )}
      </div>
      
      {/* Texto del estado */}
      <span className="font-medium">
        {isConfigured ? (
          <>
            <span className="hidden sm:inline">📊 Conectado a Google Sheets</span>
            <span className="sm:hidden">📊 Conectado</span>
          </>
        ) : (
          <>
            <span className="hidden sm:inline">🔧 Modo Demo (Sin persistencia)</span>
            <span className="sm:hidden">🔧 Demo</span>
          </>
        )}
      </span>
    </motion.div>
  )
}

interface DatabaseSetupBannerProps {
  onClose?: () => void
}

export const DatabaseSetupBanner: React.FC<DatabaseSetupBannerProps> = ({
  onClose
}) => {
  const isConfigured = findiaSheets.isConfigured()
  
  if (isConfigured) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-4 py-3"
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            🔧
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900">
              Estás en modo demo
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Configura Google Sheets para guardar tus datos permanentemente
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              window.open(
                'https://github.com/tu-usuario/findia/blob/main/docs/GOOGLE_SHEETS_SETUP.md',
                '_blank'
              )
            }}
            className="
              text-xs px-3 py-1 bg-blue-600 text-white rounded-md
              hover:bg-blue-700 transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            "
          >
            Ver guía
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="
                text-blue-600 hover:text-blue-800 p-1
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded
              "
              aria-label="Cerrar banner"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

interface ConnectionTestProps {
  onTest?: () => void
}

export const ConnectionTest: React.FC<ConnectionTestProps> = ({ onTest }) => {
  const [isLoading, setIsLoading] = React.useState(false)
  const [result, setResult] = React.useState<{
    success: boolean
    message: string
  } | null>(null)
  
  const testConnection = async () => {
    setIsLoading(true)
    setResult(null)
    
    try {
      const testResult = await findiaSheets.testConnection()
      setResult(testResult)
      onTest?.()
    } catch (error) {
      setResult({
        success: false,
        message: 'Error al probar la conexión: ' + (error instanceof Error ? error.message : 'Error desconocido')
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">
          Probar Conexión a Google Sheets
        </h3>
        <DatabaseStatus />
      </div>
      
      <button
        onClick={testConnection}
        disabled={isLoading}
        className="
          w-full px-4 py-2 bg-blue-600 text-white rounded-md
          hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        "
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.div
              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            Probando conexión...
          </span>
        ) : (
          'Probar Conexión'
        )}
      </button>
      
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`
            mt-3 p-3 rounded-md text-sm
            ${result.success 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
            }
          `}
        >
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0">
              {result.success ? '✅' : '❌'}
            </span>
            <span>{result.message}</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default DatabaseStatus