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
    callFunction<object, { accounts: GoogleAccountStatus[] }>('googleAccountsStatus', {})
      .then(r => { setAccounts(r.accounts); setError(null); })
      .catch(e => setError(e.message));
  useEffect(() => { refresh(); }, []);
  return { accounts, error, refresh };
}

export async function connectGoogle(account: GoogleAccountKey) {
  const { url } = await callFunction<object, { url: string }>('googleAuthUrl', { account });
  window.location.href = url;
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
