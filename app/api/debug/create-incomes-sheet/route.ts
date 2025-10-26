import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    // Configuración de autenticación con Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

    console.log('🔧 Creando hoja Incomes...');

    // Crear la hoja Incomes
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Incomes',
              },
            },
          },
        ],
      },
    });

    // Agregar encabezados
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Incomes!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['id', 'userId', 'name', 'amount', 'date', 'category', 'notes', 'isRecurring', 'frequency', 'createdAt']],
      },
    });

    console.log('✅ Hoja Incomes creada exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Hoja Incomes creada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error creando hoja Incomes:', error);
    return NextResponse.json({
      success: false,
      error: 'Error creando hoja',
      details: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
