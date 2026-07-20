import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TIPO_CONFIG } from "../dashboardHelpers";

export default function TablonAvisoResidente({ avisos }) {
    const [imagenAmpliada, setImagenAmpliada] = useState(null);
    const [imagenVisible, setImagenVisible] = useState(false);

    useEffect(() => {
        if (imagenAmpliada) {
            document.body.style.overflow = "hidden";
            requestAnimationFrame(() => setImagenVisible(true));
        } else {
            document.body.style.overflow = "auto";
            setImagenVisible(false);
        }

        return () => {
            document.body.style.overflow = "auto";
        };
    }, [imagenAmpliada]);

    const closeImagen = () => {
        setImagenVisible(false);
        setTimeout(() => setImagenAmpliada(null), 300);
    };

    if (avisos.length === 0) return null;

    return (
        <div className="relative overflow-hidden p-6 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            {/* Brillo superior */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <div className="flex items-center gap-2 mb-5">
                <svg
                    className="w-5 h-5 text-orange-400 drop-shadow-sm"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                    />
                </svg>
                <h3 className="text-sm font-bold text-stone-800 tracking-wide uppercase">
                    Tablón de Avisos
                </h3>
            </div>

            <div className="space-y-3">
                {avisos.map((aviso) => {
                    const cfg = TIPO_CONFIG[aviso.tipo] || TIPO_CONFIG.informativo;
                    return (
                        <div
                            key={aviso.id}
                            className={`relative overflow-hidden rounded-2xl border p-4 bg-white/50 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_2px_8px_rgba(0,0,0,0.02)] ${cfg.border} hover:bg-white/60 transition-colors duration-300`}
                        >
                            <div className="flex items-start gap-3 relative z-10">
                                <span
                                    className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <p className={`text-sm font-bold ${cfg.text}`}>
                                            {aviso.titulo}
                                        </p>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border} backdrop-blur-sm`}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-stone-600 leading-relaxed">
                                        {aviso.descripcion}
                                    </p>

                                    {aviso.imagen_url && (
                                        <button
                                            onClick={() => setImagenAmpliada(aviso.imagen_url)}
                                            className="mt-3 block w-full max-w-xs rounded-xl overflow-hidden border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:opacity-90 active:scale-[0.98] transition-all"
                                        >
                                            <img
                                                src={aviso.imagen_url}
                                                alt={aviso.titulo}
                                                className="w-full h-40 object-cover"
                                            />
                                        </button>
                                    )}

                                    <p className="text-xs text-stone-400 mt-2 font-medium">
                                        {new Date(aviso.created_at).toLocaleDateString("es-MX", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {imagenAmpliada &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
                        style={{ touchAction: "manipulation" }}
                        onClick={closeImagen}
                    >
                        <div
                            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300"
                            style={{ opacity: imagenVisible ? 1 : 0 }}
                        />

                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-lg flex flex-col bg-white/45 backdrop-blur-[5px] backdrop-saturate-200 border-t border-l border-white/70 border-r border-b border-white/30 z-10 overflow-hidden"
                            style={{
                                maxHeight: "90dvh",
                                borderRadius: imagenVisible ? "2rem" : "9999px",
                                transform: imagenVisible ? "scale(1)" : "scale(0.35)",
                                opacity: imagenVisible ? 1 : 0,
                                filter: imagenVisible ? "blur(0px)" : "blur(4px)",
                                transformOrigin: "center",
                                transition:
                                    "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, filter 0.35s ease-out",
                                boxShadow:
                                    "0 25px 70px rgba(0,0,0,0.15), inset 0 2px 10px rgba(255,255,255,0.6)",
                            }}
                        >
                            <div className="flex items-center justify-end p-4 border-b border-white/30 shrink-0">
                                <button
                                    onClick={closeImagen}
                                    className="p-2 text-stone-500 hover:text-stone-800 bg-white/40 hover:bg-white/70 rounded-full transition-all active:scale-95"
                                >
                                    <svg
                                        className="w-5 h-5"
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
                            </div>

                            <div className="p-5 overflow-y-auto flex items-center justify-center">
                                <img
                                    src={imagenAmpliada}
                                    alt="Aviso ampliado"
                                    className="w-full h-auto object-contain rounded-xl border border-white/60"
                                    style={{
                                        touchAction: "manipulation",
                                        maxHeight: "65dvh",
                                    }}
                                />
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
