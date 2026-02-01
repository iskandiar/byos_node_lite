import {google} from 'googleapis';
import {TIMEZONE} from 'Config.js';

export type GoogleEvent = {
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    status?: string;
};

export function getGoogleOAuthClientFromEnv() {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    const refreshToken = process.env['GOOGLE_REFRESH_TOKEN'];

    if (!clientId) throw new Error('Missing env GOOGLE_CLIENT_ID');
    if (!clientSecret) throw new Error('Missing env GOOGLE_CLIENT_SECRET');
    if (!refreshToken) throw new Error('Missing env GOOGLE_REFRESH_TOKEN');

    const oauth2Client = new google.auth.OAuth2({
        clientId,
        clientSecret,
    });

    oauth2Client.setCredentials({
        refresh_token: refreshToken,
    });

    return oauth2Client;
}

function parseGoogleDateTime(value?: { dateTime?: string; date?: string }): Date | undefined {
    if (!value) return undefined;
    if (value.dateTime) return new Date(value.dateTime);
    if (value.date) {
        // All-day events: date is YYYY-MM-DD (no time). Treat as local start-of-day.
        const d = new Date(value.date + 'T00:00:00');
        return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
}

export async function listGoogleCalendarEvents(params: {
    calendarId: string;
    timeMin: Date;
    timeMax: Date;
    maxResults?: number;
}): Promise<GoogleEvent[]> {
    const auth = getGoogleOAuthClientFromEnv();
    const calendar = google.calendar({version: 'v3', auth});

    const res = await calendar.events.list({
        calendarId: params.calendarId,
        timeMin: params.timeMin.toISOString(),
        timeMax: params.timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: params.maxResults ?? 50,
        timeZone: TIMEZONE,
        showDeleted: false,
    });

    return (res.data.items ?? []) as GoogleEvent[];
}

export function googleEventToRange(ev: GoogleEvent): { start?: Date; end?: Date } {
    const start = parseGoogleDateTime(ev.start);
    const end = parseGoogleDateTime(ev.end);

    // If end is missing but start exists, assume 1 hour.
    if (start && !end) return {start, end: new Date(start.getTime() + 60 * 60 * 1000)};
    return {start, end};
}
