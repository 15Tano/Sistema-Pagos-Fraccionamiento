import {
    CalendarDays,
    ChevronRight,
    FileSearch,
    History,
    RotateCcw,
} from "lucide-react";
import EstadoBadge from "./EstadoBadge";
import { formatCurrency, formatFecha } from "../formatters";

/*
 * Layout, espaciado y tipografía en CSS propio (no dependen de Tailwind) y grid con
 * container queries: responde al ancho real de la lista, no al de la ventana.
 * Sin superficie propia: la tarjeta glass la pone el contenedor de la página.
 * Una sola lista continua; el "resaltado" de cada fila es solo hover/focus, no una card.
 */
const ESTILOS = `
.lc-root { container-type: inline-size; width: 100%; }
.lc-list { padding: 6px; }

/* ── Fila (móvil por defecto) ── */
.lc-row {
    position: relative; display: grid; width: 100%; box-sizing: border-box;
    grid-template-columns: minmax(0,1fr) auto; column-gap: 12px; row-gap: 8px; align-items: center;
    padding: 14px 16px; border: 0; border-radius: 16px; text-align: left; font: inherit; color: inherit;
    background: transparent; cursor: pointer;
    transition: background .18s ease, box-shadow .18s ease, transform .12s ease;
}
.lc-row + .lc-row::before {
    content: ""; position: absolute; top: -1px; left: 16px; right: 16px; height: 1px;
    background: rgba(120,53,15,0.08);
}
.lc-row::after {
    content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px;
    border-radius: 0 3px 3px 0; background: #fb923c; opacity: 0; transition: opacity .18s ease;
}
.lc-row:hover {
    background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,247,237,0.75));
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.95), 0 8px 20px -14px rgba(234,88,12,0.45);
}
.lc-row:hover::after { opacity: 1; }
.lc-row:active { transform: scale(0.996); }
.lc-row:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(255,255,255,0.95), 0 0 0 4px rgba(251,146,60,0.55); }
.lc-row:focus-visible::after { opacity: 1; }

.lc-fecha { grid-column: 1; grid-row: 1; min-width: 0; }
.lc-fecha-top { display: flex; align-items: center; gap: 7px; }
.lc-fecha-ico { color: #a8a29e; flex-shrink: 0; }
.lc-fecha-txt { font-size: 15px; font-weight: 600; color: #292524; text-transform: capitalize; line-height: 1.25; }
.lc-firma { margin-top: 2px; font-size: 12px; color: #78716c; }
.lc-firma-vacia { color: #a8a29e; }

.lc-monto { grid-column: 1; grid-row: 2; font-size: 18px; font-weight: 700; color: #292524;
    font-variant-numeric: tabular-nums; letter-spacing: -0.01em; line-height: 1.2; }
.lc-monto-vacio { color: #a8a29e; font-weight: 500; }

.lc-meta { grid-column: 1; grid-row: 3; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.lc-estado { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.lc-reab { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; color: #c2410c; white-space: nowrap; }
.lc-int { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #78716c;
    font-variant-numeric: tabular-nums; white-space: nowrap; }
.lc-int svg { color: #a8a29e; }

.lc-chev { grid-column: 2; grid-row: 1 / span 3; color: #a8a29e; display: block;
    transition: transform .18s ease, color .18s ease; }
.lc-row:hover .lc-chev { transform: translateX(3px); color: #f97316; }

.lc-head { display: none; }

/* ── Tablet: monto a la derecha de la fecha ── */
@container (min-width: 560px) {
    .lc-row { grid-template-columns: minmax(0,1fr) auto 20px; column-gap: 16px; padding: 14px 18px; }
    .lc-monto { grid-column: 2; grid-row: 1; text-align: right; }
    .lc-meta { grid-column: 1 / 3; grid-row: 2; }
    .lc-chev { grid-column: 3; grid-row: 1 / span 2; }
}

/* ── Escritorio: columnas alineadas de arriba a abajo ── */
@container (min-width: 860px) {
    .lc-list { --lc-cols: minmax(0,1fr) 130px 240px 96px 20px; }
    .lc-row { grid-template-columns: var(--lc-cols); column-gap: 16px; row-gap: 0; padding: 13px 18px; }
    .lc-fecha, .lc-monto, .lc-chev { grid-column: auto; grid-row: auto; }
    .lc-meta { display: contents; }
    .lc-int { justify-self: start; }
    .lc-head { display: grid; grid-template-columns: var(--lc-cols); column-gap: 16px; padding: 6px 18px 8px; }
    .lc-head span { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #a8a29e; }
    .lc-head span:nth-child(2) { text-align: right; }
}

/* ── Vacío ── */
.lc-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 44px 24px;
    animation: lc-fade .35s ease-out backwards; }
.lc-empty-ico { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
    color: #f97316; background: rgba(255,247,237,0.9); border: 1px solid rgba(253,186,116,0.6);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9); margin-bottom: 12px; }
.lc-empty-t { font-size: 16px; font-weight: 700; color: #44403c; }
.lc-empty-d { margin-top: 4px; font-size: 13px; color: #78716c; max-width: 260px; line-height: 1.4; }
@keyframes lc-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
    .lc-row, .lc-row::after, .lc-chev { transition: none; }
    .lc-empty { animation: none; }
}
`;

export default function ListaCortes({ cortes, onSelect }) {
    if (cortes.length === 0) {
        return (
            <div className="lc-root">
                <style>{ESTILOS}</style>
                <div className="lc-empty">
                    <div className="lc-empty-ico">
                        <FileSearch size={20} aria-hidden="true" />
                    </div>
                    <div className="lc-empty-t">Sin cortes</div>
                    <div className="lc-empty-d">
                        No hay cortes que coincidan con los filtros actuales.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="lc-root">
            <style>{ESTILOS}</style>
            <div className="lc-list">
                <div className="lc-head" aria-hidden="true">
                    <span>Fecha / capturista</span>
                    <span>Monto</span>
                    <span>Estado</span>
                    <span>Intentos</span>
                    <span />
                </div>

                {cortes.map((c) => (
                    <button
                        type="button"
                        key={c.uuid}
                        onClick={() => onSelect(c.uuid)}
                        className="lc-row"
                    >
                        <div className="lc-fecha">
                            <div className="lc-fecha-top">
                                <CalendarDays
                                    size={14}
                                    className="lc-fecha-ico"
                                    aria-hidden="true"
                                />
                                <span className="lc-fecha-txt">
                                    {formatFecha(c.fecha)}
                                </span>
                            </div>
                            <div
                                className={`lc-firma${c.firma_capturista ? "" : " lc-firma-vacia"}`}
                            >
                                {c.firma_capturista
                                    ? `Firmó: ${c.firma_capturista}`
                                    : "Sin firma"}
                            </div>
                        </div>

                        <div
                            className={`lc-monto${c.monto_sistema != null ? "" : " lc-monto-vacio"}`}
                        >
                            {c.monto_sistema != null
                                ? formatCurrency(c.monto_sistema)
                                : "—"}
                        </div>

                        <div className="lc-meta">
                            <div className="lc-estado">
                                <EstadoBadge estado={c.estado} />
                                {c.reabierto_at && (
                                    <span className="lc-reab">
                                        <RotateCcw
                                            size={12}
                                            aria-hidden="true"
                                        />
                                        Reabierto
                                    </span>
                                )}
                            </div>
                            <div className="lc-int">
                                <History size={13} aria-hidden="true" />
                                <span>
                                    {c.intentos_count}{" "}
                                    {c.intentos_count === 1
                                        ? "intento"
                                        : "intentos"}
                                </span>
                            </div>
                        </div>

                        <ChevronRight
                            size={18}
                            className="lc-chev"
                            aria-hidden="true"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}
