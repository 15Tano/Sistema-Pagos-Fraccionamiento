// Punto 3: búsqueda por nombre en tiempo real. El debounce ya vive en el hook,
// aquí solo se actualiza el valor "en vivo" para que el input no se sienta lento.
function BuscadorVecino({ value, onChange, placeholder = "Buscar vecino..." }) {
    return (
        <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1.5 ml-1">
                Buscar
            </label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-sm font-medium text-stone-600 transition-all"
            />
        </div>
    );
}

export default BuscadorVecino;
