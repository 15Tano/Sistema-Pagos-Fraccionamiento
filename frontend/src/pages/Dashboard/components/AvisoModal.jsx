import { createPortal } from "react-dom";
import { TIPO_CONFIG_ADMIN, TIPOS } from "../config/avisosConfig";

export default function AvisoModal({
    open,
    editing,
    form,
    setForm,
    preview,
    saving,
    onClose,
    onSave,
    onImagenChange,
    onRemoveImagen,
}) {
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white/40 backdrop-blur-sm border-t border-l border-white/80 border-r border-b border-white/40 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.8)] p-8 z-10 transform transition-all scale-100">
                <h3 className="text-xl font-bold text-stone-800 mb-6 drop-shadow-sm">
                    {editing ? "Editar aviso" : "Nuevo aviso"}
                </h3>

                <div className="space-y-4">
                    {/* Título */}
                    <input
                        type="text"
                        placeholder="Título"
                        value={form.titulo}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                titulo: e.target.value,
                            })
                        }
                        className="w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400 transition-all font-semibold text-stone-700"
                    />

                    {/* Descripción */}
                    <textarea
                        rows={3}
                        placeholder="Descripción del aviso..."
                        value={form.descripcion}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                descripcion: e.target.value,
                            })
                        }
                        className="w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400 transition-all font-medium text-stone-600 resize-none"
                    />

                    {/* Imagen */}
                    <div className="p-4 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/50">
                        <p className="text-xs font-bold text-stone-500 mb-3 uppercase tracking-wide">
                            Imagen (opcional)
                        </p>

                        {preview ? (
                            <div className="relative">
                                <img
                                    src={preview}
                                    alt="preview"
                                    className="w-full h-40 object-cover rounded-xl shadow-inner"
                                />
                                <button
                                    onClick={onRemoveImagen}
                                    className="absolute top-2 right-2 p-1.5 bg-stone-900/60 backdrop-blur-sm text-white rounded-full hover:bg-red-500/80 transition-colors"
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
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all">
                                <svg
                                    className="w-6 h-6 text-stone-400 mb-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                </svg>
                                <span className="text-xs font-medium text-stone-400">
                                    Subir imagen
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={onImagenChange}
                                />
                            </label>
                        )}
                    </div>

                    {/* Selector de tipo con círculos de color */}
                    <div className="p-4 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/50">
                        <p className="text-xs font-bold text-stone-700 mb-3 uppercase tracking-wide">
                            Prioridad
                        </p>
                        <div className="flex gap-4 justify-around">
                            {TIPOS.map((tipo) => {
                                const cfg = TIPO_CONFIG_ADMIN[tipo];
                                const selected = form.tipo === tipo;
                                return (
                                    <button
                                        key={tipo}
                                        onClick={() =>
                                            setForm({
                                                ...form,
                                                tipo,
                                            })
                                        }
                                        className="flex flex-col items-center gap-2 group outline-none"
                                        title={cfg.label}
                                    >
                                        <span
                                            className={`w-8 h-8 rounded-full ${cfg.dot} transition-all duration-300 ${
                                                selected
                                                    ? `ring-4 ring-offset-2 ring-offset-transparent ${cfg.ring} scale-110`
                                                    : "opacity-50 group-hover:opacity-80 group-hover:scale-105"
                                            }`}
                                        />
                                        <span
                                            className={`text-[10px] uppercase tracking-wide transition-all ${
                                                selected
                                                    ? "text-stone-800 font-bold"
                                                    : "text-stone-400 font-medium"
                                            }`}
                                        />
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-stone-600 bg-white/40 backdrop-blur-sm border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] hover:bg-white/70 active:scale-95 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={
                            saving ||
                            !form.titulo.trim() ||
                            !form.descripcion.trim()
                        }
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 shadow-[0_4px_15px_rgba(249,115,22,0.3),inset_0_2px_4px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:shadow-none disabled:transform-none active:scale-95 transition-all"
                    >
                        {saving
                            ? "Guardando..."
                            : editing
                              ? "Guardar cambios"
                              : "Publicar aviso"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
