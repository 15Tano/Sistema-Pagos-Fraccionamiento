import { useState } from "react";
import { formatMonth, formatDate, formatCurrency } from "../formatters";
import Badge from "../../../components/Badge";
import FilaExpandible from "./FilaExpandible";

// Reemplaza las 5 tablas casi idénticas del original.
// Desktop: 7 columnas completas. Mobile: 3 columnas esenciales + tap para expandir (punto 9).
function TablaPagos({ pagos, sortConfig, onSort }) {
    const [expandedId, setExpandedId] = useState(null);

    const SortHeader = ({ field, children, className = "" }) => {
        const isActive = sortConfig.field === field;
        return (
            <th
                onClick={() => onSort(field)}
                className={`px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider cursor-pointer select-none hover:text-orange-600 transition-colors ${className}`}
            >
                {children}{" "}
                {isActive && (sortConfig.direction === "asc" ? "▲" : "▼")}
            </th>
        );
    };

    if (pagos.length === 0) {
        return (
            <div className="px-6 py-12 text-center text-stone-500 font-medium">
                No hay pagos registrados para este filtro.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
                <thead className="bg-black/5 border-b border-white/40">
                    <tr>
                        <SortHeader field="nombre">Vecino</SortHeader>
                        <th className="hidden md:table-cell px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                            Dirección
                        </th>
                        <th className="hidden md:table-cell px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                            Mes Pagado
                        </th>
                        <th className="hidden md:table-cell px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                            Tipo
                        </th>
                        <SortHeader field="cantidad">Cantidad</SortHeader>
                        <th className="hidden md:table-cell px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                            Estado
                        </th>
                        <th className="hidden md:table-cell px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                            Fecha Cobro
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                    {pagos.map((pago) => (
                        <>
                            <tr
                                key={pago.id}
                                onClick={() =>
                                    setExpandedId(
                                        expandedId === pago.id ? null : pago.id,
                                    )
                                }
                                className="hover:bg-white/40 transition-colors cursor-pointer md:cursor-default"
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-800 capitalize">
                                    {pago.vecino.nombre}
                                </td>
                                <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                                    {pago.vecino.calle} #
                                    {pago.vecino.numero_casa}
                                </td>
                                <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-700 capitalize">
                                    {formatMonth(pago.mes)}
                                </td>
                                <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                                    <Badge
                                        variant={
                                            pago.tipo === "extraordinario"
                                                ? "warning"
                                                : "info"
                                        }
                                    >
                                        {pago.tipo}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-800">
                                    {formatCurrency(pago.cantidad)}
                                </td>
                                <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                                    <Badge variant="success">Completado</Badge>
                                </td>
                                <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-xs text-stone-400">
                                    {pago.fecha_de_cobro
                                        ? formatDate(pago.fecha_de_cobro)
                                        : "-"}
                                </td>
                            </tr>
                            {expandedId === pago.id && (
                                <FilaExpandible
                                    key={`${pago.id}-detail`}
                                    pago={pago}
                                />
                            )}
                        </>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default TablaPagos;
