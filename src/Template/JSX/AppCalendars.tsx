import {TemplateDataType} from "Data/PrepareData.js";
import Todo from "./Todo.js";

export default function AppCalendars(data: TemplateDataType & { calendarColumns?: any[] }) {
    const columns = data.calendarColumns ?? [[], [], []];

    return <div style={{
        fontSize: 18,
        display: 'flex',
        backgroundColor: '#ffffff',
        width: '800px',
        height: '480px',
        padding: 10,
        boxSizing: 'border-box',
        color: '#111'
    }}>
        <div style={{display: 'flex', flexDirection: 'column', width: '70%', height: '100%'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{fontSize: 20, fontWeight: 600}}>Today's Accepted Meetings (3 columns)</div>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8}}>
                {columns.map((events, i) => (
                    <div key={i} style={{flex: 1, border: '1px solid #e6e6e6', borderRadius: 6, padding: 8, minHeight: 160, background: '#fff'}}>
                        <div style={{fontWeight: 700, marginBottom: 6}}>Column {i + 1}</div>
                        {events && events.length ? events.map((ev: any) => (
                            <div key={ev.id || ev.start} style={{marginBottom: 8}}>
                                <div style={{fontSize: 13, fontWeight: 600}}>{ev.summary}</div>
                                <div style={{fontSize: 12, color: '#444'}}>{formatEventTime(ev.start, ev.end)}</div>
                            </div>
                        )) : <div style={{color: '#888', fontSize: 12}}>No events</div>}
                    </div>
                ))}
            </div>

            <div style={{marginTop: 12}}>
                <Todo />
            </div>
        </div>

        <div style={{width: '30%', paddingLeft: 10}}>
            {/* Right column reserved for optional content or image */}
            <div style={{fontSize: 14, color: '#666'}}>Notes</div>
            <div style={{marginTop: 8, fontSize: 12, color: '#333'}}>Showing accepted events for the targeted work day. Configure ICS URLs in the server environment.</div>
        </div>
    </div>
}

function formatEventTime(start?: string, end?: string) {
    if (!start) return '';
    try {
        const s = new Date(start);
        const e = end ? new Date(end) : undefined;
        const opts: Intl.DateTimeFormatOptions = {hour: '2-digit', minute: '2-digit'};
        return e ? `${s.toLocaleTimeString([], opts)} — ${e.toLocaleTimeString([], opts)}` : s.toLocaleTimeString([], opts);
    } catch (err) {
        return start;
    }
}
