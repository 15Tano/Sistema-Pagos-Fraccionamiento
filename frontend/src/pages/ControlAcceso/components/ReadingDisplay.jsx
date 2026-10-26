import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Radio, X } from "lucide-react";
import { eventPresentation, neighborText } from "../model";
import { OutcomeMark } from "./ReadingCard";
import { useDisplayReading } from "../hooks/useDisplayReading";

export default function ReadingDisplay({ row: latest, now, door, ready, catchingUp, onClose }) {
    const row = useDisplayReading(latest, now, door, ready, catchingUp);
    const outcome = eventPresentation(row?.event_code);
    const label = door === "2" ? "Salida" : "Entrada";
    useEffect(() => {
        const previous = document.body.style.overflow;
        const root = document.getElementById("root");
        const wasInert = root?.inert;
        const wasHidden = root?.hidden;
        let wasFullscreen = Boolean(document.fullscreenElement);
        if (root) { root.inert = true; root.hidden = true; }
        document.body.style.overflow = "hidden";
        const escape = (event) => { if (event.key === "Escape") onClose(); };
        const fullscreen = () => {
            if (document.fullscreenElement) wasFullscreen = true;
            else if (wasFullscreen) onClose();
        };
        document.addEventListener("keydown", escape);
        document.addEventListener("fullscreenchange", fullscreen);
        return () => {
            document.body.style.overflow = previous;
            if (root) { root.inert = wasInert; root.hidden = wasHidden; }
            document.removeEventListener("keydown", escape);
            document.removeEventListener("fullscreenchange", fullscreen);
            requestAnimationFrame(() => document.querySelector(".ac-expand")?.focus());
        };
    }, [onClose]);
    return createPortal(<section role="dialog" aria-modal="true" aria-label={`Pantalla de ${label.toLowerCase()}`} className={`ac-display ac-result-${row ? outcome.tone : "idle"}`}>
        <button autoFocus type="button" className="ac-display-close" onClick={onClose} aria-label="Cerrar modo pantalla" aria-pressed={true}><X size={19} /></button>
        <div className="ac-display-brand">SAN ISIDRO <span>{label}</span></div>
        <div key={row?.id || "idle"} className="ac-display-body">
            {row ? <><OutcomeMark kind={outcome.icon} /><p className="ac-display-result">{outcome.title}</p><h1>{neighborText(row)}</h1>
                <div className="ac-tag-pill"><CreditCard size={20} />Tag {row.card_no}</div><p className="ac-display-message">{outcome.message}</p></>
                : <><div className={`ac-waiting-mark ${ready ? "ac-waiting-active" : ""}`}><Radio size={59} strokeWidth={1.4} /></div>
                    <h1>{ready ? "Presente su tag" : "Solicite apoyo a vigilancia"}</h1>
                    <p className="ac-display-message">{ready ? "Su lectura aparecerá aquí." : "Las lecturas no están actualizadas."}</p></>}
        </div>
        <div className="ac-display-footer"><span className={`ac-tiny-dot ${ready ? "ac-online-dot" : ""}`} />{ready ? `Lector de ${label.toLowerCase()}` : "Esperando conexión"}</div>
    </section>, document.body);
}
