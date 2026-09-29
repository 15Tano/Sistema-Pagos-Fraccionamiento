import { useEffect, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import DesgloseJornada from "./DesgloseJornada";

// Fase "coincide" del conteo ciego: el conteo del capturista coincidió con
// monto_sistema. Muestra el check, el count-up, el desglose con stagger, y
// finalmente el paso de firma que cierra la caja (fase -> "sellado").
//
// Layout en islas: izquierda = desglose (ocupa las dos filas); derecha =
// conciliación arriba + firma abajo. En móvil colapsan a una sola columna
// respetando el orden narrativo Conciliado -> Revisado -> Sellado.
//
// Props:
//   desglose        — objeto { ordinario, especiales, extraordinario, ventasTags, total, ... }
//   ultimoResultado — objeto que devuelve useCorteCaja().ultimoResultado
//                     (usa ultimoResultado.monto_sistema)
//   onCerrar        — cerrar(firma) del hook useCorteCaja
export default function ResultadoCoincide({
    desglose,
    resultado: ultimoResultado,
    onCerrar,
}) {
    const monto = ultimoResultado?.monto_sistema ?? 0;
    const [montoMostrado, setMontoMostrado] = useState(0);
    const [mostrarDesglose, setMostrarDesglose] = useState(false);
    const [mostrarFirma, setMostrarFirma] = useState(false);
    const [firma, setFirma] = useState("");
    const [firmaEnfocada, setFirmaEnfocada] = useState(false);
    const [cerrando, setCerrando] = useState(false);

    // Count-up (misma matemática de siempre) + pequeña pausa antes de
    // revelar el desglose, para que la revelación se sienta deliberada.
    useEffect(() => {
        let frame;
        let pausaTimeout;
        const inicio = performance.now();
        const duracionMs = 900;

        const tick = (ahora) => {
            const progreso = Math.min((ahora - inicio) / duracionMs, 1);
            const easeOut = 1 - Math.pow(1 - progreso, 3);
            setMontoMostrado(monto * easeOut);
            if (progreso < 1) {
                frame = requestAnimationFrame(tick);
            } else {
                pausaTimeout = setTimeout(() => setMostrarDesglose(true), 260);
            }
        };

        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(pausaTimeout);
        };
    }, [monto]);

    // La firma (momento "sellado") entra después del desglose, no junto con él.
    useEffect(() => {
        if (!mostrarDesglose) return;
        const t = setTimeout(() => setMostrarFirma(true), 380);
        return () => clearTimeout(t);
    }, [mostrarDesglose]);

    const formatCurrency = (valor) =>
        new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
        }).format(valor);

    const handleCerrar = async () => {
        const nombre = firma.trim();
        if (!nombre || cerrando) return;
        setCerrando(true);
        try {
            await onCerrar(nombre);
        } catch {
            setCerrando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-400/30 backdrop-blur-xl p-4 overflow-y-auto">
            <div className="relative w-full max-w-3xl lg:max-w-4xl my-auto py-4">
                <div className="absolute inset-x-10 top-1/4 h-56 bg-orange-500/20 blur-[80px] rounded-full pointer-events-none" />

                <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] lg:grid-rows-[auto_auto] gap-4 lg:gap-5">
                    {/* Isla: desglose (izquierda, ocupa ambas filas en desktop) */}
                    {mostrarDesglose && (
                        <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2 rounded-[28px] bg-white/[0.06] border border-white/12 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_25px_70px_-25px_rgba(0,0,0,0.65)] p-6 lg:p-7 animate-seccion-in">
                            <p className="text-[13px] font-medium tracking-[0.15em] text-white/80 uppercase mb-4">
                                Desglose de la jornada
                            </p>
                            <DesgloseJornada desglose={desglose} />
                        </div>
                    )}

                    {/* Isla: conciliación (derecha, arriba) */}
                    <div className="order-1 lg:order-none lg:col-start-2 lg:row-start-1 rounded-[28px] bg-white/[0.07] border border-white/15 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_25px_70px_-25px_rgba(0,0,0,0.7)] px-7 py-8 flex flex-col items-center text-center animate-modal-in">
                        <p className="text-[11px] font-medium tracking-[0.15em] text-white/80 uppercase">
                            Cierre de jornada
                        </p>
                        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-orange-500/45 border border-orange-400/50 px-3 py-1 text-[11px] font-medium text-orange-100">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Conciliado
                        </span>

                        <div className="mt-6">
                            <CheckSellado />
                        </div>
                        <p className="mt-5 text-lg font-bold text-white">
                            Efectivo conciliado
                        </p>
                        <p className="mt-1.5 text-sm text-white/65 max-w-[28ch]">
                            El monto declarado coincide con el registro del
                            sistema.
                        </p>
                        <p
                            className="mt-5 text-4xl sm:text-5xl font-black tabular-nums text-orange-500"
                            style={{
                                textShadow: "0 0 40px rgba(251,146,60,0.25)",
                            }}
                        >
                            {formatCurrency(montoMostrado)}
                        </p>
                    </div>

                    {/* Isla: firma / sellado (derecha, abajo) */}
                    {mostrarFirma && (
                        <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-2 rounded-[28px] bg-white/[0.07] border border-white/15 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_25px_70px_-25px_rgba(0,0,0,0.7)] p-6 lg:p-7 animate-seccion-in">
                            <p className="text-sm font-semibold text-white">
                                Sellar jornada
                            </p>
                            <p className="mt-1 text-xs text-white/65">
                                Ingresa tu nombre para confirmar y cerrar esta
                                caja.
                            </p>

                            <label htmlFor="firma-cierre" className="sr-only">
                                Nombre completo de quien firma
                            </label>
                            <div
                                className={`mt-4 rounded-2xl border bg-white/[0.04] backdrop-blur-md transition-all duration-300 ${
                                    firmaEnfocada
                                        ? "border-orange-400/50 shadow-[0_0_0_4px_rgba(251,146,60,0.12)] bg-white/[0.06]"
                                        : "border-white/15"
                                }`}
                            >
                                <input
                                    id="firma-cierre"
                                    type="text"
                                    value={firma}
                                    onChange={(e) => setFirma(e.target.value)}
                                    onFocus={() => setFirmaEnfocada(true)}
                                    onBlur={() => setFirmaEnfocada(false)}
                                    placeholder="Tu nombre completo"
                                    autoFocus
                                    className="w-full bg-transparent px-4 py-3.5 text-white placeholder-white/50 outline-none"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleCerrar}
                                disabled={!firma.trim() || cerrando}
                                className="group mt-4 w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-orange-500 text-white font-semibold shadow-[0_10px_28px_-10px_rgba(249,115,22,0.6)] transition-all duration-200 hover:bg-orange-600 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:saturate-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
                            >
                                {cerrando ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sellando jornada...
                                    </>
                                ) : (
                                    <>
                                        Firmar y cerrar caja
                                        <Lock className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes modal-in {
                    from { opacity: 0; transform: translateY(8px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-modal-in {
                    animation: modal-in 450ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes seccion-in {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-seccion-in {
                    animation: seccion-in 400ms ease-out both;
                }
                @keyframes check-pop {
                    0% { opacity: 0; transform: scale(0.82); }
                    60% { opacity: 1; transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                .animate-check-pop {
                    animation: check-pop 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes check-draw {
                    to { stroke-dashoffset: 0; }
                }
            `}</style>
        </div>
    );
}

function CheckSellado() {
    return (
        <div className="relative flex items-center justify-center animate-check-pop">
            <div className="absolute w-16 h-16 rounded-full bg-orange-500 blur-3xl" />
            <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                fill="none"
                className="relative"
            >
                <circle
                    cx="32"
                    cy="32"
                    r="29"
                    fill="rgba(255,255,255,0.05)"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="1.5"
                />
                <circle
                    cx="32"
                    cy="32"
                    r="29"
                    fill="none"
                    stroke="rgba(251,146,60,0.55)"
                    strokeWidth="1.5"
                />
                <path
                    d="M20 33 L28 41 L44 22"
                    stroke="#f27e05"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength="1"
                    strokeDasharray="1"
                    strokeDashoffset="1"
                    style={{
                        animation:
                            "check-draw 0.55s cubic-bezier(0.65,0,0.35,1) 0.3s forwards",
                    }}
                />
            </svg>
        </div>
    );
}
