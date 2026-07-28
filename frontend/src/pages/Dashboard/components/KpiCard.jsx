export default function KpiCard({
    label,
    value,
    valueClassName,
    subtitle,
    icon,
    iconWrapperClassName,
}) {
    return (
        <div className="relative overflow-hidden p-5 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] group hover:bg-white/50 transition-colors">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1 drop-shadow-sm">
                {label}
            </p>
            <p className={valueClassName}>{value}</p>
            <p className="text-[11px] font-semibold text-stone-400 mt-2">
                {subtitle}
            </p>
            <div className={iconWrapperClassName}>{icon}</div>
        </div>
    );
}
