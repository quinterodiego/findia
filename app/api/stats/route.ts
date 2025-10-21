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
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
