import type { Category } from '@/types'

export const DEFAULT_CATEGORIES = [
  {
    name: 'Ingresos',
    color: '#10b981', // green-500
    icon: '💰',
    type: 'income' as const,
    isDefault: true,
  },
  {
    name: 'Gasto Fijo',
    color: '#ef4444', // red-500
    icon: '🏠',
    type: 'expense' as const,
    isDefault: true,
  },
  {
    name: 'Gasto Variable',
    color: '#f59e0b', // amber-500
    icon: '🛒',
    type: 'expense' as const,
    isDefault: true,
  },
  {
    name: 'Ahorro',
    color: '#3b82f6', // blue-500
    icon: '🎯',
    type: 'saving' as const,
    isDefault: true,
  },
]

export function createDefaultCategories(userId: string): Omit<Category, 'id' | 'createdAt'>[] {
  return DEFAULT_CATEGORIES.map(cat => ({
    userId,
    name: cat.name,
    color: cat.color,
    icon: cat.icon,
    type: cat.type,
    isDefault: cat.isDefault,
  }))
}
