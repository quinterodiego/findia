import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    googleSheetsId: process.env.GOOGLE_SHEETS_ID ? '✅ Configurado' : '❌ No configurado',
    googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Configurado' : '❌ No configurado',
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY ? '✅ Configurado' : '❌ No configurado',
    nextAuthSecret: process.env.NEXTAUTH_SECRET ? '✅ Configurado' : '❌ No configurado',
    nextAuthUrl: process.env.NEXTAUTH_URL || 'No configurado',
    adminEmails: process.env.ADMIN_EMAILS || 'No configurado',
  });
}