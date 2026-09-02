import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/email';

/**
 * GET /api/test-email
 * Endpoint de diagnóstico interno para verificar la configuración de email.
 * Antes no requería ninguna autenticación -- cualquiera en Internet podía
 * hacer que FindIA mandara un email a la dirección que quisiera. Ahora
 * requiere sesión + estar en ADMIN_EMAILS (mismo mecanismo ya usado en
 * app/api/debts/route.ts, no se introduce un sistema de roles nuevo).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'No tenés permisos para esta acción' }, { status: 403 });
    }

    // Obtener email de destino desde query params
    const searchParams = req.nextUrl.searchParams;
    const toEmail = searchParams.get('to') || 'findiaok@gmail.com';
    
    const testResult = await sendEmail({
      to: toEmail,
      subject: '🧪 Test de Email - FindIA',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Test Email - FindIA</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #FF3A5F;">✅ Test de Email Exitoso</h1>
          <p>Si recibes este email, significa que la configuración de Gmail SMTP está funcionando correctamente.</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            Este es un email de prueba enviado desde FindIA.
          </p>
        </body>
        </html>
      `,
    });
    
    if (testResult) {
      return NextResponse.json({
        success: true,
        message: 'Email de prueba enviado correctamente',
        to: toEmail,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Error al enviar email de prueba',
        to: toEmail,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error en test de email:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}

