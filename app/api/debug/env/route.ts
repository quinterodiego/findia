import { NextResponse } from 'next/server';

/**
 * Debug endpoint para verificar variables de entorno en producción
 * NOTA: Eliminar en producción final por seguridad
 */
export async function GET() {
  try {
    const envStatus = {
      GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID ? '✅ Disponible' : '❌ Faltante',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Disponible' : '❌ Faltante',
      GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ? '✅ Disponible' : '❌ Faltante',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? '✅ Disponible' : '❌ Faltante',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Disponible' : '❌ Faltante',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✅ Disponible' : '❌ Faltante',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✅ Disponible' : '❌ Faltante',
    };

    // Verificar formato de GOOGLE_PRIVATE_KEY
    const privateKeyInfo = process.env.GOOGLE_PRIVATE_KEY ? {
      hasBeginMarker: process.env.GOOGLE_PRIVATE_KEY.includes('-----BEGIN PRIVATE KEY-----'),
      hasEndMarker: process.env.GOOGLE_PRIVATE_KEY.includes('-----END PRIVATE KEY-----'),
      length: process.env.GOOGLE_PRIVATE_KEY.length,
      hasNewlines: process.env.GOOGLE_PRIVATE_KEY.includes('\\n'),
    } : null;

    return NextResponse.json({
      environment: 'production',
      envStatus,
      privateKeyInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error en debug endpoint:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}