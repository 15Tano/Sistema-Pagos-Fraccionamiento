const TZ = "America/Mexico_City";

export const formatCurrency = (n) =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Number(n) || 0);

// Acepta "2026-09-27" o "2026-09-27T00:00:00.000000Z" y devuelve solo la fecha
export const fechaISO = (valor) => String(valor ?? "").slice(0, 10);

export function formatFecha(valor) {
    const [y, m, d] = fechaISO(valor).split("-").map(Number);
    if (!y) return "—";
    return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function formatHora(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TZ,
    });
}

export function formatFechaHora(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-MX", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TZ,
    });
}

export const hoyMX = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: TZ });
