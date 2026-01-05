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
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'GOOGLE_SHEETS_ID no configurado' },
        { status: 500 }
      )
    }

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

    // 4. Obtener TODAS las subcategorías (sin filtrar por userId)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subcategories!A2:G',
    })

    const rows = response.data.values || []
    const allSubcategories = rows.map((row: string[]) => ({
      id: row[0],
      userId: row[1],
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

    // 6. Agrupar subcategorías únicas por tipo de categoría (COMPLETAMENTE IGNORANDO userId)
    // Las subcategorías son completamente globales: cualquier usuario con una categoría del mismo tipo verá las mismas subcategorías
    const userCategoryTypes = new Set(userCategories.map(cat => cat.type))
    const userCategoryIds = new Set(userCategories.map(cat => cat.id))
    
    // Agrupar TODAS las subcategorías por tipo de categoría, eliminando duplicados por nombre
    // NO importa de qué usuario venga la subcategoría, solo importa el tipo de categoría
    const subcategoriesByType = new Map<string, Map<string, Subcategory>>()
    
    for (const subcat of allSubcategories) {
      const categoryType = categoryIdToType.get(subcat.categoryId)
      if (!categoryType || !userCategoryTypes.has(categoryType)) continue
      
      if (!subcategoriesByType.has(categoryType)) {
        subcategoriesByType.set(categoryType, new Map())
      }
      
      // Usar el nombre como clave para evitar duplicados dentro del mismo tipo
      // Si ya existe una subcategoría con el mismo nombre y tipo, la ignoramos (son globales)
      const typeMap = subcategoriesByType.get(categoryType)!
      if (!typeMap.has(subcat.name)) {
        typeMap.set(subcat.name, subcat)
      }
    }

    // 7. Mapear las subcategorías globales a TODAS las categorías del usuario del mismo tipo
    // Para cada subcategoría global única, crear una copia para cada categoría del usuario del mismo tipo
    const userSubcategories: Subcategory[] = []
    const processedKeys = new Set<string>() // Para evitar duplicados

    console.log('🔍 Procesando subcategorías globales (IGNORANDO userId completamente)...')
    console.log(`   - Tipos de categorías del usuario: ${Array.from(userCategoryTypes).join(', ')}`)
    console.log(`   - Subcategorías agrupadas por tipo: ${Array.from(subcategoriesByType.keys()).join(', ')}`)
    console.log(`   - Total subcategorías en la hoja: ${allSubcategories.length}`)

    for (const [categoryType, uniqueSubcats] of subcategoriesByType.entries()) {
      // Obtener todas las categorías del usuario de este tipo
      const userCategoriesOfType = userCategories.filter(cat => cat.type === categoryType)
      
      console.log(`   - Tipo "${categoryType}": ${uniqueSubcats.size} subcategorías únicas globales, ${userCategoriesOfType.length} categorías del usuario`)
      
      // Para cada subcategoría única de este tipo (sin importar de qué usuario venga)
      for (const globalSubcat of uniqueSubcats.values()) {
        // Crear una copia para cada categoría del usuario del mismo tipo
        for (const userCategory of userCategoriesOfType) {
          // Crear una clave única basada en nombre + categoryId del usuario
          const uniqueKey = `${globalSubcat.name}-${userCategory.id}`
          
          if (!processedKeys.has(uniqueKey)) {
            userSubcategories.push({
              ...globalSubcat,
              categoryId: userCategory.id, // Asociar a la categoría específica del usuario
              id: crypto.randomUUID(), // Generar un ID único para esta combinación
              // userId se mantiene del original pero NO se usa para filtrar
            })
            processedKeys.add(uniqueKey)
            console.log(`     ✓ Mapeada "${globalSubcat.name}" (originalmente de ${globalSubcat.userId}) a categoría ${userCategory.id} del usuario actual`)
          }
        }
      }
    }

    console.log(`✅ Total subcategorías mapeadas para el usuario: ${userSubcategories.length}`)

    // 8. Si el usuario no tiene subcategorías, crear las por defecto
    if (userSubcategories.length === 0) {
      console.log('Usuario sin subcategorías, creando defaults...')

      const defaultSubcategories = createDefaultSubcategories(
        'global', // Usar 'global' en lugar del email del usuario para hacer las subcategorías completamente globales
        userCategories
      )

      // Insertar subcategorías por defecto como globales
      const newRows = defaultSubcategories.map(subcat => [
        crypto.randomUUID(),
        'global', // Marcar como global
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

    return NextResponse.json(userSubcategories)
  } catch (error) {
    console.error('Error en GET /api/subcategories:', error)
    return NextResponse.json(
      { error: 'Error obteniendo subcategorías' },
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

    // Crear subcategoría global (userId se mantiene para compatibilidad con la estructura de la hoja, pero no se usa para filtrar)
    const newSubcategory: Subcategory = {
      id: crypto.randomUUID(),
      userId: 'global', // Marcar como global en lugar de asociar a un usuario específico
      categoryId,
      name,
      icon: icon || '📌',
      isDefault: false,
      createdAt: new Date().toISOString(),
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Subcategories!A2:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newSubcategory.id,
          newSubcategory.userId,
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
