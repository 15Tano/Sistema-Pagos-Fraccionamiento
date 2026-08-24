import { createPortal } from "react-dom";

const LIMITE_PREGUNTA = 500;
const LIMITE_DESCRIPCION = 1000;
const LIMITE_OPCION = 300;

function Contador({ actual, limite }) {
    const cerca = actual >= limite * 0.9;
    return (
        <span
            className={`text-[10px] font-bold ${cerca ? "text-orange-500" : "text-stone-400"}`}
        >
            {actual}/{limite}
        </span>
    );
}

export default function EncuestaModal({
    open,
    form,
    setForm,
    saving,
    onClose,
    onSave,
}) {
    if (!open) return null;

    const handleOpcionChange = (index, value) => {
        const nuevas = [...form.opciones];
        nuevas[index] = value;
        setForm({ ...form, opciones: nuevas });
    };

    const addOpcion = () => {
        if (form.opciones.length >= 8) return;
        setForm({ ...form, opciones: [...form.opciones, ""] });
    };

    const removeOpcion = (index) => {
        if (form.opciones.length <= 2) return;
        setForm({
            ...form,
            opciones: form.opciones.filter((_, i) => i !== index),
        });
    };

    const opcionesValidas = form.opciones.filter((o) => o.trim()).length >= 2;
    const puedeGuardar = form.pregunta.trim() && opcionesValidas;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white/40 backdrop-blur-sm border-t border-l border-white/80 border-r border-b border-white/40 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.8)] p-8 z-10">
                <h3 className="text-xl font-bold text-stone-800 mb-6 drop-shadow-sm">
                    Nueva encuesta
                </h3>

                <div className="space-y-4">
                    <div>
                        <input
                            type="text"
                            placeholder="Pregunta"
                            maxLength={LIMITE_PREGUNTA}
                            value={form.pregunta}
                            onChange={(e) =>
                                setForm({ ...form, pregunta: e.target.value })
                            }
                            className="w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400 transition-all font-semibold text-stone-700"
                        />
                        <div className="flex justify-end mt-1 px-1">
                            <Contador
                                actual={form.pregunta.length}
                                limite={LIMITE_PREGUNTA}
                            />
                        </div>
                    </div>

                    <div>
                        <textarea
                            rows={2}
                            placeholder="Descripción breve (opcional)"
                            maxLength={LIMITE_DESCRIPCION}
                            value={form.descripcion}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    descripcion: e.target.value,
                                })
                            }
                            className="w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400 transition-all font-medium text-stone-600 resize-none"
                        />
                        <div className="flex justify-end mt-1 px-1">
                            <Contador
                                actual={form.descripcion.length}
                                limite={LIMITE_DESCRIPCION}
                            />
                        </div>
                    </div>

                    {/* Opciones dinámicas */}
                    <div className="p-4 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/50">
                        <p className="text-xs font-bold text-stone-500 mb-3 uppercase tracking-wide">
                            Opciones
                        </p>
                        <div className="space-y-2">
                            {form.opciones.map((opcion, i) => (
                                <div key={i}>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder={`Opción ${i + 1}`}
                                            maxLength={LIMITE_OPCION}
                                            value={opcion}
                                            onChange={(e) =>
                                                handleOpcionChange(
                                                    i,
                                                    e.target.value,
                                                )
                                            }
                                            className="flex-1 px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                                        />
                                        {form.opciones.length > 2 && (
                                            <button
                                                onClick={() => removeOpcion(i)}
                                                className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg transition-colors"
                                            >
                                                <svg
                                                    className="w-4 h-4"
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
                                        )}
                                    </div>
                                    <div className="flex justify-end mt-0.5 px-1">
                                        <Contador
                                            actual={opcion.length}
                                            limite={LIMITE_OPCION}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {form.opciones.length < 8 && (
                            <button
                                onClick={addOpcion}
                                className="flex items-center gap-1 mt-2 text-xs font-bold text-orange-500 hover:text-orange-600"
                            >
                                <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                                Agregar opción
                            </button>
                        )}
                        <p className="text-[10px] text-stone-400 mt-2">
                            Máximo 8 opciones · {LIMITE_OPCION} caracteres cada
                            una
                        </p>
                    </div>

                    {/* Fecha de cierre opcional */}
                    <div className="p-4 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/50">
                        <p className="text-xs font-bold text-stone-500 mb-3 uppercase tracking-wide">
                            Cierre automático (opcional)
                        </p>
                        <input
                            type="date"
                            value={form.fecha_cierre}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    fecha_cierre: e.target.value,
                                })
                            }
                            className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-stone-600 bg-white/40 backdrop-blur-sm border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 active:scale-95 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={saving || !puedeGuardar}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 shadow-[0_4px_15px_rgba(249,115,22,0.3),inset_0_2px_4px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:shadow-none disabled:transform-none active:scale-95 transition-all"
                    >
                        {saving ? "Publicando..." : "Publicar encuesta"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
