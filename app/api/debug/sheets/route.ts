import { NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * Debug endpoint para probar conexión con Google Sheets directamente
 */
export async function GET() {
  try {
    // Verificar variables de entorno
    const requiredEnvs = {
      GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
    };

    // Verificar que todas las variables existan
    const missingEnvs = Object.entries(requiredEnvs)
      .filter(([_, value]) => !value)
      .map(([key, _]) => key);

    if (missingEnvs.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Variables de entorno faltantes',
        missingEnvs,
      });
    }

    // Probar configuración de autenticación
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Probar conexión a Google Sheets
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Intentar obtener información del spreadsheet
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    });

    // Verificar hojas existentes
    const sheetNames = spreadsheetInfo.data.sheets?.map(
      sheet => sheet.properties?.title
    ) || [];

    return NextResponse.json({
      success: true,
      message: 'Conexión a Google Sheets exitosa',
      spreadsheetTitle: spreadsheetInfo.data.properties?.title,
      sheetNames,
      totalSheets: sheetNames.length,
      envVariablesStatus: {
        GOOGLE_SHEETS_ID: '✅ OK',
        GOOGLE_SERVICE_ACCOUNT_EMAIL: '✅ OK',
        GOOGLE_PRIVATE_KEY: `✅ OK (length: ${process.env.GOOGLE_PRIVATE_KEY?.length})`,
      }
    });

  } catch (error) {
    console.error('Error en test de Google Sheets:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error al conectar con Google Sheets',
      details: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      envCheck: {
        GOOGLE_SHEETS_ID: !!process.env.GOOGLE_SHEETS_ID,
        GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
        privateKeyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
        privateKeyFormat: {
          hasBegin: process.env.GOOGLE_PRIVATE_KEY?.includes('-----BEGIN PRIVATE KEY-----') || false,
          hasEnd: process.env.GOOGLE_PRIVATE_KEY?.includes('-----END PRIVATE KEY-----') || false,
          hasNewlines: process.env.GOOGLE_PRIVATE_KEY?.includes('\\n') || false,
        }
      }
    }, { status: 500 });
  }
}