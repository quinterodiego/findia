import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDebtStats } from '@/lib/googleSheets';

/**
 * GET /api/stats
 * Obtiene estadísticas de las deudas del usuario
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
    
    const stats = await getDebtStats(session.user.id);
    
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error en GET /api/stats:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener estadísticas',
        details: error instanceof Error ? error.message : 'Error desconocido',
        env_check: {
          sheets_id: !!process.env.GOOGLE_SHEETS_ID,
          service_email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: !!process.env.GOOGLE_PRIVATE_KEY
        }
      },
      { status: 500 }
    );
  }
}
