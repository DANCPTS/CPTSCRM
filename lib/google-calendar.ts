import { supabase } from './supabase';

const CALENDAR_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-calendar-oauth`;

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  htmlLink?: string;
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function initiateGoogleOAuth() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '977624826081-25sfllkc20nrdobp5k578bqvq9cd78rk.apps.googleusercontent.com';
  const redirectUri = `${window.location.origin}/calendar`;
  const scope = 'https://www.googleapis.com/auth/calendar';

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  window.location.href = authUrl.toString();
}

export async function handleOAuthCallback(code: string) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${CALENDAR_FUNCTION_URL}/callback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to connect calendar');
  }

  return await response.json();
}

export async function getCalendarStatus() {
  const headers = await getAuthHeaders();

  const response = await fetch(`${CALENDAR_FUNCTION_URL}/status`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to check calendar status');
  }

  return await response.json();
}

export async function getCalendarEvents(timeMin?: string, timeMax?: string) {
  const headers = await getAuthHeaders();

  const url = new URL(`${CALENDAR_FUNCTION_URL}/events`);
  if (timeMin) url.searchParams.set('timeMin', timeMin);
  if (timeMax) url.searchParams.set('timeMax', timeMax);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch calendar events');
  }

  return await response.json();
}

export async function createCalendarEvent(event: CalendarEvent) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${CALENDAR_FUNCTION_URL}/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create calendar event');
  }

  return await response.json();
}

export async function disconnectCalendar() {
  const headers = await getAuthHeaders();

  const response = await fetch(`${CALENDAR_FUNCTION_URL}/disconnect`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to disconnect calendar');
  }

  return await response.json();
}
