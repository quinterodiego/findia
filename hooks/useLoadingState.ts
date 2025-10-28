'use client'

import { useState, useEffect } from 'react'

interface UseLoadingStateProps {
  debtsLoading: boolean
  incomesLoading: boolean
  expensesLoading: boolean
  goalsLoading: boolean
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated'
}

export function useLoadingState({
  debtsLoading,
  incomesLoading,
  expensesLoading,
  goalsLoading,
  sessionStatus
}: UseLoadingStateProps) {
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasBeenAuthenticated, setHasBeenAuthenticated] = useState(false)

  // Determinar si estamos en carga inicial (solo si nunca hemos estado autenticados)
  const isInitialLoading = sessionStatus === 'loading' && !hasBeenAuthenticated && isInitialLoad

  // Determinar si estamos en carga de datos (después de autenticación)
  const isDataLoading = debtsLoading || incomesLoading || expensesLoading || goalsLoading

  // Determinar si debemos mostrar skeleton (datos parciales o recarga)
  const shouldShowSkeleton = (sessionStatus === 'loading' && hasBeenAuthenticated) || 
                             (sessionStatus === 'authenticated' && isDataLoading)

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      setHasBeenAuthenticated(true)
      setIsInitialLoad(false)
    }
  }, [sessionStatus])

  return {
    isInitialLoading,
    isDataLoading,
    shouldShowSkeleton,
    isLoading: isInitialLoading || isDataLoading
  }
}
