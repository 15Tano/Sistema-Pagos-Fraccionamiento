import { Receipt, AlertTriangle, Gift, Tag, Sparkles } from "lucide-react";
import { formatCurrency } from "../formatters";

const CONCEPTOS = [
    {
        key: "ordinario",
        label: "Cuotas Ordinarias",
        sub: "a $280 c/u",
        icon: Receipt,
    },
    {
        key: "extraordinario",
        label: "Multas",
        sub: "Extraordinarios",
        icon: AlertTriangle,
    },
    {
        key: "especiales",
        label: "Pagos Especiales",
        sub: "$300, $500, etc.",
        icon: Gift,
    },
    { key: "ventasTags", label: "Venta Tags", sub: null, icon: Tag },
];

function DesgloseFinanciero({ desglose, periodoLabel }) {
    return (
        <div className="space-y-4">
            {/* ── Tira de conceptos ── */}
            <div className="glass-card !p-0 overflow-hidden">
                <p className="px-6 pt-5 pb-1 text-[11px] font-medium text-stone-500 uppercase tracking-wide">
                    Ingresos físicos recibidos — {periodoLabel}
                </p>

                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/50">
                    {CONCEPTOS.map(({ key, label, sub, icon: Icon }) => (
                        <div
                            key={key}
                            className="flex-1 flex items-center gap-3.5 px-6 py-5"
                        >
                            <div className="w-11 h-11 rounded-2xl bg-black/[0.03] border border-black/[0.05] flex items-center justify-center flex-shrink-0">
                                <Icon size={19} className="text-stone-500" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] text-stone-500 truncate">
                                    {label}
                                </p>
                                <p className="text-xl font-bold text-stone-800 tabular-nums">
                                    {formatCurrency(desglose[key], {
                                        decimals: false,
                                    })}
                                </p>
                                <p className="text-[10px] text-stone-400">
                                    {key === "ventasTags"
                                        ? `${desglose.tagsCount} tags`
                                        : sub}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Total — el momento grande, con personalidad propia ── */}
            <div className="relative overflow-hidden glass-card !rounded-[1.75rem] !p-8 md:!p-10 flex flex-col items-center text-center">
                {/* glow naranja de fondo, sutil, propio del sistema (mismos blobs que .app-bg) */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-70"
                    style={{
                        background:
                            "radial-gradient(ellipse 60% 80% at 50% 120%, rgba(249,115,22,0.14) 0%, transparent 70%)",
                    }}
                />
                <div className="relative flex items-center gap-2 mb-3">
                    <Sparkles size={15} className="text-orange-500" />
                    <p className="text-xs font-semibold text-orange-700/70 uppercase tracking-[0.15em]">
                        Total Recaudado Real
                    </p>
                </div>
                <p className="relative text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 drop-shadow-sm tabular-nums">
                    {formatCurrency(desglose.total)}
                </p>
                <p className="relative text-xs text-stone-400 mt-2">
                    {periodoLabel}
                </p>
            </div>
        </div>
    );
}

export default DesgloseFinanciero;
