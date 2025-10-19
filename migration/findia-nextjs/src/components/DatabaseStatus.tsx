"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, AlertTriangle, Database } from 'lucide-react'

interface DatabaseStatusProps {
  className?: string
}

export const DatabaseStatus: React.FC<DatabaseStatusProps> = ({
  className = ''
}) => {
  // For Next.js, we'll check if the user has configured their Google Sheets
  // This would be connected to the actual Google Sheets API in a real implementation
  const isConfigured = true // Placeholder - would check actual configuration

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
      <div className="flex items-center">
        {isConfigured ? (
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            <CheckCircle className="w-4 h-4 text-green-500" />
          </motion.div>
        ) : (
          <AlertTriangle className="w-4 h-4 text-orange-500" />
        )}
      </div>

      {/* Texto del estado */}
      <span className="font-medium">
        {isConfigured ? (
          <>
            <Database className="w-3 h-3 inline mr-1" />
            Base de datos conectada
          </>
        ) : (
          'Configuración pendiente'
        )}
      </span>

      {/* Mensaje adicional */}
      {!isConfigured && (
        <span className="text-xs opacity-75 ml-1">
          - Configura Google Sheets
        </span>
      )}
    </motion.div>
  )
}

export default DatabaseStatus