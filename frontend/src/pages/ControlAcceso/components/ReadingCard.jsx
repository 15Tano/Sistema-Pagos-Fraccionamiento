import { Check, CircleHelp, CreditCard, Maximize2, Repeat2 } from "lucide-react";
import { ageText, deviceText, eventPresentation, neighborText, utcText } from "../model";

export function OutcomeMark({ kind = "help" }) {
    const Icon = kind === "check" ? Check : kind === "repeat" ? Repeat2 : CircleHelp;
    return <div className="ac-outcome-mark" aria-hidden="true"><span /><div><Icon size={37} strokeWidth={2.6} /></div></div>;
}

export default function ReadingCard({ row, now, gate, onGate, onDisplay, displayHref, paused }) {
    const outcome = eventPresentation(row?.event_code);
    const door = row?.door_label || (gate === "1" ? "Entrada" : gate === "2" ? "Salida" : "");
    return <section className={`ac-hero glass-card ac-result-${row ? outcome.tone : "idle"}`} aria-label="Última lectura">
        <div className="ac-hero-top"><span className="ac-eyebrow">Última lectura</span>
            <button type="button" className="ac-expand" onClick={() => onDisplay(gate || row?.door_id || "1")} aria-pressed={false} title="Mostrar solo la última lectura en grande"><Maximize2 size={15} />Ampliar</button></div>
        <div className="ac-gates" role="group" aria-label="Pluma de la última lectura">
            {[["", "Todas"], ["1", "Entrada"], ["2", "Salida"]].map(([value, text]) => <button key={text} type="button" aria-pressed={gate === value} onClick={() => onGate(value)}>{text}</button>)}
        </div>
        <div key={row?.id || "empty"} className="ac-hero-content">
            {row ? <><OutcomeMark kind={outcome.icon} /><span className="ac-result-label">{outcome.title}</span>
                <h2 className="ac-resident-name">{neighborText(row)}</h2>
                <div className="ac-tag-pill"><CreditCard size={15} /><span>Tag {row.card_no || "sin número"}</span></div>
                <p className="ac-hero-message">{outcome.message}</p>
                <div className="ac-hero-meta"><span className="ac-gate-label">{door || "Puerta sin identificar"}</span><span>{ageText(row.captured_ended_utc, now)}</span></div>
            </> : <><div className="ac-empty-tag"><CreditCard size={34} /></div><h2 className="ac-resident-name">Esperando una lectura</h2><p className="ac-hero-message">Aquí aparecerá el último tag recibido.</p></>}
        </div>
        {paused && <p className="ac-kept-reading">Seguimiento pausado. Se conserva la última lectura.</p>}
        {row && <details className="ac-reading-details"><summary>Detalle de la lectura</summary><dl>
            <div><dt>Hora del equipo</dt><dd>{deviceText(row.device_time_raw)}</dd></div>
            <div><dt>Recibido</dt><dd>{utcText(row.received_at_utc)}</dd></div>
            <div><dt>Código del controlador</dt><dd>{row.event_code}</dd></div>
            <div><dt>Sentido / verificación</dt><dd>{row.direction ?? "—"} / {row.verification ?? "—"}</dd></div>
        </dl></details>}
        <details className="ac-display-links"><summary>Pantallas de entrada y salida</summary><p>Abra cada vista en su propia ventana y muévala al monitor correspondiente.</p>
            <div><a href={displayHref("1")} target="_blank" rel="noopener noreferrer">Pantalla de entrada ↗</a><a href={displayHref("2")} target="_blank" rel="noopener noreferrer">Pantalla de salida ↗</a></div>
        </details>
    </section>;
}
