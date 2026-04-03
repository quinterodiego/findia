import { useState, useCallback, useEffect } from 'react'
import type { Subcategory } from '@/types'

export function useSubcategories() {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSubcategories = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/subcategories')
      
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
        console.error('[useSubcategories] Error response:', errorData)
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!Array.isArray(data)) {
        setSubcategories([])
        return
      }
      
      setSubcategories(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      console.error('[useSubcategories] Error completo:', {
        message,
        error: err,
        stack: err instanceof Error ? err.stack : undefined
      })
      setSubcategories([]) // Asegurar que el array esté vacío en caso de error
    } finally {
      setLoading(false)
    }
  }, [])

  const createSubcategory = useCallback(
    async (categoryId: string, name: string, icon?: string) => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/subcategories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ categoryId, name, icon }),
        })

        if (!response.ok) {
          throw new Error('Error al crear subcategoría')
        }

        const newSubcategory = await response.json()
        setSubcategories((prev) => [...prev, newSubcategory])
        return newSubcategory
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        setError(message)
        console.error('Error en createSubcategory:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Cargar subcategorías automáticamente al montar el componente
  useEffect(() => {
    fetchSubcategories()
  }, [fetchSubcategories])

  return {
    subcategories,
    loading,
    error,
    fetchSubcategories,
    createSubcategory,
  }
}
