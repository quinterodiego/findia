import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { createDefaultSubcategories, DEFAULT_SUBCATEGORIES_BY_TYPE } from '@/lib/defaultSubcategories'
import type { Subcategory } from '@/types'

// Configuración de autenticación con Service Account
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

export async function GET() {
  try {
    console.log('[GET /api/subcategories] Iniciando...')
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      console.error('[GET /api/subcategories] No autorizado - sin sesión')
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    console.log('[GET /api/subcategories] Usuario autenticado:', session.user.email)

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY

    if (!spreadsheetId) {
      console.error('[GET /api/subcategories] GOOGLE_SHEETS_ID no configurado')
      return NextResponse.json(
        { error: 'GOOGLE_SHEETS_ID no configurado' },
        { status: 500 }
      )
    }

    if (!serviceAccountEmail || !privateKey) {
      console.error('[GET /api/subcategories] Variables de Google Auth no configuradas:', {
        hasServiceAccountEmail: !!serviceAccountEmail,
        hasPrivateKey: !!privateKey
      })
      return NextResponse.json(
        { error: 'Variables de Google Auth no configuradas' },
        { status: 500 }
      )
    }

    console.log('[GET /api/subcategories] Variables de entorno OK')

    // 1. Verificar si existe la hoja "Subcategories"
    let sheetExists = false
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      })
      sheetExists = spreadsheet.data.sheets?.some(
        sheet => sheet.properties?.title === 'Subcategories'
      ) || false
    } catch (error) {
      console.error('Error verificando hoja Subcategories:', error)
    }

    // 2. Crear la hoja si no existe
    if (!sheetExists) {
      console.log('Creando hoja Subcategories...')
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Subcategories',
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 7,
                    },
                  },
                },
              },
            ],
          },
        })

        // Agregar encabezados
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Subcategories!A1:G1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['ID', 'UserId', 'CategoryId', 'Name', 'Icon', 'IsDefault', 'CreatedAt']],
          },
        })
        console.log('Hoja Subcategories creada exitosamente')
      } catch (error) {
        console.error('Error creando hoja Subcategories:', error)
        return NextResponse.json(
          { error: 'Error creando hoja de subcategorías' },
          { status: 500 }
        )
      }
    }

    // 3. Obtener todas las categorías del usuario para filtrar subcategorías
    const categoriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Categories!A2:H',
    })

    const categoryRows = categoriesResponse.data.values || []
    const userCategories = categoryRows
      .filter((row: string[]) => row[1] === session.user.email)
      .map((row: string[]) => ({
        id: row[0],
        type: row[5], // Type column is at index 5
      }))

    if (userCategories.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no tiene categorías. Crea categorías primero.' },
        { status: 400 }
      )
    }

    // 4. Obtener TODAS las subcategorías (ignorando userId - las subcategorías son globales)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subcategories!A2:G',
    })

    const rows = response.data.values || []
    // Mapear subcategorías ignorando userId (columna B) - las subcategorías son globales
    const allSubcategories = rows.map((row: string[]) => ({
      id: row[0],
      userId: row[1] || '', // Mantener por compatibilidad pero no usarlo para filtrar
      categoryId: row[2],
      name: row[3],
      icon: row[4],
      isDefault: row[5] === 'true',
      createdAt: row[6],
    }))

    // 5. Crear mapa de categoryId -> categoryType para todas las categorías
    const categoryIdToType = new Map<string, string>()
    categoryRows.forEach((row: string[]) => {
      categoryIdToType.set(row[0], row[5]) // row[0] = id, row[5] = type
    })

    // 6. Agrupar subcategorías únicas por tipo de categoría (no por categoryId específico)
    // Esto hace que las subcategorías sean globales: cualquier usuario con una categoría del mismo tipo verá las mismas subcategorías
    const userCategoryTypes = new Set(userCategories.map(cat => cat.type))
    
    // Agrupar todas las subcategorías por tipo de categoría, eliminando duplicados por nombre
    const subcategoriesByType = new Map<string, Map<string, Subcategory>>()
    
    for (const subcat of allSubcategories) {
      const categoryType = categoryIdToType.get(subcat.categoryId)
      if (!categoryType || !userCategoryTypes.has(categoryType)) continue
      
      if (!subcategoriesByType.has(categoryType)) {
        subcategoriesByType.set(categoryType, new Map())
      }
      
      // Usar el nombre como clave para evitar duplicados dentro del mismo tipo
      const typeMap = subcategoriesByType.get(categoryType)!
      if (!typeMap.has(subcat.name)) {
        typeMap.set(subcat.name, subcat)
      }
    }

    // 7. Mapear las subcategorías globales a TODAS las categorías del usuario del mismo tipo
    // Para cada subcategoría global única, crear una copia para cada categoría del usuario del mismo tipo
    const userSubcategories: Subcategory[] = []
    const processedKeys = new Set<string>() // Para evitar duplicados

    console.log('🔍 Procesando subcategorías globales (SIN filtrar por userId)...')
    console.log(`   - Total subcategorías en sistema: ${allSubcategories.length}`)
    console.log(`   - Tipos de categorías del usuario: ${Array.from(userCategoryTypes).join(', ')}`)
    console.log(`   - Subcategorías agrupadas por tipo: ${Array.from(subcategoriesByType.keys()).join(', ')}`)

    for (const [categoryType, uniqueSubcats] of subcategoriesByType.entries()) {
      // Obtener todas las categorías del usuario de este tipo
      const userCategoriesOfType = userCategories.filter(cat => cat.type === categoryType)
      
      console.log(`   - Tipo "${categoryType}": ${uniqueSubcats.size} subcategorías únicas, ${userCategoriesOfType.length} categorías del usuario`)
      console.log(`     Subcategorías únicas: ${Array.from(uniqueSubcats.keys()).join(', ')}`)
      
      // Para cada subcategoría única de este tipo
      for (const globalSubcat of uniqueSubcats.values()) {
        // Crear una copia para cada categoría del usuario del mismo tipo
        for (const userCategory of userCategoriesOfType) {
          // Crear una clave única basada en nombre + categoryId del usuario
          const uniqueKey = `${globalSubcat.name}-${userCategory.id}`
          
          if (!processedKeys.has(uniqueKey)) {
            userSubcategories.push({
              ...globalSubcat,
              categoryId: userCategory.id, // Asociar a la categoría específica del usuario
              id: `${globalSubcat.id}-${userCategory.id}`, // ID único pero determinístico
            })
            processedKeys.add(uniqueKey)
            console.log(`     ✓ Mapeada "${globalSubcat.name}" (${globalSubcat.icon}) a categoría ${userCategory.id}`)
          }
        }
      }
    }

    console.log(`✅ Total subcategorías mapeadas para el usuario: ${userSubcategories.length}`)
    console.log(`   Subcategorías por categoría:`)
    userCategories.forEach(cat => {
      const count = userSubcategories.filter(sub => sub.categoryId === cat.id).length
      console.log(`     - ${cat.id}: ${count} subcategorías`)
    })

    // 8. Si el usuario no tiene subcategorías, crear las por defecto
    if (userSubcategories.length === 0) {
      console.log('Usuario sin subcategorías, creando defaults...')

      const defaultSubcategories = createDefaultSubcategories(
        session.user.email, // Mantener por compatibilidad con la función, pero no se usará para filtrar
        userCategories
      )

      // Insertar subcategorías por defecto
      // IMPORTANTE: userId se guarda pero NO se usa para filtrar - las subcategorías son globales
      const newRows = defaultSubcategories.map(subcat => [
        crypto.randomUUID(),
        '', // userId vacío o el email del usuario que las crea (no se usa para filtrar)
        subcat.categoryId,
        subcat.name,
        subcat.icon,
        subcat.isDefault.toString(),
        new Date().toISOString(),
      ])

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Subcategories!A2:G',
        valueInputOption: 'RAW',
        requestBody: {
          values: newRows,
        },
      })

      console.log(`${newRows.length} subcategorías por defecto creadas`)

      // Retornar las subcategorías recién creadas
      const createdSubcategories: Subcategory[] = newRows.map(row => ({
        id: row[0],
        userId: row[1],
        categoryId: row[2],
        name: row[3],
        icon: row[4],
        isDefault: row[5] === 'true',
        createdAt: row[6],
      }))

      return NextResponse.json(createdSubcategories)
    }

    console.log('[GET /api/subcategories] ✅ Retornando subcategorías:', {
      total: userSubcategories.length,
      sample: userSubcategories.slice(0, 3).map(s => ({ name: s.name, categoryId: s.categoryId }))
    })
    
    return NextResponse.json(userSubcategories)
  } catch (error) {
    console.error('[GET /api/subcategories] ❌ Error completo:', {
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      error
    })
    return NextResponse.json(
      { 
        error: 'Error obteniendo subcategorías',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { categoryId, name, icon } = body

    if (!categoryId || !name) {
      return NextResponse.json(
        { error: 'CategoryId y Name son requeridos' },
        { status: 400 }
      )
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'GOOGLE_SHEETS_ID no configurado' },
        { status: 500 }
      )
    }

    const newSubcategory: Subcategory = {
      id: crypto.randomUUID(),
      userId: '', // userId vacío - las subcategorías son globales, no se filtran por usuario
      categoryId,
      name,
      icon: icon || '📌',
      isDefault: false,
      createdAt: new Date().toISOString(),
    }

    // Verificar si ya existe una subcategoría con el mismo nombre para esta categoría
    // (para evitar duplicados globales)
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subcategories!A2:G',
    })
    
    const existingRows = existingResponse.data.values || []
    const alreadyExists = existingRows.some((row: string[]) => 
      row[2] === categoryId && row[3] === name
    )
    
    if (alreadyExists) {
      return NextResponse.json(
        { error: 'Ya existe una subcategoría con este nombre para esta categoría' },
        { status: 400 }
      )
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Subcategories!A2:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newSubcategory.id,
          '', // userId vacío - las subcategorías son globales
          newSubcategory.categoryId,
          newSubcategory.name,
          newSubcategory.icon,
          newSubcategory.isDefault.toString(),
          newSubcategory.createdAt,
        ]],
      },
    })

    return NextResponse.json(newSubcategory)
  } catch (error) {
    console.error('Error en POST /api/subcategories:', error)
    return NextResponse.json(
      { error: 'Error creando subcategoría' },
      { status: 500 }
    )
  }
}
