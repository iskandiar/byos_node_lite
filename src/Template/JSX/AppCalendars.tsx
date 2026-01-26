import {TemplateDataType} from "Data/PrepareData.js";
import {TIMEZONE} from "Config.js";
// Todo component removed per request

export default function AppCalendars(data: TemplateDataType & { calendarColumns?: any[] }) {
    const columns = data.calendarColumns ?? [[], [], []];
    const names = ["Work", "Life", "Sport"];

    // Header: current date (timezone-aware) and last synced time
    const now = new Date();
    const tzDate = new Date(now.toLocaleString('en-GB', { timeZone: TIMEZONE }));

    return <div className="app-container">
        <div className="app-header">
            <div className="app-title">Next 3 Days • last synced at {data.time}</div>
        </div>

        <div className="app-grid">
            {columns.map((events, i) => (
                <div key={i} className="card">
                    <div className="card-title">{names[i] ?? `Calendar ${i + 1}`}</div>
                    {events && events.length ? (
                        <div>
                            {events.map((ev: any) => (
                                <div key={ev.id || ev.start} className="event-item">
                                    <div className="event-summary">{ev.summary}</div>
                                    <div className="event-time">{formatEventTime(ev.start, ev.end)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty">No events</div>
                    )}
                </div>
            ))}
        </div>
    </div>
}

function formatEventTime(start?: string, end?: string) {
    if (!start) return '';
    try {
        const s = new Date(start);
        const e = end ? new Date(end) : undefined;
        // Short day format dd.MM and weekday short
        const dd = String(s.getDate()).padStart(2, '0');
        const mm = String(s.getMonth() + 1).padStart(2, '0');
        const weekday = s.toLocaleDateString([], { weekday: 'short' });
        const dayStr = `${weekday} ${dd}.${mm}`;
        const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
        const startStr = s.toLocaleTimeString([], timeOpts);
        const endStr = e ? e.toLocaleTimeString([], timeOpts) : undefined;
        return endStr ? `${dayStr} ${startStr} — ${endStr}` : `${dayStr} ${startStr}`;
    } catch (err) {
        return start;
    }
}

// timeline helpers removed per request
