import { useState, useEffect } from "react";
import api from "../api";

function Pagos() {
    const [pagos, setPagos] = useState([]);
    const [vecinos, setVecinos] = useState([]);
    const [form, setForm] = useState({
        vecino_id: "",
        cantidad: "",
        mes: "",
        tipo: "ordinario",
        fecha_de_cobro: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [editingPagoId, setEditingPagoId] = useState(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchVecinos(), fetchPagos()]);
        } catch (error) {
            console.error("Error fetching initial data:", error);
            setError("Error al cargar los datos iniciales");
        } finally {
            setLoading(false);
        }
    };

    const fetchVecinos = async () => {
        try {
            const response = await api.get("/vecinos");
            setVecinos(response.data);
        } catch (error) {
            console.error("Error fetching vecinos:", error);
            throw error;
        }
    };

    const fetchPagos = async () => {
        try {
            const response = await api.get("/pagos");
            setPagos(response.data);
        } catch (error) {
            console.error("Error fetching pagos:", error);
            throw error;
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
        setError(""); // Clear error when user types
    };

    const validateForm = () => {
        const cantidad = parseFloat(form.cantidad);

        if (!form.vecino_id) {
            setError("Por favor seleccione un vecino");
            return false;
        }

        if (!cantidad || cantidad <= 0) {
            setError("La cantidad debe ser mayor a 0");
            return false;
        }

        if (!form.mes) {
            setError("Por favor seleccione un mes");
            return false;
        }

        // Validate that cantidad doesn't exceed the monthly fee (280)
        const monthlyFee = 280;
        if (cantidad > monthlyFee) {
            setError(
                `La cantidad no puede ser mayor a ${monthlyFee} (cuota mensual)`
            );
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError("");

        try {
            const cantidad = parseFloat(form.cantidad);

            const submitData = {
                ...form,
                cantidad: cantidad,
            };

            if (editingPagoId) {
                await api.put(`/pagos/${editingPagoId}`, submitData);
            } else {
                await api.post("/pagos", submitData);
            }

            // Reset form
            setForm({
                vecino_id: "",
                cantidad: "",
                mes: "",
                tipo: "ordinario",
                fecha_de_cobro: "",
            });
            setEditingPagoId(null);

            await fetchPagos(); // Refresh the list
        } catch (error) {
            console.error("Error saving pago:", error);
            if (
                error.response &&
                error.response.data &&
                error.response.data.message
            ) {
                setError(error.response.data.message);
            } else {
                setError(
                    "Error al guardar el pago. Por favor intente nuevamente."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (pago) => {
        setForm({
            vecino_id: pago.vecino.id,
            cantidad: pago.cantidad.toString(),
            mes: pago.mes,
            tipo: pago.tipo,
            fecha_de_cobro: pago.fecha_de_cobro || "",
        });
        setEditingPagoId(pago.id);
        setError(""); // Clear any existing errors
    };

    const handleCancelEdit = () => {
        setForm({
            vecino_id: "",
            cantidad: "",
            mes: "",
            tipo: "ordinario",
            fecha_de_cobro: "",
        });
        setEditingPagoId(null);
        setError("");
    };

    const handleDelete = async (id) => {
        if (
            !window.confirm("¿Estás seguro de que quieres eliminar este pago?")
        ) {
            return;
        }

        setLoading(true);
        try {
            await api.delete(`/pagos/${id}`);
            await fetchPagos(); // Refresh the list
        } catch (error) {
            console.error("Error deleting pago:", error);
            setError(
                "Error al eliminar el pago. Por favor intente nuevamente."
            );
        } finally {
            setLoading(false);
        }
    };

    const formatMonth = (monthString) => {
        if (!monthString) return "-";
        const [year, month] = monthString.split("-");
        const date = new Date(year, month - 1);
        return date.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
        });
    };

    const calculateRestantePreview = () => {
        if (!form.vecino_id || !form.mes || !form.cantidad) return 0;
        const totalPagadoMes = pagos
            .filter((p) => p.vecino.id == form.vecino_id && p.mes === form.mes)
            .reduce((sum, p) => sum + p.cantidad, 0);
        const cantidad = parseFloat(form.cantidad) || 0;
        return Math.max(0, 280 - totalPagadoMes - cantidad);
    };

    if (loading && pagos.length === 0 && vecinos.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-center items-center h-64">
                    <div className="text-lg">Cargando...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold text-indigo-600 mb-4">
                {editingPagoId ? "Editar Pago" : "Registrar Pago"}
            </h2>

            {error && (
                <div className="mb-4 text-red-600 bg-red-100 p-3 rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-2 gap-4 mb-6"
            >
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vecino *
                    </label>
                    <select
                        name="vecino_id"
                        value={form.vecino_id}
                        onChange={handleChange}
                        className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                        disabled={loading}
                    >
                        <option value="">Seleccione un vecino</option>
                        {vecinos.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cantidad *
                    </label>
                    <input
                        type="number"
                        name="cantidad"
                        value={form.cantidad}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0.01"
                        className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                        disabled={loading}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mes *
                    </label>
                    <input
                        type="month"
                        name="mes"
                        value={form.mes}
                        onChange={handleChange}
                        className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                        disabled={loading}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo
                    </label>
                    <select
                        name="tipo"
                        value={form.tipo}
                        onChange={handleChange}
                        className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={loading}
                    >
                        <option value="ordinario">Ordinario</option>
                        <option value="extraordinario">Extraordinario</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de Cobro
                    </label>
                    <input
                        type="date"
                        name="fecha_de_cobro"
                        value={form.fecha_de_cobro}
                        onChange={handleChange}
                        className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={loading}
                    />
                </div>

                {/* Show calculated restante preview */}
                {form.cantidad && form.vecino_id && form.mes && (
                    <div className="bg-gray-50 border rounded-lg px-3 py-2 col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Restante (calculado)
                        </label>
                        <div className="text-lg font-semibold text-gray-800">
                            ${calculateRestantePreview()}
                        </div>
                        <div className="text-xs text-gray-500">
                            Cuota mensual: $280
                        </div>
                    </div>
                )}

                <div className="col-span-2 flex gap-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 text-white py-2 px-6 rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading
                            ? editingPagoId
                                ? "Actualizando..."
                                : "Registrando..."
                            : editingPagoId
                            ? "Actualizar"
                            : "Registrar"}
                    </button>
                    {editingPagoId && (
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={loading}
                            className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                    )}
                </div>
            </form>

            <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Historial de Pagos
            </h3>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-gray-50 rounded-lg overflow-hidden shadow-sm">
                    <thead className="bg-indigo-600 text-white">
                        <tr>
                            <th className="p-3 text-left">Vecino</th>
                            <th className="p-3 text-left">Mes</th>
                            <th className="p-3 text-left">Tipo</th>
                            <th className="p-3 text-left">Cantidad</th>
                            <th className="p-3 text-left">Estado</th>
                            <th className="p-3 text-left">Fecha de Cobro</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagos.length === 0 ? (
                            <tr>
                                <td
                                    colSpan="7"
                                    className="p-6 text-center text-gray-500"
                                >
                                    No hay pagos registrados
                                </td>
                            </tr>
                        ) : (
                            pagos.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-b hover:bg-gray-100 transition"
                                >
                                    <td className="p-3 font-medium">
                                        {p.vecino.nombre}
                                    </td>
                                    <td className="p-3">
                                        {formatMonth(p.mes)}
                                    </td>
                                    <td className="p-3">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${
                                                p.tipo === "extraordinario"
                                                    ? "bg-orange-100 text-orange-800"
                                                    : "bg-blue-100 text-blue-800"
                                            }`}
                                        >
                                            {p.tipo.charAt(0).toUpperCase() +
                                                p.tipo.slice(1)}
                                        </span>
                                    </td>
                                    <td className="p-3 font-semibold">
                                        ${p.cantidad}
                                    </td>
                                    <td className="p-3">
                                        {p.restante > 0 ? (
                                            <span className="text-orange-600 font-medium">
                                                Resta ${p.restante}
                                            </span>
                                        ) : (
                                            <span className="text-green-600 font-medium flex items-center">
                                                <span className="mr-1">✅</span>
                                                Cubierto
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {p.fecha_de_cobro ? (
                                            new Date(
                                                p.fecha_de_cobro
                                            ).toLocaleDateString("es-ES")
                                        ) : (
                                            <span className="text-gray-400">
                                                Sin fecha
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                onClick={() => handleEdit(p)}
                                                disabled={loading}
                                                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDelete(p.id)
                                                }
                                                disabled={loading}
                                                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Pagos;
