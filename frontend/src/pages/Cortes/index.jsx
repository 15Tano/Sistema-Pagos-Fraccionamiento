import { useCallback, useState } from "react";
import GlassPanel from "../../components/GlassPanel";
import { useCortes } from "./hooks/useCortes";
import FiltrosCortes from "./components/FiltrosCortes";
import ListaCortes from "./components/ListaCortes";
import DetalleCorte from "./components/DetalleCorte";

export default function Cortes() {
    const {
        cortes,
        meta,
        loading,
        error,
        filtros,
        setFiltro,
        limpiarFiltros,
        page,
        setPage,
        refetch,
    } = useCortes();

    const [seleccionado, setSeleccionado] = useState(null);
    const cerrarDetalle = useCallback(() => setSeleccionado(null), []);

    return (
        <div className="flex flex-col gap-5 h-full pb-20 md:pb-0">
            <GlassPanel size="lg">
                <FiltrosCortes
                    filtros={filtros}
                    onChange={setFiltro}
                    onLimpiar={limpiarFiltros}
                />
            </GlassPanel>

            <GlassPanel size="lg" className="!p-0">
                <div className="px-6 py-4 border-b border-white/40 bg-white/20 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-stone-800">
                        Historial de cortes
                    </h3>
                    <span className="text-xs font-semibold text-stone-500">
                        {meta.total} {meta.total === 1 ? "corte" : "cortes"}
                    </span>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-10 gap-3">
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-stone-500 text-sm font-medium">
                            Cargando cortes...
                        </span>
                    </div>
                )}

                {!loading && error && (
                    <div className="py-10 text-center text-sm text-red-600">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <ListaCortes cortes={cortes} onSelect={setSeleccionado} />
                )}

                {meta.last_page > 1 && (
                    <div className="px-6 py-4 border-t border-white/40 flex items-center justify-between">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-stone-600 bg-white/50 hover:bg-white/80 border border-white/70 disabled:opacity-40"
                        >
                            Anterior
                        </button>
                        <span className="text-xs font-semibold text-stone-500">
                            Página {page} de {meta.last_page}
                        </span>
                        <button
                            onClick={() =>
                                setPage((p) => Math.min(meta.last_page, p + 1))
                            }
                            disabled={page >= meta.last_page}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-stone-600 bg-white/50 hover:bg-white/80 border border-white/70 disabled:opacity-40"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </GlassPanel>

            {seleccionado && (
                <DetalleCorte
                    uuid={seleccionado}
                    onClose={cerrarDetalle}
                    onReabierto={refetch}
                />
            )}
        </div>
    );
}
