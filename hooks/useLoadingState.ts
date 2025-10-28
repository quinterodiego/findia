'use client'

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
  // Determinar si estamos en carga de datos
  const isDataLoading = debtsLoading || incomesLoading || expensesLoading || goalsLoading

  // Determinar si debemos mostrar skeleton (siempre que estemos cargando datos o verificando sesión)
  const shouldShowSkeleton = sessionStatus === 'loading' || isDataLoading

  return {
    isDataLoading,
    shouldShowSkeleton,
    isLoading: isDataLoading
  }
}
