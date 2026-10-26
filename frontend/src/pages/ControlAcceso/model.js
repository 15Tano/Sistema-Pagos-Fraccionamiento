const ID = /^(0|[1-9][0-9]{0,18})$/;
export const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
export const rowId = (value) => typeof value === "string" && ID.test(value) &&
    (value.length < 19 || value <= "9223372036854775807");
export const compareIds = (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
export function mergeRows(previous, incoming, maximum = 400) {
    const map = new Map(previous.map((row) => [row.id, row]));
    for (const row of incoming) map.set(row.id, row);
    return [...map.values()].sort((a, b) => compareIds(b.id, a.id)).slice(0, maximum);
}
export function statesResponse(value) {
    if (!Array.isArray(value?.data) || !Number.isFinite(Date.parse(value?.meta?.server_time_utc)) ||
        value.data.some((a) => !uuid(a?.agent_id))) throw new Error("invalid_response");
    return value;
}
export function eventsResponse(value, after, before = null) {
    if (!Array.isArray(value?.data) || !value?.meta || typeof value.meta.has_more !== "boolean" ||
        value.meta.physical_passage_confirmed !== false || value.data.some((r) => !rowId(r?.id) ||
            !["rt", "transaction"].includes(r.source) || !Number.isInteger(r.event_code) ||
            ["card_no", "pin", "door_id", "door_label", "device_time_raw", "direction", "verification",
                "captured_ended_utc", "received_at_utc"].some((key) => r[key] !== null && typeof r[key] !== "string") ||
            (r.neighbor_status !== undefined && !["single", "none", "multiple"].includes(r.neighbor_status)) ||
            (r.neighbor_name !== undefined && r.neighbor_name !== null && typeof r.neighbor_name !== "string"))) {
        throw new Error("invalid_response");
    }
    for (let i = 0; i < value.data.length; i++) {
        if ((i && compareIds(value.data[i - 1].id, value.data[i].id) >= 0) ||
            (after != null && compareIds(value.data[i].id, after) <= 0) ||
            (before != null && compareIds(value.data[i].id, before) >= 0)) throw new Error("invalid_response");
    }
    const last = value.data.at(-1)?.id ?? after ?? null;
    if (value.meta.last_id !== last || value.meta.first_id !== (value.data[0]?.id ?? null) ||
        (value.meta.has_more && !value.data.length)) throw new Error("invalid_response");
    return value;
}
export function errorInfo(error) {
    const status = error?.response?.status;
    if (status === 401) return { text: "La sesión terminó. Vuelve a ingresar.", terminal: true, clear: true };
    if (status === 403) return { text: "No tienes permiso para consultar este monitor.", terminal: true, clear: true };
    if (status === 404) return { text: "El monitor no está disponible para esta caseta. Puedes reintentar más tarde.", terminal: true };
    if (status === 422 || error?.message === "invalid_response") return { text: "No se pudo interpretar la respuesta del monitor. Actualiza la consulta.", terminal: true };
    if (status === 429) return { text: "Hay demasiadas consultas. Reintentaremos en unos segundos.", terminal: false };
    return { text: "No se pudo actualizar. Conservamos las últimas lecturas recibidas y volveremos a intentarlo.", terminal: false };
}
const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Mexico_City" });
export function utcText(value) {
    if (!value || !/(Z|[+-]\d\d:\d\d)$/.test(value)) return "Sin dato";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? dateFormat.format(date) : "Sin dato";
}
export function deviceText(value) { return typeof value === "string" && value ? value : "Sin hora reportada"; }
const clockFormat = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "America/Mexico_City" });
export function timeText(value) {
    return utcText(value) === "Sin dato" ? "Sin hora" : clockFormat.format(new Date(value));
}
export function ageText(value, now) {
    const age = (now - Date.parse(value)) / 1000;
    if (!Number.isFinite(age)) return "Sin dato";
    if (age < -30) return "Reloj por revisar";
    if (age < 60) return "Hace unos segundos";
    if (age < 3600) return `Hace ${Math.floor(age / 60)} min`;
    if (age < 86400) return `Hace ${Math.floor(age / 3600)} h`;
    return `Hace ${Math.floor(age / 86400)} días`;
}
export function reporting(agent, now) {
    const map = { reciente: ["Reportes recientes", "good"], sin_reporte: ["Sin reportes", "neutral"],
        sin_reporte_reciente: ["Sin reporte reciente", "warning"], reporte_atrasado: ["Reporte atrasado", "warning"],
        reloj_por_revisar: ["Reloj por revisar", "warning"], revocado: ["Agente revocado", "bad"] };
    if (agent?.reporting_status === "reciente") {
        const received = now - Date.parse(agent.received_at_utc), reported = now - Date.parse(agent.reported_at_utc);
        if (![received, reported].every(Number.isFinite)) return ["Sin información", "neutral"];
        if (Math.min(received, reported) < -30000) return map.reloj_por_revisar;
        if (received > 90000) return map.sin_reporte_reciente;
        if (reported > 90000) return map.reporte_atrasado;
    }
    return map[agent?.reporting_status] ?? ["Sin información", "neutral"];
}
export function cycleLabel(agent, now) {
    const labels = { correcto: "Al día", sin_datos: "Sin datos", sin_confirmar: "Sin confirmar", detenido: "Detenidas",
        error: "Con errores", reloj_por_revisar: "Revisar reloj", atrasado: "Sin ciclo reciente" };
    if (agent?.vigencias_status === "correcto") {
        const ages = [agent.vigencias?.last_ok_utc, agent.vigencias?.heartbeat_utc].map((stamp) => now - Date.parse(stamp));
        if (reporting(agent, now)[1] !== "good" || !ages.every(Number.isFinite) ||
            Math.max(...ages) > 300000 || Math.min(...ages) < -30000) return "Sin confirmar";
    }
    return labels[agent?.vigencias_status] ?? "Sin datos";
}

export function neighborText(row) {
    if (row?.neighbor_status === "multiple") return "Verificar asociación";
    if (row?.neighbor_status === "none") return "Sin vecino asociado";
    return row?.neighbor_status === "single" && row.neighbor_name?.trim() ? row.neighbor_name : "Nombre no disponible";
}

// PullSDK, anexo 6: solo significados contrastados; nunca deducir vigencia del código 20.
export function eventPresentation(code) {
    if (code === 0) return { tone: "success", title: "Acceso autorizado", short: "Autorizado", message: "Tag reconocido por el lector.", icon: "check" };
    if (code === 20) return { tone: "warning", title: "Lectura repetida", short: "Lectura repetida", message: "Espere un momento antes de volver a intentarlo.", icon: "repeat" };
    return { tone: "review", title: "Consulte a vigilancia", short: "Por revisar", message: "El vigilante le ayudará a revisar esta lectura.", icon: "help" };
}

export const displayDoor = (value) => value === "entrada" ? "1" : value === "salida" ? "2" : "";
export function displayReading(row, now, { door, ready, catchingUp = false }) {
    if (!ready || catchingUp || !["1", "2"].includes(door) || row?.door_id !== door || row.source !== "rt" ||
        !row.card_no || row.card_no === "0") return null;
    const ages = [row.captured_ended_utc, row.received_at_utc].map((value) => now - Date.parse(value));
    return ages.every((age) => Number.isFinite(age) && age >= -1000 && age < 8000) ? row : null;
}
