import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveSubscription, removeSubscriptionByEndpoint } from '@/lib/pushService';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const subscription = await req.json();
  await saveSubscription(session.user.id, subscription);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { endpoint } = await req.json();
  await removeSubscriptionByEndpoint(endpoint);
  return NextResponse.json({ success: true });
}
