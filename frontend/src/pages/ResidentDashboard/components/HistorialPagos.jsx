import { useState, useMemo } from "react";
import { formatMonth, formatDate } from "../dashboardHelpers";

export default function HistorialPagos({ pagos, loading, onVerRecibo }) {
    const [selectedYear, setSelectedYear] = useState("2026");

    const availableYears = useMemo(() => {
        const years = new Set(pagos.map((p) => p.mes.split("-")[0]));
        years.add("2026");
        return Array.from(years).sort((a, b) => b - a);
    }, [pagos]);

    const filteredPagos = useMemo(() => {
        return pagos.filter((p) => p.mes.startsWith(selectedYear));
    }, [pagos, selectedYear]);

    return (
        <div className="relative overflow-hidden p-6 bg-white/40 backdrop-blur-xl border-t border-l border-white/80 border-r border-b border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-2">
                    <svg
                        className="w-5 h-5 text-orange-400 drop-shadow-sm"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                    </svg>
                    <h3 className="text-sm font-bold text-stone-800 tracking-wide uppercase">
                        Historial
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-white/50 backdrop-blur-md border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] rounded-xl px-2.5 py-1 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-orange-400/50 appearance-none cursor-pointer"
                        style={{
                            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%23555" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>')`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 6px center",
                            paddingRight: "1.75rem",
                        }}
                    >
                        {availableYears.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>

                    <span className="px-3 py-1 rounded-full bg-white/50 border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] text-xs font-semibold text-stone-500">
                        {filteredPagos.length}
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin drop-shadow-md" />
                </div>
            ) : filteredPagos.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-8 font-medium">
                    Sin pagos registrados en {selectedYear}
                </p>
            ) : (
                <div className="divide-y divide-white/50 relative z-10">
                    {filteredPagos.map((pago) => (
                        <div
                            key={pago.id}
                            className="flex items-center justify-between py-3 px-2 -mx-2 rounded-xl hover:bg-white/40 transition-colors duration-200"
                        >
                            <div>
                                <p className="text-sm font-bold text-stone-800 capitalize">
                                    {formatMonth(pago.mes).split(" ")[0]}{" "}
                                </p>
                                <p className="text-xs text-stone-500 font-medium mt-0.5">
                                    {pago.tipo === "extraordinario"
                                        ? "Extraordinario"
                                        : "Ordinario"}
                                    {pago.fecha_de_cobro
                                        ? ` · ${formatDate(pago.fecha_de_cobro)}`
                                        : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-stone-800">
                                    ${parseFloat(pago.cantidad).toLocaleString("es-MX")}
                                </span>
                                {parseFloat(pago.restante) === 0 ? (
                                    <button
                                        onClick={() => onVerRecibo(pago)}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-green-100/60 text-green-700 border border-green-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] hover:bg-green-200/70 transition-colors cursor-pointer"
                                    >
                                        Completo
                                    </button>
                                ) : (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-red-100/60 text-red-700 border border-red-200/60 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
                                        Resta ${parseFloat(pago.restante).toFixed(0)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
