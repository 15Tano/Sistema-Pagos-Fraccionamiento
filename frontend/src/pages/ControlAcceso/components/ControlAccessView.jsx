import { useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, ArrowRight, Building2, ChevronDown, Clock3,
    CreditCard, History, Info, Pause, Play, Radio, RefreshCw, Search, ShieldCheck, Unplug, X } from "lucide-react";
import { ageText, cycleLabel, deviceText, reporting, utcText } from "../model";
import "../control-acceso.css";

function Badge({ tone = "neutral", children }) {
    return <span className={`ac-badge ac-tone-${tone}`}><span aria-hidden="true" />{children}</span>;
}
function Door({ row }) {
    const label = row?.door_label;
    const Icon = label === "Entrada" ? ArrowDownLeft : label === "Salida" ? ArrowUpRight : ArrowRight;
    return <span className={`ac-door ${label === "Entrada" ? "ac-entry" : label === "Salida" ? "ac-exit" : ""}`}>
        <Icon size={16} />{label || (row?.door_id ? `Puerta ${row.door_id}` : "Puerta sin dato")}
    </span>;
}
const cardText = (row) => row?.card_no && row.card_no !== "0" ? row.card_no : "Sin tag";
function StateCard({ icon, label, value, detail, tone = "neutral" }) {
    const Icon = icon;
    return <div className="glass-card ac-stat"><div className={`ac-stat-icon ac-tone-${tone}`}><Icon size={19} /></div>
        <div><p className="ac-overline">{label}</p><p className="ac-stat-value">{value}</p><p className="ac-stat-detail">{detail}</p></div></div>;
}

export default function ControlAccessView({ monitor, filters, onFilters, navigation }) {
    const [draft, setDraft] = useState("");
    const [inputError, setInputError] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const agent = monitor.agents.find((a) => a.agent_id === monitor.agentId);
    const selected = monitor.rows.find((r) => r.id === selectedId) || monitor.rows[0];
    const pinned = selectedId && selected?.id === selectedId;
    const [reportLabel, reportTone] = reporting(agent, monitor.now);
    const cycle = monitor.error || !monitor.online || !monitor.automatic ? "Sin confirmar" : cycleLabel(agent, monitor.now);
    const captureAge = selected ? monitor.now - Date.parse(selected.captured_ended_utc) : NaN;
    const staleReading = !Number.isFinite(captureAge) || captureAge > 90000 || captureAge < -30000;
    const live = monitor.automatic && monitor.online && !monitor.error && reportTone === "good";
    const statusTone = monitor.error || !monitor.online ? "warning" : !monitor.automatic ? "neutral" : reportTone;
    const readerLabels = { catching_up: "Recuperando lecturas", status_observed: "Estado recibido", paused: "Pausado", unknown: "Sin confirmar" };
    const pending = agent?.sender?.pending_count;
    const search = (e) => {
        e.preventDefault(); const value = draft.trim();
        if (value && !/^[0-9]{1,32}$/.test(value)) { setInputError("Escribe un número de tag de hasta 32 dígitos."); return; }
        setInputError(""); setSelectedId(null); onFilters({ card: value });
    };
    return <div className="acceso-monitor">
        <header className="ac-heading">
            <div>{navigation}<p className="ac-overline ac-accent">SAN ISIDRO · CASETA</p><h1>Control de acceso</h1>
                <p className="ac-subtitle">Lecturas y estado de operación, en un solo lugar.</p></div>
            <div className="ac-heading-actions"><Badge tone={statusTone}>{!monitor.online ? "Sin conexión" : monitor.error ? "Sin actualizar" :
                !monitor.automatic ? "Seguimiento pausado" : live ? "Reportes recientes" : "Actualización automática"}</Badge>
                <button className="ac-icon-button" type="button" onClick={monitor.refresh} disabled={monitor.busy || !monitor.automatic || !monitor.online}
                    aria-label="Actualizar consulta" title="Actualizar consulta"><RefreshCw size={18} className={monitor.busy ? "ac-spinning" : ""} /></button></div>
        </header>

        {monitor.error && <div className="ac-notice" role="alert"><Unplug size={19} /><div><strong>La consulta necesita atención</strong><p>{monitor.error.text}</p></div>
            {monitor.automatic && <button type="button" className="ac-text-button" onClick={monitor.refresh} disabled={monitor.busy}>Reintentar</button>}</div>}
        {!monitor.online && !monitor.error && <div className="ac-notice" role="status"><Unplug size={18} />Tu equipo está sin conexión. Las lecturas mostradas pueden estar atrasadas.</div>}

        <div className="glass-card ac-toolbar">
            <label className="ac-caseta"><Building2 size={19} /><span><span className="ac-overline">Caseta</span>
                <select aria-label="Seleccionar caseta" value={monitor.agentId} onChange={(e) => { setSelectedId(null); onFilters({ agentId: e.target.value }); }}>
                    {!monitor.agents.length && <option value="">{monitor.loading ? "Consultando casetas…" : "Sin casetas disponibles"}</option>}
                    {monitor.agents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name} · {a.device_serial}</option>)}
                </select></span><ChevronDown size={16} /></label>
            <div className="ac-toolbar-right"><span className="ac-muted">Solo consulta</span><button className="ac-follow-button" type="button"
                aria-pressed={monitor.automatic} onClick={() => monitor.setAutomatic(!monitor.automatic)}>
                {monitor.automatic ? <Pause size={15} /> : <Play size={15} />}{monitor.automatic ? "Pausar seguimiento" : "Reanudar seguimiento"}</button></div>
        </div>
        {monitor.truncated && <p className="ac-muted">La lista de casetas es parcial. Solicita a administración la caseta que necesitas consultar.</p>}

        <section className="ac-stats" aria-label="Estado reportado de la caseta">
            <StateCard icon={Radio} label="Reportes de caseta" value={!monitor.automatic ? "Consulta pausada" : monitor.error || !monitor.online ? "Sin actualizar" : agent ? reportLabel : "Sin datos"} detail={agent?.received_at_utc ? ageText(agent.received_at_utc, monitor.now) : "Aún no se recibe información"} tone={monitor.error || !monitor.online ? "warning" : !monitor.automatic ? "neutral" : reportTone} />
            <StateCard icon={ShieldCheck} label="Sincronización de vigencias" value={cycle} detail={agent?.vigencias?.last_ok_utc ? `Último ciclo correcto: ${utcText(agent.vigencias.last_ok_utc)}` : "Sin ciclo confirmado"} tone={cycle === "Al día" && !monitor.error ? "good" : "neutral"} />
            <StateCard icon={Activity} label="Lector del controlador" value={!live ? "Sin confirmar" : readerLabels[agent?.reader?.state] || "Sin información"} detail={agent?.reader?.checked_at_utc ? `Reporte: ${utcText(agent.reader.checked_at_utc)}` : "Pendiente de un reporte"} />
            <StateCard icon={History} label="Envíos pendientes" value={pending == null ? "Sin datos" : pending === 0 ? "Sin pendientes" : `${pending} pendientes`} detail={pending > 0 ? ageText(agent.sender.oldest_pending_at_utc, monitor.now) : "Según el último reporte recibido"} tone={pending > 0 ? "warning" : "neutral"} />
        </section>

        <section className="ac-workspace">
            <div className="glass-card ac-feed">
                <div className="ac-feed-heading"><div><p className="ac-overline">ACTIVIDAD DEL CONTROLADOR</p><h2>Lecturas recibidas</h2></div>
                    <span className="ac-count">{monitor.rows.length} en lista</span></div>
                <div className="ac-filters">
                    <div className="ac-door-tabs" role="group" aria-label="Filtrar por pluma">
                        {[['', 'Todas'], ['1', agent?.device_serial === 'CO2K225060027' ? 'Entrada' : 'Puerta 1'], ['2', agent?.device_serial === 'CO2K225060027' ? 'Salida' : 'Puerta 2']].map(([value, label]) =>
                            <button key={label} type="button" aria-pressed={filters.door === value} className={filters.door === value ? "ac-active" : ""}
                                onClick={() => { setSelectedId(null); onFilters({ door: value }); }}>{label}</button>)}
                    </div>
                    <form className="ac-search" onSubmit={search}><Search size={17} /><input value={draft} onChange={(e) => setDraft(e.target.value)}
                        aria-label="Buscar número de tag" placeholder="Buscar número de tag" inputMode="numeric" maxLength={32} />
                        {draft && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setDraft(""); setInputError(""); onFilters({ card: "" }); }}><X size={15} /></button>}
                        <button type="submit">Buscar</button></form>
                </div>
                {inputError && <p className="ac-input-error" role="alert">{inputError}</p>}
                <div className="ac-feed-options"><label>Origen <select aria-label="Origen de las lecturas" value={filters.source} onChange={(e) => { setSelectedId(null); onFilters({ source: e.target.value }); }}>
                    <option value="rt">Lecturas del controlador</option><option value="transaction">Historial del controlador</option><option value="all">Todos los registros</option></select></label>
                    {monitor.catchingUp ? <span>Recuperando lecturas pendientes…</span> : filters.card ? <span>Tag {filters.card}</span> : <span>Orden de recepción</span>}</div>

                {!monitor.rows.length ? <div className="ac-empty" role="status"><CreditCard size={32} />
                    <h3>{monitor.loading && monitor.automatic ? "Consultando lecturas…" : monitor.error ? "No hay lecturas para mostrar" : !monitor.automatic ? "Seguimiento pausado" : !monitor.agentId ? "Aún no hay una caseta registrada" : "Sin lecturas para esta consulta"}</h3>
                    <p>{!monitor.automatic ? "Reanuda el seguimiento para consultar esta selección." : "Las lecturas aparecerán aquí cuando la caseta las entregue y coincidan con tus filtros."}</p></div>
                    : <div className="ac-table-wrap"><table className="ac-table"><thead><tr><th>Tag / tarjeta</th><th>Pluma</th><th>Hora del equipo</th><th>Evento</th><th><span className="sr-only">Detalle</span></th></tr></thead>
                        <tbody>{monitor.rows.map((row) => <tr key={row.id} className={selected?.id === row.id ? "ac-selected" : ""}>
                            <td><button className="ac-row-link" type="button" aria-label={`Consultar lectura ${row.id}, tag ${cardText(row)}`} onClick={() => setSelectedId(row.id)}>{cardText(row)}</button>
                                <span className="ac-row-note">Recibido {ageText(row.received_at_utc, monitor.now).toLowerCase()}</span></td>
                            <td><Door row={row} /></td><td className="ac-device-time">{deviceText(row.device_time_raw)}<span className="ac-row-note">{row.source === "transaction" ? "Historial" : "Lectura del controlador"}</span></td>
                            <td><span className="ac-event-code">Código {row.event_code}</span></td><td><button className="ac-row-detail" type="button" onClick={() => setSelectedId(row.id)} aria-label={`Ver detalle de lectura ${row.id}`}><ArrowRight size={17} /></button></td>
                        </tr>)}</tbody></table></div>}
                <div className="ac-feed-footer"><span>{monitor.rows.length >= 400 ? "Se muestran hasta 400 lecturas. Acota los filtros para consultar otro rango." : "Se conservan las lecturas repetidas del controlador."}</span>
                    {monitor.olderMore && monitor.rows.length < 400 && <button className="ac-text-button" type="button" onClick={monitor.loadOlder} disabled={monitor.olderLoading || !monitor.online}>{monitor.olderLoading ? "Consultando…" : "Ver anteriores"}</button>}</div>
            </div>

            <aside className="ac-reading-column" aria-label="Detalle de lectura">
                <div className="glass-card ac-reading"><div className="ac-reading-title"><span className="ac-overline">{pinned ? "LECTURA SELECCIONADA" : "ÚLTIMA LECTURA EN LISTA"}</span><CreditCard size={20} /></div>
                    {selected ? <><p className="ac-tag-caption">Tag / tarjeta</p><p className={`ac-big-tag ${cardText(selected).length > 14 ? "ac-long-tag" : ""}`}>{cardText(selected)}</p>
                        <Door row={selected} /><div className="ac-reading-time"><Clock3 size={16} /><span>{deviceText(selected.device_time_raw)}<small>Hora reportada por el equipo</small></span></div>
                        {(staleReading || monitor.error || !monitor.automatic || !monitor.online) && <p className="ac-reading-note">Lectura conservada. No indica actividad actual de la caseta.</p>}
                        <dl className="ac-detail-list"><div><dt>Código de evento</dt><dd>{selected.event_code}</dd></div><div><dt>Puerta reportada</dt><dd>{selected.door_id ?? "Sin dato"}</dd></div>
                            <div><dt>Sentido reportado</dt><dd>{selected.direction ?? "Sin dato"}</dd></div><div><dt>Verificación reportada</dt><dd>{selected.verification ?? "Sin dato"}</dd></div>
                            <div><dt>Captura en caseta</dt><dd>{utcText(selected.captured_ended_utc)}</dd></div><div><dt>Recepción en servidor</dt><dd>{utcText(selected.received_at_utc)}</dd></div></dl>
                        {pinned && <button type="button" className="ac-text-button ac-return-latest" onClick={() => setSelectedId(null)}>Volver a la última lectura <ArrowRight size={15} /></button>}
                    </> : <div className="ac-reading-placeholder"><CreditCard size={38} /><p>Selecciona una lectura para consultar su detalle.</p></div>}
                </div>
                <div className="ac-explanation"><Info size={18} /><p>Los registros son eventos del controlador. Una lectura no confirma el paso físico de un vehículo.</p></div>
            </aside>
        </section>
        <footer className="ac-page-footer"><span><span className="ac-tiny-dot" />Vista de consulta · sin acciones sobre las plumas</span><span>Captura y recepción mostradas en hora de Ciudad de México.</span></footer>
    </div>;
}
