import { useState, useEffect, useCallback } from "react";
import api from "../api";
import { Link } from "react-router-dom";
const CheckCircle2Icon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
    </svg>
);

// Custom SVG Icons
const TrashIcon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
    </svg>
);

const UserIcon = () => (
    <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
    </svg>
);

const CreditCardIcon = () => (
    <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
    </svg>
);

const BarChartIcon = () => (
    <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
    </svg>
);

const ShoppingCartIcon = () => (
    <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6m-8 0V9a2 2 0 012-2h4a2 2 0 012 2v4.01"
        />
    </svg>
);

const TagIcon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
    </svg>
);

const AlertCircleIcon = () => (
    <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
    </svg>
);

const CheckCircleIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
    </svg>
);

const XCircleIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
    </svg>
);

// Import your actual API instance

function Tags() {
    const [vecinos, setVecinos] = useState([]);
    const [sales, setSales] = useState([]);
    const [stock, setStock] = useState(0);
    const [totalSales, setTotalSales] = useState(0);
    const [unsoldTags, setUnsoldTags] = useState([]);
    const [saleForm, setSaleForm] = useState({ tag_id: "" });
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState("");
    const [payments, setPayments] = useState([]);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const showMessage = useCallback((message, type = "success") => {
        if (type === "success") {
            setSuccessMessage(message);
            setError(null);
        } else {
            setError(message);
            setSuccessMessage(null);
        }
        setTimeout(() => {
            setSuccessMessage(null);
            setError(null);
        }, 3000);
    }, []);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

            const [tagsRes, vecinosRes, salesRes, paymentsRes] =
                await Promise.all([
                    api.get("/tags"),
                    api.get("/vecinos"),
                    api.get("/tag_sales"),
                    api.get(`/pagos/historico?mes=${currentMonth}`), // Get current month payments
                ]);

            const tags = tagsRes.data || [];
            const vecinos = vecinosRes.data || [];
            const sales = salesRes.data || [];
            const payments = paymentsRes.data || [];

            setVecinos(vecinos);
            setSales(sales);
            setPayments(payments);

            // Filter unsold tags - tags that don't have a tag_sale record
            const soldTagIds = new Set(sales.map((s) => s.tag_id));
            const unsold = tags.filter((t) => !soldTagIds.has(t.id));
            setUnsoldTags(unsold);
            setStock(unsold.length);

            // Calculate total from sales
            const total = sales.reduce(
                (sum, sale) => sum + parseFloat(sale.price || 150),
                0
            );
            setTotalSales(total);
        } catch (error) {
            console.error("Error fetching data:", error);
            setError(
                "Error al cargar los datos. Por favor intente nuevamente."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
        // Set current month for payment tracking
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(
            now.getMonth() + 1
        ).padStart(2, "0")}`;
        setCurrentMonth(monthStr);
    }, [fetchAllData]);

    const handleSaleChange = (e) => {
        setSaleForm({ ...saleForm, [e.target.name]: e.target.value });
    };

    const handleSaleSubmit = async () => {
        if (!saleForm.tag_id) {
            setError("Por favor seleccione un tag");
            return;
        }

        try {
            const response = await api.post("/tag_sales", {
                tag_id: saleForm.tag_id,
            });
            showMessage("Venta registrada exitosamente");
            setSaleForm({ tag_id: "" });
            await fetchAllData();
        } catch (error) {
            console.error("Error creating sale:", error);
            if (error.response?.data?.error) {
                setError(error.response.data.error);
            } else {
                setError(
                    "Error al registrar la venta. Por favor intente nuevamente."
                );
            }
        }
    };

    const handleDeleteSale = async (saleId) => {
        if (!window.confirm("¿Está seguro de eliminar esta venta?")) return;

        try {
            await api.delete(`/tag_sales/${saleId}`);
            showMessage("Venta eliminada exitosamente");
            await fetchAllData();
        } catch (error) {
            console.error("Error deleting sale:", error);
            setError(
                "Error al eliminar la venta. Por favor intente nuevamente."
            );
        }
    };

    // Helper function to check if vecino has paid this month
    const hasVecinoPaidThisMonth = (vecinoId) => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const vecinoPayments = payments.filter(
            (p) => p.vecino_id === vecinoId && p.mes === currentMonth
        );
        const totalPaid = vecinoPayments.reduce(
            (sum, payment) => sum + parseFloat(payment.cantidad),
            0
        );
        return totalPaid >= 280; // Monthly payment amount
    };

    // Toggle individual tag status (manual override)
    const handleToggleTag = async (tagId) => {
        try {
            const response = await api.patch(`/tags/${tagId}/toggle`);
            showMessage(response.data.message);
            await fetchAllData();
        } catch (error) {
            console.error("Error toggling tag:", error);
            setError(
                "Error al cambiar el estado del tag. Por favor intente nuevamente."
            );
        }
    };

    // Create a quick payment for a vecino (activates their tags)
    const handleCreatePayment = async (vecinoId) => {
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const response = await api.post("/pagos", {
                vecino_id: vecinoId,
                cantidad: 280,
                tipo: "ordinario",
                mes: currentMonth,
                fecha_de_cobro: new Date().toISOString().split("T")[0],
            });
            showMessage("Pago registrado y tags activados automáticamente");
            await fetchAllData();
        } catch (error) {
            console.error("Error creating payment:", error);
            setError(
                "Error al registrar el pago. Por favor intente nuevamente."
            );
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="mt-4 text-slate-600 font-medium">
                        Cargando datos...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        Gestión de Tags
                    </h1>
                    <p className="text-slate-600">
                        Administra los tags de acceso de tu comunidad
                    </p>
                </div>

                {/* Messages */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800">
                        <AlertCircleIcon />
                        <span>{error}</span>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-800">
                        <CheckCircleIcon />
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Vender Tag */}
                    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <ShoppingCartIcon />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800">
                                Vender Tag
                            </h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Seleccionar Tag
                                </label>
                                <select
                                    name="tag_id"
                                    value={saleForm.tag_id}
                                    onChange={handleSaleChange}
                                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                >
                                    <option value="">Seleccione un tag</option>
                                    {unsoldTags.map((tag) => (
                                        <option key={tag.id} value={tag.id}>
                                            {tag.codigo}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleSaleSubmit}
                                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Registrar Venta
                            </button>
                        </div>
                    </div>

                    {/* Estadísticas */}
                    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <BarChartIcon />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800">
                                Estadísticas
                            </h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <TagIcon />
                                    <span className="font-medium text-blue-800">
                                        Stock Disponible
                                    </span>
                                </div>
                                <span className="text-2xl font-bold text-blue-600">
                                    {stock}
                                </span>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <CreditCardIcon />
                                    <span className="font-medium text-green-800">
                                        Total Ventas
                                    </span>
                                </div>
                                <span className="text-2xl font-bold text-green-600">
                                    ${totalSales}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Ventas Recientes */}
                    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <CreditCardIcon />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800">
                                Ventas Recientes
                            </h3>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {sales.length > 0 ? (
                                sales.slice(0, 5).map((sale) => (
                                    <div
                                        key={sale.id}
                                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-800 text-sm">
                                                {sale.tag
                                                    ? sale.tag.codigo
                                                    : `Tag #${sale.tag_id}`}
                                            </p>
                                            <p className="text-xs text-slate-600">
                                                {sale.sold_at
                                                    ? new Date(
                                                          sale.sold_at
                                                      ).toLocaleDateString()
                                                    : "Sin fecha"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-green-600">
                                                ${sale.price}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    handleDeleteSale(sale.id)
                                                }
                                                className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-center py-8">
                                    No hay ventas registradas
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabla de Vecinos */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
                    <div className="p-6 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <UserIcon />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800">
                                Estado de Vecinos y Tags
                            </h3>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-100/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                        Vecino
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                        Tags Asignados
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                        Estado de Pago
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                        Estado de Tags
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {vecinos.map((vecino) => (
                                    <tr
                                        key={vecino.id}
                                        className="hover:bg-slate-50/50 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-semibold text-slate-800">
                                                    {vecino.nombre}
                                                </p>
                                                <p className="text-sm text-slate-600">
                                                    {vecino.calle} #
                                                    {vecino.numero_casa}
                                                </p>
                                            </div>
                                        </td>

                                        {vecino.tags &&
                                        vecino.tags.length > 0 ? (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {vecino.tags.map(
                                                            (tag) => (
                                                                <span
                                                                    key={tag.id}
                                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                                                        tag.activo
                                                                            ? "bg-green-100 text-green-800"
                                                                            : "bg-red-100 text-red-800"
                                                                    }`}
                                                                >
                                                                    {tag.codigo}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {hasVecinoPaidThisMonth(
                                                        vecino.id
                                                    ) ? (
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle2Icon />
                                                            <span className="text-sm text-green-700 font-medium">
                                                                Pagado
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <XCircleIcon />
                                                            <span className="text-sm text-red-700 font-medium">
                                                                Pendiente $280
                                                            </span>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {new Date().toLocaleDateString(
                                                            "es-ES",
                                                            {
                                                                month: "long",
                                                                year: "numeric",
                                                            }
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-2">
                                                        {vecino.tags.map(
                                                            (tag) => (
                                                                <div
                                                                    key={tag.id}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    {tag.activo ? (
                                                                        <CheckCircleIcon />
                                                                    ) : (
                                                                        <XCircleIcon />
                                                                    )}
                                                                    <span
                                                                        className={`text-sm ${
                                                                            tag.activo
                                                                                ? "text-green-700"
                                                                                : "text-red-700"
                                                                        }`}
                                                                    >
                                                                        {tag.activo
                                                                            ? "Activo"
                                                                            : "Inactivo"}
                                                                    </span>
                                                                    <span className="text-xs text-slate-500">
                                                                        (
                                                                        {
                                                                            tag.codigo
                                                                        }
                                                                        )
                                                                    </span>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-2">
                                                        {!hasVecinoPaidThisMonth(
                                                            vecino.id
                                                        ) && (
                                                            <Link
                                                                to={`/pagos?vecinoId=${vecino.id}`}
                                                                className="block text-center w-full px-3 py-2 rounded-lg text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200"
                                                            >
                                                                Registrar Pago
                                                            </Link>
                                                        )}
                                                        <div className="text-xs text-slate-600 border-t pt-2">
                                                            <p className="font-medium mb-1">
                                                                Control Manual:
                                                            </p>
                                                            {vecino.tags.map(
                                                                (tag) => (
                                                                    <button
                                                                        key={
                                                                            tag.id
                                                                        }
                                                                        onClick={() =>
                                                                            handleToggleTag(
                                                                                tag.id
                                                                            )
                                                                        }
                                                                        className={`px-2 py-1 rounded text-xs font-semibold mr-1 mb-1 transition-all duration-200 ${
                                                                            tag.activo
                                                                                ? "bg-red-500 hover:bg-red-600 text-white"
                                                                                : "bg-green-500 hover:bg-green-600 text-white"
                                                                        }`}
                                                                    >
                                                                        {tag.activo
                                                                            ? "Desactivar"
                                                                            : "Activar"}{" "}
                                                                        {
                                                                            tag.codigo
                                                                        }
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <td
                                                colSpan="4"
                                                className="px-6 py-4 text-center text-slate-500 italic"
                                            >
                                                Sin tags asignados
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Tags;
