import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { google } from 'googleapis'
import { createDefaultCategories } from '@/lib/defaultCategories'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID

// Usar Service Account en lugar de OAuth del usuario
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

// GET: Obtener todas las categorías del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    
    // Intentar leer categorías existentes
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Categories!A2:H',
      })

      const rows = response.data.values || []
      
      // Filtrar categorías del usuario actual
      const userCategories = rows
        .filter((row: string[]) => row[1] === session.user?.email)
        .map((row: string[]) => ({
          id: row[0],
          userId: row[1],
          name: row[2],
          color: row[3],
          icon: row[4],
          type: row[5] as 'income' | 'expense' | 'saving' | 'custom',
          isDefault: row[6] === 'true',
          createdAt: row[7],
        }))


      // Si el usuario no tiene categorías, crear las por defecto
      if (userCategories.length === 0) {
        const defaultCategories = createDefaultCategories(session.user.email)
        
        // Insertar categorías por defecto
        const newRows = defaultCategories.map((cat, index) => [
          `cat_${Date.now()}_${index}`, // id
          cat.userId,
          cat.name,
          cat.color,
          cat.icon,
          cat.type,
          (cat.isDefault ?? false).toString(),
          new Date().toISOString(),
        ])
        
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Categories!A2:H',
          valueInputOption: 'RAW',
          requestBody: {
            values: newRows,
          },
        })
        
        
        // Devolver las categorías creadas
        const categories = defaultCategories.map((cat, index) => ({
          id: `cat_${Date.now()}_${index}`,
          ...cat,
          createdAt: new Date().toISOString(),
        }))
        
        return NextResponse.json({ categories })
      }

      return NextResponse.json({ categories: userCategories })
    } catch (error: unknown) {
      console.error('Error reading categories sheet:', error)
      
      // Si la hoja "Categories" no existe, crearla
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('Unable to parse range') || errorMessage.includes('not found')) {
        
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Categories',
                  },
                },
              },
            ],
          },
        })


        // Agregar headers
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Categories!A1:H1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['ID', 'UserID', 'Name', 'Color', 'Icon', 'Type', 'IsDefault', 'CreatedAt']],
          },
        })


        // Crear categorías por defecto
        const defaultCategories = createDefaultCategories(session.user.email!)
        const newRows = defaultCategories.map((cat, index) => [
          `cat_${Date.now()}_${index}`,
          cat.userId,
          cat.name,
          cat.color,
          cat.icon,
          cat.type,
          (cat.isDefault ?? false).toString(),
          new Date().toISOString(),
        ])
        
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Categories!A2:H',
          valueInputOption: 'RAW',
          requestBody: {
            values: newRows,
          },
        })


        const categories = defaultCategories.map((cat, index) => ({
          id: `cat_${Date.now()}_${index}`,
          ...cat,
          createdAt: new Date().toISOString(),
        }))
        
        return NextResponse.json({ categories })
      }
      
      throw error
    }
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
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, color, icon, type = 'custom' } = body

    if (!name || !color || !icon) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      )
    }
    
    const newCategory = {
      id: `cat_${Date.now()}`,
      userId: session.user.email,
      name,
      color,
      icon,
      type,
      isDefault: false,
      createdAt: new Date().toISOString(),
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Categories!A2:H',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newCategory.id,
          newCategory.userId,
          newCategory.name,
          newCategory.color,
          newCategory.icon,
          newCategory.type,
          (newCategory.isDefault ?? false).toString(),
          newCategory.createdAt,
        ]],
      },
    })

    return NextResponse.json({ category: newCategory })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Error al crear categoría' },
      { status: 500 }
    )
  }
}