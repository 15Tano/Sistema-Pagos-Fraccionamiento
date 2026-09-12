import Badge from "../../../components/Badge";
import DesgloseFinanciero from "./DesgloseFinanciero";
import { formatCurrency, formatMonth } from "../formatters";

function ResumenGeneral({ data }) {
    const {
        filteredCurrentMonthSummary,
        desgloseFinanciero,
        sortConfig,
        toggleSort,
        CURRENT_MONTH_ISO,
    } = data;

    const SortHeader = ({ field, children }) => {
        const isActive = sortConfig.field === field;
        return (
            <th
                onClick={() => toggleSort(field)}
                className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider cursor-pointer select-none hover:text-orange-600 transition-colors"
            >
                {children}{" "}
                {isActive && (sortConfig.direction === "asc" ? "▲" : "▼")}
            </th>
        );
    };

    return (
        <div className="flex flex-col">
            <div className="px-6 py-5 border-b border-white/40 bg-white/20">
                <h3 className="text-lg font-semibold text-stone-800">
                    Resumen del Mes Actual ({formatMonth(CURRENT_MONTH_ISO)})
                </h3>
                <p className="text-orange-600 text-xs font-medium uppercase tracking-wide mt-1">
                    Estado de deudas para este mes
                </p>
            </div>

            {/* Tabla y buscador van primero — nada bloquea el resultado de la búsqueda */}
            <div className="grid grid-cols-2 gap-0 divide-x divide-white/40 border-t border-b border-white/40 bg-white/20">
                <div className="px-6 py-5 text-center">
                    <p className="text-3xl font-semibold text-green-600">
                        {
                            filteredCurrentMonthSummary.filter((v) => v.hasPaid)
                                .length
                        }
                    </p>
                    <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide mt-1">
                        Pagados
                    </p>
                </div>
                <div className="px-6 py-5 text-center">
                    <p className="text-3xl font-semibold text-red-500">
                        {
                            filteredCurrentMonthSummary.filter(
                                (v) => !v.hasPaid,
                            ).length
                        }
                    </p>
                    <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide mt-1">
                        Sin Pagar
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-black/5 border-b border-white/40">
                        <tr>
                            <SortHeader field="nombre">Vecino</SortHeader>
                            <th className="hidden md:table-cell px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                Dirección
                            </th>
                            <th className="px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                Estado
                            </th>
                            <SortHeader field="totalPaid">
                                Monto Pagado
                            </SortHeader>
                            <th className="hidden md:table-cell px-6 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                                Tag
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/40">
                        {filteredCurrentMonthSummary.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-6 py-12 text-center text-stone-500 font-medium"
                                >
                                    No se encontraron vecinos con ese filtro.
                                </td>
                            </tr>
                        ) : (
                            filteredCurrentMonthSummary.map((vecino) => (
                                <tr
                                    key={vecino.id}
                                    className="hover:bg-white/40 transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <p className="text-sm font-medium text-stone-800 capitalize">
                                            {vecino.nombre}
                                        </p>
                                    </td>
                                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                                        {vecino.calle} #{vecino.numero_casa}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge
                                            variant={
                                                vecino.hasPaid
                                                    ? "success"
                                                    : "danger"
                                            }
                                        >
                                            {vecino.hasPaid
                                                ? "Pagado"
                                                : "Sin Pagar"}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-700">
                                        {formatCurrency(vecino.totalPaid)}
                                    </td>
                                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-xs text-stone-400">
                                        {vecino.tags &&
                                        vecino.tags.length > 0 ? (
                                            <span className="bg-stone-100/50 px-2.5 py-1 rounded-lg border border-stone-200/50 text-stone-600">
                                                {vecino.tags
                                                    .map((tag) => tag.codigo)
                                                    .join(", ")}
                                            </span>
                                        ) : (
                                            <span className="italic text-stone-300">
                                                Sin Tag
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Desglose completo — al final, como cierre. Ya no compite con el buscador. */}
            <div className="p-4 md:p-6">
                <DesgloseFinanciero
                    desglose={desgloseFinanciero}
                    periodoLabel={formatMonth(CURRENT_MONTH_ISO)}
                />
            </div>
        </div>
    );
}

export default ResumenGeneral;
