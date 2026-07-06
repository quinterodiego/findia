import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/pushService';

export async function GET() {
  return NextResponse.json({ publicKey: getVapidPublicKey() });
}
