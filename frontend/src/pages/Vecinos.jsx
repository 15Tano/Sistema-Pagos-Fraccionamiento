import { useState, useEffect } from "react";
import api from "../api";

function Vecinos() {
    const [vecinos, setVecinos] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);
    const [form, setForm] = useState({
        nombre: "",
        calle: "",
        numero_casa: "",
        numero_tag: "",
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchVecinos();
        fetchAvailableTags();
    }, []);

    const fetchVecinos = async () => {
        try {
            const response = await api.get("/vecinos");
            setVecinos(response.data);
        } catch (error) {
            console.error("Error fetching vecinos:", error);
        }
    };

    const fetchAvailableTags = async () => {
        try {
            const tagsResponse = await api.get("/tags");
            const salesResponse = await api.get("/tag_sales");
            const soldTagIds = salesResponse.data.map((s) => s.tag_id);
            const available = tagsResponse.data.filter(
                (t) => soldTagIds.includes(t.id) && !t.vecino_id
            );
            setAvailableTags(available);
        } catch (error) {
            console.error("Error fetching available tags:", error);
        }
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/vecinos/${editingId}`, form);
                setEditingId(null);
            } else {
                await api.post("/vecinos", form);
            }
            setForm({ nombre: "", calle: "", numero_casa: "", numero_tag: "" });
            fetchVecinos();
        } catch (error) {
            console.error("Error saving vecino:", error);
            alert(
                "Error saving vecino: " +
                    (error.response?.data?.message || error.message)
            );
        }
    };

    const handleEdit = (vecino) => {
        setForm(vecino);
        setEditingId(vecino.id);
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Estás seguro de eliminar este vecino?")) {
            try {
                await api.delete(`/vecinos/${id}`);
                fetchVecinos();
            } catch (error) {
                console.error("Error deleting vecino:", error);
            }
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Vecinos</h2>

            <form
                onSubmit={handleSubmit}
                className="mb-6 grid grid-cols-2 gap-4"
            >
                <input
                    type="text"
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Nombre"
                    className="border rounded-lg px-3 py-2"
                    required
                />
                <input
                    type="text"
                    name="calle"
                    value={form.calle}
                    onChange={handleChange}
                    placeholder="Calle"
                    className="border rounded-lg px-3 py-2"
                    required
                />
                <input
                    type="number"
                    name="numero_casa"
                    value={form.numero_casa}
                    onChange={handleChange}
                    placeholder="Número de Casa"
                    className="border rounded-lg px-3 py-2"
                    required
                />
                <select
                    name="numero_tag"
                    value={form.numero_tag}
                    onChange={handleChange}
                    className="border rounded-lg px-3 py-2"
                    required
                >
                    <option value="">Seleccionar Tag</option>
                    {availableTags.map((t) => (
                        <option key={t.id} value={t.codigo}>
                            {t.codigo}
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    className="col-span-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                    {editingId ? "Actualizar" : "Agregar"} Vecino
                </button>
            </form>

            <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
                <thead className="bg-blue-600 text-white">
                    <tr>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Calle</th>
                        <th className="p-3">Número Casa</th>
                        <th className="p-3">Tag</th>
                        <th className="p-3">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {vecinos.map((v) => (
                        <tr key={v.id} className="border-b">
                            <td className="p-3">{v.nombre}</td>
                            <td className="p-3">{v.calle}</td>
                            <td className="p-3">{v.numero_casa}</td>
                            <td className="p-3">{v.numero_tag}</td>
                            <td className="p-3">
                                <button
                                    onClick={() => handleEdit(v)}
                                    className="bg-yellow-500 text-white px-3 py-1 rounded mr-2 hover:bg-yellow-600"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => handleDelete(v.id)}
                                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
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

export default Vecinos;
