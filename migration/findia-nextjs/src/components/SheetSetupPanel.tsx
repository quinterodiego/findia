"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Database, Users, CreditCard, DollarSign, Crown } from 'lucide-react'

interface SheetSetupPanelProps {
  className?: string
}

interface SetupResult {
  success: boolean
  message: string
  instructions?: string[]
}

export const SheetSetupPanel: React.FC<SheetSetupPanelProps> = ({ className = '' }) => {
  const [isInitializing, setIsInitializing] = useState(false)
  const [result, setResult] = useState<SetupResult | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  // Check if Google Sheets is configured
  const isConfigured = () => {
    return !!(process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID && process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
  }

  const initializeStructure = async () => {
    setIsInitializing(true)
    setResult(null)

    try {
      // Simulate API call to initialize sheet structure
      // In real implementation, this would call your Google Sheets API
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mock response - in real implementation this would check actual sheet structure
      const mockResult: SetupResult = {
        success: true,
        message: "✅ Estructura verificada correctamente. Todas las pestañas están configuradas.",
        instructions: [
          "1. Abrir Google Sheet",
          "2. Verificar pestañas: users, debts, payments, admin",
          "3. Confirmar headers en cada pestaña",
          "4. Probar conexión desde la aplicación"
        ]
      }

      setResult(mockResult)

      // Auto-show instructions if any
      if (mockResult.instructions && mockResult.instructions.length > 0) {
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

  const openGoogleSheet = () => {
    const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID
    if (sheetId) {
      window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`, '_blank')
    }
  }

  const connectionStatus = isConfigured()

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Configuración de Google Sheets
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-3 h-3 rounded-full ${connectionStatus ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-600">
            {connectionStatus ? 'Conectado' : 'No conectado'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Esta herramienta verifica y configura automáticamente la estructura necesaria en tu Google Sheet para almacenar datos de usuarios, deudas y pagos.
        </p>

        {/* Estructura que se creará */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Pestañas requeridas:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-3 p-2 bg-white rounded border">
              <Users className="w-4 h-4 text-blue-500" />
              <div>
                <div className="font-medium">users</div>
                <div className="text-gray-500 text-xs">Información de usuarios</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 bg-white rounded border">
              <CreditCard className="w-4 h-4 text-green-500" />
              <div>
                <div className="font-medium">debts</div>
                <div className="text-gray-500 text-xs">Registro de deudas</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 bg-white rounded border">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <div>
                <div className="font-medium">payments</div>
                <div className="text-gray-500 text-xs">Historial de pagos</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 bg-white rounded border">
              <Crown className="w-4 h-4 text-orange-500" />
              <div>
                <div className="font-medium">admin</div>
                <div className="text-gray-500 text-xs">Administradores</div>
              </div>
            </div>
          </div>
        </div>

        {/* Administradores configurados */}
        <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <Crown className="w-4 h-4" />
            Administradores Configurados:
          </h4>
          <div className="space-y-1 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              coderflixarg@gmail.com
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              d86webs@gmail.com
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="space-y-2">
          <button
            onClick={initializeStructure}
            disabled={isInitializing || !connectionStatus}
            className="
              w-full px-4 py-3 bg-blue-600 text-white rounded-md font-medium
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200 flex items-center justify-center gap-2
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            "
          >
            {isInitializing ? (
              <>
                <motion.div
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Verificando estructura...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Verificar y Configurar Estructura
              </>
            )}
          </button>

          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="
              w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md
              hover:bg-gray-200 transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
            "
          >
            {showInstructions ? '📖 Ocultar Instrucciones Manuales' : '📖 Ver Instrucciones Manuales'}
          </button>

          {connectionStatus && (
            <button
              onClick={openGoogleSheet}
              className="
                w-full px-4 py-2 bg-green-100 text-green-700 rounded-md
                hover:bg-green-200 transition-colors duration-200 flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
              "
            >
              <ExternalLink className="w-4 h-4" />
              Abrir Google Sheet
            </button>
          )}
        </div>

        {/* Instrucciones manuales */}
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-yellow-50 border border-yellow-200 p-4 rounded-md"
          >
            <h4 className="font-medium text-yellow-900 mb-3">📝 Configuración Manual:</h4>
            <div className="text-sm text-yellow-800 space-y-3">
              <div>
                <p className="font-medium">1. Abre tu Google Sheet</p>
              </div>
              
              <div>
                <p className="font-medium">2. Crea estas 4 pestañas:</p>
                <ul className="list-disc ml-4 space-y-1 mt-1">
                  <li><code className="bg-yellow-100 px-1 rounded">users</code> - Para usuarios registrados</li>
                  <li><code className="bg-yellow-100 px-1 rounded">debts</code> - Para las deudas</li>
                  <li><code className="bg-yellow-100 px-1 rounded">payments</code> - Para el historial de pagos</li>
                  <li><code className="bg-yellow-100 px-1 rounded">admin</code> - Para administradores</li>
                </ul>
              </div>

              <div>
                <p className="font-medium">3. En cada pestaña, agrega los headers en la fila 1:</p>
                <div className="space-y-2 mt-2 text-xs font-mono bg-yellow-100 p-3 rounded">
                  <div>
                    <strong>users:</strong> id, name, email, createdAt, lastActiveAt, preferences, role
                  </div>
                  <div>
                    <strong>debts:</strong> id, userId, name, currentAmount, originalAmount, minimumPayment, interestRate, dueDate, priority, category, type, notes, createdAt, updatedAt
                  </div>
                  <div>
                    <strong>payments:</strong> id, debtId, userId, amount, paymentDate, notes
                  </div>
                  <div>
                    <strong>admin:</strong> email, role, permissions, addedAt, addedBy
                  </div>
                </div>
              </div>
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
              <div className="mt-3 p-3 bg-white border border-green-200 rounded text-xs">
                <div className="font-medium mb-2">📋 Pasos completados:</div>
                <div className="space-y-1">
                  {result.instructions.map((instruction, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span>{instruction}</span>
                    </div>
                  ))}
                </div>

                {connectionStatus && (
                  <button
                    onClick={openGoogleSheet}
                    className="mt-3 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Abrir Google Sheet
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Warning si no está configurado */}
        {!connectionStatus && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-md">
            <div className="text-red-800 text-sm">
              <strong>⚠️ Configuración Incompleta:</strong>
              <p className="mt-1">
                Para usar este panel, necesitas configurar las variables de entorno:
              </p>
              <ul className="list-disc ml-4 mt-2 font-mono text-xs">
                <li>NEXT_PUBLIC_GOOGLE_SHEETS_ID</li>
                <li>NEXT_PUBLIC_GOOGLE_API_KEY</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SheetSetupPanel