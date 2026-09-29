import { Filter, Search, RotateCcw, ChevronDown } from "lucide-react";

/*
 * Layout y tipografía en CSS propio (no dependen de Tailwind) y grid con container queries:
 * responde al ancho REAL de la barra, no al de la ventana.
 * Sin superficie propia: la tarjeta glass la pone el contenedor de la página.
 */
const ESTILOS = `
.fc-root { container-type: inline-size; width: 100%; }
.fc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.fc-title { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #78716c; }
.fc-icon-accent { color: #f97316; flex-shrink: 0; }
.fc-pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 9999px;
    font-size: 10.5px; font-weight: 700; color: #c2410c;
    background: rgba(255,237,213,0.9); border: 1px solid rgba(253,186,116,0.8); }
.fc-pill i { width: 6px; height: 6px; border-radius: 9999px; background: #f97316; display: block; }

.fc-grid { display: grid; grid-template-columns: minmax(0,1fr); gap: 12px; align-items: end; }
@container (min-width: 520px) {
    .fc-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .fc-btn { grid-column: 1 / -1; }
}
@container (min-width: 900px) {
    .fc-grid { grid-template-columns: repeat(3, minmax(0,1fr)) minmax(0,1.35fr) auto; }
    .fc-btn { grid-column: auto; }
}

label.fc-label { display: block; margin: 0 0 6px 2px; font-size: 10.5px; font-weight: 700; line-height: 1.2;
    letter-spacing: .12em; text-transform: uppercase; color: #78716c; }
.fc-field { position: relative; }
.fc-ico { position: absolute; top: 50%; transform: translateY(-50%); color: #a8a29e; pointer-events: none; }
.fc-ico-l { left: 12px; }
.fc-ico-r { right: 12px; }

.fc-input { box-sizing: border-box; width: 100%; height: 40px; padding: 0 12px; border-radius: 12px;
    font-size: 14px; color: #44403c; color-scheme: light;
    background: rgba(255,255,255,0.7); border: 1px solid rgba(214,211,209,0.8);
    box-shadow: inset 0 1px 2px rgba(120,53,15,0.05);
    transition: background .18s ease, border-color .18s ease, box-shadow .18s ease; }
.fc-input::placeholder { color: #a8a29e; }
.fc-input:hover { background: rgba(255,255,255,0.92); border-color: rgba(168,162,158,0.8); }
.fc-input:focus { outline: none; background: #fff; border-color: #fb923c; box-shadow: 0 0 0 3px rgba(251,146,60,0.2); }
.fc-input.fc-activo { background: rgba(255,247,237,0.9); border-color: rgba(251,146,60,0.55); }
.fc-pl { padding-left: 36px; }
.fc-pr { padding-right: 36px; appearance: none; -webkit-appearance: none; cursor: pointer; }

.fc-btn { box-sizing: border-box; height: 40px; padding: 0 16px; border-radius: 12px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 14px; font-weight: 600; white-space: nowrap; color: #57534e;
    background: rgba(255,255,255,0.7); border: 1px solid rgba(214,211,209,0.8);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
    transition: background .18s ease, border-color .18s ease, color .18s ease, transform .12s ease; }
.fc-btn:hover { background: rgba(255,255,255,0.97); border-color: rgba(168,162,158,0.8); color: #292524; }
.fc-btn:active { transform: translateY(1px) scale(0.98); }
.fc-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(251,146,60,0.3); }
.fc-btn svg { transition: transform .3s ease; }
.fc-btn:hover svg { transform: rotate(-180deg); }
@media (prefers-reduced-motion: reduce) {
    .fc-input, .fc-btn, .fc-btn svg { transition: none; }
}
`;

export default function FiltrosCortes({ filtros, onChange, onLimpiar }) {
    // Derivado solo de `filtros`, sin estado nuevo
    const activos = [
        filtros.desde,
        filtros.hasta,
        filtros.estado,
        filtros.firma,
    ].filter(Boolean).length;
    const marca = (v) => (v ? " fc-activo" : "");

    return (
        <div className="fc-root">
            <style>{ESTILOS}</style>

            <div className="fc-head">
                <Filter
                    size={13}
                    className="fc-icon-accent"
                    aria-hidden="true"
                />
                <h3 className="fc-title">Filtrar cortes</h3>
                {activos > 0 && (
                    <span className="fc-pill">
                        <i aria-hidden="true" />
                        {activos === 1 ? "1 activo" : `${activos} activos`}
                    </span>
                )}
            </div>

            <div className="fc-grid">
                <div>
                    <label htmlFor="filtro-desde" className="fc-label">
                        Desde
                    </label>
                    <input
                        id="filtro-desde"
                        type="date"
                        className={`fc-input${marca(filtros.desde)}`}
                        value={filtros.desde}
                        onChange={(e) => onChange("desde", e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="filtro-hasta" className="fc-label">
                        Hasta
                    </label>
                    <input
                        id="filtro-hasta"
                        type="date"
                        className={`fc-input${marca(filtros.hasta)}`}
                        value={filtros.hasta}
                        onChange={(e) => onChange("hasta", e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="filtro-estado" className="fc-label">
                        Estado
                    </label>
                    <div className="fc-field">
                        <select
                            id="filtro-estado"
                            className={`fc-input fc-pr${marca(filtros.estado)}`}
                            value={filtros.estado}
                            onChange={(e) => onChange("estado", e.target.value)}
                        >
                            <option value="">Todos</option>
                            <option value="cuadrado">Cuadrado</option>
                            <option value="cerrado_con_diferencia">
                                Con diferencia
                            </option>
                            <option value="en_proceso">En proceso</option>
                        </select>
                        <ChevronDown
                            size={15}
                            className="fc-ico fc-ico-r"
                            aria-hidden="true"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="filtro-firma" className="fc-label">
                        Capturista
                    </label>
                    <div className="fc-field">
                        <Search
                            size={15}
                            className="fc-ico fc-ico-l"
                            aria-hidden="true"
                        />
                        <input
                            id="filtro-firma"
                            type="text"
                            aria-label="Firma del capturista"
                            className={`fc-input fc-pl${marca(filtros.firma)}`}
                            placeholder="Buscar por nombre…"
                            value={filtros.firma}
                            onChange={(e) => onChange("firma", e.target.value)}
                        />
                    </div>
                </div>

                <button type="button" onClick={onLimpiar} className="fc-btn">
                    <RotateCcw size={14} aria-hidden="true" />
                    Limpiar filtros
                </button>
            </div>
        </div>
    );
}
