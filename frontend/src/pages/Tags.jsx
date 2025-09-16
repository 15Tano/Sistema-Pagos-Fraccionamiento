import { useState, useEffect, useCallback } from "react";
import api from "../api";

function Tags() {
    const [vecinos, setVecinos] = useState([]);
    const [sales, setSales] = useState([]);
    const [stock, setStock] = useState(0);
    const [totalSales, setTotalSales] = useState(0);
    const [unsoldTags, setUnsoldTags] = useState([]);
    const [saleForm, setSaleForm] = useState({ tag_id: "" });
    const [loading, setLoading] = useState(false);
    const currentMonth = new Date().toISOString().slice(0, 7);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchTags(),
                fetchVecinos(),
                fetchSales(),
                fetchStock(),
                fetchTotalSales(),
            ]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const fetchTags = async () => {
        try {
            const response = await api.get("/tags");
            // We don't need to store tags in state since we only use them for calculations
            return response.data;
        } catch (error) {
            console.error("Error fetching tags:", error);
            return [];
        }
    };

    const fetchVecinos = async () => {
        try {
            const response = await api.get("/vecinos");
            setVecinos(response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching vecinos:", error);
            return [];
        }
    };

    const fetchSales = async () => {
        try {
            const response = await api.get("/tag_sales");
            setSales(response.data);

            // Calculate unsold tags based on current sales
            const tagsResponse = await api.get("/tags");
            const soldTagIds = response.data.map((s) => s.tag_id);
            const unsold = tagsResponse.data.filter(
                (t) => !soldTagIds.includes(t.id)
            );
            setUnsoldTags(unsold);

            return response.data;
        } catch (error) {
            console.error("Error fetching sales:", error);
            return [];
        }
    };

    const fetchStock = async () => {
        try {
            // Calculate stock based on actual data instead of relying on backend endpoint
            const [tagsResponse, salesResponse] = await Promise.all([
                api.get("/tags"),
                api.get("/tag_sales"),
            ]);

            const totalTags = tagsResponse.data.length;
            const soldTags = salesResponse.data.length;
            const calculatedStock = totalTags - soldTags;

            setStock(calculatedStock);
            return calculatedStock;
        } catch (error) {
            console.error("Error calculating stock:", error);
            // Fallback to backend endpoint if available
            try {
                const response = await api.get("/tags/stock");
                setStock(response.data.stock || 0);
                return response.data.stock || 0;
            } catch (fallbackError) {
                console.error(
                    "Error fetching stock from backend:",
                    fallbackError
                );
                setStock(0);
                return 0;
            }
        }
    };

    const fetchTotalSales = async () => {
        try {
            const response = await api.get("/tag_sales");
            // Calculate total sales locally to ensure accuracy
            const total = response.data.reduce(
                (sum, sale) => sum + (sale.price || 150),
                0
            );
            setTotalSales(total);
            return total;
        } catch (error) {
            console.error("Error calculating total sales:", error);
            // Fallback to backend endpoint if available
            try {
                const response = await api.get("/tags/total_sales");
                setTotalSales(response.data.total_sales || 0);
                return response.data.total_sales || 0;
            } catch (fallbackError) {
                console.error(
                    "Error fetching total sales from backend:",
                    fallbackError
                );
                setTotalSales(0);
                return 0;
            }
        }
    };

    const handleSaleChange = (e) => {
        setSaleForm({ ...saleForm, [e.target.name]: e.target.value });
    };

    const handleSaleSubmit = async (e) => {
        e.preventDefault();
        if (!saleForm.tag_id) {
            alert("Por favor seleccione un tag");
            return;
        }

        setLoading(true);
        try {
            await api.post("/tag_sales", saleForm);
            setSaleForm({ tag_id: "" });

            // Refresh all relevant data
            await Promise.all([fetchSales(), fetchStock(), fetchTotalSales()]);

            alert("Tag vendido exitosamente");
        } catch (error) {
            console.error("Error selling tag:", error);
            alert("Error al vender el tag. Por favor intente nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (id) => {
        if (!id) {
            alert("ID de tag no válido");
            return;
        }

        setLoading(true);
        try {
            const response = await api.patch(`/tags/${id}/toggle`);

            // Update the local state immediately for better UX
            setVecinos((prevVecinos) =>
                prevVecinos.map((vecino) => {
                    if (vecino.tag && vecino.tag.id === id) {
                        return {
                            ...vecino,
                            tag: {
                                ...vecino.tag,
                                activo: !vecino.tag.activo,
                            },
                        };
                    }
                    return vecino;
                })
            );

            // Refresh data from server to ensure consistency (optional, but good practice)
            setTimeout(async () => {
                try {
                    await Promise.all([fetchVecinos()]);
                } catch (error) {
                    console.error("Error refreshing data after toggle:", error);
                }
            }, 500);

            console.log("Tag toggled successfully:", response.data);
        } catch (error) {
            console.error("Error toggling tag:", error);
            alert(
                "Error al cambiar el estado del tag. Por favor intente nuevamente."
            );

            // If there was an error, refresh the data to ensure UI is consistent
            await fetchVecinos();
        } finally {
            setLoading(false);
        }
    };

    const handleResetSales = async () => {
        if (
            !window.confirm(
                "¿Está seguro que desea reiniciar las ventas? Esta acción eliminará todos los registros de ventas y es permanente."
            )
        ) {
            return;
        }

        setLoading(true);
        try {
            const response = await api.delete("/tag_sales/reset");
            console.log("Sales reset response:", response);

            // Refresh all data after reset
            await fetchAllData();

            alert("Ventas reiniciadas exitosamente");
        } catch (error) {
            console.error("Error resetting sales:", error);
            alert(
                "Error al reiniciar las ventas. Por favor intente nuevamente."
            );
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex justify-center items-center h-64">
                    <div className="text-lg">Cargando...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Tags</h2>

            <div className="grid grid-cols-2 gap-6">
                {/* Left Column: Venta de Tags */}
                <div>
                    <h3 className="text-lg font-semibold mb-4">
                        Venta de Tags
                    </h3>

                    <form onSubmit={handleSaleSubmit} className="mb-4">
                        <select
                            name="tag_id"
                            value={saleForm.tag_id}
                            onChange={handleSaleChange}
                            className="border rounded-lg px-3 py-2 w-full mb-2"
                            required
                            disabled={loading}
                        >
                            <option value="">Seleccionar Tag</option>
                            {unsoldTags.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.codigo}
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            disabled={loading || !saleForm.tag_id}
                            className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full"
                        >
                            {loading ? "Procesando..." : "Vender Tag ($150)"}
                        </button>
                    </form>

                    <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                        <p className="text-sm font-medium">
                            Stock: {stock} tags disponibles
                        </p>
                        <p className="text-sm font-medium">
                            Total Ventas: ${totalSales}
                        </p>
                        <button
                            onClick={handleResetSales}
                            disabled={loading}
                            className="mt-2 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full"
                        >
                            {loading ? "Procesando..." : "Reiniciar Ventas"}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
                            <thead className="bg-green-600 text-white">
                                <tr>
                                    <th className="p-2 text-left">Tag</th>
                                    <th className="p-2 text-left">
                                        Fecha Venta
                                    </th>
                                    <th className="p-2 text-left">Precio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="3"
                                            className="p-4 text-center text-gray-500"
                                        >
                                            No hay ventas registradas
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map((s) => (
                                        <tr
                                            key={s.id}
                                            className="border-b hover:bg-gray-50"
                                        >
                                            <td className="p-2">
                                                {s.tag ? s.tag.codigo : "N/A"}
                                            </td>
                                            <td className="p-2">
                                                {new Date(
                                                    s.sold_at
                                                ).toLocaleDateString()}
                                            </td>
                                            <td className="p-2">
                                                ${s.price || 150}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Vecinos */}
                <div>
                    <h3 className="text-lg font-semibold mb-4">Vecinos</h3>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
                            <thead className="bg-blue-600 text-white">
                                <tr>
                                    <th className="p-2 text-left">Vecino</th>
                                    <th className="p-2 text-left">Tag</th>
                                    <th className="p-2 text-left">Estado</th>
                                    <th className="p-2 text-left">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vecinos.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="p-4 text-center text-gray-500"
                                        >
                                            No hay vecinos registrados
                                        </td>
                                    </tr>
                                ) : (
                                    vecinos.map((v) => {
                                        const hasCompletePago =
                                            v.pagos &&
                                            v.pagos.some(
                                                (p) =>
                                                    p.mes === currentMonth &&
                                                    p.restante === 0
                                            );
                                        const tagActivo = v.tag && v.tag.activo;
                                        // Tag is active only if it has a complete payment (restante = 0) for the current month
                                        const isActive =
                                            tagActivo && hasCompletePago;

                                        // Debug logging (remove in production)
                                        console.log(`Vecino ${v.nombre}:`, {
                                            hasCompletePago,
                                            tagActivo,
                                            isActive,
                                            tag: v.tag,
                                        });

                                        return (
                                            <tr
                                                key={v.id}
                                                className="border-b hover:bg-gray-50"
                                            >
                                                <td className="p-2">
                                                    {v.nombre}
                                                </td>
                                                <td className="p-2">
                                                    {v.numero_tag || "Sin tag"}
                                                </td>
                                                <td className="p-2">
                                                    <span
                                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                                            isActive
                                                                ? "bg-green-500 text-white"
                                                                : "bg-gray-500 text-white"
                                                        }`}
                                                    >
                                                        {isActive
                                                            ? "Activo"
                                                            : "Inactivo"}
                                                        {/* Debug info (remove in production) */}
                                                        <span className="ml-1 text-xs">
                                                            (
                                                            {hasCompletePago
                                                                ? "P"
                                                                : ""}
                                                            {tagActivo
                                                                ? "T"
                                                                : ""}
                                                            )
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="p-2">
                                                    {v.tag ? (
                                                        <button
                                                            onClick={() =>
                                                                handleToggle(
                                                                    v.tag.id
                                                                )
                                                            }
                                                            disabled={loading}
                                                            className={`px-3 py-1 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                                                                v.tag.activo
                                                                    ? "bg-red-500 text-white hover:bg-red-600"
                                                                    : "bg-green-500 text-white hover:bg-green-600"
                                                            }`}
                                                        >
                                                            {loading
                                                                ? "..."
                                                                : v.tag.activo
                                                                ? "Desactivar"
                                                                : "Activar"}
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">
                                                            Sin tag
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Tags;
