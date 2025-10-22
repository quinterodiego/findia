import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { createDefaultSubcategories } from '@/lib/defaultSubcategories'
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

    // 3. Obtener subcategorías del usuario
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subcategories!A2:G',
    })

    const rows = response.data.values || []
    const userSubcategories = rows
      .filter((row: string[]) => row[1] === session.user.email)
      .map((row: string[]) => ({
        id: row[0],
        userId: row[1],
        categoryId: row[2],
        name: row[3],
        icon: row[4],
        isDefault: row[5] === 'true',
        createdAt: row[6],
      }))

    // 4. Si el usuario no tiene subcategorías, crear las por defecto
    if (userSubcategories.length === 0) {
      console.log('Usuario sin subcategorías, creando defaults...')

      // Primero necesitamos obtener las categorías del usuario
      const categoriesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Categories!A2:H',
      })

      const categoryRows = categoriesResponse.data.values || []
      const userCategories = categoryRows
        .filter((row: string[]) => row[1] === session.user.email)
        .map((row: string[]) => ({
          id: row[0],
          type: row[5], // Type column is at index 5 (A=0, B=1, C=2, D=3, E=4, F=5)
        }))

      if (userCategories.length === 0) {
        return NextResponse.json(
          { error: 'Usuario no tiene categorías. Crea categorías primero.' },
          { status: 400 }
        )
      }

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
