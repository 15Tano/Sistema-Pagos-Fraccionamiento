import { UserIcon, TagIcon } from "./IconosLogin";

// --- TABS / PESTAÑAS LÍQUIDAS ---
function SelectorTipoLogin({ loginType, onSelect }) {
    return (
        <div className="flex p-1.5 bg-black/5 backdrop-blur-sm rounded-2xl mb-8 shadow-[inset_0_2px_6px_rgba(0,0,0,0.04)] border border-white/20">
            <button
                type="button"
                onClick={() => onSelect("admin")}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
                    loginType === "admin"
                        ? "bg-white/80 text-orange-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-white transform scale-[1.02]"
                        : "text-stone-500 hover:text-stone-700 hover:bg-white/20"
                }`}
            >
                <UserIcon className="w-4 h-4 mr-2" />
                Administración
            </button>
            <button
                type="button"
                onClick={() => onSelect("residente")}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
                    loginType === "residente"
                        ? "bg-white/80 text-green-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-white transform scale-[1.02]"
                        : "text-stone-500 hover:text-stone-700 hover:bg-white/20"
                }`}
            >
                <TagIcon className="w-4 h-4 mr-2" />
                Residente
            </button>
        </div>
    );
}

export default SelectorTipoLogin;
