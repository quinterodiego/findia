import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  try {
    // Verificar variables de entorno
    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    const envCheck = {
      sheetsId: sheetsId ? '✅ Configurado' : '❌ No configurado',
      serviceEmail: serviceEmail ? '✅ Configurado' : '❌ No configurado',
      privateKey: privateKey ? '✅ Configurado' : '❌ No configurado',
    };

    // Si no hay variables, retornar error
    if (!sheetsId || !serviceEmail || !privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Variables de entorno faltantes',
        envCheck,
        message: 'Configura las variables de Google Sheets en Vercel'
      });
    }

    // Intentar autenticación
    let auth;
    try {
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: serviceEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    } catch (authError) {
      return NextResponse.json({
        success: false,
        error: 'Error de autenticación',
        authError: authError instanceof Error ? authError.message : 'Error desconocido',
        envCheck,
      });
    }

    // Intentar acceder al spreadsheet
    let sheets;
    try {
      sheets = google.sheets({ version: 'v4', auth });
    } catch (sheetsError) {
      return NextResponse.json({
        success: false,
        error: 'Error creando cliente de Sheets',
        sheetsError: sheetsError instanceof Error ? sheetsError.message : 'Error desconocido',
        envCheck,
      });
    }

    // Intentar leer el spreadsheet
    let spreadsheet;
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: sheetsId,
      });
      spreadsheet = response.data;
    } catch (spreadsheetError) {
      return NextResponse.json({
        success: false,
        error: 'Error accediendo al spreadsheet',
        spreadsheetError: spreadsheetError instanceof Error ? spreadsheetError.message : 'Error desconocido',
        envCheck,
        spreadsheetId: sheetsId,
      });
    }

    // Si llegamos aquí, todo está bien
    return NextResponse.json({
      success: true,
      message: 'Google Sheets API funcionando correctamente',
      envCheck,
      spreadsheet: {
        id: spreadsheet?.spreadsheetId,
        title: spreadsheet?.properties?.title,
        sheets: spreadsheet?.sheets?.map(sheet => ({
          title: sheet.properties?.title,
          id: sheet.properties?.sheetId,
        })) || [],
      },
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error general',
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}