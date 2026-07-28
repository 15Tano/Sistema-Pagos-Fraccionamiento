export default function PanelSeccion({
    titulo,
    badgeText,
    badgeClassName,
    children,
}) {
    return (
        <div className="relative overflow-hidden flex flex-col min-h-0 p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
                    {titulo}
                </h3>
                <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] ${badgeClassName}`}
                >
                    {badgeText}
                </span>
            </div>
            <div className="relative z-10 flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
