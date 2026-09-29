import { useEffect, useRef, useState } from "react";
import DesgloseJornada from "./DesgloseJornada";
import VerificacionPorPlaza from "./Verificacionporplaza";

// Fase "diferencia" del conteo ciego: el conteo del capturista NO coincidió
// con monto_sistema. Muestra tu conteo vs total registrado vs diferencia,
// permite consultar el desglose (solo lectura), reintentar sin límite, y
// desde el 3er intento ofrece la válvula "cerrar con diferencia" (nota +
// firma obligatorias).
//
// Props:
//   desglose               — objeto { ordinario, especiales, extraordinario, ventasTags, total, ... }
//   ultimoResultado        — objeto que devuelve useCorteCaja().ultimoResultado
//                             (usa declarado, monto_sistema, diferencia,
//                             numero_intento, puede_cerrar_con_diferencia)
//   corte                  — objeto corte del hook (opcional; si trae
//                             corte.intentos, se muestra la bitácora completa)
//   onReintentar           — reintentar() del hook useCorteCaja
//   onCerrarConDiferencia  — cerrarConDiferencia(nota, firma) del hook
//
// Layout: 3 tarjetas flotantes independientes en vez de una sola tarjeta
// contenedora.
//   1) Isla "diferencia por conciliar" — header + tu conteo/total/diferencia.
//   2) Isla derecha — historial de intentos + desglose del día.
//   3) Píldora inferior — acciones (reintentar / cerrar con diferencia),
//      que se transforma en una tarjeta más grande al abrir la válvula.
// En md+ las islas 1 y 2 van lado a lado; en mobile se apilan. La píldora
// siempre va debajo, ancho completo.

/* ───────────────────────── Iconos inline ───────────────────────── */

function IconRefresh(props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M20 11a8 8 0 1 0-2.34 5.66" />
            <path d="M20 4v7h-7" />
        </svg>
    );
}

function IconLock(props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
        </svg>
    );
}

function IconClock(props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
        </svg>
    );
}

function IconArrowDown(props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M12 4v14" />
            <path d="M6 12l6 6 6-6" />
        </svg>
    );
}

function IconPen(props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M4 20l4.2-.9L19 8.3a2 2 0 0 0 0-2.8l-.5-.5a2 2 0 0 0-2.8 0L5.9 15.8 5 20z" />
            <path d="M14.5 6.5l3 3" />
        </svg>
    );
}

function IconNote(props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M6 3h9l3 3v15H6z" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="12.5" y2="17" />
        </svg>
    );
}

/* ───────────────────────── Isla de vidrio reutilizable ───────────────────────── */
/*
   Envoltura: [glow -inset sibling] + [tarjeta overflow-hidden]. El glow vive
   DENTRO de un wrapper "relative" propio de cada isla (no del contenedor con
   scroll de más arriba), y la tarjeta interna es overflow-hidden, así que el
   glow nunca contribuye al overflow horizontal del contenedor que scrollea.
*/
function GlassIsland({
    className = "",
    rounded = "rounded-[28px]",
    glow = true,
    style,
    children,
}) {
    return (
        <div className="relative" style={style}>
            {glow && (
                <div
                    className={`absolute -inset-2 ${rounded} blur-2xl pointer-events-none`}
                    aria-hidden="true"
                />
            )}
            <div
                className={`relative overflow-hidden ${rounded} bg-white/[0.66] backdrop-blur-2xl backdrop-saturate-150 border border-white/80 ring-1 ring-black/[0.03] shadow-[0_18px_50px_rgba(0,0,0,0.12)] ${className}`}
            >
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
                    aria-hidden="true"
                />
                {children}
            </div>
        </div>
    );
}

/* ───────────────────────── Valor con micro-pop ───────────────────────── */
/* Solo anima cuando el valor cambia; no cuenta desde $0 en cada render. */
function AnimatedValue({ value, format, className = "", style }) {
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
            style={style}
            className={`inline-block tabular-nums rd-value-in ${
                animKey > 0 ? "rd-number-pop" : ""
            } ${className}`}
        >
            {format(value)}
        </span>
    );
}

export default function ResultadoDiferencia({
    desglose,
    resultado: ultimoResultado,
    corte,
    onReintentar,
    onCerrarConDiferencia,
}) {
    const [mostrarValvula, setMostrarValvula] = useState(false);
    const [mostrarPlazas, setMostrarPlazas] = useState(false);
    const [nota, setNota] = useState("");
    const [firma, setFirma] = useState("");
    const [enviando, setEnviando] = useState(false);

    // Bloquea el scroll de la página de fondo mientras este modal está
    // montado. Sin esto, aunque la tarjeta ya no scrollee, la barra que
    // se ve es la del body/página detrás del overlay.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const declarado = ultimoResultado?.declarado ?? 0;
    const montoSistema = ultimoResultado?.monto_sistema ?? 0;
    const diferencia = ultimoResultado?.diferencia ?? declarado - montoSistema;
    const numeroIntento =
        ultimoResultado?.numero_intento ?? corte?.intentos?.length ?? 1;
    const puedeCerrarConDiferencia =
        !!ultimoResultado?.puede_cerrar_con_diferencia;

    const formatCurrency = (valor) =>
        new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
        }).format(valor);

    const formatDiferencia = (valor) =>
        `${valor > 0 ? "+" : valor < 0 ? "-" : ""}${formatCurrency(Math.abs(valor))}`;

    const handleConfirmarValvula = async () => {
        const notaLimpia = nota.trim();
        const firmaLimpia = firma.trim();
        if (!notaLimpia || !firmaLimpia || enviando) return;
        setEnviando(true);
        try {
            await onCerrarConDiferencia(notaLimpia, firmaLimpia);
        } catch {
            setEnviando(false);
        }
    };

    const diferenciaClase =
        diferencia === 0
            ? "text-stone-600"
            : diferencia > 0
              ? "text-amber-600"
              : "text-orange-600";

    const hayHistorial = corte?.intentos?.length > 1;
    const dosBotones = puedeCerrarConDiferencia;

    // Defensivo: no confiamos en que corte.intentos venga ordenado
    // ascendente por el hook (si el último reintentar() lo agrega con
    // unshift en vez de push, o lo reconstruye en otro orden, el índice
    // final deja de ser el intento actual). Ordenamos nosotros mismos por
    // `numero`, y marcamos "actual" comparando contra numeroIntento (que
    // ya viene de ultimoResultado, un dato confiable), no por posición.
    const intentosOrdenados = corte?.intentos
        ? [...corte.intentos].sort((a, b) => a.numero - b.numero)
        : [];

    const [indiceVisible, setIndiceVisible] = useState(0);

    useEffect(() => {
        if (intentosOrdenados && intentosOrdenados.length > 0) {
            setIndiceVisible(intentosOrdenados.length - 1);
        }
    }, [intentosOrdenados?.length]);

    const irAnterior = () => setIndiceVisible((p) => Math.max(0, p - 1));
    const irSiguiente = () =>
        setIndiceVisible((p) => Math.min(intentosOrdenados.length - 1, p + 1));

    const intentoVisible = intentosOrdenados?.[indiceVisible];
    const esActual = intentoVisible?.numero === numeroIntento;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-2xl p-4 rd-overlay-in">
            {/*
                flex-col con altura total acotada: el área de las islas
                (flex-1 + min-h-0, clave para que el overflow interno
                funcione dentro de un flex item) es lo único que scrollea.
                La píldora de acciones vive AFUERA de esa zona, como footer
                fijo — así nunca queda tapada ni requiere scroll para verse,
                sin importar qué tan largo se ponga el historial.
            */}
            <div className="relative w-full max-w-md md:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rd-card-in">
                {/*
                    Ningún glow -inset vive directamente aquí (cada isla lo
                    trae, pero clipado dentro de su propia tarjeta
                    overflow-hidden), y overflow-x-hidden va explícito para
                    no depender de la regla de "auto" emparejado que causaba
                    el scroll horizontal.
                */}
                <div className="pb-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                        {/* ───────── Isla 1: diferencia por conciliar ───────── */}
                        <GlassIsland className="px-6 py-6">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 rd-dot-pulse" />
                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.7)]" />
                                        </span>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.19em] text-stone-400">
                                            Cierre de jornada
                                        </p>
                                    </div>
                                    <p className="mt-1.5 text-[15px] font-semibold leading-snug text-stone-800">
                                        Hay una diferencia por conciliar
                                    </p>
                                </div>

                                <span className="shrink-0 inline-flex items-center rounded-full bg-white/55 border border-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-500 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
                                    Intento {numeroIntento}
                                </span>
                            </div>

                            <div
                                className="mt-6 flex flex-col items-center text-center rd-fade-slide"
                                style={{
                                    animationDelay: "80ms",
                                    animationFillMode: "backwards",
                                }}
                            >
                                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-stone-400">
                                    Tu conteo
                                </p>
                                <AnimatedValue
                                    value={declarado}
                                    format={formatCurrency}
                                    className="mt-1 text-2xl font-bold text-stone-800"
                                />

                                <div className="my-2 flex flex-col items-center gap-0.5">
                                    <span className="h-6 w-px bg-gradient-to-b from-stone-300 to-stone-200" />
                                    <IconArrowDown className="h-3 w-3 text-stone-300" />
                                </div>

                                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-stone-400">
                                    Total registrado
                                </p>
                                <AnimatedValue
                                    value={montoSistema}
                                    format={formatCurrency}
                                    className="mt-1 text-2xl font-bold text-stone-800"
                                />
                            </div>

                            <div
                                className="relative my-5 h-px bg-stone-200/70"
                                aria-hidden="true"
                            >
                                <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.5)]" />
                            </div>

                            <div
                                className="flex flex-col items-center text-center rd-fade-slide"
                                style={{
                                    animationDelay: "150ms",
                                    animationFillMode: "backwards",
                                }}
                            >
                                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-stone-400">
                                    Hay una diferencia en efectivo de:
                                </p>
                                <AnimatedValue
                                    value={diferencia}
                                    format={formatDiferencia}
                                    className={`mt-1 text-[28px] font-black [text-shadow:0_1px_1px_rgba(0,0,0,0.04)] ${diferenciaClase}`}
                                />
                            </div>
                        </GlassIsland>

                        {/* ───────── Isla 2: historial + desglose ───────── */}
                        <GlassIsland className="px-6 py-6">
                            {hayHistorial && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <IconClock className="h-3.5 w-3.5 text-stone-400" />
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">
                                            Historial de conteos
                                        </p>
                                    </div>
                                    {intentoVisible && (
                                        <div className="flex h-10 items-center justify-between pr-1 -mr-1">
                                            {/* Información del Intento */}
                                            <div
                                                key={intentoVisible.numero}
                                                className={`relative flex flex-1 items-center justify-between pl-4 rd-fade-slide ${
                                                    esActual
                                                        ? "opacity-100"
                                                        : "opacity-55"
                                                }`}
                                            >
                                                <span
                                                    className={`absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full ${
                                                        esActual
                                                            ? "bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)]"
                                                            : "bg-stone-300"
                                                    }`}
                                                    aria-hidden="true"
                                                />
                                                <div className="min-w-0">
                                                    <p
                                                        className={`text-sm ${
                                                            esActual
                                                                ? "font-semibold text-stone-700"
                                                                : "text-stone-500"
                                                        }`}
                                                    >
                                                        Intento{" "}
                                                        {intentoVisible.numero}
                                                        {esActual && (
                                                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-orange-500">
                                                                actual
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-[11px] text-stone-400">
                                                        Declarado{" "}
                                                        {formatCurrency(
                                                            intentoVisible.declarado,
                                                        )}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`shrink-0 text-sm tabular-nums mr-3 ${
                                                        esActual
                                                            ? "font-semibold text-orange-600"
                                                            : "text-stone-400"
                                                    }`}
                                                >
                                                    {formatDiferencia(
                                                        intentoVisible.diferencia,
                                                    )}
                                                </span>
                                            </div>

                                            {/* Flechas de Navegación (Solo se renderizan si hay más de 1 intento) */}
                                            {intentosOrdenados.length > 1 && (
                                                <div className="flex shrink-0 flex-col items-center justify-center space-y-1 border-l border-stone-200 pl-2 ml-1">
                                                    <button
                                                        onClick={irAnterior}
                                                        disabled={
                                                            indiceVisible === 0
                                                        }
                                                        className="text-stone-400 transition-colors hover:text-stone-700 disabled:pointer-events-none disabled:opacity-30"
                                                        aria-label="Intento anterior"
                                                    >
                                                        <svg
                                                            className="h-3.5 w-3.5"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={2.5}
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M5 15l7-7 7 7"
                                                            />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={irSiguiente}
                                                        disabled={
                                                            indiceVisible ===
                                                            intentosOrdenados.length -
                                                                1
                                                        }
                                                        className="text-stone-400 transition-colors hover:text-stone-700 disabled:pointer-events-none disabled:opacity-30"
                                                        aria-label="Intento siguiente"
                                                    >
                                                        <svg
                                                            className="h-3.5 w-3.5"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={2.5}
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M19 9l-7 7-7-7"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {numeroIntento >= 2 ? (
                                <div
                                    className={`${hayHistorial ? "mt-6" : ""} rd-fade-slide`}
                                    style={{
                                        animationDelay: "200ms",
                                        animationFillMode: "backwards",
                                    }}
                                >
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">
                                            Desglose del día{" "}
                                            <span className="font-medium normal-case tracking-normal text-stone-300">
                                                · solo consulta
                                            </span>
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setMostrarPlazas(true)
                                            }
                                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-800 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 active:scale-95"
                                        >
                                            Por plaza
                                        </button>
                                    </div>
                                    <DesgloseJornada
                                        desglose={desglose}
                                        stagger={false}
                                    />
                                </div>
                            ) : (
                                <div className="flex h-full min-h-[120px] flex-col items-center justify-center text-center rd-fade-slide">
                                    <IconLock className="h-5 w-5 text-stone-300" />
                                    <p className="mt-2 text-xs text-stone-400">
                                        El desglose se habilita
                                        <br />
                                        desde tu segundo intento
                                    </p>
                                </div>
                            )}
                        </GlassIsland>
                    </div>
                </div>

                {/*
                    ───────── Isla 3: píldora de acciones / válvula ─────────
                    shrink-0: footer fijo fuera del área con scroll de arriba.
                    Siempre visible, nunca se oculta ni se corta.
                */}
                <div
                    className="shrink-0 mt-4 md:mt-5 rd-fade-slide"
                    style={{
                        animationDelay: "260ms",
                        animationFillMode: "backwards",
                    }}
                >
                    {/* CONTENEDOR DE BOTONES (Siempre visibles) */}
                    <div
                        className={`flex flex-col gap-2 ${
                            dosBotones ? "md:flex-row" : ""
                        }`}
                    >
                        <button
                            type="button"
                            onClick={onReintentar}
                            className="group relative w-full overflow-hidden rounded-full bg-orange-500/85 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.32)] transition-all duration-200 hover:shadow-[0_14px_30px_rgba(249,115,22,0.42)] hover:-translate-y-0.5 active:scale-[1.3] active:translate-y-0"
                        >
                            <span
                                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20"
                                aria-hidden="true"
                            />
                            <span className="relative flex items-center justify-center gap-2">
                                <IconRefresh className="h-4 w-4" />
                                Reintentar conteo
                            </span>
                        </button>

                        {puedeCerrarConDiferencia && (
                            <button
                                type="button"
                                onClick={() => setMostrarValvula(true)}
                                className="w-full rounded-full bg-white/55 border border-orange-300/40 px-5 py-3 text-sm font-medium text-stone-600 backdrop-blur-xl transition-all duration-200 hover:bg-white/75 hover:border-orange-300/70 hover:text-stone-800 active:scale-[0.98]"
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <IconLock className="h-4 w-4 text-orange-500" />
                                    Cerrar con diferencia
                                </span>
                            </button>
                        )}
                    </div>

                    {mostrarPlazas && (
                        <VerificacionPorPlaza
                            onCerrar={() => setMostrarPlazas(false)}
                        />
                    )}

                    {/* MODAL FLOTANTE (Aparece por encima de toda la pantalla) */}
                    {mostrarValvula && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 rd-fade-in">
                            {/* Fondo oscuro desenfocado (Clic aquí para cerrar) */}
                            <div
                                className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm rounded-3xl"
                                onClick={() =>
                                    !enviando && setMostrarValvula(false)
                                }
                            />

                            <GlassIsland className="relative w-full max-w-sm px-6 py-6 shadow-2xl rd-valve-in ring-1 ring-white/60">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <IconLock className="h-3.5 w-3.5 text-orange-500" />
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
                                        Cierre con diferencia
                                    </p>
                                </div>
                                <p className="mb-4 text-[13px] leading-relaxed text-stone-500">
                                    Este cierre requiere una justificación y una
                                    firma.
                                </p>

                                <div className="md:grid md:grid-cols-1 md:gap-x-6">
                                    <div className="mt-4 md:mt-0">
                                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-stone-500">
                                            <IconPen className="h-3.5 w-3.5 text-stone-400" />
                                            Firma para cerrar la caja
                                        </label>
                                        <input
                                            type="text"
                                            value={firma}
                                            onChange={(e) =>
                                                setFirma(e.target.value)
                                            }
                                            placeholder="Tu nombre completo"
                                            className="w-full rounded-2xl bg-white/55 backdrop-blur-xl border border-white/80 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 shadow-[0_1px_6px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-white focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-300/30 focus:bg-white/70"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setMostrarValvula(false)}
                                        disabled={enviando}
                                        className="flex-1 rounded-full bg-white/45 border border-white/80 px-4 py-3 text-sm font-medium text-stone-500 backdrop-blur-sm transition-all duration-200 hover:bg-white/65 hover:text-stone-700 active:scale-[0.97] disabled:opacity-50"
                                    >
                                        Volver
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmarValvula}
                                        disabled={
                                            !nota.trim() ||
                                            !firma.trim() ||
                                            enviando
                                        }
                                        className="flex-1 rounded-full bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(249,115,22,0.3)] transition-all duration-200 hover:shadow-[0_10px_24px_rgba(249,115,22,0.4)] active:scale-[0.97] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100"
                                    >
                                        {enviando ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                                Cerrando caja...
                                            </span>
                                        ) : (
                                            "Cerrar con diferencia"
                                        )}
                                    </button>
                                </div>
                            </GlassIsland>
                        </div>
                    )}
                </div>
            </div>

            {/*
                Estilos y keyframes propios del componente.
                Si tu proyecto centraliza animaciones en tailwind.config.js,
                puedes mover estos @keyframes ahí y sustituir las clases
                "rd-*" por utilidades de Tailwind equivalentes.
            */}
            <style>{`
                @keyframes rd-overlay-in-kf {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .rd-overlay-in {
                    animation: rd-overlay-in-kf 300ms ease-out both;
                }

                /*
                  Entrada del grupo de islas: fade + zoom + desplazamiento
                  vertical, con un pequeño remanente de "shake" al final
                  (mucho más sutil que el original) para comunicar la
                  discrepancia sin sentirse como un error de videojuego.
                */
                @keyframes rd-card-in-kf {
                    0%   { opacity: 0; transform: translateY(10px) scale(0.97); }
                    55%  { opacity: 1; transform: translateY(0) scale(1) translateX(0); }
                    70%  { transform: translateY(0) scale(1) translateX(-2px); }
                    85%  { transform: translateY(0) scale(1) translateX(1px); }
                    100% { transform: translateY(0) scale(1) translateX(0); }
                }
                .rd-card-in {
                    animation: rd-card-in-kf 550ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                @keyframes rd-fade-slide-kf {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .rd-fade-slide {
                    animation: rd-fade-slide-kf 400ms ease-out both;
                }

                @keyframes rd-value-in-kf {
                    from { opacity: 0; transform: translateY(4px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .rd-value-in {
                    animation: rd-value-in-kf 400ms ease-out both;
                }

                @keyframes rd-number-pop-kf {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.045); }
                    100% { transform: scale(1); }
                }
                .rd-number-pop {
                    animation: rd-number-pop-kf 220ms ease-out;
                }

                @keyframes rd-valve-in-kf {
                    from { opacity: 0; transform: translateY(8px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .rd-valve-in {
                    animation: rd-valve-in-kf 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                @keyframes rd-dot-pulse-kf {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.8); opacity: 0; }
                }
                .rd-dot-pulse {
                    animation: rd-dot-pulse-kf 2.2s ease-in-out infinite;
                }

                @media (prefers-reduced-motion: reduce) {
                    .rd-overlay-in,
                    .rd-card-in,
                    .rd-fade-slide,
                    .rd-value-in,
                    .rd-number-pop,
                    .rd-valve-in,
                    .rd-dot-pulse {
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
