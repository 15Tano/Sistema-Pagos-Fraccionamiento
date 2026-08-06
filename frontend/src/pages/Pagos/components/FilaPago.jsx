import { ChevronIcon, EditIcon, TrashIcon } from "./Icons";
import PagoExpandido from "./PagoExpandido";

// ── FILA DE PAGO (con fila expandida) ──
export default function FilaPago({
    pago,
    expanded,
    onToggleExpand,
    onEdit,
    onDelete,
    formatMes,
    formatDate,
}) {
    return (
        <div className="contents">
            <tr
                className={`hover:bg-white/40 transition-colors ${expanded ? "bg-white/30" : ""}`}
            >
                <td className="px-4 py-4">
                    <button
                        onClick={onToggleExpand}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 bg-white/50 border border-stone-200/50 hover:bg-white transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]"
                    >
                        <ChevronIcon open={expanded} />
                    </button>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                    <p className="text-sm font-semibold text-stone-800 capitalize">
                        {pago.vecino?.nombre}
                    </p>
                    <p className="text-xs font-medium text-stone-500 mt-0.5">
                        {pago.vecino?.calle} #{pago.vecino?.numero_casa}
                    </p>
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-stone-700 capitalize">
                    {formatMes(pago.mes)}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                    <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] border ${
                            pago.tipo === "extraordinario"
                                ? "bg-purple-100/60 text-purple-700 border-purple-200/60"
                                : "bg-blue-100/60 text-blue-700 border-blue-200/60"
                        }`}
                    >
                        {pago.tipo}
                    </span>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-stone-800">
                        $
                        {parseFloat(pago.cantidad).toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                        })}
                    </span>
                    {pago.meses_pagados > 1 && (
                        <span className="ml-1.5 text-[10px] font-medium text-stone-400 uppercase tracking-widest">
                            ({pago.meses_pagados} m)
                        </span>
                    )}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-stone-500">
                    {formatDate(pago.fecha_de_cobro)}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={onEdit}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-500 bg-white/50 border border-amber-200/50 hover:bg-amber-50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] transition-all"
                        >
                            <EditIcon />
                        </button>
                        <button
                            onClick={onDelete}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-red-500 bg-white/50 border border-red-200/50 hover:bg-red-50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] transition-all"
                        >
                            <TrashIcon />
                        </button>
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr>
                    <td colSpan="7" className="p-0">
                        <PagoExpandido vecinoUuid={pago.vecino?.uuid} />
                    </td>
                </tr>
            )}
        </div>
    );
}
