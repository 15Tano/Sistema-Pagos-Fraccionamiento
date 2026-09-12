import { TrendingUp } from "lucide-react";
import { formatCurrency } from "../formatters";

function TotalPill({ total, label = "Recaudado este mes" }) {
    return (
        <div className="glass-card inline-flex items-center gap-4 !py-3.5 !px-6 !rounded-full">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={18} className="text-orange-600" />
            </div>
            <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-medium text-stone-500">
                    {label}
                </span>
                <span className="text-2xl font-bold text-stone-800 tabular-nums">
                    {formatCurrency(total, { decimals: false })}
                </span>
            </div>
        </div>
    );
}

export default TotalPill;
