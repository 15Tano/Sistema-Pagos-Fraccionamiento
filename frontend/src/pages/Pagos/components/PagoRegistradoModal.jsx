import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatMes } from "../fechas";

const AUTO_CLOSE_MS = 2700;

// Calcula el rango de meses a mostrar. Es una estimación visual: el backend
// puede saltarse meses ya pagados dentro del rango, así que esto no es
// garantía exacta de qué meses quedaron registrados, solo una etiqueta legible.
function periodoLabel(mes, mesesPagados) {
    if (!mes) return "";
    if (mesesPagados <= 1) return formatMes(mes);
    const [y, m] = mes.split("-").map(Number);
    const fin = new Date(y, m - 1 + (mesesPagados - 1), 1);
    const mesFin = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}`;
    return `${formatMes(mes)} – ${formatMes(mesFin)}`;
}

// ── MODAL DE CONFIRMACIÓN: PAGO REGISTRADO ──
// Se proyecta sobre la pantalla estilo banco (HDMI) para que el vecino
// vea en el momento que su pago quedó asentado. Cierra con click en
// cualquier parte, o solo, a los 2.7s (barra de progreso lo indica).
export default function PagoRegistradoModal({ pago, onClose }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!pago) {
            setVisible(false);
            return;
        }
        const raf = requestAnimationFrame(() => setVisible(true));
        const closeTimer = setTimeout(onClose, AUTO_CLOSE_MS);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(closeTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pago]);

    if (!pago) return null;

    const fechaHoraLabel = pago.fechaHora.toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 cursor-pointer"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-stone-900/40 backdrop-blur-md transition-opacity duration-200 ${
                    visible ? "opacity-100" : "opacity-0"
                }`}
            />

            {/* Modal */}
            <div
                className={`relative w-full max-w-md bg-white/50 backdrop-blur-2xl backdrop-saturate-150 border-t border-l border-white/90 border-r border-b border-white/40 rounded-[2.5rem] shadow-[0_25px_70px_rgba(16,60,30,0.25),inset_0_2px_10px_rgba(255,255,255,0.9)] p-10 text-center overflow-hidden transition-all duration-200 ease-out ${
                    visible
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-90 translate-y-4"
                }`}
            >
                {/* Wash verde de fondo, sutil, sobre el vidrio */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-green-200/40 via-transparent to-emerald-200/30" />
                {/* Brillo superior tipo glass-card-shine */}
                <div className="pointer-events-none absolute top-0 left-1/5 right-1/5 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />

                <div className="relative">
                    {/* Check con "pop" y anillo de pulso — aparece con delay sobre el modal */}
                    <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
                        <span className="absolute inset-0 rounded-full bg-green-400/50 animate-ping" />
                        <span className="absolute inset-0 rounded-full bg-green-400/30 blur-md" />
                        <div
                            className={`relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center shadow-[0_10px_25px_rgba(34,197,94,0.45),inset_0_2px_4px_rgba(255,255,255,0.5)] transition-all duration-[180ms] delay-75 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                visible
                                    ? "scale-100 opacity-100"
                                    : "scale-0 opacity-0"
                            }`}
                        >
                            <svg
                                className={`w-11 h-11 text-white drop-shadow-sm transition-all duration-150 delay-[220ms] ${
                                    visible
                                        ? "scale-100 opacity-100"
                                        : "scale-50 opacity-0"
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
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

                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700/70 mb-2">
                        Pago Registrado
                    </p>
                    <h3 className="text-3xl font-extrabold text-stone-800 leading-tight drop-shadow-sm">
                        {pago.nombre}
                    </h3>
                    <p className="text-sm font-semibold text-stone-500 mt-1.5">
                        {pago.calle} #{pago.numero_casa}
                    </p>
                    <p className="text-xs font-medium text-stone-400 mt-1 mb-7">
                        {fechaHoraLabel}
                        {pago.folio ? ` · Folio ${pago.folio}` : ""}
                    </p>

                    {/* Chip de monto — última pieza en aparecer */}
                    <div
                        className={`inline-flex flex-col items-center px-8 py-5 rounded-[1.75rem] bg-white/50 backdrop-blur-md border border-white/70 shadow-[inset_0_2px_6px_rgba(255,255,255,0.8),0_4px_16px_rgba(16,60,30,0.08)] transition-all duration-150 delay-[300ms] ${
                            visible
                                ? "opacity-100 translate-y-0"
                                : "opacity-0 translate-y-3"
                        }`}
                    >
                        <p className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500 drop-shadow-sm">
                            ${pago.total.toLocaleString("es-MX")}
                        </p>
                        <p className="text-[11px] font-semibold text-stone-500 mt-1.5 uppercase tracking-wide">
                            {periodoLabel(pago.mes, pago.mesesPagados)} ·{" "}
                            {pago.tipo === "extraordinario"
                                ? "Extraordinario"
                                : "Ordinario"}
                        </p>
                    </div>

                    {/* Barra de progreso de auto-cierre */}
                    <div className="mt-8 h-1 w-full rounded-full bg-white/40 overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-[width] duration-[2700ms] ease-linear ${
                                visible ? "w-0" : "w-full"
                            }`}
                        />
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
