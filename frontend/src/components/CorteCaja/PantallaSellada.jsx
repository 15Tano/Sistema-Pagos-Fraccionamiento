import { useEffect, useState } from "react";
import {
    Clock3,
    ListChecks,
    LockKeyhole,
    PenLine,
    ReceiptText,
    ShieldCheck,
    TriangleAlert,
} from "lucide-react";
import DesgloseJornada from "./DesgloseJornada";

export default function PantallaSellada({ corte, desglose }) {
    // FIX: el banner ya no vive en el flujo del layout (era `sticky top-0`
    // dentro de un contenedor sin scroll, así que en realidad solo ocupaba
    // espacio y empujaba las islas hacia abajo, recortando el contenido).
    // Ahora aparece como overlay `fixed` tras un pequeño delay, sin afectar
    // el alto del layout.
    const [mostrarBanner, setMostrarBanner] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMostrarBanner(true), 600);
        return () => clearTimeout(timer);
    }, []);

    if (!corte) return null;

    const conDiferencia = corte.estado === "cerrado_con_diferencia";
    const numeroIntentos = corte.intentos?.length ?? 0;
    const ultimoIntento =
        numeroIntentos > 0 ? corte.intentos[numeroIntentos - 1] : null;
    const hayBloqueDiferencia = conDiferencia && ultimoIntento;

    const formatCurrency = (valor) =>
        new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
        }).format(valor ?? 0);

    const formatHora = (isoString) => {
        if (!isoString) return "—";
        return new Intl.DateTimeFormat("es-MX", {
            timeZone: "America/Mexico_City",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(isoString));
    };

    const textoIntentos =
        numeroIntentos === 1 ? "1 intento" : `${numeroIntentos} intentos`;

    // Redujimos 1 fila porque sacamos el bloque de "Caja Sellada" hacia arriba
    const filasDerecha = 2 + (hayBloqueDiferencia ? 1 : 0);

    const acento = conDiferencia
        ? {
              glow: "bg-amber-500/15",
              badgeBg: "bg-amber-500/15",
              badgeBorder: "border-amber-400/30",
              badgeText: "text-amber-300",
              orbBg: "bg-amber-500/15",
              orbBorder: "border-amber-400/30",
              orbIcon: "text-amber-300",
              orbGlow: "bg-amber-400/25",
              bloqueoBg: "bg-amber-500/20", // Un poco más intenso para el banner
              bloqueoBorder: "border-amber-400/40",
          }
        : {
              glow: "bg-orange-500/15",
              badgeBg: "bg-orange-500/15",
              badgeBorder: "border-orange-400/30",
              badgeText: "text-orange-300",
              orbBg: "bg-orange-500/15",
              orbBorder: "border-orange-400/30",
              orbIcon: "text-orange-300",
              orbGlow: "bg-orange-400/25",
              bloqueoBg: "bg-orange-500/20", // Un poco más intenso para el banner
              bloqueoBorder: "border-orange-400/40",
          };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-2xl p-4 overflow-hidden">
            {/* FIX: banner ahora es `fixed` (overlay), no ocupa espacio en el
                flujo del layout, y aparece tras un delay via `mostrarBanner`. */}
            {mostrarBanner && (
                <div
                    className={`fixed top-4 inset-x-4 z-30 mx-auto max-w-3xl lg:max-w-4xl flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 rounded-[28px] border backdrop-blur-2xl p-5 sm:p-6 shadow-2xl animate-sellada-in ${acento.bloqueoBg} ${acento.bloqueoBorder}`}
                >
                    <div className="relative flex items-center justify-center shrink-0">
                        <div
                            className={`absolute w-16 h-16 rounded-full blur-2xl ${acento.orbGlow}`}
                        />
                        <div
                            className={`relative flex items-center justify-center w-14 h-14 rounded-2xl backdrop-blur-md border shadow-inner ${acento.orbBg} ${acento.orbBorder}`}
                        >
                            <LockKeyhole
                                className={`w-7 h-7 ${acento.orbIcon}`}
                            />
                        </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left mt-1 sm:mt-0">
                        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-white">
                            Caja sellada
                        </h2>
                        <p className="mt-1 text-sm sm:text-base font-medium text-white/90 leading-relaxed max-w-[70ch]">
                            No se pueden registrar más cobros ni modificaciones.
                            La caja permanecerá bloqueada en modo de solo
                            consulta hasta la apertura de la siguiente jornada.
                        </p>
                    </div>
                </div>
            )}

            {/* FIX: contenedor con scroll interno para que el contenido no
                se corte cuando no cabe en el viewport. */}
            <div className="relative w-full max-w-3xl lg:max-w-4xl max-h-full overflow-y-auto py-4 flex flex-col gap-4 lg:gap-5">
                <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-4 lg:gap-5">
                    <div
                        className={`absolute inset-x-10 top-1/4 h-56 blur-[80px] rounded-full pointer-events-none ${acento.glow}`}
                    />

                    {/* Isla: Desglose (Izquierda, abarca toda la altura de la derecha) */}
                    <div
                        className={`lg:col-start-1 lg:row-start-1 lg:[grid-row-end:span_${filasDerecha}] rounded-[28px] bg-white/[0.06] border border-white/12 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_25px_70px_-25px_rgba(0,0,0,0.65)] p-6 lg:p-7 animate-sellada-in`}
                        style={{ animationDelay: "100ms" }}
                    >
                        <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.15em] text-white/40 uppercase mb-4">
                            <ReceiptText className="w-3.5 h-3.5" />
                            Detalle de la jornada
                        </p>
                        <DesgloseJornada desglose={desglose} />
                    </div>

                    {/* Isla: Estado + Resultado (Derecha, arriba) */}
                    <div
                        className="lg:col-start-2 rounded-[28px] bg-white/[0.07] border border-white/15 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_25px_70px_-25px_rgba(0,0,0,0.7)] px-7 py-8 flex flex-col items-center text-center animate-sellada-in"
                        style={{ animationDelay: "150ms" }}
                    >
                        <div className="flex items-center justify-between w-full">
                            <p className="text-[11px] font-medium tracking-[0.15em] text-white/40 uppercase">
                                Cierre de jornada
                            </p>
                        </div>

                        <div className="relative flex items-center justify-center mt-4">
                            <div
                                className={`absolute w-16 h-16 rounded-full blur-2xl ${acento.orbGlow}`}
                            />
                            <div
                                className={`relative flex items-center justify-center w-16 h-16 rounded-2xl backdrop-blur-md border ${acento.orbBg} ${acento.orbBorder}`}
                            >
                                {conDiferencia ? (
                                    <TriangleAlert
                                        className={`w-7 h-7 ${acento.orbIcon}`}
                                    />
                                ) : (
                                    <ShieldCheck
                                        className={`w-7 h-7 ${acento.orbIcon}`}
                                    />
                                )}
                            </div>
                        </div>

                        <span
                            className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide ${acento.badgeBg} ${acento.badgeBorder} ${acento.badgeText}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {conDiferencia
                                ? "Diferencia registrada"
                                : "Conciliado"}
                        </span>

                        <p className="mt-3 text-lg font-bold text-white">
                            {conDiferencia
                                ? "Cerrado con diferencia"
                                : "Efectivo conciliado"}
                        </p>

                        <p
                            className="mt-4 text-4xl sm:text-5xl font-black tabular-nums text-white"
                            style={{
                                textShadow: "0 0 40px rgba(251,146,60,0.2)",
                            }}
                        >
                            {formatCurrency(corte.monto_sistema)}
                        </p>
                    </div>

                    {/* Isla: Registro del cierre (Derecha, medio) */}
                    <div
                        className="lg:col-start-2 rounded-[28px] bg-white/[0.06] border border-white/12 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_25px_70px_-25px_rgba(0,0,0,0.65)] p-6 lg:p-7 animate-sellada-in"
                        style={{ animationDelay: "200ms" }}
                    >
                        <p className="text-[11px] font-medium tracking-[0.15em] text-white/40 uppercase mb-3">
                            Detalles del cierre
                        </p>
                        <div className="flex flex-col gap-2.5">
                            <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-2 text-sm text-white/50">
                                    <PenLine className="w-3.5 h-3.5" />
                                    Firmado por
                                </span>
                                <span className="text-sm font-medium text-white truncate max-w-[60%] text-right">
                                    {corte.firma_capturista ?? "—"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-2 text-sm text-white/50">
                                    <Clock3 className="w-3.5 h-3.5" />
                                    Hora de cierre
                                </span>
                                <span className="text-sm font-medium text-white tabular-nums">
                                    {formatHora(corte.cerrado_at)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-2 text-sm text-white/50">
                                    <ListChecks className="w-3.5 h-3.5" />
                                    Intentos
                                </span>
                                <span className="text-sm font-medium text-white tabular-nums">
                                    {textoIntentos}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Isla: Diferencia registrada (Derecha, condicional) */}
                    {hayBloqueDiferencia && (
                        <div
                            className="lg:col-start-2 rounded-[28px] bg-amber-500/10 border border-amber-400/25 backdrop-blur-2xl px-6 py-5 animate-sellada-in"
                            style={{ animationDelay: "250ms" }}
                        >
                            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-300/90">
                                <TriangleAlert className="w-3.5 h-3.5" />
                                Diferencia registrada
                            </p>
                            <p className="mt-1.5 text-2xl font-bold tabular-nums text-amber-200">
                                {ultimoIntento.diferencia > 0 ? "+" : ""}
                                {formatCurrency(ultimoIntento.diferencia)}
                            </p>
                            {corte.nota_diferencia && (
                                <p className="mt-2 text-sm text-white/70">
                                    {corte.nota_diferencia}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes sellada-in {
                    from { opacity: 0; transform: translateY(8px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-sellada-in {
                    animation: sellada-in 450ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
            `}</style>
        </div>
    );
}
