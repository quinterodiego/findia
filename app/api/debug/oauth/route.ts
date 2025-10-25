import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    baseUrl,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    googleClientId: process.env.GOOGLE_CLIENT_ID ? '✅ Configurado' : '❌ No configurado',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '✅ Configurado' : '❌ No configurado',
    nextAuthSecret: process.env.NEXTAUTH_SECRET ? '✅ Configurado' : '❌ No configurado',
    expectedCallbackUrl: `${baseUrl}/api/auth/callback/google`,
    headers: {
      host: req.headers.get('host'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
    }
  });
}
