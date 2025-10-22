import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';

/**
 * Debug endpoint para verificar datos RAW de Google Sheets
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Configurar autenticación
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

    // Obtener información del spreadsheet
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetNames = spreadsheetInfo.data.sheets?.map(
      sheet => sheet.properties?.title
    ) || [];

    // Leer datos RAW de cada hoja
    const rawData: Record<string, (string | number | boolean)[]> = {};

    for (const sheetName of sheetNames) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:Z`,
        });

        rawData[sheetName] = response.data.values || [];
      } catch (error) {
        rawData[sheetName] = [`Error reading ${sheetName}: ${error}`];
      }
    }

    // Obtener datos específicos de deudas
    let debtsData = [];
    try {
      const debtsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Debts!A:Z',
      });
      debtsData = debtsResponse.data.values || [];
    } catch (error) {
      debtsData = [`Error reading Debts: ${error}`];
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      userEmail: session.user.email,
      spreadsheetTitle: spreadsheetInfo.data.properties?.title,
      sheetNames,
      totalSheets: sheetNames.length,
      rawData,
      debtsSpecific: debtsData,
      dataCount: {
        totalSheets: sheetNames.length,
        debtsRows: debtsData.length,
        hasData: Object.values(rawData).some(data => data.length > 1) // Más de solo headers
      }
    });

  } catch (error) {
    console.error('Error en verificación de datos:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error al verificar datos',
      details: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}