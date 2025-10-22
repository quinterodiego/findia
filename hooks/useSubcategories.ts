import { useState, useCallback } from 'react'
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
        throw new Error('Error al cargar subcategorías')
      }

      const data = await response.json()
      setSubcategories(data)
      console.log('Subcategorías cargadas:', data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      console.error('Error en fetchSubcategories:', err)
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
        console.log('Subcategoría creada:', newSubcategory)
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

  return {
    subcategories,
    loading,
    error,
    fetchSubcategories,
    createSubcategory,
  }
}
