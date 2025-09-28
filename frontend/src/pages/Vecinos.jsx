import { useState, useEffect, useCallback } from "react";
import api from "../api";

// --- Custom SVG Icons ---
const UserPlusIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
        />
    </svg>
);
const EditIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
    </svg>
);
const TrashIcon = ({ className }) => (
    <svg
        className={className}
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
const HomeIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
    </svg>
);
const TagIcon = ({ className }) => (
    <svg
        className={className}
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
const CheckIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
        />
    </svg>
);
const XIcon = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
        />
    </svg>
);
const UsersIcon = () => (
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
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.995 5.995 0 0012 12a5.995 5.995 0 00-3-5.197M15 21a2 2 0 002-2v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1a2 2 0 002 2h6zm-6-9a2 2 0 00-2 2v1a2 2 0 002 2h6a2 2 0 002-2v-1a2 2 0 00-2-2H9z"
        />
    </svg>
);

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
    const [loading, setLoading] = useState(true);

    const fetchVecinos = useCallback(async () => {
        try {
            const response = await api.get("/vecinos");
            setVecinos(response.data || []);
        } catch (error) {
            console.error("Error fetching vecinos:", error);
            setVecinos([]); // Ensure it's an array on error
        }
    }, []);

    const fetchAvailableTags = useCallback(async (currentEditingId) => {
        try {
            const [tagsRes, salesRes, vecinosRes] = await Promise.all([
                api.get("/tags"),
                api.get("/tag_sales"),
                api.get("/vecinos"),
            ]);

            const soldTagIds = new Set(
                (salesRes.data || []).map((s) => s.tag_id)
            );
            const assignedTagIds = new Set();

            (vecinosRes.data || []).forEach((vecino) => {
                // Collect all assigned tags, EXCEPT from the one we are currently editing
                if (vecino.id !== currentEditingId && vecino.tags) {
                    vecino.tags.forEach((tag) => assignedTagIds.add(tag.id));
                }
            });

            const available = (tagsRes.data || []).filter(
                (t) => soldTagIds.has(t.id) && !assignedTagIds.has(t.id)
            );

            setAvailableTags(available);
        } catch (error) {
            console.error("Error fetching available tags:", error);
            setAvailableTags([]); // Ensure it's an array on error
        }
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            await Promise.all([fetchVecinos(), fetchAvailableTags(null)]);
            setLoading(false);
        };
        loadInitialData();
    }, [fetchVecinos, fetchAvailableTags]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const toggleTag = (tagId) => {
        setForm((prevForm) => ({
            ...prevForm,
            selectedTags: prevForm.selectedTags.includes(tagId)
                ? prevForm.selectedTags.filter((id) => id !== tagId)
                : [...prevForm.selectedTags, tagId],
        }));
    };

    const resetForm = useCallback(() => {
        setForm({ nombre: "", calle: "", numero_casa: "", selectedTags: [] });
        setEditingId(null);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const dataToSend = { ...form, tag_ids: form.selectedTags };
        delete dataToSend.selectedTags;
        try {
            if (editingId) {
                await api.put(`/vecinos/${editingId}`, dataToSend);
            } else {
                await api.post("/vecinos", dataToSend);
            }
            resetForm();
            await Promise.all([fetchVecinos(), fetchAvailableTags(null)]);
        } catch (error) {
            console.error("Error saving vecino:", error);
            alert(
                "Error al guardar vecino: " +
                    (error.response?.data?.message || error.message)
            );
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = useCallback(
        (vecino) => {
            setForm({
                nombre: vecino.nombre,
                calle: vecino.calle,
                numero_casa: vecino.numero_casa,
                selectedTags: vecino.tags ? vecino.tags.map((t) => t.id) : [],
            });
            setEditingId(vecino.id);
            fetchAvailableTags(vecino.id); // Refresh tags, passing the ID of the user being edited
            window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [fetchAvailableTags]
    );

    const handleCancelEdit = useCallback(() => {
        resetForm();
        fetchAvailableTags(null);
    }, [resetForm, fetchAvailableTags]);

    const handleDelete = useCallback(
        async (id) => {
            if (
                window.confirm(
                    "¿Estás seguro de eliminar este vecino? Esta acción es permanente."
                )
            ) {
                setLoading(true);
                try {
                    await api.delete(`/vecinos/${id}`);
                    await Promise.all([
                        fetchVecinos(),
                        fetchAvailableTags(null),
                    ]);
                } catch (error) {
                    console.error("Error deleting vecino:", error);
                    alert("Error al eliminar el vecino.");
                } finally {
                    setLoading(false);
                }
            }
        },
        [fetchVecinos, fetchAvailableTags]
    );

    // Create the definitive list of tags to show in the form
    const tagsForSelection = [...availableTags];
    if (editingId) {
        const currentVecino = vecinos.find((v) => v.id === editingId);
        if (currentVecino && currentVecino.tags) {
            currentVecino.tags.forEach((tag) => {
                // If the neighbor's tag isn't in the available list, add it
                if (!tagsForSelection.find((t) => t.id === tag.id)) {
                    tagsForSelection.push(tag);
                }
            });
        }
    }

    if (loading && !editingId) {
        // Show full-page loader only on initial load
        return (
            <div className="min-h-screen bg-white-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
                    <p className="mt-4 text-slate-600 font-medium">
                        Cargando datos...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-whire-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold bg-orange-600 bg-clip-text text-transparent mb-2">
                        Gestión de Vecinos
                    </h1>
                    <p className="text-slate-600">
                        Administra la información de los vecinos y asignación de
                        tags
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                    <div className="bg-orange-500 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500 rounded-lg">
                                <UserPlusIcon className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold text-white">
                                {editingId
                                    ? "Editar Vecino"
                                    : "Agregar Nuevo Vecino"}
                            </h3>
                        </div>
                    </div>

                    <div className="p-6 bg-white">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombre Completo *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="nombre"
                                            value={form.nombre}
                                            onChange={handleChange}
                                            placeholder="Ej: Juan Pérez"
                                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 pl-10"
                                            required
                                            disabled={loading}
                                        />
                                        <UserPlusIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Calle *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="calle"
                                            value={form.calle}
                                            onChange={handleChange}
                                            placeholder="Ej: Av. Principal"
                                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 pl-10"
                                            required
                                            disabled={loading}
                                        />
                                        <HomeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
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
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* Tag Selection */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <TagIcon className="w-5 h-5 text-gray-600" />
                                    <label className="block text-sm font-medium text-gray-700">
                                        Asignar Tags
                                    </label>
                                </div>
                                {tagsForSelection.length === 0 ? (
                                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
                                        <p className="text-amber-800 text-sm font-medium">
                                            No hay tags vendidos disponibles
                                            para asignar.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-3">
                                        {tagsForSelection.map((tag) => {
                                            const isSelected =
                                                form.selectedTags.includes(
                                                    tag.id
                                                );
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() =>
                                                        toggleTag(tag.id)
                                                    }
                                                    disabled={loading}
                                                    className={`relative px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 transform border-2 disabled:opacity-50 ${
                                                        isSelected
                                                            ? "bg-orange-500 text-white border-transparent shadow-lg scale-105"
                                                            : "bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:scale-105"
                                                    }`}
                                                >
                                                    <span className="font-mono">
                                                        {tag.codigo}
                                                    </span>
                                                    {isSelected && (
                                                        <CheckIcon className="absolute -top-1 -right-1 w-4 h-4 text-white bg-green-500 rounded-full p-0.5" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4 pt-6 border-t border-gray-200">
                                <button
                                    type="submit"
                                    disabled={loading || !form.nombre}
                                    className="flex items-center justify-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-200 transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:bg-gray-400 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {loading
                                        ? "Guardando..."
                                        : editingId
                                        ? "Actualizar Vecino"
                                        : "Agregar Vecino"}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={loading}
                                        className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-300 transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-gray-300 shadow-md"
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Table Card */}
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                    <div className="bg-orange-500 px-6 py-4">
                        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                            <UsersIcon className="w-6 h-6" />
                            Lista de Vecinos ({vecinos.length})
                        </h3>
                    </div>
                    <div className="overflow-x-auto bg-white">
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Nombre
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Dirección
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Tags Asignados
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-700">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {vecinos.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="px-6 py-12 text-center text-gray-500"
                                        >
                                            No hay vecinos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    vecinos.map((vecino) => (
                                        <tr
                                            key={vecino.id}
                                            className="hover:bg-gray-50/50 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-orange-300 rounded-full flex-shrink-0 flex items-center justify-center">
                                                        <span className="text-white font-semibold text-lg">
                                                            {vecino.nombre
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="font-medium text-gray-900">
                                                        {vecino.nombre}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {vecino.calle} #
                                                {vecino.numero_casa}
                                            </td>
                                            <td className="px-6 py-4">
                                                {vecino.tags &&
                                                vecino.tags.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {vecino.tags.map(
                                                            (tag) => (
                                                                <span
                                                                    key={tag.id}
                                                                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold bg-orange-100 text-orange-800"
                                                                >
                                                                    <TagIcon className="w-3 h-3 mr-1.5" />
                                                                    {tag.codigo}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-sm">
                                                        Sin tags
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() =>
                                                            handleEdit(vecino)
                                                        }
                                                        disabled={loading}
                                                        className="p-2 text-amber-600 hover:bg-amber-100 rounded-full transition-colors"
                                                    >
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDelete(
                                                                vecino.id
                                                            )
                                                        }
                                                        disabled={loading}
                                                        className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
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
        </div>
    );
}

export default Vecinos;
