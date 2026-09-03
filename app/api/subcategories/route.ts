import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createDefaultSubcategories } from '@/lib/defaultSubcategories'
import { getCategoriesRepository, materializeSubcategoriesForUser, SubcategoryDuplicateError } from '@/lib/repositories/categories'

export async function GET() {
  try {
    // NOTA: `getServerSession()` sin `authOptions` -- así estaba en el
    // código original de Sheets, se preserva tal cual (no es parte del
    // alcance de esta migración corregir esta inconsistencia respecto de
    // `app/api/categories/route.ts`, que sí pasa `authOptions`).
    const session = await getServerSession()

    if (!session?.user?.email) {
      console.error('[GET /api/subcategories] No autorizado - sin sesión')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const repository = getCategoriesRepository()

    const userCategories = (await repository.getCategoriesForUser(session.user.email)).map((c) => ({ id: c.id, type: c.type }))

    if (userCategories.length === 0) {
      return NextResponse.json({ error: 'Usuario no tiene categorías. Crea categorías primero.' }, { status: 400 })
    }

    const [allCategories, allSubcategories] = await Promise.all([repository.getAllCategories(), repository.getAllSubcategories()])

    const userSubcategories = materializeSubcategoriesForUser(userCategories, allCategories, allSubcategories)

    if (userSubcategories.length === 0) {
      const defaults = createDefaultSubcategories(session.user.email, userCategories)
      const created = await repository.insertDefaultSubcategories(
        defaults.map((d) => ({ categoryId: d.categoryId, name: d.name, icon: d.icon, isDefault: d.isDefault ?? false }))
      )
      return NextResponse.json(created)
    }

    return NextResponse.json(userSubcategories)
  } catch (error) {
    console.error('[GET /api/subcategories] ❌ Error completo:', {
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      error,
    })
    return NextResponse.json(
      { error: 'Error obteniendo subcategorías', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { categoryId, name, icon } = body

    if (!categoryId || !name) {
      return NextResponse.json({ error: 'CategoryId y Name son requeridos' }, { status: 400 })
    }

    const repository = getCategoriesRepository()
    const newSubcategory = await repository.createSubcategory(categoryId, name, icon)

    return NextResponse.json(newSubcategory)
  } catch (error) {
    if (error instanceof SubcategoryDuplicateError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Error en POST /api/subcategories:', error)
    return NextResponse.json({ error: 'Error creando subcategoría' }, { status: 500 })
  }
}
