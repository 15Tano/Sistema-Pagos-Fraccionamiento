import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
    X,
    CalendarDays,
    LockKeyhole,
    CircleCheck,
    RotateCcw,
    FileText,
    History,
    ShieldCheck,
    AlertTriangle,
} from "lucide-react";
import DesgloseJornada from "../../../components/CorteCaja/DesgloseJornada";
import EstadoBadge from "./EstadoBadge";
import { useCorteDetalle } from "../hooks/useCorteDetalle";
import {
    fechaISO,
    formatCurrency,
    formatFecha,
    formatFechaHora,
    formatHora,
    hoyMX,
} from "../formatters";

const ESTILOS = `
@keyframes si-overlay { from { opacity: 0 } to { opacity: 1 } }
@keyframes si-pop {
    from { opacity: 0; transform: translateY(14px) scale(.98) }
    to   { opacity: 1; transform: translateY(0) scale(1) }
}
@keyframes si-rise {
    from { opacity: 0; transform: translateY(8px) }
    to   { opacity: 1; transform: translateY(0) }
}
.si-overlay { animation: si-overlay .25s ease-out both }
.si-pop     { animation: si-pop .3s cubic-bezier(.2,.8,.2,1) backwards }
.si-hero    { animation: si-rise .4s cubic-bezier(.2,.8,.2,1) .06s backwards }
.si-scroll  { scrollbar-width: none }
.si-scroll::-webkit-scrollbar { display: none }
@media (prefers-reduced-motion: reduce) {
    .si-overlay, .si-pop, .si-hero { animation: none }
}
`;

/* Isla: forma base. El relleno va en línea (FILL_*) para no depender de la config de Tailwind */
const ISLA = "rounded-[1.75rem] p-5";

const SOMBRA =
    "0 12px 32px -16px rgba(120,53,15,0.32), inset 0 1px 0 rgba(255,255,255,1)";

const FILL = {
    background:
        "linear-gradient(145deg, rgba(255,255,255,0.97) 0%, rgba(255,251,246,0.95) 55%, rgba(255,240,226,0.93) 100%)",
    border: "1px solid rgba(255,255,255,0.95)",
    boxShadow: SOMBRA,
};

const FILL_HERO = {
    ...FILL,
    background:
        "radial-gradient(ellipse at 50% 0%, rgba(251,146,60,0.22), transparent 65%), linear-gradient(180deg, rgba(255,255,255,0.97), rgba(255,243,230,0.95))",
};

const FILL_AMBAR = {
    ...FILL,
    background:
        "linear-gradient(145deg, rgba(255,251,235,0.98), rgba(254,243,199,0.94))",
    border: "1px solid rgba(253,230,138,0.9)",
};

const FILL_NARANJA = {
    ...FILL,
    background:
        "linear-gradient(145deg, rgba(255,247,237,0.98), rgba(255,237,213,0.94))",
    border: "1px solid rgba(254,215,170,0.9)",
};

/* Vidrio real para la isla fija: translúcido + blur + saturación de lo que pasa debajo */
const FILL_VIDRIO = {
    background:
        "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.08) 100%)",
    backdropFilter: "blur(6px) saturate(190%)",
    WebkitBackdropFilter: "blur(22px) saturate(190%)",
    border: "1px solid rgba(255,255,255,0.75)",
    boxShadow:
        "0 12px 32px -14px rgba(120,53,15,0.4), inset 0 1px 0 rgba(255,255,255,0.9)",
};

const BOTON_CERRAR =
    "shrink-0 p-2 rounded-full bg-stone-100/80 border border-white text-stone-500 hover:text-stone-800 hover:bg-stone-100 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400";

function Titulo({ icon: Icon, children }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            {Icon && (
                <Icon
                    size={14}
                    className="text-orange-500 shrink-0"
                    aria-hidden="true"
                />
            )}
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">
                {children}
            </h3>
        </div>
    );
}

function Propiedad({ label, children }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-sm text-stone-500">{label}</dt>
            <dd className="text-sm font-semibold text-stone-800 text-right tabular-nums">
                {children}
            </dd>
        </div>
    );
}

function Skeleton({ onClose }) {
    const bar = "rounded-lg bg-stone-300/40 animate-pulse";
    return (
        <div
            role="status"
            aria-label="Cargando corte"
            className="flex flex-col gap-3"
        >
            <div
                style={FILL}
                className={`${ISLA} flex items-start justify-between gap-4`}
            >
                <div className="flex flex-col gap-2">
                    <div className={`${bar} h-3 w-24`} />
                    <div className={`${bar} h-7 w-56 max-w-full`} />
                    <div className={`${bar} h-6 w-24`} />
                </div>
                <button
                    onClick={onClose}
                    className={BOTON_CERRAR}
                    aria-label="Cerrar"
                >
                    <X size={18} />
                </button>
            </div>
            <div style={FILL} className={`${ISLA} h-36`} />
            <div style={FILL} className={`${ISLA} h-44`} />
            <div style={FILL} className={`${ISLA} flex flex-col gap-2.5`}>
                <div className={`${bar} h-3 w-36`} />
                <div className={`${bar} h-4 w-full`} />
                <div className={`${bar} h-4 w-5/6`} />
            </div>
        </div>
    );
}

export default function DetalleCorte({ uuid, onClose, onReabierto }) {
    const { data, loading, error, reabriendo, reabrir } = useCorteDetalle(uuid);
    const [confirmando, setConfirmando] = useState(false);
    const [errorReabrir, setErrorReabrir] = useState(null);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    const corte = data?.corte;
    const desglose = data?.desglose;
    const intentos = corte?.intentos ?? [];

    const puedeReabrir =
        corte &&
        corte.estado !== "en_proceso" &&
        !corte.reabierto_at &&
        fechaISO(corte.fecha) === hoyMX();

    const huboMovimientosPosteriores =
        corte &&
        desglose &&
        corte.monto_sistema != null &&
        Math.abs(desglose.total - corte.monto_sistema) > 0.005;

    const handleReabrir = async () => {
        setErrorReabrir(null);
        const res = await reabrir();
        if (res.ok) {
            setConfirmando(false);
            onReabierto();
        } else {
            setErrorReabrir(res.message);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
            onClick={onClose}
        >
            <style>{ESTILOS}</style>

            <div className="si-overlay absolute inset-0 bg-stone-900/25 backdrop-blur-sm" />

            {/* Contenedor sin superficie propia: solo dimensiona y hace scroll */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Detalle del corte de caja"
                onClick={(e) => e.stopPropagation()}
                style={{ width: "100%", maxWidth: "40rem", maxHeight: "94dvh" }}
                className="si-pop si-scroll relative overflow-y-auto overscroll-contain p-3"
            >
                {loading && <Skeleton onClose={onClose} />}

                {!loading && error && (
                    <div
                        style={FILL}
                        className={`${ISLA} flex flex-col items-center text-center gap-4 py-10`}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
                            <AlertTriangle size={22} aria-hidden="true" />
                        </div>
                        <div>
                            <div className="font-bold text-stone-800">
                                No se pudo cargar el corte
                            </div>
                            <p className="text-sm text-red-600 mt-1">{error}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                        >
                            Cerrar
                        </button>
                    </div>
                )}

                {corte && (
                    <div className="flex flex-col gap-3">
                        {/* Isla 1 — identidad (fija al hacer scroll) */}
                        <header
                            style={FILL_VIDRIO}
                            className={`${ISLA} sticky top-0 z-10 !py-4`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-orange-600">
                                        <CalendarDays
                                            size={13}
                                            aria-hidden="true"
                                        />
                                        Corte de caja
                                    </div>
                                    <h2 className="mt-1 text-2xl leading-tight font-bold tracking-tight text-stone-800 capitalize">
                                        {formatFecha(corte.fecha)}
                                    </h2>
                                    <p className="text-sm text-stone-500">
                                        Cierre de jornada
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className={BOTON_CERRAR}
                                    aria-label="Cerrar"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                <EstadoBadge estado={corte.estado} />
                                {corte.reabierto_at && (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700/90">
                                        <RotateCcw
                                            size={12}
                                            className="ml-1"
                                            aria-hidden="true"
                                        />
                                        Reabierto
                                    </span>
                                )}
                            </div>
                        </header>

                        {/* Isla 2 — hero financiero */}
                        <section
                            style={FILL_HERO}
                            className={`${ISLA} si-hero relative overflow-hidden text-center !py-8`}
                        >
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,146,60,0.25),transparent_65%)]"
                            />
                            <div className="relative">
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                                    Total al cierre
                                </div>
                                <div className="mt-2 text-5xl sm:text-6xl font-bold tracking-tight tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-orange-500 to-orange-700">
                                    {corte.monto_sistema != null
                                        ? formatCurrency(corte.monto_sistema)
                                        : "—"}
                                </div>
                                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
                                    <LockKeyhole size={12} aria-hidden="true" />
                                    Monto registrado al momento del cierre
                                </div>
                            </div>
                        </section>

                        {/* Isla — actividad posterior */}
                        {huboMovimientosPosteriores && (
                            <div
                                role="note"
                                style={FILL_AMBAR}
                                className={ISLA}
                            >
                                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
                                    <RotateCcw size={14} aria-hidden="true" />
                                    Actividad posterior
                                </div>
                                <p className="mt-2 text-sm text-amber-900 leading-relaxed">
                                    Actualmente el sistema registra{" "}
                                    <b className="tabular-nums">
                                        {formatCurrency(desglose.total)}
                                    </b>{" "}
                                    para este día, pero el corte cerró en{" "}
                                    <b className="tabular-nums">
                                        {formatCurrency(corte.monto_sistema)}
                                    </b>
                                    . Hubo movimientos posteriores al cierre.
                                </p>
                                <p className="mt-1.5 text-xs text-amber-800/80">
                                    El monto del corte sigue siendo el del
                                    cierre; el desglose refleja el estado
                                    actual.
                                </p>
                            </div>
                        )}

                        {/* Isla — desglose (DesgloseJornada ya es su propia isla) */}
                        {desglose && <DesgloseJornada desglose={desglose} />}

                        {/* Isla — detalles del cierre */}
                        <section style={FILL} className={ISLA}>
                            <Titulo icon={ShieldCheck}>
                                Detalles del cierre
                            </Titulo>
                            <dl className="divide-y divide-stone-900/5">
                                <Propiedad label="Firma">
                                    {corte.firma_capturista || "—"}
                                </Propiedad>
                                <Propiedad label="Cierre">
                                    {formatFechaHora(corte.cerrado_at)}
                                </Propiedad>
                                <Propiedad label="Intentos">
                                    {intentos.length}
                                </Propiedad>
                            </dl>
                        </section>

                        {/* Isla — historial de declaraciones */}
                        {intentos.length > 0 && (
                            <section style={FILL} className={ISLA}>
                                <Titulo icon={History}>
                                    Historial de declaraciones
                                </Titulo>
                                <ol>
                                    {intentos.map((i, idx) => {
                                        const coincide = i.diferencia === 0;
                                        const ultimo =
                                            idx === intentos.length - 1;
                                        return (
                                            <li
                                                key={i.numero}
                                                className={`relative pl-9 ${ultimo ? "" : "pb-5"}`}
                                            >
                                                {!ultimo && (
                                                    <span
                                                        aria-hidden="true"
                                                        className="absolute left-[11px] top-7 bottom-0 w-px bg-stone-300/70"
                                                    />
                                                )}
                                                <span
                                                    aria-hidden="true"
                                                    className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center border ${
                                                        coincide
                                                            ? "bg-emerald-100 border-emerald-200 text-emerald-600"
                                                            : "bg-amber-100 border-amber-200 text-amber-600"
                                                    }`}
                                                >
                                                    {coincide ? (
                                                        <CircleCheck
                                                            size={14}
                                                        />
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                    )}
                                                </span>
                                                <div className="flex items-baseline justify-between gap-3">
                                                    <span className="text-sm font-bold text-stone-800">
                                                        Intento {i.numero}
                                                    </span>
                                                    <span className="text-xs text-stone-400 tabular-nums">
                                                        {formatHora(i.at)}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
                                                    <span className="text-stone-600">
                                                        Declaró{" "}
                                                        <b className="font-semibold text-stone-800 tabular-nums">
                                                            {formatCurrency(
                                                                i.declarado,
                                                            )}
                                                        </b>
                                                    </span>
                                                    <span
                                                        className={`font-semibold tabular-nums ${
                                                            coincide
                                                                ? "text-emerald-600"
                                                                : "text-amber-600"
                                                        }`}
                                                    >
                                                        {coincide
                                                            ? "Coincide"
                                                            : `Diferencia ${i.diferencia > 0 ? "+" : "−"}${formatCurrency(Math.abs(i.diferencia))}`}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>
                        )}

                        {/* Isla — nota */}
                        {corte.nota_diferencia && (
                            <section style={FILL} className={ISLA}>
                                <Titulo icon={FileText}>
                                    Nota del cierre con diferencia
                                </Titulo>
                                <blockquote className="border-l-2 border-orange-300 pl-4 text-sm leading-relaxed text-stone-700">
                                    “{corte.nota_diferencia}”
                                </blockquote>
                            </section>
                        )}

                        {/* Isla — reapertura realizada */}
                        {corte.reabierto_at && (
                            <section style={FILL_NARANJA} className={ISLA}>
                                <Titulo icon={RotateCcw}>
                                    Corte reabierto
                                </Titulo>
                                <div className="text-sm text-orange-950">
                                    Reabierto por <b>{corte.reabierto_por}</b>
                                </div>
                                <div className="text-xs text-orange-800/80 tabular-nums">
                                    {formatFechaHora(corte.reabierto_at)}
                                </div>
                                {corte.motivo_reapertura && (
                                    <div className="mt-3 pt-3 border-t border-orange-200/70">
                                        <div className="text-[11px] font-semibold text-orange-700 mb-0.5">
                                            Motivo
                                        </div>
                                        <p className="text-sm text-orange-900 leading-relaxed">
                                            {corte.motivo_reapertura}
                                        </p>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Isla — acciones administrativas */}
                        {puedeReabrir && (
                            <section style={FILL} className={ISLA}>
                                <Titulo icon={LockKeyhole}>
                                    Acciones administrativas
                                </Titulo>
                                {!confirmando ? (
                                    <button
                                        onClick={() => setConfirmando(true)}
                                        className="group w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                                    >
                                        <RotateCcw
                                            size={16}
                                            className="transition-transform group-hover:-rotate-45"
                                            aria-hidden="true"
                                        />
                                        Reabrir corte
                                    </button>
                                ) : (
                                    <div
                                        role="alertdialog"
                                        aria-labelledby="reabrir-titulo"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="shrink-0 w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                                                <RotateCcw
                                                    size={18}
                                                    aria-hidden="true"
                                                />
                                            </div>
                                            <div>
                                                <div
                                                    id="reabrir-titulo"
                                                    className="font-bold text-stone-800"
                                                >
                                                    ¿Reabrir este corte?
                                                </div>
                                                <p className="mt-1 text-sm text-stone-600 leading-relaxed">
                                                    El capturista podrá volver a
                                                    registrar pagos.
                                                </p>
                                                <p className="mt-1 text-sm font-medium text-stone-700">
                                                    Este corte solo puede
                                                    reabrirse una vez.
                                                </p>
                                            </div>
                                        </div>

                                        {errorReabrir && (
                                            <div
                                                role="alert"
                                                className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700"
                                            >
                                                <div className="font-semibold">
                                                    No fue posible reabrir el
                                                    corte.
                                                </div>
                                                <div className="text-red-600">
                                                    {errorReabrir}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-5 flex gap-3">
                                            <button
                                                onClick={() => {
                                                    setConfirmando(false);
                                                    setErrorReabrir(null);
                                                }}
                                                disabled={reabriendo}
                                                className="flex-1 py-2.5 rounded-xl font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 active:scale-[0.98] transition-all disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleReabrir}
                                                disabled={reabriendo}
                                                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-500 hover:to-orange-700 shadow-[0_8px_18px_-8px_rgba(234,88,12,0.7),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
                                            >
                                                {reabriendo
                                                    ? "Reabriendo…"
                                                    : "Sí, reabrir"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
