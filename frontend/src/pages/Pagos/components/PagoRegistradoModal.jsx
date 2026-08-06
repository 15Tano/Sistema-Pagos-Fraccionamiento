// ── MODAL DE CONFIRMACIÓN: PAGO REGISTRADO ──
// Se muestra sobre la pantalla proyectada (HDMI) para que el vecino vea
// en el momento que su pago quedó asentado. Cierra con click en cualquier
// parte (dentro o fuera del modal).
export default function PagoRegistradoModal({ pago, onClose }) {
    if (!pago) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-gradient-to-br from-green-50/95 to-emerald-50/95 backdrop-blur-2xl border-t border-l border-white/80 border-r border-b border-white/40 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.15),inset_0_2px_10px_rgba(255,255,255,0.8)] p-10 text-center">
                <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center shadow-[0_8px_20px_rgba(34,197,94,0.35)]">
                    <svg
                        className="w-11 h-11 text-white"
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

                <p className="text-xs font-semibold uppercase tracking-widest text-green-700/70 mb-1">
                    Pago Registrado
                </p>
                <h3 className="text-2xl font-extrabold text-stone-800 mb-1">
                    {pago.nombre}
                </h3>
                <p className="text-sm font-medium text-stone-500 mb-6">
                    {pago.calle} #{pago.numero_casa}
                </p>

                <p className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500 drop-shadow-sm mb-2">
                    ${pago.total.toLocaleString("es-MX")}
                </p>
                <p className="text-xs font-medium text-stone-500">
                    {pago.mesesPagados} mes{pago.mesesPagados > 1 ? "es" : ""} ·{" "}
                    {pago.tipo === "extraordinario"
                        ? "Extraordinario"
                        : "Ordinario"}
                </p>

                <p className="mt-8 text-[11px] font-medium text-stone-400">
                    Toca la pantalla para cerrar
                </p>
            </div>
        </div>
    );
}
