type ParsedEvent = { id?: string; summary?: string; start?: string; end?: string };

/**
 * Fetch and parse Google Calendar events and return an array of columns (one per calendar).
 */
import {googleEventToRange, listGoogleCalendarEvents} from './GoogleCalendarData.js';

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDayInclusive(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

export async function fetchCalendarColumns(calendarIds: string[], _targetDate?: Date): Promise<ParsedEvent[][]> {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const rangeStart = startOfDay(now);
    const rangeEnd = endOfDayInclusive(threeDaysLater);

    function hasOOOKeyword(text?: string): boolean {
        if (!text) return false;
        const t = String(text).toLowerCase();
        return t.includes('out of office')
            || /\booo\b/.test(t)
            || /\boof\b/.test(t)
            || t.includes('vacation')
            || t.includes('pto')
            || t.includes('out-of-office');
    }

    function hasAsyncKeyword(text?: string): boolean {
        if (!text) return false;
        return String(text).toLowerCase().includes('async');
    }

    const results: ParsedEvent[][] = [];
    for (const calendarId of calendarIds) {
        try {
            const items = await listGoogleCalendarEvents({
                calendarId,
                timeMin: rangeStart,
                timeMax: rangeEnd,
                maxResults: 50,
            });
            console.log('[GCAL] raw items', calendarId, items.length, items.map(ev => ({
                id: ev.id,
                summary: ev.summary,
                start: ev.start?.dateTime ?? ev.start?.date,
                end: ev.end?.dateTime ?? ev.end?.date,
                status: ev.status,
            })));

            const parsed: ParsedEvent[] = [];
            for (const ev of items) {
                const status = (ev.status || '').toString().toLowerCase();
                if (status === 'cancelled') continue;

                if (hasOOOKeyword(ev.summary) || hasOOOKeyword(ev.description) || hasOOOKeyword(ev.location)) continue;
                if (hasAsyncKeyword(ev.summary) || hasAsyncKeyword(ev.description) || hasAsyncKeyword(ev.location)) continue;

                const {start, end} = googleEventToRange(ev);
                if (!start) continue;
                const overlapsWindow = (end ?? start) >= rangeStart && start <= rangeEnd;
                if (!overlapsWindow) continue;

                parsed.push({
                    id: ev.id,
                    summary: ev.summary && String(ev.summary).trim() ? String(ev.summary) : '(no title)',
                    start: start.toISOString(),
                    end: end ? end.toISOString() : undefined,
                });
            }

            parsed.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
            results.push(parsed.slice(0, 6));
        } catch (err: any) {
            console.error('Error fetching Google Calendar', calendarId, err?.message || err);
            results.push([]);
        }
    }

    while (results.length < 3) results.push([]);
    if (results.length > 3) results.splice(3);

    return results;
}
