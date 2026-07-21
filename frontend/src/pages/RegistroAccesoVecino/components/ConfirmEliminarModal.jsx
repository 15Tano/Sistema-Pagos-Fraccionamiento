import { AlertTriangleIcon } from "../icons";

export default function ConfirmEliminarModal({ vecino, onCancel, onConfirm, loading }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl p-7 max-w-[420px] w-full">
                <div className="w-14 h-14 bg-red-100 border border-red-200 rounded-2xl flex items-center justify-center mb-5 text-red-600">
                    <AlertTriangleIcon />
                </div>
                <h3 className="text-xl font-bold text-stone-800 mb-2">¿Eliminar acceso?</h3>
                <p className="text-stone-600 text-sm leading-relaxed mb-6">
                    Se eliminarán las credenciales de{" "}
                    <span className="font-bold text-stone-800">{vecino?.nombre}</span>. El
                    residente ya no podrá iniciar sesión hasta que se le creen credenciales
                    nuevas. Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-bold transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-bold transition-all"
                    >
                        {loading ? "Eliminando..." : "Sí, eliminar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
