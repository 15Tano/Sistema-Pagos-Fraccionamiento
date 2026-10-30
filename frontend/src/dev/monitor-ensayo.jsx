// Laboratorio privado, bundle independiente. No carga App, Axios ni OneSignal.
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import '../index.css';
import VigilanciaLayout from '../components/VigilanciaLayout';
import ControlAccessPanel from '../pages/ControlAcceso/components/ControlAccessPanel';
import { createTiming, observeReadingFrames } from './monitor-timing.js';
import { labClient } from './monitor-lab-client.js';
import { downloadReport } from './monitor-export.js';

function Session({ token, info, onLogout }) {
    const timing = useMemo(() => createTiming(), []);
    const client = useMemo(() => labClient(token, info.agent_id, timing), [token, info.agent_id, timing]);
    const [open, setOpen] = useState(true), [message, setMessage] = useState('Esperando la primera consulta.');
    const [busy, setBusy] = useState(false);
    useEffect(() => observeReadingFrames(timing), [timing]);
    const context = { mode: info.mode, agent_id: info.agent_id, browser_on_dell_declared: true,
        initial_view: new URLSearchParams(location.search).get('display') || 'guardia' };
    const generate = async (door, code = 0) => {
        setBusy(true);
        try {
            const response = await fetch('/api/ensayo/generar', { method: 'POST', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15000),
                headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ door, code, captured_utc: new Date().toISOString() }) });
            if (!response.ok) throw new Error('No se pudo generar.');
            const receipt = await response.json();
            setMessage('Ficticio creado: ' + receipt.response_id + '. Espere la consulta automática.');
        } catch { setMessage('Falló la generación. Revise conexión y credencial.'); }
        finally { setBusy(false); }
    };
    return <>
        <MemoryRouter initialEntries={['/vigilancia/lecturas' + location.search]}>
            <VigilanciaLayout active="readings" showTabs={false} onLogout={onLogout}>
                <ControlAccessPanel client={client} displayBase="/monitor-ensayo.html" />
            </VigilanciaLayout>
        </MemoryRouter>
        {createPortal(<aside style={{ position: 'fixed', zIndex: 100000, bottom: 8, right: 8, maxWidth: 350, maxHeight: '45vh', overflow: 'auto', background: '#fff9ed', border: '1px solid #d6b372', borderRadius: 12, padding: 10, fontSize: 12, boxShadow: '0 2px 15px #0002' }}>
            <button type="button" onClick={() => setOpen(!open)} style={{ fontWeight: 700 }}>Ensayo {info.mode} · {open ? 'Ocultar controles' : 'Ver controles'}</button>
            {open && <><p>Polling normal: 3 s, estado: 15 s. Primera página excluida. El token vive solo en memoria; recargar pide ingresarlo otra vez.</p>
                <p>En ensayo real, los nombres estarán sin asociación: no se copió el padrón de vecinos.</p>
                {info.mode === 'sintetico' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button disabled={busy} onClick={() => generate('1')}>Generar entrada ficticia</button>
                    <button disabled={busy} onClick={() => generate('2')}>Generar salida ficticia</button>
                    <button disabled={busy} onClick={() => generate('1', 20)}>Generar repetida ficticia</button>
                </div>}
                <p role="status">{message}</p>
                <button type="button" onClick={() => { const r = timing.report(context); downloadReport(r); setMessage(`Reporte guardado: ${r.rows.length} filas observadas. Cambio de reloj: ${r.clock_changed ? 'sí' : 'no'}.`); }}>Guardar medición JSON</button>
                <p>Sin antena→captura ni certificación de píxeles físicos. Display aplica sus reglas reales y regresa a espera tras 8 s.</p>
            </>}
        </aside>, document.body)}
    </>;
}
export default function Lab() {
    const [info, setInfo] = useState(null), [error, setError] = useState(''), [draft, setDraft] = useState('');
    const [token, setToken] = useState(''), [samePc, setSamePc] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetch('/salud', { cache: 'no-store', signal: controller.signal }).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((value) => { if (value.status !== 'monitor_ensayo_listo' || !['real', 'sintetico'].includes(value.mode)) throw new Error(); setInfo(value); })
            .catch((e) => { if (e.name !== 'AbortError') setError('No está conectado al nuevo ensayo privado.'); });
        return () => controller.abort();
    }, []);
    if (token && info) return <Session token={token} info={info} onLogout={() => setToken('')} />;
    return <main style={{ margin: '10vh auto', padding: 24, maxWidth: 480, background: '#fff9ef', borderRadius: 24 }}>
        <h1>Ensayo privado de Lecturas</h1><p>Modo: {info?.mode || 'comprobando…'}. Sin producción ni cambios de vigencias.</p>
        <form onSubmit={(e) => { e.preventDefault(); try { labClient(draft.trim(), info.agent_id, createTiming()); setToken(draft.trim()); setDraft(''); setError(''); } catch (e) { setError(e.message); } }}>
            <label>Credencial humana del ensayo<input type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ display: 'block', width: '100%', padding: 10, margin: '12px 0' }} /></label>
            <label><input type="checkbox" checked={samePc} onChange={(e) => setSamePc(e.target.checked)} /> Abrí este navegador en Dell, donde se ejecutará la captura.</label>
            <p>No pegue credenciales del agente ni de producción. La credencial humana dura 48 horas.</p>
            <button disabled={!info || !draft || !samePc}>Abrir monitor privado</button>
        </form>{error && <p role="alert">{error}</p>}
    </main>;
}
createRoot(document.getElementById('root')).render(<Lab />);
