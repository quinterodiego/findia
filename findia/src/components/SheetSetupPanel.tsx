import React, { useState } from 'react'
import { motion } from 'framer-motion'
import findiaSheets from '@/lib/findiaSheets'

interface SheetSetupPanelProps {
  className?: string
}

export const SheetSetupPanel: React.FC<SheetSetupPanelProps> = ({ className = '' }) => {
  const [isInitializing, setIsInitializing] = useState(false)
  const [result, setResult] = useState<{ 
    success: boolean; 
    message: string; 
    instructions?: string[] 
  } | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  const initializeStructure = async () => {
    setIsInitializing(true)
    setResult(null)
    
    try {
      const initResult = await findiaSheets.initializeSheetStructure()
      setResult(initResult)
      
      // Auto-mostrar instrucciones si hay
      if (initResult.instructions && initResult.instructions.length > 0) {
        setShowInstructions(true)
      }
    } catch (error) {
      setResult({
        success: false,
        message: `❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      })
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          🏗️ Configuración Inicial de Google Sheets
        </h3>
        <div className="text-sm text-gray-500">
          {findiaSheets.isConfigured() ? '🟢 Conectado' : '🔴 No conectado'}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Esta herramienta creará automáticamente la estructura necesaria en tu Google Sheet.
        </p>

        {/* Estructura que se creará */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="font-medium text-gray-900 mb-2">📋 Pestañas que se crearán:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-500">📊</span>
              <span><strong>users</strong> - Información de usuarios</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">💳</span>
              <span><strong>debts</strong> - Registro de deudas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-500">💰</span>
              <span><strong>payments</strong> - Historial de pagos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-500">👑</span>
              <span><strong>admin</strong> - Administradores del sistema</span>
            </div>
          </div>
        </div>

        {/* Administradores */}
        <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">👑 Administradores Configurados:</h4>
          <div className="space-y-1 text-sm text-blue-700">
            <div>• coderflixarg@gmail.com</div>
            <div>• d86webs@gmail.com</div>
          </div>
        </div>

        {/* Botón de inicialización */}
        <button
          onClick={initializeStructure}
          disabled={isInitializing || !findiaSheets.isConfigured()}
          className="
            w-full px-4 py-2 bg-blue-600 text-white rounded-md
            hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          "
        >
          {isInitializing ? (
            <span className="flex items-center justify-center gap-2">
              <motion.div
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              Verificando estructura...
            </span>
          ) : (
            '🔍 Verificar y Configurar Estructura'
          )}
        </button>

        {/* Botón de instrucciones manuales */}
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="
            w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md
            hover:bg-gray-200 transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1
          "
        >
          {showInstructions ? '📖 Ocultar Instrucciones Manuales' : '📖 Ver Instrucciones Manuales'}
        </button>

        {/* Instrucciones manuales */}
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-yellow-50 border border-yellow-200 p-4 rounded-md"
          >
            <h4 className="font-medium text-yellow-900 mb-2">📝 Configuración Manual:</h4>
            <div className="text-sm text-yellow-800 space-y-2">
              <p><strong>1. Abre tu Google Sheet</strong></p>
              <p><strong>2. Crea estas 4 pestañas:</strong></p>
              <ul className="list-disc ml-4 space-y-1">
                <li><code>users</code> - Para usuarios registrados</li>
                <li><code>debts</code> - Para las deudas</li>
                <li><code>payments</code> - Para el historial de pagos</li>
                <li><code>admin</code> - Para administradores</li>
              </ul>
              <p><strong>3. En cada pestaña, agrega los headers en la fila 1:</strong></p>
              <ul className="list-disc ml-4 space-y-1 text-xs font-mono">
                <li><strong>users:</strong> id, name, email, createdAt, lastActiveAt, preferences, role</li>
                <li><strong>debts:</strong> id, userId, name, amount, currentAmount, minimumPayment, interestRate, category, createdAt, updatedAt</li>
                <li><strong>payments:</strong> id, debtId, userId, amount, paymentDate, notes</li>
                <li><strong>admin:</strong> email, role, permissions, addedAt, addedBy</li>
              </ul>
            </div>
          </motion.div>
        )}

        {/* Resultado */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
              p-4 rounded-md text-sm border-l-4
              ${result.success 
                ? 'bg-green-50 text-green-700 border-green-400' 
                : 'bg-orange-50 text-orange-700 border-orange-400'
              }
            `}
          >
            <div className="font-medium mb-2">{result.message}</div>
            
            {/* Instrucciones paso a paso automáticas */}
            {result.instructions && result.instructions.length > 0 && (
              <div className="mt-3 p-3 bg-white border border-orange-200 rounded text-xs">
                <div className="font-medium mb-2">📋 Instrucciones paso a paso:</div>
                <div className="space-y-1 font-mono">
                  {result.instructions.map((instruction, index) => (
                    <div key={index} className={instruction.startsWith('   ') ? 'ml-4 text-gray-600' : 'font-medium'}>
                      {instruction}
                    </div>
                  ))}
                </div>
                
                {/* Botón para abrir Google Sheets */}
                <button
                  onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEETS_ID}/edit`, '_blank')}
                  className="mt-3 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                >
                  🔗 Abrir Google Sheet
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default SheetSetupPanel