import { createPortal } from "react-dom";

export default function ResultadosEncuestaModal({
    open,
    encuesta,
    resultados,
    loading,
    onClose,
}) {
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md bg-white/40 backdrop-blur-sm border-t border-l border-white/80 border-r border-b border-white/40 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.8)] p-8 z-10">
                <h3 className="text-lg font-bold text-stone-800 mb-1 drop-shadow-sm pr-8">
                    {encuesta?.pregunta}
                </h3>
                <p className="text-xs font-medium text-stone-500 mb-5">
                    {encuesta?.activa ? "Encuesta activa" : "Encuesta cerrada"}
                </p>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : resultados ? (
                    <>
                        <div className="space-y-2 mb-4">
                            {resultados.opciones.map((op, i) => (
                                <div
                                    key={i}
                                    className={`relative rounded-xl border overflow-hidden ${
                                        op.es_ganadora && op.votos > 0
                                            ? "border-orange-300 shadow-sm shadow-orange-400/20"
                                            : "border-white/60"
                                    }`}
                                >
                                    <div
                                        className="absolute inset-y-0 left-0 bg-orange-500/20"
                                        style={{ width: `${op.porcentaje}%` }}
                                    />
                                    <div className="relative z-10 flex items-center justify-between px-4 py-2.5 bg-white/40">
                                        <span className="text-sm font-semibold text-stone-700 flex items-center gap-1.5 truncate">
                                            {op.texto}
                                            {op.es_ganadora && op.votos > 0 && (
                                                <span className="text-xs">
                                                    👑
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs font-bold text-stone-600 shrink-0">
                                            {op.porcentaje}% · {op.votos} votos
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-center text-xs text-stone-400 mb-2">
                            {resultados.total_votos} vecinos han votado
                        </p>
                    </>
                ) : (
                    <p className="text-center text-sm text-stone-400 py-4">
                        No se pudieron cargar los resultados.
                    </p>
                )}

                <button
                    onClick={onClose}
                    className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold text-stone-600 bg-white/40 backdrop-blur-sm border border-white/60 hover:bg-white/70 active:scale-95 transition-all"
                >
                    Cerrar
                </button>
            </div>
        </div>,
        document.body,
    );
}
