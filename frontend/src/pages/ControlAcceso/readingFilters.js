export const EMPTY_READING_FILTERS = { search: "", from: "", to: "", door: "", result: "", source: "rt" };

export function hasReadingFilters(filters) {
    return Boolean(filters.search || filters.from || filters.to || filters.door || filters.result || filters.source !== "rt");
}

// Solo la consulta histórica recibe estos parámetros; nunca la tarjeta en vivo.
export function readingHistoryParams(agentId, filters) {
    return { agent_id: agentId, source: filters.source || "rt", limit: 50,
        ...(filters.door ? { door_id: filters.door } : {}),
        ...(filters.search ? { q: filters.search } : {}),
        ...(filters.from ? { date_from: filters.from } : {}),
        ...(filters.to ? { date_to: filters.to } : {}),
        ...(filters.result ? { result: filters.result } : {}) };
}

export function mexicoToday(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const value = (type) => parts.find((part) => part.type === type).value;
    return `${value("year")}-${value("month")}-${value("day")}`;
}
