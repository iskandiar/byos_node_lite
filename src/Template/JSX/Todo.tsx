type TodoItem = { id: number; text: string; done?: boolean };

export default function Todo({items}: { items?: TodoItem[] }) {
    const defaultItems: TodoItem[] = items ?? [
        {id: 1, text: 'Buy batteries'},
        {id: 2, text: 'Check BYOS proxy'},
        {id: 3, text: 'Write report'},
    ];

    return <div style={{border: '1px solid #e6e6e6', padding: 10, borderRadius: 6, background: '#fff'}}>
        <div style={{fontWeight: 700, marginBottom: 6}}>Todo</div>
        <ul style={{margin: 0, paddingLeft: 18}}>
            {defaultItems.map(it => (
                <li key={it.id} style={{marginBottom: 6}}>{it.text}</li>
            ))}
        </ul>
        <div style={{marginTop: 8, color: '#777', fontSize: 12}}>This is a server-side rendered list (static).</div>
    </div>
}
