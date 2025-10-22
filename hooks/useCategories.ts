'use client'

import { useState, useCallback } from 'react'
import type { Category } from '@/types'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/categories')
      
      if (!response.ok) {
        throw new Error('Error al cargar categorías')
      }
      
      const data = await response.json()
      setCategories(data.categories || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      console.error('Error fetching categories:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const createCategory = useCallback(async (categoryData: {
    name: string
    color: string
    icon: string
    type?: 'income' | 'expense' | 'saving' | 'custom'
  }) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryData),
      })
      
      if (!response.ok) {
        throw new Error('Error al crear categoría')
      }
      
      const data = await response.json()
      setCategories(prev => [...prev, data.category])
      
      return data.category
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      console.error('Error creating category:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      
      if (!response.ok) {
        throw new Error('Error al actualizar categoría')
      }
      
      const data = await response.json()
      setCategories(prev => 
        prev.map(cat => cat.id === id ? data.category : cat)
      )
      
      return data.category
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      console.error('Error updating category:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteCategory = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Error al eliminar categoría')
      }
      
      setCategories(prev => prev.filter(cat => cat.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      console.error('Error deleting category:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  }
}
