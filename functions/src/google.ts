import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db, PERSONAL, PROFESSIONAL, requireRole, Role } from './admin.js';

// Google Calendar for up to three accounts per user: Lazer, Polyform, personal.
// Refresh tokens are stored server-side in integrations/{uid}/googleAccounts/{account},
// which firestore.rules closes to every client.
//
// Setup (Google Cloud console, in the NEW project):
//   1. OAuth consent screen + a "Web application" OAuth client.
//   2. Authorised redirect URI = the deployed URL of googleOAuthCallback.
//   3. firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET / OAUTH_STATE_SECRET
//      and set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_REDIRECT_URI, APP_URL params.

export const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
export const OAUTH_STATE_SECRET = defineSecret('OAUTH_STATE_SECRET');
export const GOOGLE_OAUTH_CLIENT_ID = defineString('GOOGLE_OAUTH_CLIENT_ID');
export const GOOGLE_OAUTH_REDIRECT_URI = defineString('GOOGLE_OAUTH_REDIRECT_URI');
export const APP_URL = defineString('APP_URL');

const googleSecrets = [GOOGLE_OAUTH_CLIENT_SECRET, OAUTH_STATE_SECRET];

export type AccountKey = 'lazer' | 'polyform' | 'personal';
const ACCOUNTS: AccountKey[] = ['lazer', 'polyform', 'personal'];

// The Lazer calendar is used by professional features (booking 1:1s); the
// other two are personal and Super Admin only.
function rolesFor(account: AccountKey): Role[] {
  return account === 'lazer' ? PROFESSIONAL : PERSONAL;
}

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function client() {
  return new OAuth2Client({
    clientId: GOOGLE_OAUTH_CLIENT_ID.value(),
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET.value(),
    redirectUri: GOOGLE_OAUTH_REDIRECT_URI.value(),
  });
}

// scripts/deploy-backend.sh stores this placeholder when Calendar sign-in
// hasn't been set up yet.
const calendarConfigured = () => !!GOOGLE_OAUTH_CLIENT_ID.value() && GOOGLE_OAUTH_CLIENT_ID.value() !== 'not-configured';

function parseAccount(value: unknown): AccountKey {
  if (typeof value === 'string' && (ACCOUNTS as string[]).includes(value)) return value as AccountKey;
  throw new HttpsError('invalid-argument', 'account must be lazer, polyform or personal.');
}

// ---- signed OAuth state (binds the callback to the user who started it) ----
function sign(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', OAUTH_STATE_SECRET.value()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(state: string): { uid: string; account: AccountKey; exp: number } {
  const [body, mac] = state.split('.');
  const expected = crypto.createHmac('sha256', OAUTH_STATE_SECRET.value()).update(body || '').digest('base64url');
  if (!mac || mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    throw new Error('Bad state signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Date.now()) throw new Error('State expired');
  return payload;
}

const accountDoc = (uid: string, account: AccountKey) => db.doc(`integrations/${uid}/googleAccounts/${account}`);

export const googleAuthUrl = onCall({ secrets: googleSecrets }, async request => {
  const account = parseAccount(request.data?.account);
  const { uid } = await requireRole(request, rolesFor(account));
  if (!calendarConfigured()) {
    throw new HttpsError('failed-precondition', 'Google Calendar sign-in is not set up yet. Create the OAuth client and re-run scripts/deploy-backend.sh.');
  }
  const url = client().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: SCOPES,
    state: sign({ uid, account, exp: Date.now() + 10 * 60 * 1000 }),
  });
  return { url };
});

export const googleOAuthCallback = onRequest({ secrets: googleSecrets }, async (req, res) => {
  const back = (status: string) => res.redirect(`${APP_URL.value()}?google=${encodeURIComponent(status)}`);
  try {
    const { uid, account } = verify(String(req.query.state || ''));
    if (req.query.error) {
      console.warn('Google OAuth returned an error', { account, error: req.query.error });
      return back(`error:${req.query.error}`);
    }
    const oauth = client();
    const { tokens } = await oauth.getToken(String(req.query.code || ''));
    if (!tokens.refresh_token) return back('error:no_refresh_token');
    const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token!, audience: GOOGLE_OAUTH_CLIENT_ID.value() });
    const email = ticket.getPayload()?.email || '';
    await accountDoc(uid, account).set({
      refreshToken: tokens.refresh_token,
      email,
      scopes: tokens.scope || SCOPES.join(' '),
      connectedAt: FieldValue.serverTimestamp(),
    });
    return back(`connected:${account}`);
  } catch (err) {
    console.error('OAuth callback failed', err);
    return back('error:callback_failed');
  }
});

export const googleAccountsStatus = onCall(async request => {
  const { uid, role } = await requireRole(request, PROFESSIONAL);
  const snaps = await Promise.all(ACCOUNTS.map(a => accountDoc(uid, a).get()));
  return {
    configured: calendarConfigured(),
    accounts: ACCOUNTS.filter(a => rolesFor(a).includes(role)).map(a => {
      const s = snaps[ACCOUNTS.indexOf(a)];
      return { account: a, connected: s.exists, email: s.get('email') || null };
    }),
  };
});

export const googleDisconnect = onCall({ secrets: googleSecrets }, async request => {
  const account = parseAccount(request.data?.account);
  const { uid } = await requireRole(request, rolesFor(account));
  const snap = await accountDoc(uid, account).get();
  if (snap.exists) {
    await client().revokeToken(snap.get('refreshToken')).catch(() => undefined);
    await snap.ref.delete();
  }
  return { ok: true };
});

async function accessToken(uid: string, account: AccountKey): Promise<string> {
  const snap = await accountDoc(uid, account).get();
  if (!snap.exists) throw new HttpsError('failed-precondition', `Google ${account} account is not connected.`);
  const oauth = client();
  oauth.setCredentials({ refresh_token: snap.get('refreshToken') });
  const { token } = await oauth.getAccessToken();
  if (!token) throw new HttpsError('failed-precondition', `Could not refresh the ${account} Google token. Reconnect it.`);
  return token;
}

async function calendarFetch(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new HttpsError('internal', `Google Calendar ${res.status}: ${await res.text()}`);
  return res.json();
}

export const calendarCreateEvent = onCall({ secrets: googleSecrets }, async request => {
  const d = request.data || {};
  const account = parseAccount(d.account || 'lazer');
  const { uid } = await requireRole(request, rolesFor(account));
  if (!d.summary || !d.start || !d.end) throw new HttpsError('invalid-argument', 'summary, start and end are required.');
  const token = await accessToken(uid, account);
  const q = new URLSearchParams({ sendUpdates: d.attendees?.length ? 'all' : 'none', ...(d.withMeet ? { conferenceDataVersion: '1' } : {}) });
  const event = await calendarFetch(token, `/calendars/primary/events?${q}`, {
    method: 'POST',
    body: JSON.stringify({
      summary: d.summary,
      description: d.description || '',
      start: { dateTime: d.start, timeZone: d.timeZone || undefined },
      end: { dateTime: d.end, timeZone: d.timeZone || undefined },
      attendees: (d.attendees || []).filter(Boolean).map((email: string) => ({ email })),
      ...(d.withMeet ? { conferenceData: { createRequest: { requestId: crypto.randomUUID() } } } : {}),
    }),
  });
  return { eventId: event.id, htmlLink: event.htmlLink };
});

export interface CalendarEventOut {
  account: AccountKey;
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  eventType: string; // default | focusTime | outOfOffice | workingLocation | ...
  isTravel: boolean;
  htmlLink: string;
}

// Events across the caller's connected accounts. Focus time and out-of-office
// come through Google's eventType. Travel is detected from the title or from
// events Gmail creates from bookings (source / "flight"/"hotel" keywords); it
// is a heuristic and is labelled as such in the UI.
export const calendarListEvents = onCall({ secrets: googleSecrets }, async request => {
  const { uid, role } = await requireRole(request, PROFESSIONAL);
  const timeMin = String(request.data?.timeMin || new Date().toISOString());
  const timeMax = String(request.data?.timeMax || new Date(Date.now() + 14 * 864e5).toISOString());
  const wanted: AccountKey[] = (request.data?.accounts || ACCOUNTS).map(parseAccount);
  const results: { account: AccountKey; events: CalendarEventOut[]; error?: string }[] = [];

  for (const account of wanted) {
    if (!rolesFor(account).includes(role)) continue;
    const snap = await accountDoc(uid, account).get();
    if (!snap.exists) {
      results.push({ account, events: [], error: 'not connected' });
      continue;
    }
    try {
      const token = await accessToken(uid, account);
      const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
      const data = await calendarFetch(token, `/calendars/primary/events?${q}`);
      results.push({
        account,
        events: (data.items || [])
          .filter((e: any) => e.status !== 'cancelled')
          .map((e: any): CalendarEventOut => ({
            account,
            id: e.id,
            title: e.summary || '(no title)',
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            allDay: !!e.start?.date,
            eventType: e.eventType || 'default',
            isTravel: isTravelEvent(e),
            htmlLink: e.htmlLink,
          })),
      });
    } catch (err) {
      results.push({ account, events: [], error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { results };
});

export function isTravelEvent(e: { summary?: string; source?: { url?: string }; eventType?: string }) {
  const t = (e.summary || '').toLowerCase();
  return /\b(flight|fly|travel|trip|hotel|airbnb|train|✈)/.test(t) || /flight|hotel|reservation/.test(e.source?.url || '');
}
