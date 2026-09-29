import { useEffect, useRef, useState } from "react";

const FILAS = [
    { key: "ordinario", label: "Cuotas ordinarias" },
    { key: "especiales", label: "Pagos especiales" },
    { key: "extraordinario", label: "Extraordinarios" },
    { key: "ventasTags", label: "Venta de tags" },
];

function formatCurrency(valor) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(valor ?? 0);
}

/**
 * Micro-pop del número cuando cambia su valor.
 * No hace un conteo desde $0: solo un "pop" de escala al detectar un cambio.
 */
function AnimatedAmount({ value, className = "" }) {
    const prevValue = useRef(value);
    const [animKey, setAnimKey] = useState(0);
    const hasMounted = useRef(false);

    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true;
            prevValue.current = value;
            return;
        }
        if (prevValue.current !== value) {
            prevValue.current = value;
            setAnimKey((k) => k + 1);
        }
    }, [value]);

    return (
        <span
            key={animKey}
            className={`inline-block tabular-nums ${
                animKey > 0 ? "dj-number-pop" : ""
            } ${className}`}
        >
            {formatCurrency(value)}
        </span>
    );
}

export default function DesgloseJornada({
    desglose,
    tituloFecha,
    stagger = true,
}) {
    if (!desglose) return null;

    // Header a los ~0ms, filas empiezan alrededor de los 550ms.
    const FIRST_ROW_DELAY = 550;
    const ROW_STEP = 90;
    const TOTAL_DELAY = 1000;

    return (
        <div className="relative">
            {/* Glow atmosférico exterior */}
            <div
                className="absolute -inset-3 rounded-[32px] blur-2xl pointer-events-none dj-glow-pulse"
                aria-hidden="true"
            />

            <div className="relative overflow-hidden rounded-[28px] bg-white/[0.62] backdrop-blur-2xl backdrop-saturate-150 border border-white/80 ring-1 ring-black/[0.025] shadow-[0_18px_55px_rgba(0,0,0,0.07)] px-5 py-5 dj-enter">
                {/* Highlight superior */}
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
                    aria-hidden="true"
                />

                {/* Gradientes translúcidos internos para sensación de vidrio */}
                <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-transparent"
                    aria-hidden="true"
                />
                <div
                    className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-orange-300/20 blur-3xl"
                    aria-hidden="true"
                />
                <div
                    className="pointer-events-none absolute -top-6 -left-8 h-24 w-24 rounded-full bg-white/40 blur-2xl"
                    aria-hidden="true"
                />

                {/* Scan tecnológico sutil */}
                <div
                    className="pointer-events-none absolute top-0 left-0 h-px w-1/3 dj-scan"
                    aria-hidden="true"
                />

                {/* Contenido */}
                <div className="relative">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 dj-dot-pulse" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.7)]" />
                                </span>
                                <p className="text-[11px] font-bold uppercase tracking-[0.19em] text-stone-400">
                                    Resumen de jornada
                                </p>
                            </div>
                            {tituloFecha ? (
                                <p className="mt-1 text-[11px] font-medium text-stone-400">
                                    {tituloFecha}
                                </p>
                            ) : null}
                        </div>

                        {/* Icono de recibo */}
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/50 border border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dj-fade-zoom"
                            style={{ animationDelay: "150ms" }}
                            aria-hidden="true"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-orange-500"
                            >
                                <path d="M6 2h9l3 3v17l-3-1.5-2.5 1.5L10 20.5 7.5 22 5 20.5 5 2z" />
                                <line x1="8.5" y1="7" x2="16.5" y2="7" />
                                <line x1="8.5" y1="11" x2="16.5" y2="11" />
                                <line x1="8.5" y1="15" x2="13" y2="15" />
                            </svg>
                        </div>
                    </div>

                    {/* Divider con highlight animado */}
                    <div className="relative mt-4 mb-3 h-px bg-stone-200/60 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-1/3 dj-divider-sweep" />
                    </div>

                    {/* Label conceptos */}
                    <div className="flex items-center justify-between px-2 mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-stone-400">
                            Conceptos
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-stone-400">
                            MXN
                        </span>
                    </div>

                    {/* Filas */}
                    <div>
                        {FILAS.map((fila, i) => (
                            <div
                                key={fila.key}
                                className="group relative flex items-center justify-between py-3 px-2 rounded-xl transition-colors duration-200 hover:bg-white/45 hover:shadow-[0_1px_4px_rgba(0,0,0,0.03)] dj-row-in"
                                style={
                                    stagger
                                        ? {
                                              animationDelay: `${
                                                  FIRST_ROW_DELAY + i * ROW_STEP
                                              }ms`,
                                              animationFillMode: "backwards",
                                          }
                                        : undefined
                                }
                            >
                                <span
                                    className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 -translate-x-1 rounded-full bg-orange-400/70 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                                    aria-hidden="true"
                                />
                                <span className="text-sm text-stone-500 transition-colors duration-200 group-hover:text-stone-700">
                                    {fila.label}
                                </span>
                                <AnimatedAmount
                                    value={desglose[fila.key]}
                                    className="text-sm font-semibold text-stone-700 group-hover:text-stone-900"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Divider previo al total */}
                    <div className="relative mt-2 mb-4 h-px bg-stone-200/60 overflow-hidden">
                        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-orange-400/50 to-transparent" />
                    </div>

                    {/* Total */}
                    <div
                        className="flex items-end justify-between px-2 dj-total-in"
                        style={{ animationDelay: `${TOTAL_DELAY}ms` }}
                    >
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-stone-500">
                                Total
                            </p>
                            <p className="mt-0.5 text-[11px] font-medium text-stone-500">
                                Efectivo registrado
                            </p>
                        </div>
                        <AnimatedAmount
                            value={desglose.total}
                            className="text-[21px] font-black text-stone-900 [text-shadow:0_1px_1px_rgba(0,0,0,0.04)]"
                        />
                    </div>
                </div>

                {/* Reflejo de vidrio inferior */}
                <div
                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white/35 to-transparent"
                    aria-hidden="true"
                />
            </div>

            {/*
                Estilos y keyframes propios del componente.
                Si tu proyecto centraliza animaciones en tailwind.config.js,
                puedes mover estos @keyframes ahí y sustituir las clases
                "dj-*" por utilidades de Tailwind equivalentes.
            */}
            <style>{`
                @keyframes dj-enter-kf {
                    from { opacity: 0; transform: scale(0.985); }
                    to { opacity: 1; transform: scale(1); }
                }
                .dj-enter {
                    animation: dj-enter-kf 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                @keyframes dj-glow-pulse-kf {
                    0%, 100% { opacity: 0.55; }
                    50% { opacity: 1; }
                }
                .dj-glow-pulse {
                    animation: dj-glow-pulse-kf 4s ease-in-out infinite;
                }

                @keyframes dj-dot-pulse-kf {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.8); opacity: 0; }
                }
                .dj-dot-pulse {
                    animation: dj-dot-pulse-kf 2.2s ease-in-out infinite;
                }

                @keyframes dj-fade-zoom-kf {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                .dj-fade-zoom {
                    animation: dj-fade-zoom-kf 350ms ease-out both;
                }

                @keyframes dj-row-in-kf {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .dj-row-in {
                    animation: dj-row-in-kf 350ms ease-out both;
                }

                @keyframes dj-total-in-kf {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .dj-total-in {
                    animation: dj-total-in-kf 500ms ease-out both;
                }

                @keyframes dj-number-pop-kf {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.045); }
                    100% { transform: scale(1); }
                }
                .dj-number-pop {
                    animation: dj-number-pop-kf 220ms ease-out;
                }

                @keyframes dj-scan-kf {
                    0% { opacity: 0; transform: translateX(-100%); }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { opacity: 0; transform: translateX(300%); }
                }
                .dj-scan {
                    background: linear-gradient(
                        to right,
                        transparent,
                        rgba(249, 115, 22, 0.55),
                        transparent
                    );
                    opacity: 0;
                    animation: dj-scan-kf 1.8s ease-in-out 250ms 1 both;
                }

                @keyframes dj-divider-sweep-kf {
                    0% { opacity: 0; transform: translateX(-120%); }
                    15% { opacity: 1; }
                    85% { opacity: 1; }
                    100% { opacity: 0; transform: translateX(320%); }
                }
                .dj-divider-sweep {
                    height: 100%;
                    background: linear-gradient(
                        to right,
                        transparent,
                        rgba(249, 115, 22, 0.5),
                        transparent
                    );
                    opacity: 0;
                    animation: dj-divider-sweep-kf 900ms ease-in-out 500ms 1 both;
                }

                @media (prefers-reduced-motion: reduce) {
                    .dj-enter,
                    .dj-glow-pulse,
                    .dj-dot-pulse,
                    .dj-fade-zoom,
                    .dj-row-in,
                    .dj-total-in,
                    .dj-number-pop,
                    .dj-scan,
                    .dj-divider-sweep {
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
