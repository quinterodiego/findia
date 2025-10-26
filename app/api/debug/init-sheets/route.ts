import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { initializeSheets } from '@/lib/googleSheets';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    // Verificar si es admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(session.user.email)) {
      return NextResponse.json(
        { error: 'No tienes permisos para esta acción' },
        { status: 403 }
      );
    }
    
    console.log('🔧 Inicializando todas las hojas de Google Sheets...');
    await initializeSheets();
    
    return NextResponse.json({
      success: true,
      message: 'Todas las hojas inicializadas correctamente',
      adminEmail: session.user.email,
    });
  } catch (error) {
    console.error('❌ Error inicializando hojas:', error);
    return NextResponse.json({
      success: false,
      error: 'Error inicializando hojas',
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Use POST para inicializar las hojas',
    adminEmails: process.env.ADMIN_EMAILS?.split(',') || [],
  });
}