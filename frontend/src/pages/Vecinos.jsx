import { useState, useEffect } from "react";
import api from "../api";

function Vecinos() {
    const [vecinos, setVecinos] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);
    const [form, setForm] = useState({
        nombre: "",
        calle: "",
        numero_casa: "",
        selectedTags: [],
    });
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);

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
            const vecinosResponse = await api.get("/vecinos");

            const soldTagIds = salesResponse.data.map((s) => s.tag_id);

            // Get all tags that are already assigned to vecinos (excluding the one being edited)
            const assignedTagIds = [];
            vecinosResponse.data.forEach((vecino) => {
                if (vecino.id !== editingId && vecino.tags) {
                    // Exclude current vecino if editing
                    vecino.tags.forEach((tag) => {
                        assignedTagIds.push(tag.id);
                    });
                }
            });

            // Filter for sold tags that are NOT already assigned to other vecinos
            const available = tagsResponse.data.filter(
                (t) =>
                    soldTagIds.includes(t.id) && !assignedTagIds.includes(t.id)
            );

            setAvailableTags(available);
        } catch (error) {
            console.error("Error fetching available tags:", error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const toggleTag = (tagId) => {
        setForm((prevForm) => {
            const selectedTags = prevForm.selectedTags.includes(tagId)
                ? prevForm.selectedTags.filter((id) => id !== tagId)
                : [...prevForm.selectedTags, tagId];
            return { ...prevForm, selectedTags };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const dataToSend = {
            ...form,
            tag_ids: form.selectedTags,
        };
        delete dataToSend.selectedTags;

        try {
            if (editingId) {
                await api.put(`/vecinos/${editingId}`, dataToSend);
                setEditingId(null);
            } else {
                await api.post("/vecinos", dataToSend);
            }
            setForm({
                nombre: "",
                calle: "",
                numero_casa: "",
                selectedTags: [],
            });
            await Promise.all([fetchVecinos(), fetchAvailableTags()]);
        } catch (error) {
            console.error("Error saving vecino:", error);
            alert(
                "Error saving vecino: " +
                    (error.response?.data?.message || error.message)
            );
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (vecino) => {
        setForm({
            nombre: vecino.nombre,
            calle: vecino.calle,
            numero_casa: vecino.numero_casa,
            selectedTags: vecino.tags ? vecino.tags.map((t) => t.id) : [],
        });
        setEditingId(vecino.id);
        fetchAvailableTags(); // Refresh available tags for editing
    };

    const handleCancelEdit = () => {
        setForm({
            nombre: "",
            calle: "",
            numero_casa: "",
            selectedTags: [],
        });
        setEditingId(null);
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Estás seguro de eliminar este vecino?")) {
            setLoading(true);
            try {
                await api.delete(`/vecinos/${id}`);
                await fetchVecinos();
            } catch (error) {
                console.error("Error deleting vecino:", error);
                alert("Error al eliminar el vecino");
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Gestión de Vecinos
            </h2>

            {/* Form Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    {editingId ? "Editar Vecino" : "Agregar Nuevo Vecino"}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nombre Completo *
                            </label>
                            <input
                                type="text"
                                name="nombre"
                                value={form.nombre}
                                onChange={handleChange}
                                placeholder="Ej: Juan Pérez"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Calle *
                            </label>
                            <input
                                type="text"
                                name="calle"
                                value={form.calle}
                                onChange={handleChange}
                                placeholder="Ej: Av. Principal"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Número de Casa *
                            </label>
                            <input
                                type="number"
                                name="numero_casa"
                                value={form.numero_casa}
                                onChange={handleChange}
                                placeholder="123"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Tag Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Asignar Tags (Solo tags vendidos sin asignar)
                        </label>

                        {availableTags.length === 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-yellow-800 text-sm">
                                    No hay tags vendidos disponibles para
                                    asignar.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {availableTags.map((tag) => {
                                        const isSelected =
                                            form.selectedTags.includes(tag.id);
                                        return (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() =>
                                                    toggleTag(tag.id)
                                                }
                                                disabled={loading}
                                                className={`
                                                    px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                                                    border-2 disabled:opacity-50 disabled:cursor-not-allowed
                                                    ${
                                                        isSelected
                                                            ? "bg-blue-500 text-white border-blue-500 shadow-md transform scale-105"
                                                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                                                    }
                                                `}
                                            >
                                                <span className="font-mono font-bold">
                                                    {tag.codigo}
                                                </span>
                                                {isSelected && (
                                                    <span className="ml-2 text-blue-100">
                                                        ✓
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {form.selectedTags.length > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-blue-800 text-sm">
                                            <span className="font-medium">
                                                Tags seleccionados:
                                            </span>{" "}
                                            {form.selectedTags
                                                .map(
                                                    (id) =>
                                                        availableTags.find(
                                                            (t) => t.id === id
                                                        )?.codigo
                                                )
                                                .filter(Boolean)
                                                .join(", ")}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Procesando...
                                </>
                            ) : editingId ? (
                                "Actualizar Vecino"
                            ) : (
                                "Agregar Vecino"
                            )}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={loading}
                                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">
                        Lista de Vecinos ({vecinos.length})
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-blue-600 text-white">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                    Nombre
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                    Dirección
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                    Tags Asignados
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {vecinos.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="4"
                                        className="px-6 py-8 text-center text-gray-500"
                                    >
                                        No hay vecinos registrados
                                    </td>
                                </tr>
                            ) : (
                                vecinos.map((vecino) => (
                                    <tr
                                        key={vecino.id}
                                        className="hover:bg-gray-50 transition"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">
                                                {vecino.nombre}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {vecino.calle} #{vecino.numero_casa}
                                        </td>
                                        <td className="px-6 py-4">
                                            {vecino.tags &&
                                            vecino.tags.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {vecino.tags.map((tag) => (
                                                        <span
                                                            key={tag.id}
                                                            className="inline-block bg-blue-100 text-blue-800 text-xs font-mono font-bold px-2 py-1 rounded"
                                                        >
                                                            {tag.codigo}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic text-sm">
                                                    Sin tags asignados
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        handleEdit(vecino)
                                                    }
                                                    disabled={loading}
                                                    className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleDelete(vecino.id)
                                                    }
                                                    disabled={loading}
                                                    className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
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
        </div>
    );
}

export default Vecinos;
