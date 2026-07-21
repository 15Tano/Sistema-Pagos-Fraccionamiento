import { SearchIcon, XIcon, HomeIcon } from "../icons";

export default function VecinoBuscador({
    label = "Seleccionar Vecino",
    placeholder = "Buscar por nombre o número de casa...",
    vecinoSearch,
    vecinoResults,
    showDropdown,
    selectedVecino,
    error,
    disabled,
    onChange,
    onFocus,
    onSelect,
    onClear,
    renderBadge, // opcional: (v) => JSX para el badge en cada resultado del dropdown
}) {
    return (
        <div>
            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2.5 ml-1">
                {label}
            </label>
            <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">
                    <SearchIcon />
                </span>
                <input
                    type="text"
                    value={vecinoSearch}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={onFocus}
                    placeholder={placeholder}
                    className={`w-full pl-12 pr-12 py-3.5 bg-white/50 backdrop-blur-sm border rounded-2xl focus:outline-none focus:ring-4 text-base font-medium text-stone-800 placeholder-stone-500 transition-all hover:bg-white/60 ${
                        error
                            ? "border-red-300 focus:border-red-400 focus:ring-red-400/20"
                            : "border-white/60 focus:border-orange-400 focus:ring-orange-500/20 focus:bg-white/80"
                    }`}
                    disabled={disabled}
                />
                {vecinoSearch && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-1"
                    >
                        <XIcon />
                    </button>
                )}

                {showDropdown && vecinoResults.length > 0 && (
                    <ul className="absolute z-20 mt-2 w-full bg-white/80 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-xl overflow-hidden divide-y divide-stone-100/50">
                        {vecinoResults.map((v) => (
                            <li key={v.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(v)}
                                    className="w-full text-left px-5 py-3.5 hover:bg-white/60 transition-colors flex items-center gap-4"
                                >
                                    <span className="w-10 h-10 rounded-full bg-orange-100 border border-orange-200 text-orange-600 flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-inner">
                                        {v.nombre?.[0]?.toUpperCase() ?? "?"}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-base font-bold text-stone-800 truncate">
                                            {v.nombre}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-sm text-stone-500 mt-0.5">
                                            <HomeIcon />
                                            {v.calle} #{v.numero_casa}
                                        </span>
                                    </span>
                                    {renderBadge
                                        ? renderBadge(v)
                                        : v.user_id && (
                                              <span className="text-xs text-amber-700 bg-amber-100/80 border border-amber-200 px-2.5 py-1 rounded-full font-bold flex-shrink-0">
                                                  Ya tiene acceso
                                              </span>
                                          )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {error && (
                <p className="text-sm font-medium text-red-500 mt-2 ml-1">
                    {Array.isArray(error) ? error[0] : error}
                </p>
            )}

            {selectedVecino && (
                <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-white/40 backdrop-blur-sm border border-white/60 rounded-xl shadow-sm">
                    <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">
                        {selectedVecino.nombre?.[0]?.toUpperCase()}
                    </span>
                    <span className="text-base text-stone-800 font-bold truncate">
                        {selectedVecino.nombre}
                    </span>
                    <span className="text-sm font-semibold text-orange-500/80 ml-auto flex-shrink-0 bg-white/50 px-2 py-0.5 rounded-md">
                        ID #{selectedVecino.id}
                    </span>
                </div>
            )}
        </div>
    );
}
