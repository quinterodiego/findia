import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createDefaultCategories } from '@/lib/defaultCategories'
import { getCategoriesRepository, CategoryDuplicateError } from '@/lib/repositories/categories'

// GET: Obtener todas las categorías del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const repository = getCategoriesRepository()
    const existing = await repository.getCategoriesForUser(session.user.email)

    if (existing.length === 0) {
      const defaults = createDefaultCategories(session.user.email).map((c) => ({ ...c, isDefault: c.isDefault ?? false }))
      const categories = await repository.insertDefaultCategoriesIfEmpty(session.user.email, defaults)
      return NextResponse.json({ categories })
    }

    return NextResponse.json({ categories: existing })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Error al obtener categorías', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Crear nueva categoría personalizada
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email || !session.accessToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, color, icon, type = 'custom' } = body

    if (!name || !color || !icon) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const repository = getCategoriesRepository()
    const category = await repository.createCategory({ userId: session.user.email, name, color, icon, type })

    return NextResponse.json({ category })
  } catch (error) {
    if (error instanceof CategoryDuplicateError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 })
  }
}
