import { useState, useEffect, useMemo, useRef } from "react";

const COLORES_CONFETI = [
    "#f97316",
    "#fb923c",
    "#fbbf24",
    "#fde047",
    "#fdba74",
    "#f59e0b",
];

function generarConfeti(cantidad, radioBase) {
    return Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        angulo: (360 / cantidad) * i + (Math.random() * 25 - 12),
        distancia: radioBase + Math.random() * radioBase * 0.8,
        color: COLORES_CONFETI[i % COLORES_CONFETI.length],
        tamano: 4 + Math.random() * 6,
        delay: Math.random() * 0.2,
        rotacion: Math.random() * 720 - 360,
        forma: Math.random() > 0.5 ? "50%" : "2px",
    }));
}

// Cuenta ascendente con easing, usada para porcentajes y contadores
function useCountUp(target, duration, start) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start) return;
        let startTime = null;
        let raf;
        const step = (ts) => {
            if (!startTime) startTime = ts;
            const progress = Math.min((ts - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(target * eased));
            if (progress < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, duration, start]);
    return value;
}

function OpcionEncuesta({
    opcion,
    index,
    seleccionada,
    algunaSeleccionada,
    onSeleccionar,
}) {
    const [ripples, setRipples] = useState([]);
    const idRef = useRef(0);

    const handleClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = idRef.current++;
        setRipples((r) => [...r, { id, x, y }]);
        setTimeout(
            () => setRipples((r) => r.filter((rp) => rp.id !== id)),
            550,
        );
        onSeleccionar(index);
    };

    return (
        <button
            onClick={handleClick}
            style={{
                animation: `opcion-entrada 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.06}s both`,
            }}
            className={`relative overflow-hidden text-left px-4 py-3 rounded-xl text-sm font-medium border flex items-center gap-3 transition-all duration-200 ${
                seleccionada
                    ? "bg-orange-500 text-white border-orange-500 scale-[1.02] shadow-md shadow-orange-500/30"
                    : "bg-white/60 text-stone-700 border-white/70 hover:bg-white/80 hover:-translate-y-0.5 active:scale-[0.97]"
            } ${algunaSeleccionada && !seleccionada ? "opacity-45" : "opacity-100"}`}
        >
            {ripples.map((r) => (
                <span
                    key={r.id}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        left: r.x,
                        top: r.y,
                        width: 10,
                        height: 10,
                        marginLeft: -5,
                        marginTop: -5,
                        background: seleccionada
                            ? "rgba(255,255,255,0.5)"
                            : "rgba(249,115,22,0.35)",
                        animation: "ripple-expand 0.55s ease-out forwards",
                    }}
                />
            ))}

            <span
                className={`relative flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                    seleccionada
                        ? "border-white bg-white/20"
                        : "border-stone-300"
                }`}
            >
                <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{
                        transform: seleccionada ? "scale(1)" : "scale(0)",
                        transition:
                            "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3.5}
                        d="M5 13l4 4L19 7"
                    />
                </svg>
            </span>

            <span className="relative">{opcion}</span>
        </button>
    );
}

function BarraResultado({ opcion, esSeleccionUsuario, delay }) {
    const [activo, setActivo] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setActivo(true), 150 + delay);
        return () => clearTimeout(t);
    }, [delay]);

    const porcentajeAnimado = useCountUp(opcion.porcentaje, 800, activo);

    return (
        <div
            className={`relative rounded-xl border overflow-hidden ${
                esSeleccionUsuario
                    ? "border-orange-400 ring-2 ring-orange-300/50"
                    : "border-white/70"
            } ${opcion.es_ganadora && opcion.votos > 0 ? "shadow-md shadow-orange-400/30" : ""}`}
            style={{
                animation: `opcion-entrada 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay / 1000}s both`,
            }}
        >
            <div
                className="absolute inset-y-0 left-0 bg-orange-500/20"
                style={{
                    width: activo ? `${opcion.porcentaje}%` : "0%",
                    transition: "width 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            />
            <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-white/40">
                <div className="flex items-center gap-2 min-w-0">
                    {esSeleccionUsuario && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                            <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3.5}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </span>
                    )}
                    <span
                        className={`text-sm font-semibold truncate ${esSeleccionUsuario ? "text-orange-700" : "text-stone-700"}`}
                    >
                        {opcion.texto}
                    </span>
                    {opcion.es_ganadora && opcion.votos > 0 && (
                        <span className="flex-shrink-0 text-xs">👑</span>
                    )}
                </div>
                <div className="flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-stone-800">
                        {porcentajeAnimado}%
                    </span>
                    <span className="block text-[11px] text-stone-500">
                        {opcion.votos} votos
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function ModalEncuesta({
    isOpen,
    isVisible,
    onClose,
    encuesta,
    yaVoto,
    opcionVotada,
    resultados,
    onVotar,
}) {
    const [paso, setPaso] = useState("votando"); // "votando" | "confirmando" | "resultados"
    const [seleccion, setSeleccion] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState(null);
    const [textoConfirmacion, setTextoConfirmacion] = useState("¡Listo! 🎉");

    const confetiCentro = useMemo(() => generarConfeti(14, 55), [paso]);
    const confetiAmplio = useMemo(() => generarConfeti(20, 100), [paso]);

    // Al abrir, decide en qué paso arrancar según si ya votó o la encuesta ya cerró
    useEffect(() => {
        if (isOpen) {
            setPaso(yaVoto || !encuesta?.activa ? "resultados" : "votando");
            setSeleccion(null);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, encuesta?.id]);

    // Secuencia de texto + avance automático durante la confirmación
    useEffect(() => {
        if (paso !== "confirmando") return;
        setTextoConfirmacion("¡Listo! 🎉");
        const t1 = setTimeout(
            () => setTextoConfirmacion("Tu voto fue registrado"),
            750,
        );
        const t2 = setTimeout(() => setPaso("resultados"), 2300);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [paso]);

    if (!isOpen || !encuesta) return null;

    const handleVotar = async () => {
        if (seleccion === null) return;
        setEnviando(true);
        setError(null);
        try {
            await onVotar(seleccion);
            setPaso("confirmando");
        } catch (e) {
            setError(
                e?.response?.data?.message || "No se pudo registrar tu voto.",
            );
        } finally {
            setEnviando(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    const opcionSeleccionadaTexto =
        seleccion !== null ? encuesta.opciones[seleccion] : null;
    const totalVotos = resultados?.total_votos ?? 0;
    const cierraEnDias = resultados?.cierra_en_dias ?? null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ touchAction: "manipulation" }}
            onClick={handleClose}
        >
            <style>{`
                @keyframes confeti-burst {
                    0% { transform: translate(-50%, -50%) rotate(0deg) scale(0); opacity: 1; }
                    55% { opacity: 1; }
                    100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) rotate(var(--rot)) scale(1); opacity: 0; }
                }
                @keyframes check-pop {
                    0% { transform: scale(0) rotate(-20deg); opacity: 0; }
                    55% { transform: scale(1.2) rotate(8deg); opacity: 1; }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                }
                @keyframes check-ring {
                    0% { transform: scale(0.6); opacity: 0.7; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
                @keyframes check-ring-2 {
                    0% { transform: scale(0.6); opacity: 0.5; }
                    100% { transform: scale(2.8); opacity: 0; }
                }
                @keyframes glow-pulse {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 0.9; transform: scale(1.08); }
                }
                @keyframes texto-subir {
                    0% { transform: translateY(8px); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                @keyframes opcion-entrada {
                    0% { transform: translateY(10px) scale(0.96); opacity: 0; }
                    100% { transform: translateY(0) scale(1); opacity: 1; }
                }
                @keyframes ripple-expand {
                    0% { width: 10px; height: 10px; margin-left: -5px; margin-top: -5px; opacity: 0.6; }
                    100% { width: 140px; height: 140px; margin-left: -70px; margin-top: -70px; opacity: 0; }
                }
                @keyframes pop-badge {
                    0% { transform: scale(0.5); opacity: 0; }
                    60% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>

            <div
                className="absolute inset-0 bg-stone-900/25 transition-opacity duration-300"
                style={{ opacity: isVisible ? 1 : 0 }}
            />
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-sm p-6 z-10 bg-white/55 backdrop-blur-[20px] backdrop-saturate-200 border-t border-l border-white/70 border-r border-b border-white/30 overflow-hidden"
                style={{
                    borderRadius: isVisible ? "2rem" : "9999px",
                    transform: isVisible ? "scale(1)" : "scale(0.4)",
                    opacity: isVisible ? 1 : 0,
                    filter: isVisible ? "blur(0px)" : "blur(4px)",
                    transformOrigin: "center",
                    transition:
                        "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, filter 0.35s ease-out",
                    boxShadow:
                        "0 25px 70px rgba(0,0,0,0.15), inset 0 2px 10px rgba(255,255,255,0.6)",
                }}
            >
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-20 p-2 text-stone-500 hover:text-stone-800 bg-white/50 hover:bg-white/70 rounded-full transition-all active:scale-95"
                >
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>

                {/* ── PASO 1: VOTANDO ── */}
                {paso === "votando" && (
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-orange-500 mb-1.5 pr-8">
                            📊 Encuesta
                        </p>
                        <h3 className="text-xl font-extrabold text-stone-800 leading-snug mb-1.5 pr-8">
                            {encuesta.pregunta}
                        </h3>
                        {encuesta.descripcion && (
                            <p className="text-sm text-stone-600 leading-relaxed mb-4">
                                {encuesta.descripcion}
                            </p>
                        )}

                        <div
                            className={`flex flex-col gap-2 ${encuesta.descripcion ? "" : "mt-4"} mb-4`}
                        >
                            {encuesta.opciones.map((opcion, i) => (
                                <OpcionEncuesta
                                    key={i}
                                    opcion={opcion}
                                    index={i}
                                    seleccionada={seleccion === i}
                                    algunaSeleccionada={seleccion !== null}
                                    onSeleccionar={setSeleccion}
                                />
                            ))}
                        </div>

                        {error && (
                            <p className="text-xs font-medium text-red-500 mb-3">
                                {error}
                            </p>
                        )}

                        <button
                            onClick={handleVotar}
                            disabled={seleccion === null || enviando}
                            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            {enviando
                                ? "Enviando..."
                                : opcionSeleccionadaTexto
                                  ? `Votar por "${opcionSeleccionadaTexto}" →`
                                  : "Selecciona una opción"}
                        </button>
                    </div>
                )}

                {/* ── PASO 2: CONFIRMANDO ── */}
                {paso === "confirmando" && (
                    <div className="relative flex flex-col items-center text-center py-6">
                        <div
                            className="absolute top-14 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-orange-400/25 blur-2xl pointer-events-none"
                            style={{
                                animation: "glow-pulse 2s ease-in-out infinite",
                            }}
                        />

                        <div className="absolute top-10 left-1/2 w-0 h-0 pointer-events-none">
                            {confetiAmplio.map((p) => {
                                const rad = (p.angulo * Math.PI) / 180;
                                const tx = Math.cos(rad) * p.distancia;
                                const ty = Math.sin(rad) * p.distancia;
                                return (
                                    <span
                                        key={`a-${p.id}`}
                                        className="absolute"
                                        style={{
                                            width: p.tamano,
                                            height: p.tamano,
                                            backgroundColor: p.color,
                                            borderRadius: p.forma,
                                            left: 0,
                                            top: 0,
                                            "--tx": `${tx}px`,
                                            "--ty": `${ty}px`,
                                            "--rot": `${p.rotacion}deg`,
                                            animation: `confeti-burst 1.1s ease-out ${p.delay}s forwards`,
                                        }}
                                    />
                                );
                            })}
                        </div>
                        <div className="absolute top-10 left-1/2 w-0 h-0 pointer-events-none">
                            {confetiCentro.map((p) => {
                                const rad = (p.angulo * Math.PI) / 180;
                                const tx = Math.cos(rad) * p.distancia;
                                const ty = Math.sin(rad) * p.distancia;
                                return (
                                    <span
                                        key={`c-${p.id}`}
                                        className="absolute"
                                        style={{
                                            width: p.tamano * 0.8,
                                            height: p.tamano * 0.8,
                                            backgroundColor: p.color,
                                            borderRadius: p.forma,
                                            left: 0,
                                            top: 0,
                                            "--tx": `${tx}px`,
                                            "--ty": `${ty}px`,
                                            "--rot": `${p.rotacion}deg`,
                                            animation: `confeti-burst 0.7s ease-out ${p.delay}s forwards`,
                                        }}
                                    />
                                );
                            })}
                        </div>

                        <div className="relative w-16 h-16 mb-5 flex items-center justify-center">
                            <span
                                className="absolute inset-0 rounded-full bg-orange-400/40"
                                style={{
                                    animation:
                                        "check-ring 0.9s ease-out 0.05s forwards",
                                }}
                            />
                            <span
                                className="absolute inset-0 rounded-full bg-orange-300/30"
                                style={{
                                    animation:
                                        "check-ring-2 1.1s ease-out 0.15s forwards",
                                }}
                            />
                            <div
                                className="relative w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40"
                                style={{
                                    animation:
                                        "check-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                                }}
                            >
                                <svg
                                    className="w-8 h-8 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                        </div>

                        <div className="h-8 flex items-center justify-center mb-3">
                            <h3
                                key={textoConfirmacion}
                                className="text-xl font-extrabold text-stone-800"
                                style={{
                                    animation:
                                        "texto-subir 0.35s ease-out both",
                                }}
                            >
                                {textoConfirmacion}
                            </h3>
                        </div>

                        <span
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/15 text-orange-600 text-xs font-bold"
                            style={{
                                animation:
                                    "pop-badge 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both",
                            }}
                        >
                            +1 voto registrado
                        </span>
                    </div>
                )}

                {/* ── PASO 3: RESULTADOS ── */}
                {paso === "resultados" && resultados && (
                    <div>
                        {!encuesta.activa && (
                            <p
                                className="text-xs font-bold uppercase tracking-wide text-stone-500 mb-1.5"
                                style={{
                                    animation:
                                        "texto-subir 0.35s ease-out both",
                                }}
                            >
                                🔒 Encuesta cerrada
                            </p>
                        )}
                        <h3 className="text-lg font-bold text-stone-800 leading-snug mb-4 pr-8">
                            {encuesta.pregunta}
                        </h3>

                        <div className="flex flex-col gap-2 mb-4">
                            {resultados.opciones.map((opcion, i) => (
                                <BarraResultado
                                    key={i}
                                    opcion={opcion}
                                    esSeleccionUsuario={opcionVotada === i}
                                    delay={i * 90}
                                />
                            ))}
                        </div>

                        <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-4">
                            <span>{totalVotos} vecinos han votado</span>
                            {encuesta.activa && cierraEnDias !== null && (
                                <span className="text-orange-600 font-bold">
                                    Cierra en {cierraEnDias} día
                                    {cierraEnDias === 1 ? "" : "s"}
                                </span>
                            )}
                        </div>

                        {!encuesta.activa && (
                            <p className="text-center text-xs text-stone-400 mb-4">
                                Gracias por participar.
                            </p>
                        )}

                        <button
                            onClick={handleClose}
                            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all active:scale-[0.98]"
                        >
                            Cerrar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
