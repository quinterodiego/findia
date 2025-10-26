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

    console.log('🔧 Creando hoja Goals...');

    // Crear la hoja Goals
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Goals',
              },
            },
          },
        ],
      },
    });

    // Agregar encabezados
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Goals!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['id', 'userId', 'name', 'amount', 'date', 'category', 'notes', 'targetDate', 'currentAmount', 'createdAt']],
      },
    });

    console.log('✅ Hoja Goals creada exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Hoja Goals creada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error creando hoja Goals:', error);
    return NextResponse.json({
      success: false,
      error: 'Error creando hoja',
      details: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
