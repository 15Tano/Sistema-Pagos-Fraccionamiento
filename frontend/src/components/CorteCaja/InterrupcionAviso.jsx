import { useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

// Fase "interrupcion": pantalla gráfica e imposible de ignorar que anuncia
// que la jornada de cobro terminó y el corte debe comenzar. Se muestra solo
// en el primerísimo intento del día (antes de declarar nada), y reaparece en
// cada refresh mientras siga sin haber intentos registrados. Avanza sola a
// los 10s, o al instante con un tap en cualquier parte de la tarjeta.
//
// MOTION DESIGN DE ENTRADA — una sola idea, no una colección de efectos:
// "un barrido de luz naranja atraviesa la pantalla y el nuevo estado (el
// corte de caja) queda revelado detrás de él". El fondo negro aparece de
// golpe (sin fade), el barrido cruza el viewport en ~400ms, la tarjeta se
// revela con clip-path (no hace scale-in), el ícono se "activa" con un
// combo de blur+rotate+scale, y el título se revela línea por línea con
// clip-path en vez de un translateY genérico. Todo resuelve en ~800ms.
//
// Props:
//   onContinuar — avanzarConteo() del hook useCorteCaja
export default function InterrupcionAviso({ onContinuar }) {
    const DURACION_MS = 15000;
    const [progreso, setProgreso] = useState(0); // 0 -> 1
    const avanzadoRef = useRef(false);

    const avanzar = () => {
        if (avanzadoRef.current) return;
        avanzadoRef.current = true;
        onContinuar();
    };

    useEffect(() => {
        let frame;
        const inicio = performance.now();

        const tick = (ahora) => {
            const t = Math.min((ahora - inicio) / DURACION_MS, 1);
            setProgreso(t);
            if (t < 1) {
                frame = requestAnimationFrame(tick);
            } else {
                avanzar();
            }
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const segundosRestantes = Math.max(0, Math.ceil((1 - progreso) * 10));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0704]/95 p-4 overflow-hidden">
            {/* Surge naranja — el "shock de color" que marca el cambio de etapa */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[60vmax] h-[60vmax] rounded-full animate-surge-flash bg-[radial-gradient(circle,rgba(249,115,22,0.55)_0%,rgba(249,115,22,0)_70%)]" />
            </div>

            {/* Ambiente de fondo — presencia constante, entrada mínima, no protagonista */}
            <div className="absolute -top-24 -left-20 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-orange-500/20 blur-[100px] animate-ambiente-in" />
            <div
                className="absolute -bottom-28 -right-16 w-80 h-80 sm:w-[26rem] sm:h-[26rem] rounded-full bg-orange-600/15 blur-[110px] animate-ambiente-in"
                style={{ animationDelay: "60ms" }}
            />

            {/* Barrido — la idea central: una línea de luz naranja atraviesa la pantalla */}
            <div
                className="absolute top-0 left-[-45vw] w-[45vw] h-full animate-barrido pointer-events-none"
                style={{
                    background:
                        "linear-gradient(100deg, transparent 0%, rgba(253,186,116,0.9) 45%, rgba(249,115,22,0.9) 55%, transparent 100%)",
                    filter: "blur(6px)",
                }}
            />

            {/* Tarjeta — se REVELA con clip-path, no hace scale-in */}
            <div
                onClick={avanzar}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter") avanzar();
                    if (e.key === " ") {
                        e.preventDefault();
                        avanzar();
                    }
                }}
                className="group relative z-10 w-full max-w-md cursor-pointer select-none rounded-[36px] bg-white/[0.08] border border-white/20 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_30px_90px_-20px_rgba(0,0,0,0.8)] p-9 sm:p-10 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-white/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70 animate-card-revela"
            >
                {/* Icono — se activa: blur + rotación + escala, no un simple scale-in */}
                <div
                    className="relative mx-auto flex items-center justify-center w-20 h-20 sm:w-[88px] sm:h-[88px] animate-icono-activa"
                    style={{ animationDelay: "260ms" }}
                >
                    <div className="absolute inset-0 rounded-full bg-orange-500/35 blur-xl animate-orb-respira" />
                    <div className="relative flex items-center justify-center w-full h-full rounded-[26px] bg-orange-500/25 border border-orange-500/50 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] transition-transform duration-300 group-hover:scale-[1.03]">
                        <LockKeyhole
                            className="w-9 h-9 text-orange-400"
                            strokeWidth={1.75}
                        />
                    </div>
                </div>

                {/* Eyebrow */}
                <div
                    className="mt-6 animate-secundario-in"
                    style={{ animationDelay: "380ms" }}
                >
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">
                        Cierre de jornada
                    </p>
                    <p className="mt-1.5 text-[11px] font-bold tracking-[0.15em] text-orange-400 uppercase">
                        Jornada de cobro finalizada
                    </p>
                </div>

                {/* Título — cada línea se REVELA con clip-path, no hace fade+translateY */}
                <h1 className="mt-4 text-2xl sm:text-3xl font-bold leading-tight text-white">
                    <div
                        className="animate-revela-linea"
                        style={{ animationDelay: "420ms" }}
                    >
                        La jornada terminó.
                    </div>
                    <div
                        className="animate-revela-linea"
                        style={{ animationDelay: "480ms" }}
                    >
                        Comienza el corte de caja.
                    </div>
                </h1>

                {/* Subtítulo + CTA */}
                <div
                    className="mt-5 flex flex-col items-center gap-4 animate-secundario-in"
                    style={{ animationDelay: "560ms" }}
                >
                    <p className="text-sm text-white/80 max-w-[32ch]">
                        Toca en cualquier parte para comenzar.
                    </p>

                    <span className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 pl-5 pr-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(249,115,22,0.6)] transition-all duration-200 group-hover:bg-orange-600 group-hover:translate-x-0.5">
                        Comenzar corte
                        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>

                    <p className="text-xs font-semibold text-white/65 tabular-nums">
                        {progreso >= 1
                            ? "Continuando…"
                            : `Continúa automáticamente en ${segundosRestantes} s`}
                    </p>
                </div>

                {/* Progreso */}
                <div
                    className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.12] animate-secundario-in"
                    style={{ animationDelay: "560ms" }}
                >
                    <div
                        className="h-full rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.7)] transition-[width] duration-100 ease-linear"
                        style={{ width: `${progreso * 100}%` }}
                    />
                </div>
            </div>

            <style>{`
                /* Surge naranja: aparece con fuerza y retrocede — un solo pulso, no decoración */
                @keyframes surge-flash {
                    0% { opacity: 0; transform: scale(0.3); }
                    35% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(1.3); }
                }
                .animate-surge-flash {
                    animation: surge-flash 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                /* Ambiente de fondo: entrada mínima, no compite con la idea principal */
                @keyframes ambiente-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-ambiente-in {
                    animation: ambiente-in 500ms ease-out both;
                }

                /* LA IDEA CENTRAL: el barrido de luz que atraviesa la pantalla */
                @keyframes barrido-mov {
                    0% { transform: translateX(0vw) skewX(-12deg); opacity: 0; }
                    10% { opacity: 1; }
                    100% { transform: translateX(220vw) skewX(-12deg); opacity: 0; }
                }
                .animate-barrido {
                    animation: barrido-mov 420ms cubic-bezier(0.19, 1, 0.22, 1) both;
                }

                /* La tarjeta se revela — no hace scale-in, queda descubierta por el barrido */
                @keyframes card-revela {
                    from { opacity: 0; clip-path: inset(0 100% 0 0); }
                    to { opacity: 1; clip-path: inset(0 0% 0 0); }
                }
                .animate-card-revela {
                    animation: card-revela 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
                    animation-delay: 90ms;
                }

                /* El ícono se activa: blur + rotación + escala combinados, no un simple scale */
                @keyframes icono-activa {
                    0% { opacity: 0; filter: blur(12px); transform: scale(0.6) rotate(-8deg); }
                    55% { opacity: 1; filter: blur(0px); transform: scale(1.12) rotate(2deg); }
                    100% { opacity: 1; filter: blur(0px); transform: scale(1) rotate(0deg); }
                }
                .animate-icono-activa {
                    animation: icono-activa 340ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                /* El título se revela línea por línea con clip-path, no con translateY */
                @keyframes revela-linea {
                    from { clip-path: inset(0 100% 0 0); }
                    to { clip-path: inset(0 0% 0 0); }
                }
                .animate-revela-linea {
                    animation: revela-linea 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                /* Contenido secundario (eyebrow, subtítulo, CTA, progreso): fade simple, sin protagonismo */
                @keyframes secundario-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-secundario-in {
                    animation: secundario-in 260ms ease-out both;
                }

                /* Respiración sutil y continua del glow del ícono — única animación que no termina */
                @keyframes orb-respira {
                    0%, 100% { opacity: 0.45; transform: scale(1); }
                    50% { opacity: 0.65; transform: scale(1.08); }
                }
                .animate-orb-respira {
                    animation: orb-respira 3200ms ease-in-out infinite;
                }

                @media (prefers-reduced-motion: reduce) {
                    .animate-surge-flash,
                    .animate-ambiente-in,
                    .animate-barrido,
                    .animate-card-revela,
                    .animate-icono-activa,
                    .animate-revela-linea,
                    .animate-secundario-in {
                        animation-duration: 1ms !important;
                        animation-delay: 0ms !important;
                        filter: none !important;
                        clip-path: inset(0 0% 0 0) !important;
                        transform: none !important;
                    }
                    .animate-barrido {
                        display: none !important;
                    }
                    .animate-orb-respira {
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
