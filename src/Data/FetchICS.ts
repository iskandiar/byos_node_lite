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

/**
 * Fetch and parse ICS URLs and return an array of columns (one per URL) with events that occur on targetDate
 */
import IcalExpander from 'ical-expander';

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

export async function fetchCalendarColumns(icsUrls: string[], _targetDate?: Date): Promise<ParsedEvent[][]> {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const rangeStart = startOfDay(now);
    const rangeEnd = endOfDayInclusive(threeDaysLater);

    const results: ParsedEvent[][] = [];
    for (const url of icsUrls) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`Failed to fetch ICS ${url} - status ${res.status}`);
                results.push([]);
                continue;
            }
            const ics = await res.text();
            // If the ICS is very large, fall back to lightweight parser (no recurrence expansion)
            if (ics.length > 6_000_000) {
                const parsed = parseIcsLight(ics, rangeStart, rangeEnd);
                parsed.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
                results.push(parsed.slice(0, 6));
                continue;
            }
            const expander = new IcalExpander({ ics, maxIterations: 200 });
            const { events, occurrences } = expander.between(rangeStart, rangeEnd);

            function readProp(item: any, prop: string): string | undefined {
                if (!item) return undefined;
                if (item[prop]) return item[prop]; // e.g., item.summary or item.uid on ICAL.Event
                const comp = item.component;
                if (comp && typeof comp.getFirstPropertyValue === 'function') {
                    try { return comp.getFirstPropertyValue(prop); } catch { /* ignore */ }
                }
                return undefined;
            }

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
                const t = String(text).toLowerCase();
                return t.includes('async');
            }

            function isOutOfOfficeItem(item: any): boolean {
                const summary = readProp(item, 'summary');
                const description = readProp(item, 'description');
                const location = readProp(item, 'location');
                // Exclude OOO and any event containing the word 'async'
                if (hasOOOKeyword(summary) || hasOOOKeyword(description) || hasOOOKeyword(location)) return true;
                if (hasAsyncKeyword(summary) || hasAsyncKeyword(description) || hasAsyncKeyword(location)) return true;
                const comp = item?.component;
                if (comp && typeof comp.getFirstPropertyValue === 'function') {
                    try {
                        const busy = comp.getFirstPropertyValue('x-microsoft-cdo-busystatus');
                        if (busy && String(busy).toUpperCase() === 'OOF') return true;
                        const cats = comp.getFirstPropertyValue('categories');
                        if (cats && hasOOOKeyword(String(cats))) return true;
                    } catch { /* ignore */ }
                }
                return false;
            }

            function getBestTitle(item: any): string {
                const title = readProp(item, 'summary')
                    || readProp(item, 'description')
                    || readProp(item, 'location');
                return title && String(title).trim() ? String(title) : '(no title)';
            }

            const parsed: ParsedEvent[] = [];
            for (const ev of events) {
                const start = ev.startDate && typeof ev.startDate.toJSDate === 'function' ? ev.startDate.toJSDate() : undefined;
                const end = ev.endDate && typeof ev.endDate.toJSDate === 'function' ? ev.endDate.toJSDate() : undefined;
                if (!start) continue;
                if (isOutOfOfficeItem(ev.item)) continue;
                const title = getBestTitle(ev.item);
                const uid = readProp(ev.item, 'uid');
                parsed.push({ id: uid, summary: title, start: start.toISOString(), end: end ? end.toISOString() : undefined });
                if (parsed.length >= 6) break;
            }
            if (parsed.length < 6) {
                for (const occ of occurrences) {
                const start = occ.startDate && typeof occ.startDate.toJSDate === 'function' ? occ.startDate.toJSDate() : undefined;
                const end = occ.endDate && typeof occ.endDate.toJSDate === 'function' ? occ.endDate.toJSDate() : undefined;
                if (!start) continue;
                    if (isOutOfOfficeItem(occ.item)) continue;
                    const title = getBestTitle(occ.item);
                const uid = readProp(occ.item, 'uid');
                parsed.push({ id: uid, summary: title, start: start.toISOString(), end: end ? end.toISOString() : undefined });
                    if (parsed.length >= 6) break;
                }
            }

            parsed.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
            results.push(parsed.slice(0, 6));
        } catch (err: any) {
            console.error('Error parsing ICS', url, err?.message || err);
            results.push([]);
        }
    }

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

// Lightweight ICS parser for large feeds (no recurrence expansion)
function parseIcsLight(icsText: string, windowStart: Date, windowEnd: Date): ParsedEvent[] {
    try {
        const text = icsText.replace(/\r?\n[ \t]/g, '');
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
            const rawDt = obj['DTSTART']?.[0]
                || obj['DTSTART;TZID']?.[0]
                || extractWithParam(obj, 'DTSTART');
            const rawEnd = obj['DTEND']?.[0]
                || obj['DTEND;TZID']?.[0]
                || extractWithParam(obj, 'DTEND');
            const title = obj['SUMMARY']?.[0]
                || obj['DESCRIPTION']?.[0]
                || obj['LOCATION']?.[0]
                || '(no title)';
            const uid = obj['UID']?.[0];
            const busy = (obj['X-MICROSOFT-CDO-BUSYSTATUS']?.[0] || '').toUpperCase();
            const combined = `${obj['SUMMARY']?.[0] || ''} ${obj['DESCRIPTION']?.[0] || ''} ${obj['LOCATION']?.[0] || ''}`.toLowerCase();
            const isOOO = busy === 'OOF' || /\booo\b/.test(combined) || /\boof\b/.test(combined) || combined.includes('out of office') || combined.includes('vacation') || combined.includes('pto') || combined.includes('out-of-office');
            const isAsync = combined.includes('async');
            if (isOOO || isAsync) continue;
            if (!rawDt) continue;
            const start = parseICSTime(rawDt);
            let end = rawEnd ? parseICSTime(rawEnd) : undefined;
            if (!end && isDateOnly(rawDt) && start) end = endOfDay(start);
            if (!end && start) end = new Date(start.getTime() + 60 * 60 * 1000);
            if (!start) continue;
            const overlapsWindow = (end ?? start) >= windowStart && start <= windowEnd;
            if (overlapsWindow) {
                events.push({ id: uid, summary: title, start: start.toISOString(), end: end ? end.toISOString() : undefined });
            }
        }
        return events;
    } catch (err) {
        return [];
    }
}
