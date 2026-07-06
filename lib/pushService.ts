import webpush from 'web-push';
import { google } from 'googleapis';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@findia.app';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET = 'PushSubscriptions';
const HEADERS = ['userId', 'endpoint', 'p256dh', 'auth', 'createdAt'];

async function ensureSheet() {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = res.data.sheets?.some((s) => s.properties?.title === SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

export async function saveSubscription(userId: string, subscription: PushSubscriptionJSON) {
  await ensureSheet();
  const { endpoint, keys } = subscription;

  // Eliminar suscripción previa del mismo endpoint antes de guardar
  await removeSubscriptionByEndpoint(endpoint!);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET}!A:E`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[userId, endpoint, keys?.p256dh, keys?.auth, new Date().toISOString()]],
    },
  });
}

export async function removeSubscriptionByEndpoint(endpoint: string) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A:E`,
    });
    const rows = res.data.values || [];
    const kept = rows.filter((row, i) => i === 0 || row[1] !== endpoint);
    await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET}!A:E` });
    if (kept.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: kept },
      });
    }
  } catch {
    // Hoja aún no existe, ignorar
  }
}

export async function getSubscriptions(userId: string): Promise<webpush.PushSubscription[]> {
  try {
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A:E`,
    });
    return (res.data.values || [])
      .slice(1)
      .filter((row) => row[0] === userId)
      .map((row) => ({ endpoint: row[1], keys: { p256dh: row[2], auth: row[3] } }));
  } catch {
    return [];
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendNotification(userId: string, payload: NotificationPayload) {
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

export const getVapidPublicKey = () => VAPID_PUBLIC_KEY;
