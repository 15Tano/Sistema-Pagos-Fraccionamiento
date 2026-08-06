// ── MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ──
export default function ModalConfirmarEliminar({
    pago,
    onCancel,
    onConfirm,
    formatMes,
}) {
    if (!pago) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity"
            onClick={onCancel}
        >
            <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-sm bg-white/70 backdrop-blur-2xl border-t border-l border-white/80 border-r border-b border-white/40 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.8)] p-8 transform transition-all scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-stone-800 mb-2 drop-shadow-sm">
                    ¿Eliminar recibo de pago?
                </h3>
                <p className="text-sm font-medium text-stone-500 mb-6 leading-relaxed">
                    Se borrará permanentemente el pago de{" "}
                    <span className="font-semibold text-stone-700">
                        {pago.vecino?.nombre}
                    </span>{" "}
                    correspondiente a{" "}
                    <span className="font-semibold text-stone-700 capitalize">
                        {formatMes(pago.mes)}
                    </span>
                    . Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl border border-white/80 bg-white/50 text-stone-600 text-sm font-semibold hover:bg-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-400 text-white text-sm font-semibold hover:from-red-400 hover:to-red-500 shadow-[0_4px_15px_rgba(239,68,68,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all active:scale-95"
                    >
                        Sí, eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}
