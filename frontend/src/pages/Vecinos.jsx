import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../lib/axios";

// ── ICONS ──
const PlusIcon = () => (
    <svg
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
        />
    </svg>
);
const EditIcon = () => (
    <svg
        width="15"
        height="15"
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
const TrashIcon = () => (
    <svg
        width="15"
        height="15"
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
const SearchIcon = () => (
    <svg
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
        />
    </svg>
);
const XIcon = () => (
    <svg
        width="18"
        height="18"
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
const TagIcon = () => (
    <svg
        width="11"
        height="11"
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

// ── MODAL ──
function VecinoModal({ open, onClose, onSaved, editingVecino, availableTags }) {
    const isEdit = !!editingVecino;
    const [form, setForm] = useState({
        nombre: "",
        calle: "",
        numero_casa: "",
        selectedTags: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [visible, setVisible] = useState(false);
    const [tagSearch, setTagSearch] = useState("");

    // Animación de entrada
    useEffect(() => {
        if (open) {
            setTimeout(() => setVisible(true), 10);
        } else {
            setVisible(false);
        }
    }, [open]);

    // Poblar form al editar
    useEffect(() => {
        if (editingVecino) {
            setForm({
                nombre: editingVecino.nombre || "",
                calle: editingVecino.calle || "",
                numero_casa: editingVecino.numero_casa || "",
                selectedTags: editingVecino.tags?.map((t) => t.id) || [],
            });
        } else {
            setForm({
                nombre: "",
                calle: "",
                numero_casa: "",
                selectedTags: [],
            });
        }
        setError("");
        setTagSearch("");
    }, [editingVecino, open]);

    const toggleTag = (tagId) => {
        setForm((f) => ({
            ...f,
            selectedTags: f.selectedTags.includes(tagId)
                ? f.selectedTags.filter((id) => id !== tagId)
                : [...f.selectedTags, tagId],
        }));
    };

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 250);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) {
            setError("El nombre es obligatorio.");
            return;
        }
        if (!form.calle.trim()) {
            setError("La plaza es obligatoria.");
            return;
        }
        if (!form.numero_casa.trim()) {
            setError("El número de casa es obligatorio.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const payload = {
                nombre: form.nombre.trim(),
                calle: form.calle.trim(),
                numero_casa: form.numero_casa.trim(),
                tags: form.selectedTags,
            };
            if (isEdit) {
                await api.put(`/vecinos/${editingVecino.id}`, payload);
            } else {
                await api.post("/vecinos", payload);
            }
            onSaved();
            handleClose();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Error al guardar. Intenta de nuevo.",
            );
        } finally {
            setLoading(false);
        }
    };

    const filteredTags = availableTags.filter((tag) =>
        tag.codigo.toLowerCase().includes(tagSearch.toLowerCase()),
    );

    if (!open && !editingVecino) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
                background: `rgba(0,0,0,${visible ? 0.25 : 0})`,
                backdropFilter: `blur(${visible ? 6 : 0}px)`,
                transition: "background 0.25s ease, backdrop-filter 0.25s ease",
            }}
            onClick={handleClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    opacity: visible ? 1 : 0,
                    transform: visible
                        ? "scale(1) translateY(0)"
                        : "scale(0.92) translateY(24px)",
                    transition:
                        "opacity 0.28s cubic-bezier(0.34,1.56,0.64,1), transform 0.28s cubic-bezier(0.34,1.56,0.64,1)",
                }}
                className="w-full max-w-md"
            >
                <div className="glass-card">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-base font-700 text-stone-800">
                                {isEdit ? "Editar Vecino" : "Nuevo Vecino"}
                            </h2>
                            <p className="text-xs text-stone-400 mt-0.5">
                                {isEdit
                                    ? "Modifica los datos del vecino"
                                    : "Completa los datos para registrar"}
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-black/5 transition"
                        >
                            <XIcon />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
                            {error}
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-4"
                    >
                        {/* Nombre */}
                        <div>
                            <label className="block text-xs font-600 text-stone-600 mb-1.5">
                                Nombre completo *
                            </label>
                            <input
                                type="text"
                                value={form.nombre}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        nombre: e.target.value,
                                    }))
                                }
                                placeholder="Ej. Juan Pérez García"
                                className="vecino-input"
                                disabled={loading}
                            />
                        </div>

                        {/* Plaza + Número */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-600 text-stone-600 mb-1.5">
                                    Plaza *
                                </label>
                                <input
                                    type="text"
                                    value={form.calle}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            calle: e.target.value,
                                        }))
                                    }
                                    placeholder="Ej. Plaza Roble"
                                    className="vecino-input"
                                    disabled={loading}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-600 text-stone-600 mb-1.5">
                                    Número de casa *
                                </label>
                                <input
                                    type="text"
                                    value={form.numero_casa}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            numero_casa: e.target.value,
                                        }))
                                    }
                                    placeholder="Ej. 14-A"
                                    className="vecino-input"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Tags disponibles */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                                <label className="text-xs font-600 text-stone-600">
                                    Tags disponibles
                                    <span className="ml-1 font-400 text-stone-400">
                                        (opcional)
                                    </span>
                                </label>
                                {/* Buscador pequeñito */}
                                {availableTags.length > 0 && (
                                    <div className="relative w-32">
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 scale-75">
                                            <SearchIcon />
                                        </div>
                                        <input
                                            type="text"
                                            value={tagSearch}
                                            onChange={(e) =>
                                                setTagSearch(e.target.value)
                                            }
                                            placeholder="Buscar tag..."
                                            className="w-full pl-7 pr-2 py-1 text-[11px] rounded-md bg-stone-100 border border-stone-200 text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-orange-400 transition"
                                            disabled={loading}
                                        />
                                    </div>
                                )}
                            </div>

                            {availableTags.length === 0 ? (
                                <p className="text-xs text-stone-400 italic py-2">
                                    No hay tags disponibles para asignar.
                                </p>
                            ) : (
                                <div className="max-h-40 overflow-y-auto p-3 rounded-xl bg-white/50 border border-black/05 custom-scrollbar">
                                    {filteredTags.length === 0 ? (
                                        <p className="text-xs text-stone-400 text-center py-4">
                                            No se encontró el tag "{tagSearch}"
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {filteredTags.map((tag) => {
                                                const selected =
                                                    form.selectedTags.includes(
                                                        tag.id,
                                                    );
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        onClick={() =>
                                                            toggleTag(tag.id)
                                                        }
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-600 border transition-all duration-150
                                                            ${
                                                                selected
                                                                    ? "bg-orange-500 text-white border-orange-500 shadow-sm scale-105"
                                                                    : "bg-white text-stone-600 border-stone-200 hover:border-orange-300 hover:text-orange-600"
                                                            }`}
                                                    >
                                                        <TagIcon />
                                                        {tag.codigo}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            {form.selectedTags.length > 0 && (
                                <p className="text-xs text-orange-600 mt-1.5 font-500">
                                    {form.selectedTags.length} tag
                                    {form.selectedTags.length > 1
                                        ? "s"
                                        : ""}{" "}
                                    seleccionado
                                    {form.selectedTags.length > 1 ? "s" : ""}
                                </p>
                            )}
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-white/60 text-stone-600 text-sm font-600 hover:bg-white transition disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-600 hover:bg-orange-600 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && (
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                )}
                                {loading
                                    ? "Guardando..."
                                    : isEdit
                                      ? "Guardar cambios"
                                      : "Registrar vecino"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// ── COMPONENTE PRINCIPAL ──
export default function Vecinos() {
    const [vecinos, setVecinos] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingVecino, setEditingVecino] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Filtros
    const [search, setSearch] = useState("");
    const [filterPlaza, setFilterPlaza] = useState("");
    const [plazas, setPlazas] = useState([]);

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const PER_PAGE = 20;

    // Debounce del search
    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    // Reset página cuando cambian filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, filterPlaza]);

    // Fetch principal
    const fetchVecinos = useCallback(
        async (page = 1) => {
            setLoading(true);
            try {
                const params = { page, per_page: PER_PAGE };
                if (debouncedSearch) params.search = debouncedSearch;
                if (filterPlaza) params.calle = filterPlaza;

                const res = await api.get("/vecinos", { params });
                const paginated = res.data;

                setVecinos(paginated.data || []);
                setCurrentPage(paginated.current_page);
                setLastPage(paginated.last_page);
                setTotal(paginated.total);
            } catch (err) {
                console.error("Error cargando vecinos:", err);
            } finally {
                setLoading(false);
            }
        },
        [debouncedSearch, filterPlaza],
    );

    // Fetch tags y plazas (solo una vez al montar)
    const fetchTagsAndPlazas = useCallback(async () => {
        try {
            const [tagsRes, salesRes, plazasRes] = await Promise.all([
                api.get("/tags"),
                api.get("/tag_sales"),
                api.get("/vecinos/plazas"),
            ]);

            const soldTagIds = new Set(
                (salesRes.data || []).map((s) => s.tag_id),
            );

            // Tags disponibles = vendidos sin vecino asignado aún
            // Lo calculamos después de cargar vecinos
            setAllTags(tagsRes.data || []);
            setPlazas(plazasRes.data || []);
        } catch (err) {
            console.error("Error cargando tags/plazas:", err);
        }
    }, []);

    // Calcular tags disponibles cuando cambian vecinos o allTags
    useEffect(() => {
        const fetchSalesAndCompute = async () => {
            try {
                const [salesRes, vecinosAllRes] = await Promise.all([
                    api.get("/tag_sales"),
                    api.get("/vecinos", { params: { per_page: 9999 } }),
                ]);
                const soldTagIds = new Set(
                    (salesRes.data || []).map((s) => s.tag_id),
                );
                const assignedTagIds = new Set();
                (vecinosAllRes.data?.data || []).forEach((v) => {
                    (v.tags || []).forEach((t) => assignedTagIds.add(t.id));
                });
                setAvailableTags(
                    allTags.filter(
                        (t) =>
                            soldTagIds.has(t.id) && !assignedTagIds.has(t.id),
                    ),
                );
            } catch (err) {
                console.error(err);
            }
        };
        if (allTags.length > 0) fetchSalesAndCompute();
    }, [allTags, vecinos]);

    useEffect(() => {
        fetchTagsAndPlazas();
    }, [fetchTagsAndPlazas]);
    useEffect(() => {
        fetchVecinos(currentPage);
    }, [fetchVecinos, currentPage]);

    const handleSaved = () => {
        fetchVecinos(currentPage);
        fetchTagsAndPlazas();
    };

    const tagsForModal = useMemo(() => {
        if (!editingVecino) return availableTags;
        const editingIds = new Set((editingVecino.tags || []).map((t) => t.id));
        const extra = (editingVecino.tags || []).filter(
            (t) => !availableTags.find((a) => a.id === t.id),
        );
        return [
            ...availableTags.filter((t) => !editingIds.has(t.id)),
            ...extra,
        ];
    }, [availableTags, editingVecino]);

    const handleOpenNew = () => {
        setEditingVecino(null);
        setModalOpen(true);
    };
    const handleOpenEdit = (vecino) => {
        setEditingVecino(vecino);
        setModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/vecinos/${id}`);
            setDeleteConfirm(null);
            fetchVecinos(currentPage);
        } catch (err) {
            console.error(err);
        }
    };

    // Páginas con ellipsis
    const getPageNumbers = () => {
        if (lastPage <= 5)
            return Array.from({ length: lastPage }, (_, i) => i + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, "...", lastPage];
        if (currentPage >= lastPage - 2)
            return [
                1,
                "...",
                lastPage - 3,
                lastPage - 2,
                lastPage - 1,
                lastPage,
            ];
        return [
            1,
            "...",
            currentPage - 1,
            currentPage,
            currentPage + 1,
            "...",
            lastPage,
        ];
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-lg font-700 text-stone-800">
                        Gestión de Vecinos
                    </h1>
                    <p className="text-xs text-stone-400 mt-0.5">
                        {total} vecinos registrados
                    </p>
                </div>
                <button
                    onClick={handleOpenNew}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-600 hover:bg-orange-600 active:scale-95 transition shadow-sm"
                >
                    <PlusIcon />
                    Nuevo Vecino
                </button>
            </div>

            {/* Filtros */}
            <div className="glass-card !p-3 flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, plaza o número..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white/70 border border-black/08 text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300 transition"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        >
                            <XIcon />
                        </button>
                    )}
                </div>

                {/* Filtro Plaza */}
                <select
                    value={filterPlaza}
                    onChange={(e) => setFilterPlaza(e.target.value)}
                    className="py-2.5 px-3 rounded-xl bg-white/70 border border-black/08 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300 transition min-w-[160px]"
                >
                    <option value="">Todas las plazas</option>
                    {plazas.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>

                {/* Limpiar filtros */}
                {(search || filterPlaza) && (
                    <button
                        onClick={() => {
                            setSearch("");
                            setFilterPlaza("");
                        }}
                        className="px-3 py-2.5 rounded-xl border border-stone-200 bg-white/60 text-stone-500 text-sm hover:bg-white transition whitespace-nowrap"
                    >
                        Limpiar
                    </button>
                )}
            </div>

            {/* Tabla */}
            <div className="glass-card !p-0 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48 gap-3">
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-stone-400">
                            Cargando vecinos...
                        </span>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-black/06 bg-white/40">
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Vecino
                                        </th>
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Plaza
                                        </th>
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Casa
                                        </th>
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Tags
                                        </th>
                                        <th className="px-5 py-3 text-center text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/04">
                                    {vecinos.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="5"
                                                className="px-5 py-12 text-center text-stone-400 text-sm"
                                            >
                                                {search || filterPlaza
                                                    ? "No hay resultados para los filtros aplicados."
                                                    : "No hay vecinos registrados."}
                                            </td>
                                        </tr>
                                    ) : (
                                        vecinos.map((vecino) => (
                                            <tr
                                                key={vecino.id}
                                                className="hover:bg-white/40 transition-colors"
                                            >
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-orange-600 font-700 text-xs">
                                                                {vecino.nombre
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-600 text-stone-800">
                                                            {vecino.nombre}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-stone-600">
                                                    {vecino.calle}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-stone-600">
                                                    #{vecino.numero_casa}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    {vecino.tags?.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {vecino.tags.map(
                                                                (tag) => (
                                                                    <span
                                                                        key={
                                                                            tag.id
                                                                        }
                                                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-orange-100 text-orange-700 border border-orange-200"
                                                                    >
                                                                        <TagIcon />
                                                                        {
                                                                            tag.codigo
                                                                        }
                                                                    </span>
                                                                ),
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-stone-300 italic">
                                                            Sin asignar
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() =>
                                                                handleOpenEdit(
                                                                    vecino,
                                                                )
                                                            }
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 transition"
                                                        >
                                                            <EditIcon />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                setDeleteConfirm(
                                                                    vecino,
                                                                )
                                                            }
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition"
                                                        >
                                                            <TrashIcon />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        {lastPage > 1 && (
                            <div className="flex items-center justify-between px-5 py-3 border-t border-black/05 bg-white/30 flex-wrap gap-2">
                                <span className="text-xs text-stone-400">
                                    {(currentPage - 1) * PER_PAGE + 1}–
                                    {Math.min(currentPage * PER_PAGE, total)} de{" "}
                                    {total} vecinos
                                </span>
                                <div className="flex gap-1 items-center flex-wrap">
                                    <button
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.max(1, p - 1),
                                            )
                                        }
                                        disabled={currentPage === 1}
                                        className="w-7 h-7 rounded-lg border border-black/10 bg-white/60 text-stone-600 text-xs font-semibold flex items-center justify-center hover:bg-white disabled:opacity-30 transition"
                                    >
                                        ‹
                                    </button>
                                    {getPageNumbers().map((p, i) =>
                                        p === "..." ? (
                                            <span
                                                key={`e${i}`}
                                                className="w-6 text-center text-xs text-stone-400"
                                            >
                                                …
                                            </span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() =>
                                                    setCurrentPage(p)
                                                }
                                                className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition
                                                    ${
                                                        currentPage === p
                                                            ? "bg-orange-500 text-white border border-orange-500"
                                                            : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white"
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        ),
                                    )}
                                    <button
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.min(lastPage, p + 1),
                                            )
                                        }
                                        disabled={currentPage === lastPage}
                                        className="w-7 h-7 rounded-lg border border-black/10 bg-white/60 text-stone-600 text-xs font-semibold flex items-center justify-center hover:bg-white disabled:opacity-30 transition"
                                    >
                                        ›
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modales */}
            <VecinoModal
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingVecino(null); // ¡Esto mata al fantasma!
                }}
                onSaved={handleSaved}
                editingVecino={editingVecino}
                availableTags={tagsForModal}
            />

            {deleteConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{
                        background: "rgba(0,0,0,0.25)",
                        backdropFilter: "blur(6px)",
                    }}
                    onClick={() => setDeleteConfirm(null)}
                >
                    <div
                        className="glass-card w-full max-w-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-700 text-stone-800 mb-1">
                            ¿Eliminar vecino?
                        </h3>
                        <p className="text-sm text-stone-500 mb-5">
                            Se eliminará a{" "}
                            <strong>{deleteConfirm.nombre}</strong>{" "}
                            permanentemente.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-white/60 text-stone-600 text-sm font-600 hover:bg-white transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm.id)}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-600 hover:bg-red-600 active:scale-95 transition"
                            >
                                Sí, eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
