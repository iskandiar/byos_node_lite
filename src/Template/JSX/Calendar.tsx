type Props = {
    year: number;
    month: number; // 0-based
    label?: string;
    style?: React.CSSProperties;
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function Calendar({year, month, label, style}: Props) {
    // build month grid starting Monday (or Sunday depending on preference)
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay(); // 0 = Sunday
    const daysInMonth = last.getDate();

    // create rows
    const cells: Array<(number | null)> = [];
    // pad start
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const rows: Array<Array<number | null>> = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    return <div style={{border: '1px solid #ddd', borderRadius: 6, padding: 8, boxSizing: 'border-box', background: '#fafafa', ...style}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6}}>
            <div style={{fontWeight: 600}}>{label ?? `${MONTH_NAMES[month]} ${year}`}</div>
        </div>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
            <thead>
                <tr style={{color: '#666'}}>
                    <th style={{textAlign: 'center'}}>Sun</th>
                    <th style={{textAlign: 'center'}}>Mon</th>
                    <th style={{textAlign: 'center'}}>Tue</th>
                    <th style={{textAlign: 'center'}}>Wed</th>
                    <th style={{textAlign: 'center'}}>Thu</th>
                    <th style={{textAlign: 'center'}}>Fri</th>
                    <th style={{textAlign: 'center'}}>Sat</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, ri) => (
                    <tr key={ri}>
                        {r.map((c, ci) => (
                            <td key={ci} style={{height: 28, verticalAlign: 'top', padding: 4, textAlign: 'center', color: c ? '#111' : '#ccc'}}>{c ?? ''}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
}
