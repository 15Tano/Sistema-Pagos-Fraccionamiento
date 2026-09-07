export default function AccionesRapidas({ onAbrirCorreo, onAbrirCamaras }) {
    return (
        <div className="flex items-center gap-3">
            <button
                onClick={onAbrirCorreo}
                style={{ touchAction: "manipulation" }}
                className="accion-btn flex items-center gap-2.5 flex-1 min-w-0 px-4 py-2.5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 rounded-2xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_8px_rgba(0,0,0,0.03)] hover:bg-white/60 active:scale-[0.98] transition-all duration-200 text-left"
            >
                <svg
                    className="w-4 h-4 text-orange-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                </svg>
                <span className="text-xs font-semibold text-stone-600 truncate">
                    casetasanisidro088@gmail.com
                </span>
            </button>

            <button
                onClick={onAbrirCamaras}
                title="Ver rango de cámaras"
                style={{ touchAction: "manipulation" }}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_4px_14px_rgba(0,0,0,0.05),inset_0_1px_2px_rgba(255,255,255,0.9)] hover:bg-white/75 active:scale-95 transition-all duration-200"
            >
                <svg
                    className="w-5 h-5 text-stone-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                </svg>
            </button>
        </div>
    );
}
