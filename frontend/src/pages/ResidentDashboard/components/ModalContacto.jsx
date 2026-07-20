/**
 * Modal de contacto genérico. Se usa dos veces con estilos ligeramente
 * distintos (dashboard normal vs. pantalla de bloqueo), por eso el
 * fondo del modal, el origen de la transformación y el email son props.
 */
export default function ModalContacto({
    isOpen,
    isVisible,
    onClose,
    email,
    titulo = "Contacto de Vigilancia",
    boxClassName = "bg-white/55 backdrop-blur-[20px] backdrop-saturate-200 border-t border-l border-white/70 border-r border-b border-white/30",
    transformOrigin = "bottom right",
}) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ touchAction: "manipulation" }}
            onClick={onClose}
        >
            <div
                className="absolute inset-0 bg-stone-900/25 transition-opacity duration-300"
                style={{ opacity: isVisible ? 1 : 0 }}
            />
            <div
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full max-w-sm p-6 z-10 ${boxClassName}`}
                style={{
                    borderRadius: isVisible ? "2rem" : "9999px",
                    transform: isVisible ? "scale(1)" : "scale(0.4)",
                    opacity: isVisible ? 1 : 0,
                    filter: isVisible ? "blur(0px)" : "blur(4px)",
                    transformOrigin,
                    transition:
                        "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, filter 0.35s ease-out",
                    boxShadow: "0 25px 70px rgba(0,0,0,0.15), inset 0 2px 10px rgba(255,255,255,0.6)",
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-stone-800">{titulo}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-stone-500 hover:text-stone-800 bg-white/50 hover:bg-white/70 rounded-full transition-all active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <p className="text-sm text-stone-600 leading-relaxed">
                    Para quejas, sugerencias, solicitud de video u otro tema relacionado con
                    seguridad, escribe a:
                </p>
                <p className="text-sm font-bold text-orange-500 mt-2 break-all">{email}</p>
            </div>
        </div>
    );
}
