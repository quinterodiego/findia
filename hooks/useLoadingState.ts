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
  const [showSkeleton, setShowSkeleton] = useState(false)

  // Determinar si estamos en carga inicial (primera vez)
  const isInitialLoading = sessionStatus === 'loading' || isInitialLoad

  // Determinar si estamos en carga de datos (después de autenticación)
  const isDataLoading = debtsLoading || incomesLoading || expensesLoading || goalsLoading

  // Determinar si debemos mostrar skeleton (datos parciales)
  const shouldShowSkeleton = !isInitialLoading && isDataLoading

  useEffect(() => {
    if (sessionStatus === 'authenticated' && !isInitialLoad) {
      setIsInitialLoad(false)
    }
  }, [sessionStatus, isInitialLoad])

  useEffect(() => {
    if (isDataLoading && !isInitialLoading) {
      setShowSkeleton(true)
    } else {
      setShowSkeleton(false)
    }
  }, [isDataLoading, isInitialLoading])

  return {
    isInitialLoading,
    isDataLoading,
    shouldShowSkeleton,
    isLoading: isInitialLoading || isDataLoading
  }
}
