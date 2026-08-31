import nodemailer from 'nodemailer';

/**
 * Obtiene la URL base de la aplicación (producción o desarrollo)
 */
export function getBaseUrl(): string {
  // Prioridad 1: URL explícita desde variable de entorno
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Prioridad 2: NEXTAUTH_URL (usado por NextAuth)
  if (process.env.NEXTAUTH_URL) {
    // Si NEXTAUTH_URL contiene localhost, usar el fallback
    if (process.env.NEXTAUTH_URL.includes('localhost') || process.env.NEXTAUTH_URL.includes('127.0.0.1')) {
      return process.env.NODE_ENV === 'production' ? 'https://findia.vercel.app' : process.env.NEXTAUTH_URL;
    }
    return process.env.NEXTAUTH_URL;
  }
  
  // Prioridad 3: Detectar entorno
  if (process.env.NODE_ENV === 'production') {
    return 'https://findia.vercel.app';
  }
  
  // Fallback para desarrollo
  return 'http://localhost:3000';
}

// Configuración del transportador de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: process.env.EMAIL_USER || 'findiaok@gmail.com',
    pass: process.env.EMAIL_PASSWORD, // App Password de Gmail
  },
  tls: {
    // No rechazar certificados no autorizados en desarrollo
    // En producción debería ser true para seguridad
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
});

// Verificar conexión cuando se importa el módulo (solo si hay configuración)
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Error en configuración de email:', error);
      console.error('   Detalles:', error.message);
      console.error('   Verifica que EMAIL_USER y EMAIL_PASSWORD estén correctos en .env.local');
    } else {
    }
  });
} else {
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envía un email
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const mailOptions = {
      from: `FindIA <${process.env.EMAIL_USER || 'findiaok@gmail.com'}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Convertir HTML a texto plano
    };

    const info = await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return false;
  }
}

/**
 * Envía email de notificación cuando se comparte un gasto
 */
export async function sendSharedExpenseNotification(
  toEmail: string,
  ownerName: string,
  expenseName: string,
  expenseAmount: number,
  ownerAmount: number,
  partnerAmount: number,
  notes?: string
): Promise<boolean> {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gasto Compartido - FindIA</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #FF3A5F 0%, #FF007A 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">FindIA</h1>
        <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">Gasto Compartido</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">¡Hola!</h2>
        <p style="color: #666; font-size: 16px;">
          <strong>${ownerName}</strong> te ha compartido un gasto para dividir.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF3A5F;">
          <h3 style="margin-top: 0; color: #333;">${expenseName}</h3>
          <div style="margin: 15px 0;">
            <p style="margin: 5px 0; color: #666;">
              <strong>Monto total:</strong> 
              <span style="color: #333; font-size: 18px;">${formatCurrency(expenseAmount)}</span>
            </p>
            <p style="margin: 5px 0; color: #666;">
              <strong>Tu parte:</strong> 
              <span style="color: #FF3A5F; font-size: 18px; font-weight: bold;">${formatCurrency(partnerAmount)}</span>
            </p>
            <p style="margin: 5px 0; color: #666;">
              <strong>Parte de ${ownerName}:</strong> 
              <span style="color: #333; font-size: 18px;">${formatCurrency(ownerAmount)}</span>
            </p>
          </div>
          ${notes ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #666; font-style: italic;">"${notes}"</p>
            </div>
          ` : ''}
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            ⏳ Este gasto está <strong>pendiente</strong> de tu aceptación. 
            Inicia sesión en FindIA para aceptarlo o rechazarlo.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${getBaseUrl()}/dashboard" 
             style="background: linear-gradient(135deg, #FF3A5F 0%, #FF007A 100%); 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 6px; 
                    display: inline-block; 
                    font-weight: bold;
                    font-size: 16px;">
            Ver en FindIA
          </a>
        </div>
        
        <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          Este email fue enviado desde FindIA. Si no esperabas recibir este mensaje, puedes ignorarlo.
        </p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: toEmail,
    subject: `💸 ${ownerName} te compartió un gasto: ${expenseName}`,
    html,
  });
}

/**
 * Envía email de notificación cuando se acepta un gasto compartido
 */
export async function sendSharedExpenseAcceptedNotification(
  toEmail: string,
  partnerName: string,
  expenseName: string,
  partnerAmount: number
): Promise<boolean> {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gasto Aceptado - FindIA</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">✅ Gasto Aceptado</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">¡Excelente noticia!</h2>
        <p style="color: #666; font-size: 16px;">
          <strong>${partnerName}</strong> ha aceptado el gasto compartido <strong>"${expenseName}"</strong>.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4ade80;">
          <p style="margin: 0; color: #666;">
            <strong>Monto que te debe:</strong> 
            <span style="color: #4ade80; font-size: 20px; font-weight: bold;">${formatCurrency(partnerAmount)}</span>
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${getBaseUrl()}/dashboard" 
             style="background: linear-gradient(135deg, #FF3A5F 0%, #FF007A 100%); 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 6px; 
                    display: inline-block; 
                    font-weight: bold;
                    font-size: 16px;">
            Ver en FindIA
          </a>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: toEmail,
    subject: `✅ ${partnerName} aceptó el gasto compartido: ${expenseName}`,
    html,
  });
}

/**
 * Envía email de notificación cuando se cancela un gasto compartido
 */
export async function sendSharedExpenseCancelledNotification(
  toEmail: string,
  ownerName: string,
  expenseName: string,
  wasAccepted: boolean
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gasto Cancelado - FindIA</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🚫 Gasto Cancelado</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">${wasAccepted ? 'Solicitud de Cancelación' : 'Notificación'}</h2>
        <p style="color: #666; font-size: 16px;">
          <strong>${ownerName}</strong> ${wasAccepted ? 'ha solicitado cancelar' : 'ha cancelado'} el gasto compartido <strong>"${expenseName}"</strong>.
        </p>
        
        <div style="background: ${wasAccepted ? '#fff3cd' : '#fff3cd'}; border: 1px solid ${wasAccepted ? '#f59e0b' : '#f59e0b'}; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: ${wasAccepted ? '#92400e' : '#92400e'}; font-size: 14px;">
            ${wasAccepted 
              ? '⚠️ El gasto había sido aceptado previamente. Debes confirmar o rechazar la cancelación. Si confirmas, el gasto será eliminado y el balance se actualizará.' 
              : 'El gasto compartido ha sido cancelado y ya no está activo.'}
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${getBaseUrl()}/dashboard" 
             style="background: linear-gradient(135deg, #FF3A5F 0%, #FF007A 100%); 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 6px; 
                    display: inline-block; 
                    font-weight: bold;
                    font-size: 16px;">
            Ver en FindIA
          </a>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: toEmail,
    subject: `🚫 ${ownerName} canceló el gasto compartido: ${expenseName}`,
    html,
  });
}

/** Escapa HTML básico — usado solo para datos que el usuario controla
 * (nombre de grupo, nombre de invitador) antes de interpolarlos en el email
 * de invitación. Los templates de arriba (legacy) no lo hacían; se agrega
 * acá porque es la única plantilla nueva de esta fase, sin tocar las
 * existentes. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Construye el asunto/HTML del email de invitación a un grupo de Gastos
 * Compartidos — separado de sendSharedGroupInvitationNotification() para
 * poder testear el contenido (escaping, ausencia de lenguaje técnico, link)
 * sin enviar ningún email real.
 */
export function buildSharedGroupInvitationEmail(
  inviterName: string,
  groupName: string,
  inviteUrl: string
): { subject: string; html: string } {
  const safeInviterName = escapeHtml(inviterName);
  const safeGroupName = escapeHtml(groupName);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitación a compartir gastos - FindIA</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #FF3A5F 0%, #FF007A 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">FindIA</h1>
        <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">Gastos Compartidos</p>
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">¡Hola!</h2>
        <p style="color: #666; font-size: 16px;">
          <strong>${safeInviterName}</strong> te invitó al grupo <strong>${safeGroupName}</strong>.
        </p>
        <p style="color: #666; font-size: 16px;">
          Podés compartir gastos, ver cuánto debe cada persona y registrar pagos desde FindIA.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}"
             style="background: linear-gradient(135deg, #FF3A5F 0%, #FF007A 100%);
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 6px;
                    display: inline-block;
                    font-weight: bold;
                    font-size: 16px;">
            Ver invitación
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          Este email fue enviado desde FindIA. Si no esperabas recibir este mensaje, podés ignorarlo.
        </p>
      </div>
    </body>
    </html>
  `;

  return {
    subject: `${inviterName} te invitó a compartir gastos en FindIA`,
    html,
  };
}

/**
 * Envía el email de invitación a un grupo de Gastos Compartidos V2. Sigue
 * exactamente la convención de las funciones sendSharedExpense*Notification
 * de arriba (mismo transporter, mismo sendEmail(), mismo Promise<boolean>).
 * `inviteUrl` ya debe venir armada por el caller (ver
 * app/api/shared-groups/[id]/invitations/handlers.ts) — esta función no
 * conoce nada de SharedGroup/SharedGroupMember/token, solo arma y manda el
 * email con los 3 datos que necesita.
 */
export async function sendSharedGroupInvitationNotification(
  toEmail: string,
  inviterName: string,
  groupName: string,
  inviteUrl: string
): Promise<boolean> {
  const { subject, html } = buildSharedGroupInvitationEmail(inviterName, groupName, inviteUrl);
  return await sendEmail({ to: toEmail, subject, html });
}

/**
 * Envía email de notificación cuando se rechaza un gasto compartido
 */
export async function sendSharedExpenseRejectedNotification(
  toEmail: string,
  partnerName: string,
  expenseName: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gasto Rechazado - FindIA</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">❌ Gasto Rechazado</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">Notificación</h2>
        <p style="color: #666; font-size: 16px;">
          <strong>${partnerName}</strong> ha rechazado el gasto compartido <strong>"${expenseName}"</strong>.
        </p>
        
        <div style="background: #fee2e2; border: 1px solid #ef4444; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 14px;">
            El gasto compartido ha sido rechazado y ya no está activo.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${getBaseUrl()}/dashboard" 
             style="background: linear-gradient(135deg, #FF3A5F 0%, #FF007A 100%); 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 6px; 
                    display: inline-block; 
                    font-weight: bold;
                    font-size: 16px;">
            Ver en FindIA
          </a>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: toEmail,
    subject: `❌ ${partnerName} rechazó el gasto compartido: ${expenseName}`,
    html,
  });
}

