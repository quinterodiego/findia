import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendNotification } from '@/lib/pushService';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { title, body, url, tag } = await req.json();
  const result = await sendNotification(session.user.id, { title, body, url, tag });
  return NextResponse.json({ success: true, ...result });
}
