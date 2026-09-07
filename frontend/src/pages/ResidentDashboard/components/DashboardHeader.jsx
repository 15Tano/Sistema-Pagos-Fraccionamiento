import { useTemporada } from "../../../hooks/useTemporada";
const tema = useTemporada();
{
    tema.saludo && <p className="text-xs text-gray-500 mb-1">{tema.saludo}</p>;
}

export default function DashboardHeader({ user, tags, onLogout }) {
    return (
        <div className="flex items-start justify-between p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.03)] rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
            <div>
                <h1 className="text-2xl font-bold text-stone-800 drop-shadow-sm">
                    Bienvenido, {user?.name || "Residente"}
                </h1>
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                        {tags.map((t) => (
                            <span
                                key={t.id}
                                className={`px-3 py-1 rounded-xl text-xs font-bold font-mono tracking-wider shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] ${
                                    t.activo
                                        ? "bg-green-100/60 text-green-700 border border-green-200/60 backdrop-blur-sm"
                                        : "bg-red-100/60 text-red-600 border border-red-200/60 backdrop-blur-sm"
                                }`}
                            >
                                {t.codigo}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold text-stone-600 bg-white/50 border border-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(255,255,255,1)] hover:bg-white/80 hover:shadow-[0_4px_15px_rgba(0,0,0,0.05)] active:scale-95 transition-all duration-200"
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
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                </svg>
                Salir
            </button>
        </div>
    );
}
