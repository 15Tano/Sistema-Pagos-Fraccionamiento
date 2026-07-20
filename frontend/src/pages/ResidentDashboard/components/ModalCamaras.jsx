export default function ModalCamaras({ isOpen, isVisible, onClose }) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            style={{ touchAction: "manipulation" }}
            onClick={onClose}
        >
            <div
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300"
                style={{ opacity: isVisible ? 1 : 0 }}
            />

            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-lg flex flex-col bg-white/45 backdrop-blur-[5px] backdrop-saturate-200 border-t border-l border-white/70 border-r border-b border-white/30 z-10 overflow-hidden"
                style={{
                    maxHeight: "90dvh",
                    borderRadius: isVisible ? "2rem" : "9999px",
                    transform: isVisible ? "scale(1)" : "scale(0.35)",
                    opacity: isVisible ? 1 : 0,
                    filter: isVisible ? "blur(0px)" : "blur(4px)",
                    transformOrigin: "top right",
                    transition:
                        "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, filter 0.35s ease-out",
                    boxShadow: "0 25px 70px rgba(0,0,0,0.15), inset 0 2px 10px rgba(255,255,255,0.6)",
                }}
            >
                <div className="flex items-center justify-between p-5 border-b border-white/30 shrink-0">
                    <h3 className="text-lg font-bold text-stone-800">Rango de Cámaras</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-stone-500 hover:text-stone-800 bg-white/40 hover:bg-white/70 rounded-full transition-all active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <div className="p-5 overflow-y-auto">
                    <img
                        src="/CAMARAS_page-0001.jpg"
                        alt="Rango de cámaras de seguridad"
                        className="w-full h-auto object-contain rounded-xl border border-white/60"
                        style={{ touchAction: "manipulation" }}
                    />
                </div>
            </div>
        </div>
    );
}
