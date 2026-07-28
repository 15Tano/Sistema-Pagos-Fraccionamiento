export function formatFechaHora(dt) {
    if (!dt) return "-";
    return new Date(dt).toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatFechaCorta(dt) {
    return new Date(dt).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
