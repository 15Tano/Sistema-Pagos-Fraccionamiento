import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, CreditCard, ShieldCheck, X } from "lucide-react";
import { displayReading, eventPresentation, neighborText } from "../model";
import { DisplayScanner, DisplaySeal } from "./DisplaySeal";
import DisplayAtmosphere from "./DisplayAtmosphere";
import { useDisplayReading } from "../hooks/useDisplayReading";

const STATUS_PULSE = { opacity: [.6, 1, .6], scale: [1, 1.22, 1] };
const STILL_STATUS = { opacity: 1, scale: 1 };

export default function ReadingDisplay({ row: latest, now, door, ready, recovering = false, catchingUp, onClose }) {
    const reducedMotion = useReducedMotion();
    const row = useDisplayReading(latest, now, door, ready, catchingUp);
    const outcome = eventPresentation(row?.event_code);
    const displayReason = row ? "shown" : recovering ? "catching_up" : !ready ? "not_ready" : catchingUp ? "catching_up" : !latest ? "empty"
        : latest.door_id !== door ? "other_door" : !displayReading(latest, now, { door, ready, catchingUp }) ? "freshness_or_non_tag" : "awaiting_commit";
    const label = door === "2" ? "Salida" : "Entrada";
    const active = ready && !catchingUp;
    const idleTitle = ready ? "Presente su tag" : recovering ? "Actualizando lecturas" : "Solicite apoyo a vigilancia";
    const idleMessage = ready ? "Su lectura aparecerá aquí." : recovering ? "Espere un momento." : "Las lecturas no están actualizadas.";
    const success = row?.event_code === 0;
    const greeting = success ? door === "2" ? "¡Hasta pronto!" : "¡Bienvenido a casa!"
        : row?.event_code === 20 ? "Una lectura a la vez" : "Estamos para ayudarte";
    const textEntrance = reducedMotion ? false : { opacity: .6, y: 8 };
    const textTransition = { duration: reducedMotion ? 0 : .35, ease: "easeOut" };
    const maskEntrance = reducedMotion ? false : { y: "110%" };
    const maskTransition = (delay) => ({ duration: reducedMotion ? 0 : .8, delay: reducedMotion ? 0 : delay, ease: [.22, 1, .36, 1] });
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
    return createPortal(<section role="dialog" aria-modal="true" aria-label={`Pantalla de ${label.toLowerCase()}`} className={`ac-display ac-result-${row ? outcome.tone : "idle"}`}
        data-ac-display-latest={latest?.id} data-ac-display-reason={displayReason}>
        <button autoFocus type="button" className="ac-display-close" onClick={onClose} aria-label="Cerrar modo pantalla" aria-pressed={true}><X size={19} /></button>
        <DisplayAtmosphere reducedMotion={reducedMotion} />
        <header className="ac-display-header"><div className="ac-display-brand"><ShieldCheck size={20} /><span>SAN ISIDRO</span></div>
            <span className="ac-display-door">{door === "2" ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}{label}</span></header>
        <div className="ac-display-stage"><Motion.div key={row?.id || (ready ? "idle" : recovering ? "recovering" : "offline")}
            className={`ac-display-body ac-display-scene ${row ? "ac-scene-has-reading" : "ac-scene-waiting"}`}
            data-ac-reading={row?.id} data-ac-surface="display"
            initial={reducedMotion ? false : { y: row ? 32 : 8, z: row ? -100 : 0, rotateX: row ? 10 : 0, scale: row ? .9 : 1, filter: row ? "blur(8px)" : "blur(0px)" }}
            animate={{ y: 0, z: 0, rotateX: 0, scale: 1, filter: "blur(0px)" }}
            transition={reducedMotion ? { duration: 0 } : row ? { type: "spring", damping: 24, stiffness: 160, mass: 1.4, filter: { duration: .55, ease: [.22, 1, .36, 1] } } : { duration: .4, ease: "easeOut" }}>
            {row ? <>
                {!reducedMotion && <div className="ac-scene-sheen-clip" aria-hidden="true"><Motion.div className="ac-scene-sheen"
                    initial={{ x: "-160%", rotate: -15 }} animate={{ x: "260%", rotate: -15 }}
                    transition={{ duration: 1.35, ease: "easeOut" }} /></div>}
                <div className="ac-scene-reading-content">
                    <DisplaySeal kind={outcome.icon} reducedMotion={reducedMotion} />
                    <div className="ac-scene-copy">
                        <p className="ac-scene-greeting ac-text-mask"><Motion.span initial={maskEntrance} animate={{ y: "0%" }} transition={maskTransition(.1)}>{greeting}</Motion.span></p>
                        <h1 className="ac-text-mask" aria-live="polite" aria-atomic="true"><Motion.span initial={maskEntrance} animate={{ y: "0%" }} transition={maskTransition(.2)}>{neighborText(row)}</Motion.span></h1>
                        <Motion.p className="ac-display-result ac-scene-result" initial={textEntrance} animate={{ opacity: 1, y: 0 }} transition={textTransition}><span />{outcome.title}</Motion.p>
                        <div className="ac-scene-details"><div className="ac-tag-pill"><CreditCard size={18} />Tag {row.card_no}</div>
                            <span className="ac-scene-direction">{door === "2" ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}{label}</span></div>
                        <Motion.p className="ac-display-message" initial={textEntrance} animate={{ opacity: 1, y: 0 }} transition={textTransition}>{outcome.message}</Motion.p>
                    </div>
                </div>
            </> : <div className="ac-scene-wait-content">
                <DisplayScanner active={active} reducedMotion={reducedMotion} />
                {active && <p className="ac-scene-eyebrow">{door === "2" ? "Nos vemos pronto" : "Tu hogar te espera"}</p>}
                <Motion.h1 initial={textEntrance} animate={{ opacity: 1, y: 0 }} transition={textTransition}>{idleTitle}</Motion.h1>
                <Motion.p className="ac-display-message" initial={textEntrance} animate={{ opacity: 1, y: 0 }} transition={textTransition}>{idleMessage}</Motion.p>
            </div>}
            {row && <div className="ac-display-duration" aria-hidden="true" />}
        </Motion.div></div>
        <div className={`ac-display-footer ${active ? "ac-display-system-active" : ""}`} role="status" aria-live="polite" aria-atomic="true">
            <Motion.span key={active ? "active" : "inactive"} className="ac-display-status-dot" aria-hidden="true"
                initial={reducedMotion ? false : STILL_STATUS} animate={active && !reducedMotion ? STATUS_PULSE : STILL_STATUS}
                transition={active && !reducedMotion ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} />
            {active ? "Sistema activo" : recovering || catchingUp && ready ? "Actualizando lecturas" : "Sin datos recientes"}
        </div>
    </section>, document.body);
}
