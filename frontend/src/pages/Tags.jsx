import { useState, useEffect } from "react";
import api from "../api";

function Tags() {
    const [tags, setTags] = useState([]);
    const [vecinos, setVecinos] = useState([]);
    const [sales, setSales] = useState([]);
    const [stock, setStock] = useState(0);
    const [totalSales, setTotalSales] = useState(0);
    const [unsoldTags, setUnsoldTags] = useState([]);
    const [saleForm, setSaleForm] = useState({ tag_id: "" });
    const currentMonth = new Date().toISOString().slice(0, 7);

    useEffect(() => {
        fetchTags();
        fetchVecinos();
        fetchSales();
        fetchStock();
        fetchTotalSales();
    }, []);

    const fetchTags = async () => {
        try {
            const response = await api.get("/tags");
            setTags(response.data);
        } catch (error) {
            console.error("Error fetching tags:", error);
        }
    };

    const fetchVecinos = async () => {
        try {
            const response = await api.get("/vecinos");
            setVecinos(response.data);
        } catch (error) {
            console.error("Error fetching vecinos:", error);
        }
    };

    const fetchSales = async () => {
        try {
            const response = await api.get("/tag_sales");
            setSales(response.data);
            // Fetch unsold tags
            const tagsResponse = await api.get("/tags");
            const soldTagIds = response.data.map((s) => s.tag_id);
            const unsold = tagsResponse.data.filter(
                (t) => !soldTagIds.includes(t.id)
            );
            setUnsoldTags(unsold);
        } catch (error) {
            console.error("Error fetching sales:", error);
        }
    };

    const fetchStock = async () => {
        try {
            const response = await api.get("/tags/stock");
            setStock(response.data.stock);
        } catch (error) {
            console.error("Error fetching stock:", error);
        }
    };

    const fetchTotalSales = async () => {
        try {
            const response = await api.get("/tags/total_sales");
            setTotalSales(response.data.total_sales);
        } catch (error) {
            console.error("Error fetching total sales:", error);
        }
    };

    const fetchUnsoldTags = async () => {
        try {
            const response = await api.get("/tags");
            const soldTagIds = sales.map((s) => s.tag_id);
            const unsold = response.data.filter(
                (t) => !soldTagIds.includes(t.id)
            );
            setUnsoldTags(unsold);
        } catch (error) {
            console.error("Error fetching unsold tags:", error);
        }
    };

    const handleSaleChange = (e) => {
        setSaleForm({ ...saleForm, [e.target.name]: e.target.value });
    };

    const handleSaleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/tag_sales", saleForm);
            setSaleForm({ tag_id: "" });
            fetchSales();
            fetchStock();
            fetchTotalSales();
            fetchUnsoldTags();
        } catch (error) {
            console.error("Error selling tag:", error);
        }
    };

    const handleToggle = async (id) => {
        try {
            await api.patch(`/tags/${id}/toggle`);
            fetchTags();
            fetchVecinos();
        } catch (error) {
            console.error("Error toggling tag:", error);
        }
    };

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
                            className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 w-full"
                        >
                            Vender Tag (150)
                        </button>
                    </form>

                    <div className="mb-4">
                        <p className="text-sm">
                            Stock: {stock} tags disponibles
                        </p>
                        <p className="text-sm">Total Ventas: ${totalSales}</p>
                        <button
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "¿Está seguro que desea reiniciar las ventas? Esta acción es permanente."
                                    )
                                ) {
                                    api.delete("/tag_sales/reset")
                                        .then(() => {
                                            fetchSales();
                                            fetchStock();
                                            fetchTotalSales();
                                            fetchTags();
                                        })
                                        .catch((error) =>
                                            console.error(
                                                "Error resetting sales:",
                                                error
                                            )
                                        );
                                }
                            }}
                            className="mt-2 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 w-full"
                        >
                            Reiniciar Ventas
                        </button>
                    </div>

                    <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
                        <thead className="bg-green-600 text-white">
                            <tr>
                                <th className="p-2">Tag</th>
                                <th className="p-2">Fecha Venta</th>
                                <th className="p-2">Precio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((s) => (
                                <tr key={s.id} className="border-b">
                                    <td className="p-2">
                                        {s.tag ? s.tag.codigo : "N/A"}
                                    </td>
                                    <td className="p-2">
                                        {new Date(
                                            s.sold_at
                                        ).toLocaleDateString()}
                                    </td>
                                    <td className="p-2">${s.price}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Right Column: Vecinos */}
                <div>
                    <h3 className="text-lg font-semibold mb-4">Vecinos</h3>

                    <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
                        <thead className="bg-blue-600 text-white">
                            <tr>
                                <th className="p-2">Vecino</th>
                                <th className="p-2">Tag</th>
                                <th className="p-2">Activo</th>
                                <th className="p-2">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vecinos.map((v) => {
                                const hasPago =
                                    v.pagos &&
                                    v.pagos.some((p) => p.mes === currentMonth);
                                const isActive =
                                    hasPago || (v.tag && v.tag.activo);
                                return (
                                    <tr key={v.id} className="border-b">
                                        <td className="p-2">{v.nombre}</td>
                                        <td className="p-2">
                                            {v.numero_tag || "Sin tag"}
                                        </td>
                                        <td className="p-2">
                                            <span
                                                className={`px-2 py-1 rounded text-xs ${
                                                    isActive
                                                        ? "bg-green-500 text-white"
                                                        : "bg-gray-500 text-white"
                                                }`}
                                            >
                                                {isActive
                                                    ? "Activo"
                                                    : "Inactivo"}
                                            </span>
                                        </td>
                                        <td className="p-2">
                                            {v.tag && (
                                                <button
                                                    onClick={() =>
                                                        handleToggle(v.tag.id)
                                                    }
                                                    className={`px-3 py-1 rounded text-xs ${
                                                        v.tag.activo
                                                            ? "bg-red-500 text-white hover:bg-red-600"
                                                            : "bg-blue-500 text-white hover:bg-blue-600"
                                                    }`}
                                                >
                                                    {v.tag.activo
                                                        ? "Desactivar"
                                                        : "Activar"}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Tags;
