// Entrada exclusivamente local de Vite. Sin Axios, auth, OneSignal ni API real.
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Search } from "lucide-react";
import "../index.css";
import VigilanciaLayout from "../components/VigilanciaLayout";
import ControlAccessPanel from "../pages/ControlAcceso/components/ControlAccessPanel";

const AGENT = "00000000-0000-4000-8000-000000000001";
const NAMES = ["María Fernanda López Morales", "Carlos Alberto Ramírez Soto", "Ana Sofía Hernández Cruz", "José Luis Martínez Ríos"];
const iso = (ms) => new Date(ms).toISOString();
let sequence = 200;
function fixture(id, door, code = 0, time = Date.now(), index = 0) {
    return { id: String(id), response_id: "demo-" + id, ordinal: 0, source: "rt",
        card_no: "8800" + String(40 + index).padStart(4, "0"), pin: String(400 + index),
        door_id: door, door_label: door === "2" ? "Salida" : "Entrada", event_code: code,
        direction: door === "2" ? "1" : "0", verification: "4",
        device_time_raw: new Date(time - 21600000).toISOString().slice(0, 19).replace("T", " "),
        captured_ended_utc: iso(time), received_at_utc: iso(time),
        neighbor_name: NAMES[index % NAMES.length], neighbor_status: "single" };
}
function demoClient(scenario) {
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
                meta: { server_time_utc: iso(time), truncated: false } };
        },
        async events(params) {
            const data = rows.filter((r) => (!params.door_id || r.door_id === params.door_id) && (!params.card_no || r.card_no === params.card_no) &&
                (params.source === "all" || params.source === r.source) && (!params.after_id || BigInt(r.id) > BigInt(params.after_id)) &&
                (!params.before_id || BigInt(r.id) < BigInt(params.before_id))).sort((a, b) => Number(a.id) - Number(b.id));
            return { data, meta: { first_id: data[0]?.id ?? null, last_id: data.at(-1)?.id ?? params.after_id ?? null,
                has_more: false, physical_passage_confirmed: false } };
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
export default function Preview() {
    const [scenario, setScenario] = useState("normal");
    const client = useMemo(() => demoClient(scenario), [scenario]);
    const controls = <div className="ac-demo mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <span>Demostración local · nombres y lecturas ficticios</span>
        <div className="flex flex-wrap gap-2"><select aria-label="Escenario de demostración" className="rounded-lg border border-amber-200 bg-white/70 p-1" value={scenario} onChange={(e) => setScenario(e.target.value)}>
            <option value="normal">Funcionando</option><option value="review">Lectura por revisar</option><option value="stale">Sin reportes recientes</option><option value="empty">Sin datos</option><option value="error">Error de conexión</option><option value="disabled">No disponible</option></select>
            <button type="button" className="rounded-lg bg-white/70 px-2 py-1" onClick={() => client.capture("1")}>Simular entrada</button>
            <button type="button" className="rounded-lg bg-white/70 px-2 py-1" onClick={() => client.capture("2")}>Simular salida</button>
            <button type="button" className="rounded-lg bg-white/70 px-2 py-1" onClick={() => client.capture("1", 20)}>Simular repetida</button></div>
    </div>;
    return <MemoryRouter initialEntries={["/vigilancia/lecturas" + window.location.search]}>
        {controls}
        <Routes>
            <Route path="/vigilancia" element={<VigilanciaLayout active="search" onLogout={() => {}}><PreviewSearch /></VigilanciaLayout>} />
            <Route path="/vigilancia/lecturas" element={<VigilanciaLayout active="readings" onLogout={() => {}}><ControlAccessPanel client={client} displayBase="/monitor-preview.html" /></VigilanciaLayout>} />
        </Routes>
    </MemoryRouter>;
}
const previewRoot = import.meta.hot?.data.previewRoot || createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.previewRoot = previewRoot;
previewRoot.render(<Preview />);
