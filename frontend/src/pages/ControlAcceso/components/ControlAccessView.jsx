import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Clock3, CloudCheck, CreditCard, Pause, Play, Radio, RefreshCw, Repeat2, ShieldCheck, Wifi } from "lucide-react";
import { ageText, cycleLabel, deviceText, displayStatus, eventPresentation, neighborText, reporting, timeText, utcText } from "../model";
import ReadingCard from "./ReadingCard";
import ReadingDisplay from "./ReadingDisplay";
import ReadingFilters from "./ReadingFilters";
import "../control-acceso.css";

function Stat({ icon, label, value, detail, tone = "neutral" }) {
    const Icon = icon;
    return <div className={"ac-stat ac-stat-" + tone}><span className="ac-stat-icon"><Icon size={18} /></span>
        <div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></div>;
}

function FeedRow({ row, index, expanded, onToggle }) {
    const outcome = eventPresentation(row.event_code);
    const Icon = row.event_code === 0 ? Check : row.event_code === 20 ? Repeat2 : CreditCard;
    const Direction = row.door_id === "2" ? ArrowUpRight : ArrowDownLeft;
    return <li className={"ac-feed-item ac-result-" + outcome.tone} data-ac-reading={row.id} data-ac-surface="feed" style={{ "--ac-index": Math.min(index, 5) }}>
        <button type="button" className="ac-feed-row" onClick={onToggle} aria-expanded={expanded} aria-controls={expanded ? `ac-feed-detail-${row.id}` : undefined} aria-label={"Detalle de lectura de " + neighborText(row) + ", tag " + row.card_no}>
            <span className="ac-feed-icon"><Icon size={18} /></span>
            <span className="ac-feed-person"><strong>{neighborText(row)}</strong><span>Tag {row.card_no || "sin número"} <span aria-hidden="true">·</span> <span className="ac-row-result">{outcome.short}</span></span></span>
            <span className="ac-feed-end"><span><Direction size={12} />{row.door_label || "Puerta sin identificar"}</span><time>{timeText(row.captured_ended_utc)}</time></span>
            <ChevronDown size={13} className={expanded ? "ac-chevron-open" : ""} />
        </button>
        {expanded && <dl className="ac-feed-detail" id={`ac-feed-detail-${row.id}`}><div><dt>Hora del equipo</dt><dd>{deviceText(row.device_time_raw)}</dd></div>
            <div><dt>Evento del controlador</dt><dd>{row.event_code} · {outcome.title}</dd></div><div><dt>Origen</dt><dd>{row.source === "transaction" ? "Historial del controlador" : "Lectura del controlador"}</dd></div>
            <div><dt>Recibido por la app</dt><dd>{utcText(row.received_at_utc)}</dd></div><div><dt>Nombre</dt><dd>Asociación actual del tag</dd></div></dl>}
    </li>;
}

export default function ControlAccessView({ monitor, gate, onGate, history, historyActive, filters, onFilters, canViewHistory = false, adminSettings, displayMode, onDisplay, onCloseDisplay, displayHref }) {
    const [expandedId, setExpandedId] = useState(null);
    const agent = monitor.agents.find((a) => a.agent_id === monitor.agentId);
    const [reportLabel, reportTone] = reporting(agent, monitor.now);
    const locked = monitor.error?.clear || history.error?.clear;
    const current = !locked ? monitor.rows.find((row) => row.card_no && row.card_no !== "0") : null;
    const online = monitor.online && !monitor.error && reportTone === "good";
    const cycle = online && monitor.automatic ? cycleLabel(agent, monitor.now) : "Sin confirmar";
    const knownGate = agent?.device_serial === "CO2K225060027";
    const readerReady = agent?.reader?.state === "status_observed";
    const displayState = displayStatus({ available: online && monitor.automatic && knownGate && !locked && !monitor.loading,
        readerState: agent?.reader?.state, catchingUp: monitor.catchingUp });
    const pending = agent?.sender?.pending_count;
    const rows = locked ? [] : historyActive ? history.rows : monitor.rows;
    const busy = historyActive ? history.loading : monitor.loading;
    const error = monitor.error || historyActive && history.error;
    const more = historyActive ? history.more : monitor.olderMore && rows.length < 400;
    if (displayMode) return <ReadingDisplay door={displayMode} ready={displayState === "ready"} recovering={displayState === "recovering"}
        row={current} now={monitor.now} catchingUp={monitor.catchingUp} onClose={onCloseDisplay} />;

    return <div className="acceso-monitor">
        {error && <div className="ac-notice" role="alert"><Wifi size={19} /><p>{error.text}</p><button type="button" onClick={() => { monitor.refresh(); history.refresh(); }}>Reintentar</button></div>}
        {!monitor.online && !error && <div className="ac-notice" role="status">Sin internet. Conservamos las últimas lecturas recibidas.</div>}
        <div className={`ac-console ${canViewHistory ? "" : "ac-console-current-only"}`}>
            <ReadingCard row={current} now={monitor.now} gate={gate} onGate={onGate} onDisplay={onDisplay} displayHref={displayHref} paused={!monitor.automatic} live={online && monitor.automatic} />
            {canViewHistory && <section className="ac-feed glass-card" aria-label="Lecturas recibidas">
                <header className="ac-feed-heading"><div><p className="ac-eyebrow">Actividad reciente</p><h2>Lecturas recibidas</h2></div><span className="ac-count">{rows.length}</span></header>
                <ReadingFilters filters={filters} onFilters={onFilters} busy={busy} />
                {historyActive && <div className="ac-search-note"><span>{online && monitor.automatic ? "Resultados guardados · La última lectura sigue en vivo" : "Consulta de lecturas guardadas"}</span><button type="button" onClick={history.refresh} disabled={busy || !monitor.online}>Actualizar resultados</button></div>}
                {rows.length ? <ul className="ac-feed-list">{rows.map((row, index) => <FeedRow key={row.id} row={row} index={index} expanded={expandedId === row.id} onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)} />)}</ul>
                    : <div className="ac-empty" role="status"><CreditCard size={30} /><h3>{busy ? "Buscando lecturas…" : "Sin lecturas para mostrar"}</h3><p>{historyActive ? "Pruebe con otro nombre, tag o rango de fechas." : "Las nuevas lecturas aparecerán aquí."}</p></div>}
                <footer className="ac-feed-footer"><span>{monitor.catchingUp && !historyActive ? "Recuperando lecturas…" : rows.length >= 400 ? "Hasta 400 registros por consulta" : "Más recientes primero"}</span>
                    {more && <button type="button" onClick={historyActive ? history.older : monitor.loadOlder} disabled={busy || monitor.olderLoading || !monitor.online}>{busy || monitor.olderLoading ? "Consultando…" : "Ver anteriores"}</button>}</footer>
            </section>}
        </div>
        <section className="ac-system-section" aria-label="Estado de lecturas de acceso">
        <div className="ac-page-heading"><div><h2>Lecturas de acceso</h2><p><span className={"ac-tiny-dot " + (online && monitor.automatic ? "ac-online-dot" : "")} />
            {!monitor.online ? "Sin conexión a internet" : !monitor.automatic ? "Seguimiento pausado" : monitor.error ? "Sin actualizar" : reportTone === "good" ? "Actualización automática" : reportLabel}</p></div>
            <div className="ac-heading-controls"><button type="button" className="ac-icon-button" disabled={monitor.busy || !monitor.online || !monitor.automatic}
                onClick={() => { monitor.refresh(); if (historyActive) history.refresh(); }} aria-label="Actualizar lecturas"><RefreshCw size={17} className={monitor.busy ? "ac-spinning" : ""} /></button>
                <button type="button" className="ac-icon-button" onClick={() => monitor.setAutomatic(!monitor.automatic)} aria-label={monitor.automatic ? "Pausar seguimiento" : "Reanudar seguimiento"} aria-pressed={!monitor.automatic} title={monitor.automatic ? "Pausar seguimiento" : "Reanudar seguimiento"}>{monitor.automatic ? <Pause size={17} /> : <Play size={17} />}</button></div>
        </div>
        <section className="ac-stats glass-card" aria-label="Estado del sistema">
            <Stat icon={Wifi} label="Conexión" value={!monitor.automatic ? "En pausa" : online ? "Recibiendo datos" : "Sin actualizar"}
                detail={agent?.received_at_utc ? ageText(agent.received_at_utc, monitor.now) : "Esperando información"} tone={online && monitor.automatic ? "good" : "neutral"} />
            <Stat icon={ShieldCheck} label="Vigencias de tags" value={cycle === "Al día" ? "Actualizadas" : ["Con errores", "Sin ciclo reciente"].includes(cycle) ? "Revisar" : cycle}
                detail="Fechas de acceso de los tags" tone={cycle === "Al día" ? "good" : "neutral"} />
            <Stat icon={Radio} label="Lector de tags" value={!online || !monitor.automatic ? "Sin confirmar" : readerReady ? "En espera" : agent?.reader?.state === "catching_up" ? "Recuperando" : agent?.reader?.state === "paused" ? "En pausa" : "Sin confirmar"}
                detail={readerReady && online ? "Estado recibido" : "Según último reporte"} tone={readerReady && online && monitor.automatic ? "good" : "neutral"} />
            <Stat icon={CloudCheck} label="Envío de lecturas" value={pending == null ? "Sin datos" : pending === 0 ? "Todo enviado" : pending + " pendientes"}
                detail="Según último reporte" tone={pending > 0 ? "warning" : "neutral"} />
        </section>
        </section>
        {adminSettings}
        <details className="ac-system-detail"><summary><Clock3 size={13} />Información del sistema</summary><p>Las vigencias indican la sincronización de fechas; no el estado de pago del tag mostrado. Los nombres corresponden a la asociación actual en la app.</p>
            <p>Último ciclo correcto: {utcText(agent?.vigencias?.last_ok_utc)}. Captura y recepción en hora de Ciudad de México; hora del equipo sin convertir.</p></details>
    </div>;
}
