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
        restante: "",
    });
    const [error, setError] = useState("");
    const [editingPagoId, setEditingPagoId] = useState(null);

    useEffect(() => {
        fetchVecinos();
        fetchPagos();
    }, []);

    const fetchVecinos = async () => {
        try {
            const response = await api.get("/vecinos");
            setVecinos(response.data);
        } catch (error) {
            console.error("Error fetching vecinos:", error);
        }
    };

    const fetchPagos = async () => {
        try {
            const response = await api.get("/pagos");
            setPagos(response.data);
        } catch (error) {
            console.error("Error fetching pagos:", error);
        }
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cantidad = parseFloat(form.cantidad);
        if (cantidad <= 0) {
            setError("Cantidad incorrecta");
            return;
        }

        try {
            if (editingPagoId) {
                await api.put(`/pagos/${editingPagoId}`, form);
            } else {
                await api.post("/pagos", form);
            }
            setForm({
                vecino_id: "",
                cantidad: "",
                mes: "",
                tipo: "ordinario",
                restante: "",
            });
            setEditingPagoId(null);
            fetchPagos(); // Refresh the list
        } catch (error) {
            console.error("Error saving pago:", error);
            setError("Error al guardar el pago");
        }
    };

    const handleEdit = (pago) => {
        setForm({
            vecino_id: pago.vecino.id,
            cantidad: pago.cantidad,
            mes: pago.mes,
            tipo: pago.tipo,
            restante: pago.restante,
        });
        setEditingPagoId(pago.id);
    };

    const handleCancelEdit = () => {
        setForm({
            vecino_id: "",
            cantidad: "",
            mes: "",
            tipo: "ordinario",
            restante: "",
        });
        setEditingPagoId(null);
        setError("");
    };

    const handleDelete = async (id) => {
        if (
            window.confirm("¿Estás seguro de que quieres eliminar este pago?")
        ) {
            try {
                await api.delete(`/pagos/${id}`);
                fetchPagos(); // Refresh the list
            } catch (error) {
                console.error("Error deleting pago:", error);
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold text-indigo-600 mb-4">
                {editingPagoId ? "Editar Pago" : "Registrar Pago"}
            </h2>

            {error && (
                <div className="mb-4 text-red-600 bg-red-100 p-2 rounded">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-2 gap-4 mb-6"
            >
                <select
                    name="vecino_id"
                    value={form.vecino_id}
                    onChange={handleChange}
                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                >
                    <option value="" disabled>
                        Seleccione un vecino
                    </option>
                    {vecinos.map((v) => (
                        <option key={v.id} value={v.id}>
                            {v.nombre}
                        </option>
                    ))}
                </select>
                <input
                    type="number"
                    name="cantidad"
                    value={form.cantidad}
                    onChange={handleChange}
                    placeholder="Cantidad"
                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                />
                <input
                    type="month"
                    name="mes"
                    value={form.mes}
                    onChange={handleChange}
                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                />
                <select
                    name="tipo"
                    value={form.tipo}
                    onChange={handleChange}
                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="ordinario">Ordinario</option>
                    <option value="extraordinario">Extraordinario</option>
                </select>
                {editingPagoId && (
                    <input
                        type="number"
                        name="restante"
                        value={form.restante}
                        onChange={handleChange}
                        placeholder="Restante"
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                        required
                    />
                )}

                <div className="col-span-2 flex gap-2">
                    <button
                        type="submit"
                        className="bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition"
                    >
                        {editingPagoId ? "Actualizar" : "Registrar"}
                    </button>
                    {editingPagoId && (
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition"
                        >
                            Cancelar
                        </button>
                    )}
                </div>
            </form>

            <h3 className="text-lg font-semibold mb-2">Historial de Pagos</h3>
            <table className="w-full border-collapse bg-gray-50 rounded-lg overflow-hidden">
                <thead className="bg-indigo-600 text-white">
                    <tr>
                        <th className="p-2">Vecino</th>
                        <th className="p-2">Mes</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Cantidad</th>
                        <th className="p-2">Restante</th>
                        <th className="p-2">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {pagos.map((p) => (
                        <tr key={p.id} className="border-b text-center">
                            <td className="p-2">{p.vecino.nombre}</td>
                            <td className="p-2">{p.mes}</td>
                            <td className="p-2 capitalize">{p.tipo}</td>
                            <td className="p-2">${p.cantidad}</td>
                            <td className="p-2">
                                {p.restante > 0
                                    ? `Restan $${p.restante}`
                                    : "✔️ Cubierto"}
                            </td>
                            <td className="p-2 flex gap-1 justify-center">
                                <button
                                    onClick={() => handleEdit(p)}
                                    className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => handleDelete(p.id)}
                                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                >
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Pagos;
