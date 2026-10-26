import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Clock3, CloudCheck, CreditCard, ListFilter, Pause, Play, Radio, RefreshCw, Repeat2, Search, ShieldCheck, Wifi, X } from "lucide-react";
import { ageText, cycleLabel, deviceText, eventPresentation, neighborText, reporting, timeText, utcText } from "../model";
import ReadingCard from "./ReadingCard";
import ReadingDisplay from "./ReadingDisplay";
import "../control-acceso.css";

function Stat({ icon, label, value, detail, tone = "neutral" }) {
    const Icon = icon;
    return <div className={"ac-stat ac-stat-" + tone}><span className="ac-stat-icon"><Icon size={18} /></span>
        <div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></div>;
}

function FeedRow({ row, expanded, onToggle }) {
    const outcome = eventPresentation(row.event_code);
    const Icon = row.event_code === 0 ? Check : row.event_code === 20 ? Repeat2 : CreditCard;
    const Direction = row.door_id === "2" ? ArrowUpRight : ArrowDownLeft;
    return <li className={"ac-feed-item ac-result-" + outcome.tone}>
        <button type="button" className="ac-feed-row" onClick={onToggle} aria-expanded={expanded} aria-label={"Detalle de lectura de " + neighborText(row) + ", tag " + row.card_no}>
            <span className="ac-feed-icon"><Icon size={18} /></span>
            <span className="ac-feed-person"><strong>{neighborText(row)}</strong><span>Tag {row.card_no || "sin número"} <span aria-hidden="true">·</span> <span className="ac-row-result">{outcome.short}</span></span></span>
            <span className="ac-feed-end"><span><Direction size={12} />{row.door_label || "Puerta sin identificar"}</span><time>{timeText(row.captured_ended_utc)}</time></span>
            <ChevronDown size={13} className={expanded ? "ac-chevron-open" : ""} />
        </button>
        {expanded && <dl className="ac-feed-detail"><div><dt>Hora del equipo</dt><dd>{deviceText(row.device_time_raw)}</dd></div>
            <div><dt>Evento del controlador</dt><dd>{row.event_code} · {outcome.title}</dd></div><div><dt>Origen</dt><dd>{row.source === "transaction" ? "Historial del controlador" : "Lectura del controlador"}</dd></div>
            <div><dt>Recibido por la app</dt><dd>{utcText(row.received_at_utc)}</dd></div><div><dt>Nombre</dt><dd>Asociación actual del tag</dd></div></dl>}
    </li>;
}

export default function ControlAccessView({ monitor, gate, onGate, history, historyActive, filters, onFilters, displayMode, onDisplay, onCloseDisplay, displayHref }) {
    const [draft, setDraft] = useState("");
    const [inputError, setInputError] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const agent = monitor.agents.find((a) => a.agent_id === monitor.agentId);
    const [reportLabel, reportTone] = reporting(agent, monitor.now);
    const locked = monitor.error?.clear || history.error?.clear;
    const current = !locked ? monitor.rows.find((row) => row.card_no && row.card_no !== "0") : null;
    const online = monitor.online && !monitor.error && reportTone === "good";
    const cycle = online && monitor.automatic ? cycleLabel(agent, monitor.now) : "Sin confirmar";
    const knownGate = agent?.device_serial === "CO2K225060027";
    const readerReady = agent?.reader?.state === "status_observed";
    const ready = online && monitor.automatic && knownGate && readerReady && !locked && !monitor.loading;
    const pending = agent?.sender?.pending_count;
    const rows = locked ? [] : historyActive ? history.rows : monitor.rows;
    const busy = historyActive ? history.loading : monitor.loading;
    const error = monitor.error || historyActive && history.error;
    const more = historyActive ? history.more : monitor.olderMore && rows.length < 400;
    const search = (event) => {
        event.preventDefault(); const value = draft.trim();
        if (value && !/^[0-9]{1,32}$/.test(value)) { setInputError("Escriba el número del tag, hasta 32 dígitos."); return; }
        setInputError(""); setExpandedId(null); onFilters({ card: value });
    };
    if (displayMode) return <ReadingDisplay door={displayMode} ready={ready}
        row={current} now={monitor.now} catchingUp={monitor.catchingUp} onClose={onCloseDisplay} />;

    return <div className="acceso-monitor">
        <div className="ac-page-heading"><div><h2>Lecturas de acceso</h2><p><span className={"ac-tiny-dot " + (online && monitor.automatic ? "ac-online-dot" : "")} />
            {!monitor.online ? "Sin conexión a internet" : !monitor.automatic ? "Seguimiento pausado" : monitor.error ? "Sin actualizar" : reportTone === "good" ? "Actualización automática" : reportLabel}</p></div>
            <div className="ac-heading-controls"><button type="button" className="ac-icon-button" disabled={monitor.busy || !monitor.online || !monitor.automatic}
                onClick={() => { monitor.refresh(); if (historyActive) history.refresh(); }} aria-label="Actualizar lecturas"><RefreshCw size={17} className={monitor.busy ? "ac-spinning" : ""} /></button>
                <button type="button" className="ac-icon-button" onClick={() => monitor.setAutomatic(!monitor.automatic)} aria-label={monitor.automatic ? "Pausar seguimiento" : "Reanudar seguimiento"} aria-pressed={!monitor.automatic} title={monitor.automatic ? "Pausar seguimiento" : "Reanudar seguimiento"}>{monitor.automatic ? <Pause size={17} /> : <Play size={17} />}</button></div>
        </div>
        {error && <div className="ac-notice" role="alert"><Wifi size={19} /><p>{error.text}</p><button type="button" onClick={() => { monitor.refresh(); history.refresh(); }}>Reintentar</button></div>}
        {!monitor.online && !error && <div className="ac-notice" role="status">Sin internet. Conservamos las últimas lecturas recibidas.</div>}
        <section className="ac-stats glass-card" aria-label="Estado del sistema">
            <Stat icon={Wifi} label="Comunicación" value={!monitor.automatic ? "En pausa" : online ? "Reportando" : "Sin actualizar"}
                detail={agent?.received_at_utc ? ageText(agent.received_at_utc, monitor.now) : "Esperando información"} tone={online && monitor.automatic ? "good" : "neutral"} />
            <Stat icon={ShieldCheck} label="Vigencias de tags" value={cycle === "Al día" ? "Actualizadas" : ["Con errores", "Sin ciclo reciente"].includes(cycle) ? "Revisar" : cycle}
                detail="Sincronización de fechas" tone={cycle === "Al día" ? "good" : "neutral"} />
            <Stat icon={Radio} label="Lector de tags" value={!online || !monitor.automatic ? "Sin confirmar" : readerReady ? "En espera" : agent?.reader?.state === "catching_up" ? "Recuperando" : agent?.reader?.state === "paused" ? "En pausa" : "Sin confirmar"}
                detail={readerReady && online ? "Estado recibido" : "Según último reporte"} tone={readerReady && online && monitor.automatic ? "good" : "neutral"} />
            <Stat icon={CloudCheck} label="Datos por enviar" value={pending == null ? "Sin datos" : pending === 0 ? "Todo enviado" : pending + " registros"}
                detail="Según último reporte" tone={pending > 0 ? "warning" : "neutral"} />
        </section>
        <div className="ac-console">
            <ReadingCard row={current} now={monitor.now} gate={gate} onGate={onGate} onDisplay={onDisplay} displayHref={displayHref} paused={!monitor.automatic} />
            <section className="ac-feed glass-card" aria-label="Lecturas recibidas">
                <header className="ac-feed-heading"><div><p className="ac-eyebrow">Actividad reciente</p><h2>Lecturas recibidas</h2></div><span className="ac-count">{rows.length}</span></header>
                <form className="ac-search" onSubmit={search}><Search size={17} /><input aria-label="Buscar número de tag" placeholder="Buscar un tag" inputMode="numeric" maxLength={32} value={draft} onChange={(e) => setDraft(e.target.value)} />
                    {draft && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setDraft(""); setInputError(""); onFilters({ card: "" }); }}><X size={15} /></button>}<button type="submit">Buscar</button></form>
                {inputError && <p role="alert" className="ac-input-error">{inputError}</p>}
                <div className="ac-history-options"><span>{gate === "1" ? "Entrada" : gate === "2" ? "Salida" : "Entrada y salida"}{filters.card ? " · Tag " + filters.card : ""}</span>
                    <details><summary><ListFilter size={13} />Opciones</summary><label>Mostrar <select aria-label="Origen de las lecturas" value={filters.source} onChange={(e) => onFilters({ source: e.target.value })}><option value="rt">Lecturas recientes</option><option value="transaction">Historial del controlador</option><option value="all">Ambos orígenes</option></select></label></details></div>
                {historyActive && <div className="ac-search-note"><span>Consulta de registros guardados</span><button type="button" onClick={history.refresh} disabled={busy || !monitor.online}>Actualizar resultados</button></div>}
                {rows.length ? <ul className="ac-feed-list">{rows.map((row) => <FeedRow key={row.id} row={row} expanded={expandedId === row.id} onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)} />)}</ul>
                    : <div className="ac-empty" role="status"><CreditCard size={30} /><h3>{busy ? "Buscando lecturas…" : "Sin lecturas para mostrar"}</h3><p>{filters.card ? "Pruebe con otro número de tag." : "Las nuevas lecturas aparecerán aquí."}</p></div>}
                <footer className="ac-feed-footer"><span>{monitor.catchingUp && !historyActive ? "Recuperando lecturas…" : rows.length >= 400 ? "Hasta 400 registros por consulta" : "Más recientes primero"}</span>
                    {more && <button type="button" onClick={historyActive ? history.older : monitor.loadOlder} disabled={busy || monitor.olderLoading || !monitor.online}>{busy || monitor.olderLoading ? "Consultando…" : "Ver anteriores"}</button>}</footer>
            </section>
        </div>
        <details className="ac-system-detail"><summary><Clock3 size={13} />Información del sistema</summary><p>Las vigencias indican la sincronización de fechas; no el estado de pago del tag mostrado. Los nombres corresponden a la asociación actual en la app.</p>
            <p>Último ciclo correcto: {utcText(agent?.vigencias?.last_ok_utc)}. Captura y recepción en hora de Ciudad de México; hora del equipo sin convertir.</p></details>
    </div>;
}
