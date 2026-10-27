import { useEffect, useState } from 'react';
import { callFunction } from './firebaseHelpers';

// Google account connections (Lazer, Polyform, personal). Tokens live
// server-side; the client only sees status. Used by Meetings and Calendar.
export type GoogleAccountKey = 'lazer' | 'polyform' | 'personal';

export interface GoogleAccountStatus {
  account: GoogleAccountKey;
  connected: boolean;
  email: string | null;
}

export const GOOGLE_ACCOUNT_LABEL: Record<GoogleAccountKey, string> = {
  lazer: 'Lazer',
  polyform: 'Polyform',
  personal: 'Personal',
};

export function useGoogleAccounts() {
  const [accounts, setAccounts] = useState<GoogleAccountStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    callFunction<object, { accounts: GoogleAccountStatus[]; configured?: boolean }>('googleAccountsStatus', {})
      .then(r => {
        setAccounts(r.accounts);
        setError(r.configured === false ? 'Google Calendar sign-in is not set up yet. Once the OAuth client is created and the backend redeployed, the Connect buttons will work.' : null);
      })
      .catch(e => setError(e.message));
  useEffect(() => { refresh(); }, []);
  return { accounts, error, refresh };
}

// returnView: which page to reopen when Google sends the user back.
export async function connectGoogle(account: GoogleAccountKey, returnView = 'calendar') {
  const { url } = await callFunction<object, { url: string }>('googleAuthUrl', { account });
  try { sessionStorage.setItem('dhq_google_return', returnView); } catch { /* falls back to Calendar */ }
  window.location.href = url;
}

// Plain-language version of the ?google=error:<reason> the OAuth callback sends back.
export function explainGoogleError(reason: string) {
  if (reason === 'access_denied') {
    return "Google didn't grant access. Either the approval was cancelled, or (common for company accounts) a Google Workspace admin blocks unverified apps from Calendar; ask the admin to allow it under Admin console → Security → API controls.";
  }
  if (reason === 'admin_policy_enforced') return 'A Google Workspace admin policy blocks this app for that account. Ask the admin to allow it under Admin console → Security → API controls.';
  if (reason === 'no_refresh_token') return "Google didn't return lasting access. Remove DesignHQ at myaccount.google.com/permissions for that account, then connect again.";
  if (reason === 'callback_failed') return 'The server could not finish the connection, usually because the OAuth client ID/secret or redirect URI saved on the backend does not match the Google Cloud settings. Re-run scripts/deploy-backend.sh with the values from Google Cloud.';
  return `Google returned "${reason}".`;
}

export const disconnectGoogle = (account: GoogleAccountKey) => callFunction('googleDisconnect', { account });

export interface CalendarEvent {
  account: GoogleAccountKey;
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  eventType: string;
  isTravel: boolean;
  htmlLink: string;
}

export const listCalendarEvents = (timeMin: string, timeMax: string, accounts?: GoogleAccountKey[]) =>
  callFunction<object, { results: { account: GoogleAccountKey; events: CalendarEvent[]; error?: string }[] }>('calendarListEvents', { timeMin, timeMax, accounts });

export const createCalendarEvent = (input: {
  account: GoogleAccountKey;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
  attendees?: string[];
  withMeet?: boolean;
}) => callFunction<object, { eventId: string; htmlLink: string }>('calendarCreateEvent', input);
