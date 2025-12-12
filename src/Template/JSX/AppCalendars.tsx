import {TemplateDataType} from "Data/PrepareData.js";
// Todo component removed per request

export default function AppCalendars(data: TemplateDataType & { calendarColumns?: any[] }) {
    const columns = data.calendarColumns ?? [[], [], []];

    return <div className="app-container">
        <div className="app-header">
            <div className="app-title">Upcoming Meetings</div>
        </div>

        <div className="app-grid">
            {columns.map((events, i) => (
                <div key={i} className="card">
                    <div className="card-title">Calendar {i + 1}</div>
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
        const dateOpts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit' };
        const timeOpts: Intl.DateTimeFormatOptions = {hour: '2-digit', minute: '2-digit'};
        const dateStr = s.toLocaleDateString([], dateOpts);
        const startStr = s.toLocaleTimeString([], timeOpts);
        const endStr = e ? e.toLocaleTimeString([], timeOpts) : undefined;
        return endStr ? `${dateStr} ${startStr} — ${endStr}` : `${dateStr} ${startStr}`;
    } catch (err) {
        return start;
    }
}

// timeline helpers removed per request
