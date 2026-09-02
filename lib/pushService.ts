import webpush from 'web-push';
import { getPushSubscriptionsRepository } from '@/lib/repositories/pushSubscriptions';

let vapidInitialized = false;

function initWebPush() {
  if (vapidInitialized) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@findia.app';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID environment variables are not configured');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
}

export async function saveSubscription(userId: string, subscription: PushSubscriptionJSON) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Suscripción de push inválida: falta endpoint o keys');
  }
  await getPushSubscriptionsRepository().subscribe(userId, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
}

export async function removeSubscriptionByEndpoint(endpoint: string) {
  await getPushSubscriptionsRepository().unsubscribe(endpoint);
}

export async function getSubscriptions(userId: string): Promise<webpush.PushSubscription[]> {
  const records = await getPushSubscriptionsRepository().getSubscriptionsForUser(userId);
  return records.map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendNotification(userId: string, payload: NotificationPayload) {
  initWebPush();
  const subs = await getSubscriptions(userId);
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        sent++;
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await removeSubscriptionByEndpoint(sub.endpoint);
        }
        failed++;
      }
    })
  );

  return { sent, failed };
}

export const getVapidPublicKey = () => {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set');
  return key;
};
