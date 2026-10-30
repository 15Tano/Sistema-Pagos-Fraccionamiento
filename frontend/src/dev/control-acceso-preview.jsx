// Entrada exclusivamente local de Vite. Sin Axios, auth, OneSignal ni API real.
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import "../index.css";
import VigilanciaLayout from "../components/VigilanciaLayout";
import ControlAccessPanel from "../pages/ControlAcceso/components/ControlAccessPanel";
import VigilanciaShortcut from "../pages/Dashboard/components/VigilanciaShortcut";

const AGENT = "00000000-0000-4000-8000-000000000001";
const NAMES = ["María Fernanda López Morales", "Carlos Alberto Ramírez Soto", "Ana Sofía Hernández Cruz", "José Luis Martínez Ríos"];
const iso = (ms) => new Date(ms).toISOString();
const normalized = (text) => (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const localDate = (stamp) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(stamp));
let sequence = 200;
const demoPolicy = { history_for_guards: false, revision: 1 };
const permissions = (role) => ({ can_view_history: role === "admin" || demoPolicy.history_for_guards, can_manage_history: role === "admin" });
const denied = () => Object.assign(new Error("Demo permission"), { response: { status: 403, data: { code: "history_forbidden" } } });
function fixture(id, door, code = 0, time = Date.now(), index = 0) {
    return { id: String(id), response_id: "demo-" + id, ordinal: 0, source: "rt",
        card_no: "8800" + String(40 + index).padStart(4, "0"), pin: String(400 + index),
        door_id: door, door_label: door === "2" ? "Salida" : "Entrada", event_code: code,
        direction: door === "2" ? "1" : "0", verification: "4",
        device_time_raw: new Date(time - 21600000).toISOString().slice(0, 19).replace("T", " "),
        captured_ended_utc: iso(time), received_at_utc: iso(time),
        neighbor_name: NAMES[index % NAMES.length], neighbor_status: "single" };
}
function demoClient(scenario, role) {
    const rows = Array.from({ length: 16 }, (_, i) => fixture(200 - i, i % 3 === 0 ? "2" : "1", i === 0 && scenario === "review" ? 99 : i === 3 ? 20 : 0, Date.now() - i * 45000, i));
    rows[14].neighbor_name = null; rows[14].neighbor_status = "none";
    rows[15].neighbor_name = null; rows[15].neighbor_status = "multiple"; rows[15].source = "transaction";
    return {
        capture(door, code = 0) {
            rows.push(fixture(++sequence, door, code, Date.now(), sequence % NAMES.length));
        },
        async states() {
            if (scenario === "error") throw Object.assign(new Error(), { response: { status: 503 } });
            if (scenario === "disabled") throw Object.assign(new Error(), { response: { status: 404 } });
            const time = Date.now(), stamp = iso(time - (scenario === "stale" ? 900000 : 1000));
            return { data: scenario === "empty" ? [] : [{ agent_id: AGENT, name: "Demostración", device_serial: "CO2K225060027",
                reporting_status: scenario === "stale" ? "sin_reporte_reciente" : "reciente", received_at_utc: stamp, reported_at_utc: stamp,
                vigencias_status: scenario === "stale" ? "sin_confirmar" : "correcto",
                vigencias: { last_ok_utc: stamp, heartbeat_utc: stamp, phase: "idle", consecutive_errors: 0 },
                reader: { state: "status_observed", checked_at_utc: stamp },
                sender: { pending_count: scenario === "stale" ? 24 : 0, oldest_pending_at_utc: stamp } }],
                meta: { server_time_utc: iso(time), truncated: false, permissions: permissions(role) } };
        },
        async settings() {
            if (role !== "admin") throw denied();
            return { data: { ...demoPolicy } };
        },
        async updateSettings(data) {
            if (role !== "admin") throw denied();
            if (data.revision !== demoPolicy.revision) throw Object.assign(new Error("Demo conflict"), { response: { status: 409, data: { code: "monitor_settings_conflict", data: { ...demoPolicy } } } });
            demoPolicy.history_for_guards = data.history_for_guards; demoPolicy.revision++;
            return { data: { ...demoPolicy } };
        },
        async current(params) {
            const data = ["1", "2"].filter((door) => !params.door_id || params.door_id === door).map((door) =>
                rows.filter((row) => row.source === "rt" && row.door_id === door && row.card_no && row.card_no !== "0")
                    .sort((a, b) => Number(b.id) - Number(a.id))[0]).filter(Boolean)
                .sort((a, b) => Number(a.id) - Number(b.id));
            return { data, meta: { current_only: true, has_more: false, first_id: data[0]?.id ?? null, last_id: data.at(-1)?.id ?? null,
                physical_passage_confirmed: false, permissions: permissions(role) } };
        },
        async events(params) {
            if (!permissions(role).can_view_history) throw denied();
            const data = rows.filter((r) => (!params.q || (/^[0-9]+$/.test(params.q) ? r.card_no.startsWith(params.q) : normalized(r.neighbor_name).includes(normalized(params.q)))) &&
                (!params.date_from || localDate(r.captured_ended_utc) >= params.date_from) && (!params.date_to || localDate(r.captured_ended_utc) <= params.date_to) &&
                (!params.result || (params.result === "authorized" ? r.event_code === 0 : params.result === "repeated" ? r.event_code === 20 : ![0, 20].includes(r.event_code))) && (!params.door_id || r.door_id === params.door_id) && (!params.card_no || r.card_no === params.card_no) &&
                (params.source === "all" || params.source === r.source) && (!params.after_id || BigInt(r.id) > BigInt(params.after_id)) &&
                (!params.before_id || BigInt(r.id) < BigInt(params.before_id))).sort((a, b) => Number(a.id) - Number(b.id));
            return { data, meta: { first_id: data[0]?.id ?? null, last_id: data.at(-1)?.id ?? params.after_id ?? null,
                has_more: false, physical_passage_confirmed: false, permissions: permissions(role) } };
        },
    };
}
function PreviewSearch() {
    const [value, setValue] = useState("");
    return <div className="mx-auto max-w-[540px] rounded-3xl border border-white/80 bg-white/50 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-stone-800">Buscar vecino</h2><p className="mt-2 text-xs text-stone-500">Vista previa. Este buscador utiliza únicamente nombres ficticios.</p>
        <label className="mt-5 flex items-center gap-3 rounded-xl border border-stone-200 bg-white/70 p-3"><Search size={17} className="text-stone-400" /><input aria-label="Buscar vecino de demostración" className="w-full bg-transparent text-sm outline-none" placeholder="Nombre, casa o número de tag…" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        {value && <div className="mt-4 space-y-2">{NAMES.filter((name) => name.toLowerCase().includes(value.toLowerCase())).map((name) => <p key={name} className="rounded-xl bg-white/70 p-3 text-sm text-stone-700">{name}</p>)}</div>}
    </div>;
}
function PreviewDisplayControls({ client }) {
    const location = useLocation();
    const mode = new URLSearchParams(location.search).get("display");
    if (!["entrada", "salida"].includes(mode)) return null;
    const door = mode === "salida" ? "2" : "1";
    return createPortal(<aside className="ac-preview-display-controls" aria-label="Simulación del display">
        <span>Vista previa</span><button type="button" onClick={() => client.capture(door)}>Simular lectura</button>
        <button type="button" onClick={() => client.capture(door, 20)}>Repetida</button>
    </aside>, document.body);
}

export default function Preview() {
    const [scenario, setScenario] = useState("normal");
    const [role, setRole] = useState("admin");
    const client = useMemo(() => demoClient(scenario, role), [scenario, role]);
    const controls = <div className="ac-demo mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <span>Demostración · datos y permisos ficticios; el ajuste se reinicia al recargar</span>
        <select aria-label="Rol de demostración" className="rounded-lg border border-amber-200 bg-white/70 p-1" value={role} onChange={(event) => setRole(event.target.value)}><option value="admin">Administración</option><option value="vigilancia">Vigilancia</option></select>
        <div className="flex flex-wrap gap-2"><select aria-label="Escenario de demostración" className="rounded-lg border border-amber-200 bg-white/70 p-1" value={scenario} onChange={(e) => setScenario(e.target.value)}>
            <option value="normal">Funcionando</option><option value="review">Lectura por revisar</option><option value="stale">Sin reportes recientes</option><option value="empty">Sin datos</option><option value="error">Error de conexión</option><option value="disabled">No disponible</option></select>
            <button type="button" className="rounded-lg bg-white/70 px-2 py-1" onClick={() => client.capture("1")}>Simular entrada</button>
            <button type="button" className="rounded-lg bg-white/70 px-2 py-1" onClick={() => client.capture("2")}>Simular salida</button>
            <button type="button" className="rounded-lg bg-white/70 px-2 py-1" onClick={() => client.capture("1", 20)}>Simular repetida</button></div>
    </div>;
    return <MemoryRouter initialEntries={["/vigilancia/lecturas" + window.location.search]}>
        {controls}<PreviewDisplayControls client={client} />
        <Routes>
            <Route path="/" element={<main className="app-shell p-5"><div className="mx-auto max-w-[800px]"><h1 className="mb-2 text-2xl font-bold text-stone-800">Dashboard de demostración</h1><p className="mb-5 text-xs text-stone-500">Acceso de administración. Datos ficticios.</p>{role === "admin" ? <VigilanciaShortcut /> : <PreviewSearch />}</div></main>} />
            <Route path="/vigilancia" element={<VigilanciaLayout active="search" adminReturn={role === "admin"} onLogout={() => {}}><PreviewSearch /></VigilanciaLayout>} />
            <Route path="/vigilancia/lecturas" element={<VigilanciaLayout active="readings" adminReturn={role === "admin"} onLogout={() => {}}><ControlAccessPanel key={role} client={client} displayBase="/monitor-preview.html" /></VigilanciaLayout>} />
        </Routes>
    </MemoryRouter>;
}
const previewRoot = import.meta.hot?.data.previewRoot || createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.previewRoot = previewRoot;
previewRoot.render(<Preview />);
