import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { initializeSheets } from '@/lib/googleSheets';

/**
 * Debug endpoint para inicializar hojas de Google Sheets
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Intentar inicializar las hojas
    await initializeSheets();

    return NextResponse.json({
      success: true,
      message: 'Hojas de Google Sheets inicializadas correctamente',
      userId: session.user.id,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error al inicializar hojas:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error al inicializar hojas de Google Sheets',
      details: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}