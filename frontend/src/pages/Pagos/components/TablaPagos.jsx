import FilaPago from "./FilaPago";

// ── TABLA DE PAGOS ──
export default function TablaPagos({
    pagos,
    loading,
    debouncedSearch,
    expandedId,
    setExpandedId,
    onEdit,
    onDelete,
    formatMes,
    formatDate,
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 gap-3">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-stone-500">
                    Cargando registro de pagos...
                </span>
            </div>
        );
    }

    return (
        <table className="w-full text-left">
            <thead className="bg-black/5 border-b border-white/40">
                <tr>
                    <th className="w-10 px-4 py-4" />
                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                        Vecino
                    </th>
                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                        Mes Cobrado
                    </th>
                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                        Tipo
                    </th>
                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                        Monto Total
                    </th>
                    <th className="px-5 py-4 text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                        Fecha Física
                    </th>
                    <th className="px-5 py-4 text-center text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                        Acciones
                    </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
                {pagos.length === 0 ? (
                    <tr>
                        <td
                            colSpan="7"
                            className="px-5 py-16 text-center text-stone-400 text-sm font-medium"
                        >
                            {debouncedSearch
                                ? `No hay coincidencias para "${debouncedSearch}"`
                                : "Aún no hay pagos registrados."}
                        </td>
                    </tr>
                ) : (
                    pagos.map((pago) => (
                        <FilaPago
                            key={pago.uuid}
                            pago={pago}
                            expanded={expandedId === pago.uuid}
                            onToggleExpand={() =>
                                setExpandedId(
                                    expandedId === pago.uuid
                                        ? null
                                        : pago.uuid,
                                )
                            }
                            onEdit={() => onEdit(pago)}
                            onDelete={() => onDelete(pago)}
                            formatMes={formatMes}
                            formatDate={formatDate}
                        />
                    ))
                )}
            </tbody>
        </table>
    );
}
