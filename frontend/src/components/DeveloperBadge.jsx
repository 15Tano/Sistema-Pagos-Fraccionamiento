import { ShieldCheck, X } from "lucide-react";
import useModal from "../pages/ResidentDashboard/useModal";

const NOMBRE_DESARROLLADOR = "Sebastián Espinoza Díaz";

export default function DeveloperBadge() {
    const { isOpen, isVisible, open, close } = useModal();

    return (
        <>
            {/* Badge fijo */}
            <button
                onClick={open}
                className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.8)] hover:bg-white/70 transition-all duration-300 active:scale-95"
            >
                <ShieldCheck
                    className="w-3.5 h-3.5 text-orange-500"
                    strokeWidth={2.5}
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Sistema verificado
                </span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                    style={{ touchAction: "manipulation" }}
                    onClick={close}
                >
                    <div
                        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300"
                        style={{ opacity: isVisible ? 1 : 0 }}
                    />

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm flex flex-col bg-white/45 backdrop-blur-[5px] backdrop-saturate-200 border-t border-l border-white/70 border-r border-b border-white/30 z-10 overflow-hidden"
                        style={{
                            maxHeight: "90dvh",
                            borderRadius: isVisible ? "2rem" : "9999px",
                            transform: isVisible ? "scale(1)" : "scale(0.35)",
                            opacity: isVisible ? 1 : 0,
                            filter: isVisible ? "blur(0px)" : "blur(4px)",
                            transformOrigin: "bottom right",
                            transition:
                                "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, filter 0.35s ease-out",
                            boxShadow:
                                "0 25px 70px rgba(0,0,0,0.15), inset 0 2px 10px rgba(255,255,255,0.6)",
                        }}
                    >
                        <button
                            onClick={close}
                            className="absolute top-4 right-4 p-2 text-stone-500 hover:text-stone-800 bg-white/40 hover:bg-white/70 rounded-full transition-all active:scale-95 z-10"
                        >
                            <X className="w-4 h-4" strokeWidth={2.5} />
                        </button>

                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-orange-50/80 border border-orange-200/60 flex items-center justify-center mb-4 shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_4px_10px_rgba(0,0,0,0.03)]">
                                <ShieldCheck
                                    className="w-8 h-8 text-orange-500"
                                    strokeWidth={2}
                                />
                            </div>

                            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">
                                Sistema verificado
                            </p>
                            <h3 className="text-lg font-bold text-stone-800 mb-1">
                                San Isidro 2.0
                            </h3>
                            <p className="text-sm text-stone-500 font-medium mb-6">
                                Desarrollado por {NOMBRE_DESARROLLADOR}
                            </p>

                            <div className="w-full border-t border-white/60 my-2" />

                            <p className="text-xs text-stone-500 leading-relaxed mt-4">
                                Cualquier cobro o solicitud de pago se gestiona
                                únicamente a través de la administración del
                                fraccionamiento. El desarrollador del sistema
                                nunca solicita pagos, transferencias ni datos
                                personales de forma directa.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
