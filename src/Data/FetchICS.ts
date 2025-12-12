function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function nextWorkday(d = new Date()) {
    const date = new Date(d);
    // If Saturday (6) -> Monday (+2), Sunday (0) -> Monday (+1)
    if (date.getDay() === 6) date.setDate(date.getDate() + 2);
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    return date;
}

type ParsedEvent = { id?: string; summary?: string; start?: string; end?: string };

// Simple in-memory cache per URL
type CacheEntry = { fetchedAt: number; events: ParsedEvent[] };
const ICS_CACHE: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60s; align with refresh cadence, adjust if needed

/**
 * Fetch and parse ICS URLs and return an array of columns (one per URL) with events that occur on targetDate
 */
export async function fetchCalendarColumns(icsUrls: string[], _targetDate?: Date): Promise<ParsedEvent[][]> {
    // Target current time; include ongoing/upcoming events within the next 3 days, ordered by start
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const results: ParsedEvent[][] = [];
    for (const url of icsUrls) {
        try {
            // Serve from cache if fresh
            const cached = ICS_CACHE.get(url);
            if (cached && (now.getTime() - cached.fetchedAt) < CACHE_TTL_MS) {
                // From cache: already filtered/sorted/limited when stored
                results.push(cached.events);
                continue;
            }

            const res = await fetch(url);
            if (!res.ok) {
                console.error(`Failed to fetch ICS ${url} - status ${res.status}`);
                results.push([]);
                continue;
            }
            const rawText = await res.text();
            // Unfold lines according to RFC 5545 (lines starting with space are continuations)
            const text = rawText.replace(/\r?\n[ \t]/g, '');
            // Lightweight ICS parsing without external dependency
            const events: ParsedEvent[] = [];
            const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
            let m: RegExpExecArray | null;
            while ((m = veventRegex.exec(text)) !== null) {
                const block = m[1];
                const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                const obj: Record<string, string[]> = {};
                for (const line of lines) {
                    const idx = line.indexOf(':');
                    if (idx <= 0) continue;
                    const key = line.substring(0, idx);
                    const val = line.substring(idx + 1);
                    if (!obj[key]) obj[key] = [];
                    obj[key].push(val);
                }
                // Support parameters like DTSTART;TZID=Europe/Warsaw:..., DTSTART;TZID=Europe/Warsaw:...
                const rawDt = obj['DTSTART']?.[0]
                    || obj['DTSTART;TZID']?.[0]
                    || obj['DTSTART;TZID']?.[0]
                    || extractWithParam(obj, 'DTSTART');
                const rawEnd = obj['DTEND']?.[0]
                    || obj['DTEND;TZID']?.[0]
                    || obj['DTEND;TZID']?.[0]
                    || extractWithParam(obj, 'DTEND');
                const summary = (obj['SUMMARY'] && obj['SUMMARY'][0]) || '(no title)';
                const uid = (obj['UID'] && obj['UID'][0]) || undefined;
                if (!rawDt) continue;
                const start = parseICSTime(rawDt);
                let end = rawEnd ? parseICSTime(rawEnd) : undefined;
                // Treat all-day events (DATE-only) as running until end of that day
                if (!end && isDateOnly(rawDt) && start) {
                    end = endOfDay(start);
                }
                // If still missing end, assume a short meeting duration
                if (!end && start) {
                    end = new Date(start.getTime() + 60 * 60 * 1000);
                }
                if (!start) continue;
                // Include events that are ongoing (end >= now) or upcoming (start >= now) and within next 3 days
                const isOngoing = end ? end >= now : false;
                const isUpcoming = start >= now;
                const withinThreeDays = start <= threeDaysLater;
                if ((isOngoing || isUpcoming) && withinThreeDays) {
                    events.push({ id: uid, summary, start: start.toISOString(), end: end ? end.toISOString() : undefined });
                }
            }
            // Sort by start ascending and keep only current + next 6 per calendar
            events.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
            const limited = events.slice(0, 6);
            // Update cache
            ICS_CACHE.set(url, { fetchedAt: now.getTime(), events: limited });
            results.push(limited);
        } catch (err: any) {
            console.error('Error parsing ICS', url, err.message || err);
            results.push([]);
        }
    }

    // Ensure exactly 3 columns: if fewer urls provided, pad with empty arrays; if more, take first 3
    while (results.length < 3) results.push([]);
    if (results.length > 3) results.splice(3);

    return results;
}

function parseICSTime(raw: string): Date | undefined {
    // raw examples: 20251206T100000Z or 20251206 or 20251206T100000
    // May contain parameters like VALUE=DATE or TZID=Europe/Warsaw; we strip before ':' above via extractWithParam
    try {
        const val = raw;
        // If value looks like YYYYMMDD or YYYYMMDDTHHMMSS(Z?)
        const dtRegex = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/;
        const m = dtRegex.exec(val);
        if (!m) return undefined;
        const year = Number(m[1]);
        const month = Number(m[2]) - 1;
        const day = Number(m[3]);
        if (m[4]) {
            const hour = Number(m[4]);
            const min = Number(m[5]);
            const sec = Number(m[6]);
            if (m[7] === 'Z') {
                return new Date(Date.UTC(year, month, day, hour, min, sec));
            }
            return new Date(year, month, day, hour, min, sec);
        }
        return new Date(year, month, day);
    } catch (err) {
        return undefined;
    }
}

// Helper: find first key with prefix like 'DTSTART;TZID=...' and return the value part after ':'
function extractWithParam(obj: Record<string, string[]>, base: string): string | undefined {
    const key = Object.keys(obj).find(k => k.startsWith(base + ';'));
    const val = key ? obj[key][0] : undefined;
    return val;
}

function isDateOnly(raw: string): boolean {
    // True if value is YYYYMMDD without time component
    return /^\d{8}$/.test(raw);
}

function endOfDay(d: Date): Date {
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return end;
}
