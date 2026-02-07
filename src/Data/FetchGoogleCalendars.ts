type ParsedEvent = { id?: string; summary?: string; start?: string; end?: string };

export type CalendarColumn = {
    events: ParsedEvent[];
    moreCount: number; // Number of additional events not shown
};

/**
 * Fetch and parse Google Calendar events and return an array of columns (one per calendar).
 */
import {googleEventToRange, listGoogleCalendarEvents, GoogleEvent} from './GoogleCalendarData.js';

export type CalendarMetadata = { id: string; isWorkCalendar: boolean };

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

export async function fetchCalendarColumns(calendarIds: string[] | CalendarMetadata[], _targetDate?: Date): Promise<CalendarColumn[][]> {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rangeStart = startOfDay(now);
    const rangeEnd = endOfDayInclusive(sevenDaysLater);

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

    function isFullDayEvent(ev: GoogleEvent): boolean {
        // Full-day events have a 'date' but no 'dateTime' in start/end
        return (ev.start?.date && !ev.start?.dateTime) || (ev.end?.date && !ev.end?.dateTime);
    }

    const results: ParsedEvent[][] = [];
    for (let idx = 0; idx < calendarIds.length; idx++) {
        const calendarItem = calendarIds[idx];
        const calendarId = typeof calendarItem === 'string' ? calendarItem : calendarItem.id;
        const isWorkCalendar = typeof calendarItem === 'string' ? false : calendarItem.isWorkCalendar;
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
                if (isWorkCalendar && isFullDayEvent(ev)) continue;

                const {start, end} = googleEventToRange(ev);
                if (!start) continue;
                const overlapsWindow = (end ?? start) >= rangeStart && start <= rangeEnd;
                if (!overlapsWindow) continue;
                
                // Filter out past events - keep only current (ongoing) and future events
                const eventEnd = end ?? start;
                if (eventEnd < now) continue;

                parsed.push({
                    id: ev.id,
                    summary: ev.summary && String(ev.summary).trim() ? String(ev.summary) : '(no title)',
                    start: start.toISOString(),
                    end: end ? end.toISOString() : undefined,
                });
            }

            parsed.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
            const displayedCount = 8;
            const moreCount = Math.max(0, parsed.length - displayedCount);
            results.push({
                events: parsed.slice(0, displayedCount),
                moreCount
            });
        } catch (err: any) {
            console.error('Error fetching Google Calendar', calendarId, err?.message || err);
            results.push({ events: [], moreCount: 0 });
        }
    }

    while (results.length < 3) results.push({ events: [], moreCount: 0 });
    if (results.length > 3) results.splice(3);

    return results;
}
