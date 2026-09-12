import { formatMonth, formatDate, formatCurrency } from "../formatters";
import Badge from "../../../components/Badge";

// Punto 9: en mobile la tabla solo muestra Vecino/Cantidad/Estado.
// Al tocar la fila, esto se despliega debajo con el resto del detalle.
function FilaExpandible({ pago }) {
    return (
        <tr className="md:hidden bg-black/[0.02]">
            <td
                colSpan={3}
                className="px-6 py-3 text-xs text-stone-500 space-y-1.5"
            >
                <div className="flex justify-between">
                    <span className="text-stone-400">Dirección</span>
                    <span className="font-medium text-stone-700">
                        {pago.vecino.calle} #{pago.vecino.numero_casa}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-stone-400">Mes Pagado</span>
                    <span className="font-medium text-stone-700 capitalize">
                        {formatMonth(pago.mes)}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-stone-400">Tipo</span>
                    <Badge
                        variant={
                            pago.tipo === "extraordinario" ? "warning" : "info"
                        }
                    >
                        {pago.tipo}
                    </Badge>
                </div>
                <div className="flex justify-between">
                    <span className="text-stone-400">Fecha de Cobro</span>
                    <span className="font-medium text-stone-700">
                        {pago.fecha_de_cobro
                            ? formatDate(pago.fecha_de_cobro)
                            : "-"}
                    </span>
                </div>
            </td>
        </tr>
    );
}

export default FilaExpandible;
