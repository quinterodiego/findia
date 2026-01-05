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

    // 6. Agrupar subcategorías únicas por tipo (expense, income, saving)
    // Las subcategorías ahora son categorías principales, independientes de categoryId específico
    const userCategoryTypes = new Set(userCategories.map(cat => cat.type))
    
    // Agrupar todas las subcategorías por tipo, eliminando duplicados por nombre
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

    // 7. Devolver subcategorías únicas por tipo, sin depender de categoryId específico
    // Las subcategorías ahora son categorías principales independientes
    const userSubcategories: Subcategory[] = []

    console.log('🔍 Procesando subcategorías como categorías principales (sin depender de categoryId)...')
    console.log(`   - Total subcategorías en sistema: ${allSubcategories.length}`)
    console.log(`   - Tipos de categorías del usuario: ${Array.from(userCategoryTypes).join(', ')}`)
    console.log(`   - Subcategorías agrupadas por tipo: ${Array.from(subcategoriesByType.keys()).join(', ')}`)

    for (const [categoryType, uniqueSubcats] of subcategoriesByType.entries()) {
      console.log(`   - Tipo "${categoryType}": ${uniqueSubcats.size} subcategorías únicas`)
      console.log(`     Subcategorías únicas: ${Array.from(uniqueSubcats.keys()).join(', ')}`)
      
      // Agregar cada subcategoría única como categoría principal (sin categoryId específico)
      for (const globalSubcat of uniqueSubcats.values()) {
        userSubcategories.push({
          ...globalSubcat,
          categoryId: '', // Ya no dependemos de categoryId específico
          id: globalSubcat.id, // Usar el ID original sin sufijos
        })
        console.log(`     ✓ Agregada "${globalSubcat.name}" (${globalSubcat.icon}) como categoría principal`)
      }
    }

    console.log(`✅ Total categorías (subcategorías) para el usuario: ${userSubcategories.length}`)

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

      // Retornar las subcategorías recién creadas como categorías principales (sin categoryId específico)
      // Agrupar por tipo y deduplicar por nombre
      const createdByType = new Map<string, Map<string, Subcategory>>()
      for (const row of newRows) {
        const categoryId = row[2]
        const categoryType = categoryIdToType.get(categoryId)
        if (!categoryType) continue
        
        if (!createdByType.has(categoryType)) {
          createdByType.set(categoryType, new Map())
        }
        const typeMap = createdByType.get(categoryType)!
        if (!typeMap.has(row[3])) {
          typeMap.set(row[3], {
            id: row[0],
            userId: row[1],
            categoryId: '', // Ya no dependemos de categoryId específico
            name: row[3],
            icon: row[4],
            isDefault: row[5] === 'true',
            createdAt: row[6],
            type: categoryType, // Agregar el tipo
          } as Subcategory & { type: string })
        }
      }
      
      // Aplanar a un array único
      const createdSubcategories: Subcategory[] = []
      for (const typeMap of createdByType.values()) {
        for (const subcat of typeMap.values()) {
          createdSubcategories.push(subcat)
        }
      }

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
