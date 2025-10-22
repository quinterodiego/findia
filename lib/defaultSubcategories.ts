import type { Subcategory } from '@/types'

// Subcategorías organizadas por tipo de categoría
export const DEFAULT_SUBCATEGORIES_BY_TYPE = {
  income: [
    { name: 'Salario', icon: '💼' },
    { name: 'Inversiones', icon: '📊' },
    { name: 'Bonos', icon: '🎁' },
    { name: 'Freelance', icon: '💻' },
    { name: 'Negocios', icon: '🏪' },
  ],
  expense: [ // Para Gasto Fijo y Gasto Variable
    { name: 'Alquiler/Hipoteca', icon: '🏠' },
    { name: 'Servicios', icon: '⚡' },
    { name: 'Telefonía/Internet', icon: '📱' },
    { name: 'Transporte', icon: '🚗' },
    { name: 'Seguro Médico', icon: '🏥' },
    { name: 'Educación', icon: '🎓' },
    { name: 'Cuotas Fijas', icon: '💳' },
    { name: 'Alimentación', icon: '🍔' },
    { name: 'Ropa', icon: '👔' },
    { name: 'Entretenimiento', icon: '🎮' },
    { name: 'Viajes', icon: '✈️' },
    { name: 'Compras', icon: '🛍️' },
    { name: 'Reparaciones', icon: '🔧' },
    { name: 'Eventos', icon: '🎉' },
  ],
  saving: [
    { name: 'Fondo de Emergencia', icon: '🏦' },
    { name: 'Vivienda', icon: '🏡' },
    { name: 'Vehículo', icon: '🚗' },
    { name: 'Educación', icon: '📚' },
    { name: 'Vacaciones', icon: '✈️' },
    { name: 'Proyectos Especiales', icon: '💍' },
  ],
}

export function createDefaultSubcategories(
  userId: string,
  categories: { id: string; type: string }[]
): Omit<Subcategory, 'id' | 'createdAt'>[] {
  const subcategories: Omit<Subcategory, 'id' | 'createdAt'>[] = []

  categories.forEach(category => {
    const categoryType = category.type as 'income' | 'expense' | 'saving'
    const subcatsForType = DEFAULT_SUBCATEGORIES_BY_TYPE[categoryType] || []

    subcatsForType.forEach(subcat => {
      subcategories.push({
        userId,
        categoryId: category.id,
        name: subcat.name,
        icon: subcat.icon,
        isDefault: true,
      })
    })
  })

  return subcategories
}
