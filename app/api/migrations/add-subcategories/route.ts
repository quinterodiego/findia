import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
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

// Nuevas subcategorías a agregar
const NEW_SUBCATEGORIES = [
  { name: 'Farmacia', icon: '💊' },
  { name: 'Viáticos Laborales', icon: '💼' },
  { name: 'Refrigerios', icon: '☕' },
]

export async function POST(request: NextRequest) {
  try {
    // Verificar que se pase un token de seguridad (opcional pero recomendado)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.MIGRATION_TOKEN || 'migration-secret-token'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere token de migración.' },
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


    // 1. Obtener todos los usuarios únicos
    const usersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A2:G',
    })
    const userRows = usersResponse.data.values || []
    const uniqueUserEmails = [...new Set(userRows.map(row => row[1]).filter(Boolean))]
    

    // 2. Obtener todas las categorías
    const categoriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Categories!A2:H',
    })
    const categoryRows = categoriesResponse.data.values || []

    // 3. Obtener todas las subcategorías existentes
    const subcategoriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subcategories!A2:G',
    })
    const existingSubcategoryRows = subcategoriesResponse.data.values || []

    let totalAdded = 0
    const results: Array<{ userId: string; added: number; skipped: number }> = []

    // 4. Para cada usuario, agregar las nuevas subcategorías faltantes
    for (const userEmail of uniqueUserEmails) {
      try {
        // Obtener categorías de tipo "expense" del usuario
        const userExpenseCategories = categoryRows
          .filter((row: string[]) => row[1] === userEmail && row[5] === 'expense')
          .map((row: string[]) => ({
            id: row[0],
            type: row[5],
          }))

        if (userExpenseCategories.length === 0) {
          continue
        }

        // Obtener subcategorías existentes del usuario
        const userExistingSubcategories = existingSubcategoryRows
          .filter((row: string[]) => row[1] === userEmail)
          .map((row: string[]) => ({
            categoryId: row[2],
            name: row[3],
          }))

        let userAdded = 0
        let userSkipped = 0
        const newRows: string[][] = []

        // Para cada categoría de expense del usuario
        for (const category of userExpenseCategories) {
          // Para cada nueva subcategoría
          for (const newSubcat of NEW_SUBCATEGORIES) {
            // Verificar si ya existe esta subcategoría para esta categoría
            const alreadyExists = userExistingSubcategories.some(
              existing => existing.categoryId === category.id && existing.name === newSubcat.name
            )

            if (!alreadyExists) {
              // Crear nueva subcategoría
              const newSubcategory: Subcategory = {
                id: crypto.randomUUID(),
                userId: userEmail,
                categoryId: category.id,
                name: newSubcat.name,
                icon: newSubcat.icon,
                isDefault: true,
                createdAt: new Date().toISOString(),
              }

              newRows.push([
                newSubcategory.id,
                newSubcategory.userId,
                newSubcategory.categoryId,
                newSubcategory.name,
                newSubcategory.icon,
                (newSubcategory.isDefault ?? false).toString(),
                newSubcategory.createdAt,
              ])
              userAdded++
            } else {
              userSkipped++
            }
          }
        }

        // Agregar las nuevas subcategorías a Google Sheets
        if (newRows.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Subcategories!A2:G',
            valueInputOption: 'RAW',
            requestBody: {
              values: newRows,
            },
          })

          totalAdded += userAdded
        } else {
        }

        results.push({
          userId: userEmail,
          added: userAdded,
          skipped: userSkipped,
        })
      } catch (error) {
        console.error(`❌ Error procesando usuario ${userEmail}:`, error)
        results.push({
          userId: userEmail,
          added: 0,
          skipped: 0,
        })
      }
    }


    return NextResponse.json({
      success: true,
      message: `Migración completada exitosamente`,
      summary: {
        totalUsers: uniqueUserEmails.length,
        totalSubcategoriesAdded: totalAdded,
        results,
      },
    })
  } catch (error) {
    console.error('❌ Error en migración:', error)
    return NextResponse.json(
      {
        error: 'Error ejecutando migración',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

// También permitir GET para verificar el estado sin ejecutar
export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'GOOGLE_SHEETS_ID no configurado' },
        { status: 500 }
      )
    }

    // Obtener estadísticas
    const usersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A2:G',
    })
    const userRows = usersResponse.data.values || []
    const uniqueUserEmails = [...new Set(userRows.map(row => row[1]).filter(Boolean))]

    const categoriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Categories!A2:H',
    })
    const categoryRows = categoriesResponse.data.values || []

    const subcategoriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subcategories!A2:G',
    })
    const existingSubcategoryRows = subcategoriesResponse.data.values || []

    // Contar cuántos usuarios necesitan las nuevas subcategorías
    let usersNeedingMigration = 0
    let totalMissingSubcategories = 0

    for (const userEmail of uniqueUserEmails) {
      const userExpenseCategories = categoryRows
        .filter((row: string[]) => row[1] === userEmail && row[5] === 'expense')
        .map((row: string[]) => row[0])

      if (userExpenseCategories.length === 0) continue

      const userExistingSubcategories = existingSubcategoryRows
        .filter((row: string[]) => row[1] === userEmail)
        .map((row: string[]) => ({
          categoryId: row[2],
          name: row[3],
        }))

      let userMissing = 0
      for (const categoryId of userExpenseCategories) {
        for (const newSubcat of NEW_SUBCATEGORIES) {
          const exists = userExistingSubcategories.some(
            existing => existing.categoryId === categoryId && existing.name === newSubcat.name
          )
          if (!exists) {
            userMissing++
            totalMissingSubcategories++
          }
        }
      }

      if (userMissing > 0) {
        usersNeedingMigration++
      }
    }

    return NextResponse.json({
      status: 'ready',
      newSubcategories: NEW_SUBCATEGORIES,
      statistics: {
        totalUsers: uniqueUserEmails.length,
        usersNeedingMigration,
        totalMissingSubcategories,
      },
      instructions: {
        method: 'POST',
        endpoint: '/api/migrations/add-subcategories',
        auth: 'Bearer token (configurar MIGRATION_TOKEN en .env)',
      },
    })
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    return NextResponse.json(
      {
        error: 'Error obteniendo estadísticas',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
