import { useState } from "react";
import { useVecinoSearch } from "../hooks/useVecinoSearch";
import VecinoBuscador from "./VecinoBuscador";
import ConfirmEliminarModal from "./ConfirmEliminarModal";

// ⚠️ CONFIRMAR CON EL BACKEND: no vi un endpoint de "eliminar acceso" en el
// código que compartiste. Siguiendo la convención simétrica a
// "/vecinos/registro-acceso" (POST), asumí "/vecinos/eliminar-acceso" (POST
// con { vecino_id }). Si el back expone otra cosa (por ejemplo
// DELETE /vecinos/{id}/acceso), solo hay que ajustar esta constante.
const ELIMINAR_ACCESO_ENDPOINT = "/vecinos/eliminar-acceso";

export default function EliminarAccesoForm({ call, onSuccess }) {
    const {
        vecinoSearch,
        vecinoResults,
        showDropdown,
        selectedVecino,
        vecinoError,
        handleVecinoSearch,
        selectVecino,
        clearVecino,
        setShowDropdown,
    } = useVecinoSearch(call, { onlyConAcceso: true });

    const [loading, setLoading] = useState(false);
    const [globalError, setGlobalError] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);

    const handleEliminar = async () => {
        setGlobalError("");
        setLoading(true);
        try {
            await call("post", ELIMINAR_ACCESO_ENDPOINT, {
                vecino_id: selectedVecino.id,
            });
            onSuccess({ vecino: selectedVecino });
        } catch (err) {
            setGlobalError(
                err.response?.data?.message ||
                    "Ocurrió un error al eliminar el acceso. Intenta de nuevo.",
            );
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    };

    return (
        <div className="space-y-7">
            {globalError && (
                <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    {globalError}
                </div>
            )}

            <VecinoBuscador
                label="Seleccionar Vecino con Acceso"
                placeholder="Buscar por nombre o número de casa..."
                vecinoSearch={vecinoSearch}
                vecinoResults={vecinoResults}
                showDropdown={showDropdown}
                selectedVecino={selectedVecino}
                error={vecinoError}
                disabled={loading}
                onChange={handleVecinoSearch}
                onFocus={() => vecinoResults.length > 0 && setShowDropdown(true)}
                onSelect={selectVecino}
                onClear={clearVecino}
                renderBadge={() => (
                    <span className="text-xs text-red-700 bg-red-100/80 border border-red-200 px-2.5 py-1 rounded-full font-bold flex-shrink-0">
                        Tiene acceso
                    </span>
                )}
            />

            <button
                type="button"
                onClick={() => selectedVecino && setShowConfirm(true)}
                disabled={loading || !selectedVecino}
                className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-base font-bold transition-all shadow-lg shadow-red-600/30 hover:shadow-red-600/50 hover:-translate-y-0.5 active:translate-y-0"
            >
                {loading ? "Eliminando acceso..." : "Eliminar credenciales"}
            </button>

            {showConfirm && (
                <ConfirmEliminarModal
                    vecino={selectedVecino}
                    onCancel={() => setShowConfirm(false)}
                    onConfirm={handleEliminar}
                    loading={loading}
                />
            )}
        </div>
    );
}
