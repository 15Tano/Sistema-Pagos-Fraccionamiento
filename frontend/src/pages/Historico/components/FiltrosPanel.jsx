import { useState } from "react";
import BuscadorVecino from "./BuscadorVecino";

function FiltrosPanel({ data }) {
    const [showMore, setShowMore] = useState(false);
    const {
        activeTab,
        uniqueCalles,
        selectedCalle,
        setSelectedCalle,
        selectedVecino,
        setSelectedVecino,
        selectedMonth,
        setSelectedMonth,
        selectedDate,
        setSelectedDate,
        selectedCollectionMonth,
        setSelectedCollectionMonth,
        searchTipo,
        setSearchTipo,
        showOnlyDue,
        setShowOnlyDue,
        searchNombre,
        setSearchNombre,
        filteredVecinos,
        clearFilters,
    } = data;

    // Solo "Tipo" queda detrás del acordeón — todo lo demás es de uso frecuente.
    const tieneFiltroSecundario =
        activeTab !== "resumen" && activeTab !== "adelantados";

    return (
        <div className="bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] relative z-10">
            <div className="flex flex-wrap gap-4 items-end">
                {/* Calle — ahora compacta, ya no se estira */}
                <div className="w-full sm:w-44">
                    <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                        Calle
                    </label>
                    <select
                        value={selectedCalle}
                        onChange={(e) => {
                            setSelectedCalle(e.target.value);
                            if (activeTab === "individual")
                                setSelectedVecino("");
                        }}
                        className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                    >
                        <option value="">Todas las calles</option>
                        {uniqueCalles.map((calle) => (
                            <option key={calle} value={calle}>
                                {calle}
                            </option>
                        ))}
                    </select>
                </div>

                {/* ── Filtro principal por pestaña — visible siempre, sin acordeón ── */}
                {activeTab === "individual" && (
                    <div className="flex-1 min-w-[220px]">
                        <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                            Vecino
                        </label>
                        <select
                            value={selectedVecino}
                            onChange={(e) => setSelectedVecino(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                        >
                            <option value="">Seleccionar vecino</option>
                            {filteredVecinos.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.nombre} - {v.calle} #{v.numero_casa}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {activeTab === "mensual" && (
                    <div className="w-full sm:w-48">
                        <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                            Mes Pagado
                        </label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                        />
                    </div>
                )}

                {activeTab === "mes_cobro" && (
                    <div className="w-full sm:w-48">
                        <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                            Mes de Cobro
                        </label>
                        <input
                            type="month"
                            value={selectedCollectionMonth}
                            onChange={(e) =>
                                setSelectedCollectionMonth(e.target.value)
                            }
                            className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                        />
                    </div>
                )}

                {activeTab === "por_dia" && (
                    <div className="w-full sm:w-48">
                        <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                            Fecha de Cobro
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                        />
                    </div>
                )}

                {/* Búsqueda por nombre — solo en Resumen */}
                {activeTab === "resumen" && (
                    <BuscadorVecino
                        value={searchNombre}
                        onChange={setSearchNombre}
                    />
                )}

                {activeTab === "resumen" && (
                    <div className="flex items-center gap-2 pb-2">
                        <input
                            type="checkbox"
                            id="showOnlyDue"
                            checked={showOnlyDue}
                            onChange={(e) => setShowOnlyDue(e.target.checked)}
                            className="w-4 h-4 text-orange-500 border-white/60 rounded focus:ring-orange-500/20 bg-white/50"
                        />
                        <label
                            htmlFor="showOnlyDue"
                            className="text-sm font-medium text-stone-600 cursor-pointer"
                        >
                            Solo sin pagar
                        </label>
                    </div>
                )}

                {/* Botones */}
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 sm:ml-auto">
                    {tieneFiltroSecundario && (
                        <button
                            onClick={() => setShowMore((v) => !v)}
                            className="flex-1 sm:flex-none px-5 py-2.5 bg-white/50 backdrop-blur-sm border border-white/60 text-stone-600 text-sm font-medium rounded-xl hover:bg-white/80 transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] active:scale-95"
                        >
                            {showMore ? "Menos filtros ▲" : "Más filtros ▾"}
                        </button>
                    )}
                    <button
                        onClick={clearFilters}
                        className="flex-1 sm:flex-none px-5 py-2.5 bg-white/50 backdrop-blur-sm border border-white/60 text-stone-600 text-sm font-medium rounded-xl hover:bg-white/80 transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] active:scale-95"
                    >
                        Limpiar
                    </button>
                </div>
            </div>

            {/* ── Acordeón: ahora solo "Tipo" ── */}
            {tieneFiltroSecundario && showMore && (
                <div className="flex flex-wrap gap-4 items-end mt-4 pt-4 border-t border-white/40">
                    <div className="w-full sm:w-48">
                        <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                            Tipo
                        </label>
                        <select
                            value={searchTipo}
                            onChange={(e) => setSearchTipo(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all cursor-pointer"
                        >
                            <option value="">Todos los tipos</option>
                            <option value="ordinario">Ordinario</option>
                            <option value="extraordinario">
                                Extraordinario
                            </option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FiltrosPanel;
