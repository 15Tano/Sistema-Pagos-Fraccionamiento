import { useId, useState } from "react";
import { CalendarDays, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { EMPTY_READING_FILTERS, hasReadingFilters, mexicoToday } from "../readingFilters";

export default function ReadingFilters({ filters, onFilters, busy }) {
    const [draft, setDraft] = useState(filters);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState("");
    const panelId = useId();
    const active = hasReadingFilters(filters);
    const extra = [filters.from || filters.to, filters.door, filters.result, filters.source !== "rt"].filter(Boolean).length;
    const dateText = (value) => value.split("-").reverse().join("/");
    const update = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setError(""); };
    const apply = (event) => {
        event.preventDefault();
        if (draft.from && draft.to && draft.from > draft.to) { setError("La fecha inicial debe ser anterior o igual a la final."); return; }
        onFilters({ ...draft, search: draft.search.trim() });
    };
    const reset = () => { setDraft({ ...EMPTY_READING_FILTERS }); setError(""); onFilters({ ...EMPTY_READING_FILTERS }); };
    return <form className="ac-filter-form" onSubmit={apply} noValidate>
        <div className="ac-search"><Search size={18} aria-hidden="true" />
            <input aria-label="Buscar por nombre o tag" placeholder="Nombre o tag…" maxLength={120} value={draft.search} onChange={(e) => update("search", e.target.value)} />
            {draft.search && <button type="button" className="ac-clear-search" aria-label="Borrar texto de búsqueda" onClick={() => update("search", "")}><X size={15} /></button>}
            <button type="submit" className="ac-search-submit" disabled={busy}>Buscar</button>
        </div>
        <div className="ac-filter-toolbar"><button className="ac-filter-toggle" type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
            <SlidersHorizontal size={14} />Filtros{extra > 0 && <span className="ac-filter-count">{extra}</span>}<ChevronDown size={13} className={open ? "ac-chevron-open" : ""} /></button>
            {active ? <button className="ac-reset-filters" type="button" onClick={reset}><X size={12} />Limpiar filtros</button> : <span className="ac-live-caption"><span className="ac-tiny-dot ac-online-dot" />Actividad reciente</span>}
        </div>
        <div className={`ac-filter-disclosure ${open ? "ac-filter-open" : ""}`} inert={!open}>
            <div><fieldset id={panelId} className="ac-filter-fields"><legend className="sr-only">Filtros de lecturas recibidas</legend>
                <div className="ac-date-heading"><span><CalendarDays size={14} />Fecha de captura</span><button type="button" onClick={() => { const today = mexicoToday(); setDraft((current) => ({ ...current, from: today, to: today })); setError(""); }}>Hoy</button></div>
                <div className="ac-filter-dates"><label>Desde<input aria-label="Fecha inicial" type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => update("from", e.target.value)} /></label>
                    <label>Hasta<input aria-label="Fecha final" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => update("to", e.target.value)} /></label></div>
                <div className="ac-filter-selects"><label>Pluma<select value={draft.door} onChange={(e) => update("door", e.target.value)}><option value="">Entrada y salida</option><option value="1">Entrada</option><option value="2">Salida</option></select></label>
                    <label>Resultado<select value={draft.result} onChange={(e) => update("result", e.target.value)}><option value="">Todos los resultados</option><option value="authorized">Autorizado</option><option value="repeated">Lectura repetida</option><option value="review">Por revisar</option></select></label>
                    <label>Origen<select value={draft.source} onChange={(e) => update("source", e.target.value)}><option value="rt">Lecturas recientes</option><option value="transaction">Historial del controlador</option><option value="all">Ambos orígenes</option></select></label></div>
                <div className="ac-filter-apply"><span>Hora de Ciudad de México</span><button type="submit" disabled={busy}>Aplicar filtros</button></div>
            </fieldset></div>
        </div>
        {error && <p className="ac-input-error" role="alert">{error}</p>}
        {active && <div className="ac-applied-filters" aria-label="Filtros aplicados">
            {filters.search && <span>«{filters.search}»</span>}{(filters.from || filters.to) && <span>{filters.from && filters.to
                ? filters.from === filters.to ? dateText(filters.from) : `${dateText(filters.from)} — ${dateText(filters.to)}`
                : filters.from ? `Desde ${dateText(filters.from)}` : `Hasta ${dateText(filters.to)}`}</span>}
            {filters.door && <span>{filters.door === "1" ? "Entrada" : "Salida"}</span>}{filters.result && <span>{{ authorized: "Autorizado", repeated: "Repetida", review: "Por revisar" }[filters.result]}</span>}
            {filters.source !== "rt" && <span>{filters.source === "all" ? "Ambos orígenes" : "Historial del controlador"}</span>}
        </div>}
    </form>;
}
