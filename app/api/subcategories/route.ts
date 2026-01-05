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

    // 6. Filtrar subcategorías por tipo de categoría (no por categoryId específico)
    // Esto hace que las subcategorías sean globales: cualquier usuario con una categoría del mismo tipo verá las mismas subcategorías
    const userCategoryTypes = new Set(userCategories.map(cat => cat.type))
    const userCategoryIds = new Set(userCategories.map(cat => cat.id))
    
    // Obtener todas las subcategorías que corresponden a tipos de categorías del usuario
    const globalSubcategories = allSubcategories.filter(subcat => {
      const categoryType = categoryIdToType.get(subcat.categoryId)
      return categoryType && userCategoryTypes.has(categoryType)
    })

    // Mapear las subcategorías globales a las categorías del usuario
    // Para cada subcategoría global, crear una copia para cada categoría del usuario del mismo tipo
    const userSubcategories: Subcategory[] = []
    const processedSubcategories = new Set<string>() // Para evitar duplicados

    for (const globalSubcat of globalSubcategories) {
      const categoryType = categoryIdToType.get(globalSubcat.categoryId)
      if (!categoryType) continue

      // Para cada categoría del usuario del mismo tipo, crear una entrada de subcategoría
      for (const userCategory of userCategories) {
        if (userCategory.type === categoryType) {
          // Crear una clave única basada en nombre + categoryId del usuario
          const uniqueKey = `${globalSubcat.name}-${userCategory.id}`
          
          if (!processedSubcategories.has(uniqueKey)) {
            userSubcategories.push({
              ...globalSubcat,
              categoryId: userCategory.id, // Asociar a la categoría del usuario
              id: `${globalSubcat.id}-${userCategory.id}`, // ID único para esta combinación
            })
            processedSubcategories.add(uniqueKey)
          }
        }
      }
    }

    // 7. Si el usuario no tiene subcategorías, crear las por defecto
    if (userSubcategories.length === 0) {
      console.log('Usuario sin subcategorías, creando defaults...')

      const defaultSubcategories = createDefaultSubcategories(
        session.user.email,
        userCategories
      )

      // Insertar subcategorías por defecto
      const newRows = defaultSubcategories.map(subcat => [
        crypto.randomUUID(),
        subcat.userId,
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

    const newSubcategory: Subcategory = {
      id: crypto.randomUUID(),
      userId: session.user.email,
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
