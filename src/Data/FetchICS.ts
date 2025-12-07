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
export async function fetchCalendarColumns(icsUrls: string[], targetDate?: Date): Promise<ParsedEvent[][]> {
    const date = targetDate ? new Date(targetDate) : nextWorkday(new Date());

    const results: ParsedEvent[][] = [];
    for (const url of icsUrls) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`Failed to fetch ICS ${url} - status ${res.status}`);
                results.push([]);
                continue;
            }
            const text = await res.text();
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

                const rawDt = (obj['DTSTART'] && obj['DTSTART'][0]) || (obj['DTSTART;TZID'] && obj['DTSTART;TZID'][0]);
                const rawEnd = (obj['DTEND'] && obj['DTEND'][0]) || (obj['DTEND;TZID'] && obj['DTEND;TZID'][0]);
                const summary = (obj['SUMMARY'] && obj['SUMMARY'][0]) || '(no title)';
                const uid = (obj['UID'] && obj['UID'][0]) || undefined;
                if (!rawDt) continue;
                const start = parseICSTime(rawDt);
                const end = rawEnd ? parseICSTime(rawEnd) : undefined;
                if (!start) continue;
                if (isSameDay(start, date)) {
                    // collect attendees lines (keys that start with ATTENDEE)
                    const attendeeKeys = Object.keys(obj).filter(k => k.startsWith('ATTENDEE'));
                    let accepted = false;
                    if (attendeeKeys.length) {
                        for (const ak of attendeeKeys) {
                            for (const a of obj[ak]) {
                                const up = a.toUpperCase();
                                if (up.includes('PARTSTAT=ACCEPTED') || up.includes('PARTSTAT:ACCEPTED') || up.includes('ACCEPTED')) {
                                    accepted = true;
                                    break;
                                }
                            }
                            if (accepted) break;
                        }
                    } else {
                        accepted = true; // no attendees listed -> include
                    }
                    if (accepted) events.push({ id: uid, summary, start: start.toISOString(), end: end ? end.toISOString() : undefined });
                }
            }
            events.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
            results.push(events);
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
    // Normalize to ISO-like string
    try {
        // remove any parameters (if present) before the value
        const val = raw.includes('T') ? raw : raw;
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
