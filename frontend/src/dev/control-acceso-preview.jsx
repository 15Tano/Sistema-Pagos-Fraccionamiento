// Solo entrada HTML de Vite dev; no se importa desde App ni entra en el build de produccion.
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import ControlAccessView from "../pages/ControlAcceso/components/ControlAccessView";
import { useControlAccess } from "../pages/ControlAcceso/hooks/useControlAccess";

const AGENT = "00000000-0000-4000-8000-000000000001";
const iso = (ms) => new Date(ms).toISOString();
const start = Date.now();
const rows = Array.from({ length: 16 }, (_, i) => ({ id: String(200 - i), response_id: `demo-${i}`, ordinal: 0,
    source: i === 15 ? "transaction" : "rt", card_no: `8800${String(40 + i).padStart(4, "0")}`, pin: String(400 + i),
    door_id: i % 3 === 0 ? "2" : "1", door_label: i % 3 === 0 ? "Salida" : "Entrada", event_code: i === 3 ? 20 : 0,
    direction: i % 3 === 0 ? "1" : "0", verification: "4", device_time_raw: `2026-10-26 12:${String(41 - i).padStart(2, "0")}:18`,
    captured_ended_utc: iso(start - i * 45000), received_at_utc: iso(start - i * 45000 + 500) }));
function demoClient(scenario) {
    return {
        async states() {
            if (scenario === "error") throw { response: { status: 503 } };
            if (scenario === "disabled") throw { response: { status: 404 } };
            const time = Date.now(), stamp = iso(time - (scenario === "stale" ? 900000 : 5000));
            return { data: scenario === "empty" ? [] : [{ agent_id: AGENT, name: "Caseta principal", device_serial: "CO2K225060027", revoked_at_utc: null,
                reporting_status: scenario === "stale" ? "sin_reporte_reciente" : "reciente", received_at_utc: stamp, reported_at_utc: stamp,
                vigencias_status: scenario === "stale" ? "sin_confirmar" : "correcto", vigencias: { last_ok_utc: stamp, heartbeat_utc: stamp, phase: "idle", consecutive_errors: 0 },
                reader: { state: "status_observed", checked_at_utc: stamp }, sender: { pending_count: scenario === "stale" ? 24 : 0, oldest_pending_at_utc: stamp } }],
                meta: { server_time_utc: iso(time), truncated: false } };
        },
        async events(params) {
            const data = rows.filter((r) => (!params.door_id || r.door_id === params.door_id) && (!params.card_no || r.card_no === params.card_no) &&
                (params.source === "all" || params.source === r.source) && (!params.after_id || BigInt(r.id) > BigInt(params.after_id)) && (!params.before_id || BigInt(r.id) < BigInt(params.before_id)))
                .sort((a, b) => Number(a.id) - Number(b.id));
            return { data, meta: { server_time_utc: iso(Date.now()), first_id: data[0]?.id ?? null,
                last_id: data.at(-1)?.id ?? params.after_id ?? null, has_more: false, physical_passage_confirmed: false } };
        },
    };
}
export default function Preview() {
    const [scenario, setScenario] = useState("normal");
    const [filters, setFilters] = useState({ agentId: "", door: "", card: "", source: "rt" });
    const client = useMemo(() => demoClient(scenario), [scenario]);
    const monitor = useControlAccess(client, filters);
    return <div className="app-shell"><div className="app-bg" /><main className="relative z-10 w-full max-w-[1500px] mx-auto p-4 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center justify-between mb-8 gap-3"><span className="font-semibold text-stone-700 text-sm">SAN ISIDRO <span className="text-stone-400 font-normal ml-2">Vista previa privada</span></span>
            <label className="text-xs text-stone-500">Escenario <select aria-label="Escenario de demostración" className="ml-2 rounded-lg border border-stone-200 bg-white/70 p-2"
                value={scenario} onChange={(e) => setScenario(e.target.value)}><option value="normal">Con reportes</option><option value="stale">Reporte atrasado</option>
                <option value="empty">Sin casetas</option><option value="error">Error de conexión</option><option value="disabled">Monitor no disponible</option></select></label></div>
        <div className="ac-demo">Vista previa local · datos ficticios. No conectada a la caseta.</div>
        <ControlAccessView monitor={monitor} filters={filters} onFilters={(patch) => setFilters((f) => ({ ...f, ...patch }))} />
    </main></div>;
}
createRoot(document.getElementById("root")).render(<Preview />);
