/**
 * Script de migración para hacer todas las subcategorías globales
 * Actualiza el userId de todas las subcategorías existentes a 'global'
 * 
 * Ejecutar con: npm run migrate:subcategories-to-global
 */

import { config } from 'dotenv'
import { google } from 'googleapis'

// Cargar variables de entorno
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

async function migrateSubcategoriesToGlobal() {
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

    console.log('🚀 Iniciando migración de subcategorías a globales...\n')

    // 1. Obtener todas las subcategorías
    console.log('📊 Obteniendo subcategorías...')
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Subcategories!A2:G',
    })
    
    const rows = response.data.values || []
    console.log(`✅ Encontradas ${rows.length} subcategorías\n`)

    if (rows.length === 0) {
      console.log('ℹ️  No hay subcategorías para migrar')
      return
    }

    // 2. Actualizar todas las filas cambiando userId (columna B, índice 1) a 'global'
    console.log('🔄 Actualizando subcategorías a globales...\n')
    
    let updatedCount = 0
    const updates: Array<{ range: string; values: string[][] }> = []

    // Procesar en lotes de 100 para evitar límites de la API
    const batchSize = 100
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j]
        const rowNumber = i + j + 2 // +2 porque empezamos en la fila 2 (después del header)
        
        // Solo actualizar si el userId no es ya 'global'
        if (row[1] !== 'global') {
          const updatedRow = [...row]
          updatedRow[1] = 'global' // Columna B (userId)
          
          updates.push({
            range: `Subcategories!A${rowNumber}:G${rowNumber}`,
            values: [updatedRow],
          })
          updatedCount++
        }
      }
    }

    if (updates.length === 0) {
      console.log('✅ Todas las subcategorías ya están marcadas como globales')
      return
    }

    // 3. Aplicar actualizaciones en lotes
    console.log(`📝 Actualizando ${updates.length} subcategorías...\n`)
    
    // Google Sheets API permite hasta 100 actualizaciones por batchUpdate
    const updateBatchSize = 100
    for (let i = 0; i < updates.length; i += updateBatchSize) {
      const batch = updates.slice(i, i + updateBatchSize)
      
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: batch.map(update => ({
            range: update.range,
            values: update.values,
          })),
        },
      })
      
      console.log(`   ✓ Actualizado lote ${Math.floor(i / updateBatchSize) + 1} (${Math.min(i + updateBatchSize, updates.length)}/${updates.length})`)
    }

    console.log(`\n✨ Migración completada: ${updatedCount} subcategorías actualizadas a 'global'`)
    console.log('\n✅ ¡Todas las subcategorías son ahora globales!')
  } catch (error) {
    console.error('❌ Error en migración:', error)
    process.exit(1)
  }
}

// Ejecutar migración
migrateSubcategoriesToGlobal()
