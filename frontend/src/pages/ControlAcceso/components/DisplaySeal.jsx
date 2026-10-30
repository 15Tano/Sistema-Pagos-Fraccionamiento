import { motion as Motion } from "framer-motion";
import { CircleHelp, CreditCard, Repeat2 } from "lucide-react";

const PARTICLES = [
    { x: -70, y: -104, startX: -39, startY: 20, duration: 1.9 },
    { x: 82, y: -115, startX: 46, startY: 37, duration: 2.1 },
    { x: -104, y: -61, startX: -48, startY: 46, duration: 2.25 },
    { x: 103, y: -57, startX: 52, startY: 54, duration: 1.85 },
    { x: 18, y: -130, startX: 8, startY: 6, duration: 2.35 },
];

// Sello exclusivo del display: no comparte el trazo CSS de la tarjeta del guardia.
export function DisplaySeal({ kind, reducedMotion }) {
    const success = kind === "check";
    const Icon = kind === "repeat" ? Repeat2 : CircleHelp;
    return <Motion.div className="ac-display-seal" aria-hidden="true" initial={reducedMotion ? false : { scale: 1 }}
        animate={{ scale: success && !reducedMotion ? [1, 1.02, 1] : 1 }}
        transition={{ duration: reducedMotion ? 0 : .5, delay: reducedMotion ? 0 : .78, ease: "easeInOut" }}>
        <Motion.div className="ac-seal-halo" initial={reducedMotion ? false : { scale: .9, opacity: .55 }}
            animate={success && !reducedMotion ? { scale: [.9, 1.08, 1], opacity: [.55, .95, .7] } : { scale: 1, opacity: .7 }}
            transition={{ duration: reducedMotion ? 0 : 2.4, ease: "easeInOut" }} />
        <Motion.div className="ac-seal-orbit" initial={reducedMotion ? false : { rotate: 0 }} animate={reducedMotion ? { rotate: 0 } : { rotate: 360 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 15, repeat: Infinity, ease: "linear" }}><span /></Motion.div>
        {success && !reducedMotion && <Motion.svg className="ac-seal-laser" viewBox="0 0 208 208" fill="none"
            initial={{ rotate: -90, scale: .92, opacity: 0 }}
            animate={{ rotate: 270, scale: [.92, 1.04, 1.1], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.25, delay: .45, ease: [.22, 1, .36, 1], opacity: { duration: 1.25, delay: .45, times: [0, .12, .72, 1] } }}>
            <circle cx="104" cy="104" r="95" stroke="#a9d6b7" strokeWidth=".7" />
            <circle className="ac-laser-beam" cx="104" cy="104" r="95" pathLength="1" stroke="#73b68e" strokeWidth="2.5" strokeDasharray=".3 .7" strokeLinecap="round" />
            <circle cx="199" cy="104" r="2.8" fill="#fff9e3" />
        </Motion.svg>}
        {success && !reducedMotion && [0, 1, 2].map((wave) => <Motion.span key={wave} className="ac-seal-wave"
            initial={{ scale: .85, opacity: 0 }} animate={{ scale: [.85, 1.45, 2.45], opacity: [0, .7, 0] }}
            transition={{ duration: 2.15, delay: .35 + wave * .23, ease: [.16, 1, .3, 1] }} />)}
        <Motion.div className="ac-seal-core" initial={reducedMotion ? false : { scale: .55, opacity: .5 }} animate={{ scale: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 235, damping: 14, mass: .8 }}>
            <div className="ac-seal-core-reflection" />
            {success ? <svg className="ac-seal-check" viewBox="0 0 80 80" fill="none">
                <Motion.path d="M19 41 L33 55 L61 26" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
                    initial={reducedMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: reducedMotion ? 0 : .65, delay: reducedMotion ? 0 : .18, ease: [.16, 1, .3, 1] }} />
                {!reducedMotion && <Motion.g className="ac-check-glint" initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, .65, 0] }} transition={{ duration: .62, delay: .8, times: [0, .2, .42, 1] }}>
                    <circle cx="61" cy="26" r="4.5" fill="#fff7dc" />
                    <path d="M61 16 L62.5 24.5 L71 26 L62.5 27.5 L61 36 L59.5 27.5 L51 26 L59.5 24.5 Z" fill="white" />
                </Motion.g>}
            </svg> : <Icon className="ac-seal-symbol" strokeWidth={2} />}
        </Motion.div>
        {success && !reducedMotion && PARTICLES.map((particle, index) => <Motion.span key={index} className="ac-seal-particle"
            initial={{ x: particle.startX, y: particle.startY, opacity: 0, scale: .2 }}
            animate={{ x: [particle.startX, particle.x * .8, particle.x], y: [particle.startY, particle.y * .45, particle.y], opacity: [0, .9, 0], scale: [.2, 1, .15] }}
            transition={{ duration: particle.duration, delay: .55 + index * .12, ease: [.22, 1, .36, 1] }} />)}
    </Motion.div>;
}

export function DisplayScanner({ active, reducedMotion }) {
    return <div className={`ac-display-scanner ${active ? "ac-scanner-active" : ""}`} aria-hidden="true">
        <Motion.div className="ac-scanner-orbit" initial={reducedMotion ? false : { rotate: -20 }} animate={reducedMotion ? { rotate: -20 } : { rotate: 340 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 14, repeat: Infinity, ease: "linear" }}><span /></Motion.div>
        <div className="ac-scanner-core"><CreditCard size={58} strokeWidth={1.3} />
            {active && <Motion.span className="ac-scanner-line" initial={reducedMotion ? false : { y: -24, opacity: .2 }}
                animate={reducedMotion ? { y: 0, opacity: .5 } : { y: [-24, 24, -24], opacity: [.2, .85, .2] }}
                transition={reducedMotion ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }} />}
        </div>
    </div>;
}
