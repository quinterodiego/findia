/**
 * Script de migración para agregar nuevas subcategorías a todos los usuarios existentes
 * 
 * Ejecutar con: npm run migrate:subcategories
 */

import { config } from 'dotenv'
import { google } from 'googleapis'
import type { Subcategory } from '../types'

// Cargar variables de entorno desde .env.local o .env
config({ path: '.env.local' })
config({ path: '.env' })

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

async function migrateSubcategories() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    if (!spreadsheetId) {
      console.error('❌ GOOGLE_SHEETS_ID no configurado en las variables de entorno')
      process.exit(1)
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('❌ Credenciales de Google Service Account no configuradas')
      process.exit(1)
    }

    console.log('🚀 Iniciando migración de subcategorías...\n')

    // 1. Obtener todos los usuarios únicos de Users y también de Categories
    console.log('📊 Obteniendo usuarios...')
    const usersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A2:G',
    })
    const userRows = usersResponse.data.values || []
    const userEmailsFromUsers = userRows.map(row => row[1]).filter(Boolean)
    
    // También obtener usuarios únicos de las categorías (por si hay usuarios sin registro en Users)
    const categoriesResponseTemp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Categories!A2:H',
    })
    const categoryRowsTemp = categoriesResponseTemp.data.values || []
    const userEmailsFromCategories = categoryRowsTemp.map((row: string[]) => row[1]).filter(Boolean)
    
    // Combinar ambas listas y obtener únicos
    const uniqueUserEmails = [...new Set([...userEmailsFromUsers, ...userEmailsFromCategories])]
    
    console.log(`✅ Encontrados ${uniqueUserEmails.length} usuarios únicos`)
    console.log(`   - De Users: ${userEmailsFromUsers.length}`)
    console.log(`   - De Categories: ${userEmailsFromCategories.length}`)
    console.log(`   - Total únicos: ${uniqueUserEmails.length}\n`)

    // 2. Obtener todas las categorías (ya las obtuvimos arriba, reutilizar)
    const categoryRows = categoryRowsTemp

    // 3. Obtener todas las subcategorías existentes
    console.log('📊 Obteniendo subcategorías existentes...')
    const subcategoriesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subcategories!A2:G',
    })
    const existingSubcategoryRows = subcategoriesResponse.data.values || []
    console.log(`✅ Encontradas ${existingSubcategoryRows.length} subcategorías existentes\n`)

    let totalAdded = 0
    const results: Array<{ userId: string; added: number; skipped: number }> = []

    // 4. Para cada usuario, agregar las nuevas subcategorías faltantes
    console.log('🔄 Procesando usuarios...\n')
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
          console.log(`⏭️  Usuario ${userEmail}: Sin categorías de tipo "expense", saltando...`)
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
                newSubcategory.isDefault.toString(),
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

          console.log(`✅ Usuario ${userEmail}: Agregadas ${userAdded} subcategorías, omitidas ${userSkipped}`)
          totalAdded += userAdded
        } else {
          console.log(`⏭️  Usuario ${userEmail}: Todas las subcategorías ya existen, omitidas ${userSkipped}`)
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

    console.log(`\n✨ Migración completada: ${totalAdded} subcategorías agregadas en total\n`)
    console.log('📊 Resumen por usuario:')
    results.forEach(result => {
      if (result.added > 0) {
        console.log(`  - ${result.userId}: ${result.added} agregadas, ${result.skipped} omitidas`)
      }
    })

    console.log('\n✅ ¡Migración exitosa!')
  } catch (error) {
    console.error('❌ Error en migración:', error)
    process.exit(1)
  }
}

// Ejecutar migración
migrateSubcategories()
