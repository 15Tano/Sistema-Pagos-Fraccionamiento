import { SearchIcon, XIcon } from "./Icons";

// ── FILTROS DE LA TABLA ──
export default function FiltrosTabla({
    search,
    setSearch,
    filterFecha,
    setFilterFecha,
}) {
    return (
        <div className="p-5 flex flex-col sm:flex-row gap-4 relative z-10 bg-white/20 border-b border-white/40">
            <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                    <SearchIcon />
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar vecino en recibos..."
                    className="w-full pl-11 pr-10 py-3 rounded-xl bg-white/50 backdrop-blur-md border border-white/60 text-sm font-medium text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] transition-all"
                />
                {search && (
                    <button
                        onClick={() => setSearch("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    >
                        <XIcon />
                    </button>
                )}
            </div>
            <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide whitespace-nowrap">
                    Filtrar por fecha:
                </label>
                <div className="relative">
                    <input
                        type="date"
                        value={filterFecha}
                        onChange={(e) => setFilterFecha(e.target.value)}
                        className="py-3 pl-4 pr-9 rounded-xl bg-white/50 backdrop-blur-md border border-white/60 text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] transition-all cursor-pointer"
                    />
                    {filterFecha && (
                        <button
                            onClick={() => setFilterFecha("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 bg-white/50 rounded"
                        >
                            <XIcon />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
