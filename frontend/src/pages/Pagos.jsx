import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../lib/axios";

// ── ICONS ──
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
            d="M6 18L18 6M6 6l12 12"
        />
    </svg>
);
const ChevronIcon = ({ open }) => (
    <svg
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
        }}
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
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
const TrashIcon = () => (
    <svg
        width="14"
        height="14"
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
const EditIcon = () => (
    <svg
        width="14"
        height="14"
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

// ── CUOTAS BASE ──
const CUOTAS = [280, 300, 500];
const RECARGO_EXTRA = 50;

// ── FILA EXPANDIBLE ──
function PagoExpandido({ vecinoUuid }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/pagos/estado-meses/${vecinoUuid}`)
            .then((r) => setData(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [vecinoUuid]);

    if (loading)
        return (
            <div className="px-5 py-3 flex items-center gap-2 text-xs text-stone-400">
                <div className="w-3 h-3 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                Cargando estado...
            </div>
        );

    if (!data) return null;

    return (
        <div className="px-5 py-3 bg-white/20 border-t border-black/04 flex flex-col sm:flex-row gap-4">
            {/* Últimos 3 meses */}
            <div className="flex flex-col gap-1.5">
                <p className="text-xs font-600 text-stone-500 uppercase tracking-wider mb-1">
                    Últimos 3 meses
                </p>
                <div className="flex gap-2">
                    {data.meses.map((m) => (
                        <div
                            key={m.mes}
                            className="flex flex-col items-center gap-1"
                        >
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 text-xs font-700
                                ${
                                    m.pagado
                                        ? "bg-green-100 border-green-400 text-green-700"
                                        : "bg-red-100 border-red-300 text-red-600"
                                }`}
                            >
                                {m.pagado ? "✓" : "✗"}
                            </div>
                            <span
                                className="text-xs text-stone-400 text-center leading-tight"
                                style={{ maxWidth: 52 }}
                            >
                                {m.label.split(" ")[0]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px bg-black/08" />

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
                <p className="text-xs font-600 text-stone-500 uppercase tracking-wider mb-1">
                    Tags asignados
                </p>
                {data.tags.length === 0 ? (
                    <span className="text-xs text-stone-300 italic">
                        Sin tags
                    </span>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {data.tags.map((tag) => (
                            <span
                                key={tag.id}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-orange-100 text-orange-700 border border-orange-200"
                            >
                                <TagIcon />
                                {tag.codigo}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── FORMULARIO DE PAGO ──
function FormularioPago({ onSaved, editingPago, onCancelEdit }) {
    const isEdit = !!editingPago;

    const [vecinoSearch, setVecinoSearch] = useState("");
    const [vecinoResults, setVecinoResults] = useState([]);
    const [selectedVecino, setSelectedVecino] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [cuotaBase, setCuotaBase] = useState(280);
    const [mesesPagados, setMesesPagados] = useState(1);
    const [mes, setMes] = useState("");
    const [tipo, setTipo] = useState("ordinario");
    const [fechaCobro, setFechaCobro] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const searchTimeout = useRef(null);
    const dropdownRef = useRef(null);

    // Poblar form al editar
    useEffect(() => {
        if (editingPago) {
            setSelectedVecino(editingPago.vecino);
            setVecinoSearch(
                `${editingPago.vecino.nombre} — ${editingPago.vecino.calle} #${editingPago.vecino.numero_casa}`,
            );
            // Inferir cuota base desde cantidad y meses
            const porMes =
                editingPago.meses_pagados > 0
                    ? Math.round(
                          editingPago.cantidad / editingPago.meses_pagados,
                      )
                    : editingPago.cantidad;
            const recargo =
                editingPago.tipo === "extraordinario" ? RECARGO_EXTRA : 0;
            const base = porMes - recargo;
            setCuotaBase(CUOTAS.includes(base) ? base : 280);
            setMesesPagados(editingPago.meses_pagados || 1);
            setMes(editingPago.mes || "");
            setTipo(editingPago.tipo || "ordinario");
            setFechaCobro(
                editingPago.fecha_de_cobro
                    ? editingPago.fecha_de_cobro.slice(0, 10)
                    : "",
            );
        } else {
            resetForm();
        }
    }, [editingPago]);

    const resetForm = () => {
        setSelectedVecino(null);
        setVecinoSearch("");
        setVecinoResults([]);
        setCuotaBase(280);
        setMesesPagados(1);
        setMes("");
        setTipo("ordinario");
        setFechaCobro("");
        setError("");
    };

    // Búsqueda de vecinos con debounce
    const handleVecinoSearch = (val) => {
        setVecinoSearch(val);
        setSelectedVecino(null);
        clearTimeout(searchTimeout.current);
        if (!val.trim()) {
            setVecinoResults([]);
            setShowDropdown(false);
            return;
        }
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await api.get("/vecinos", {
                    params: { search: val, per_page: 8 },
                });
                setVecinoResults(res.data.data || []);
                setShowDropdown(true);
            } catch {
                setVecinoResults([]);
            }
        }, 200);
    };

    const selectVecino = (v) => {
        setSelectedVecino(v);
        setVecinoSearch(`${v.nombre} — ${v.calle} #${v.numero_casa}`);
        setShowDropdown(false);
        setVecinoResults([]);
    };

    // Cálculo reactivo
    const recargo = tipo === "extraordinario" ? RECARGO_EXTRA : 0;
    const porMes = cuotaBase + recargo;
    const totalCalc = porMes * mesesPagados;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedVecino && !isEdit) {
            setError("Selecciona un vecino.");
            return;
        }
        if (!mes) {
            setError("Selecciona el mes de inicio.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const payload = {
                cuota_base: cuotaBase,
                meses_pagados: mesesPagados,
                mes,
                tipo,
                fecha_de_cobro: fechaCobro || null,
            };
            if (!isEdit) payload.vecino_uuid = selectedVecino.uuid;

            if (isEdit) {
                await api.put(`/pagos/${editingPago.uuid}`, payload);
            } else {
                await api.post("/pagos", payload);
            }
            resetForm();
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || "Error al guardar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-base font-700 text-stone-800">
                        {isEdit ? "Editar Pago" : "Registrar Pago"}
                    </h2>
                    <p className="text-xs text-stone-400 mt-0.5">
                        {isEdit
                            ? "Modifica los datos del pago"
                            : "Completa los datos para registrar"}
                    </p>
                </div>
                {isEdit && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-600 bg-orange-100 text-orange-700 border border-orange-200">
                        Modo edición
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Buscador de vecino */}
                {!isEdit && (
                    <div>
                        <label className="block text-xs font-600 text-stone-600 mb-1.5">
                            Vecino *
                        </label>
                        <div className="relative" ref={dropdownRef}>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                                <SearchIcon />
                            </div>
                            <input
                                type="text"
                                value={vecinoSearch}
                                onChange={(e) =>
                                    handleVecinoSearch(e.target.value)
                                }
                                onFocus={() =>
                                    vecinoResults.length > 0 &&
                                    setShowDropdown(true)
                                }
                                placeholder="Buscar por nombre, plaza o número..."
                                className="vecino-input pl-9 pr-8"
                                disabled={loading}
                            />
                            {vecinoSearch && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVecinoSearch("");
                                        setSelectedVecino(null);
                                        setShowDropdown(false);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                >
                                    <XIcon />
                                </button>
                            )}
                            {showDropdown && vecinoResults.length > 0 && (
                                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-md border border-black/08 rounded-xl shadow-lg overflow-hidden">
                                    {vecinoResults.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => selectVecino(v)}
                                            className="w-full px-4 py-2.5 text-left hover:bg-orange-50 border-b border-black/04 last:border-0 transition"
                                        >
                                            <p className="text-sm font-600 text-stone-800">
                                                {v.nombre}
                                            </p>
                                            <p className="text-xs text-stone-400">
                                                {v.calle} #{v.numero_casa}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedVecino && (
                            <div className="mt-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 font-500">
                                ✓ {selectedVecino.nombre} —{" "}
                                {selectedVecino.calle} #
                                {selectedVecino.numero_casa}
                            </div>
                        )}
                    </div>
                )}

                {/* Grid de campos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Cuota base */}
                    <div>
                        <label className="block text-xs font-600 text-stone-600 mb-1.5">
                            Cuota base *
                        </label>
                        <div className="flex gap-2">
                            {CUOTAS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCuotaBase(c)}
                                    className={`flex-1 py-2 rounded-xl text-sm font-700 border transition-all
                                        ${
                                            cuotaBase === c
                                                ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                                : "bg-white/60 text-stone-600 border-black/10 hover:border-orange-300"
                                        }`}
                                >
                                    ${c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tipo */}
                    <div>
                        <label className="block text-xs font-600 text-stone-600 mb-1.5">
                            Tipo de pago *
                        </label>
                        <select
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                            className="vecino-input"
                            disabled={loading}
                        >
                            <option value="ordinario">Ordinario</option>
                            <option value="extraordinario">
                                Extraordinario (+$50)
                            </option>
                        </select>
                    </div>

                    {/* Meses */}
                    <div>
                        <label className="block text-xs font-600 text-stone-600 mb-1.5">
                            Meses a pagar *
                        </label>
                        <select
                            value={mesesPagados}
                            onChange={(e) =>
                                setMesesPagados(Number(e.target.value))
                            }
                            className="vecino-input"
                            disabled={loading}
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                                (n) => (
                                    <option key={n} value={n}>
                                        {n} mes{n > 1 ? "es" : ""}
                                    </option>
                                ),
                            )}
                        </select>
                    </div>

                    {/* Mes inicio */}
                    <div>
                        <label className="block text-xs font-600 text-stone-600 mb-1.5">
                            Mes de inicio *
                        </label>
                        <input
                            type="month"
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                            className="vecino-input"
                            disabled={loading}
                        />
                    </div>

                    {/* Fecha de cobro */}
                    <div>
                        <label className="block text-xs font-600 text-stone-600 mb-1.5">
                            Fecha de cobro
                        </label>
                        <input
                            type="date"
                            value={fechaCobro}
                            onChange={(e) => setFechaCobro(e.target.value)}
                            className="vecino-input"
                            disabled={loading}
                        />
                    </div>

                    {/* Resumen reactivo */}
                    <div className="flex flex-col justify-end">
                        <div className="px-4 py-3 rounded-xl bg-orange-50 border border-orange-200">
                            <p className="text-xs text-orange-600 font-600 mb-1">
                                Resumen
                            </p>
                            <p className="text-xs text-stone-500">
                                ${cuotaBase}
                                {recargo > 0
                                    ? ` + $${recargo} recargo`
                                    : ""} × {mesesPagados} mes
                                {mesesPagados > 1 ? "es" : ""}
                            </p>
                            <p className="text-xl font-800 text-orange-600 mt-0.5">
                                ${totalCalc.toLocaleString("es-MX")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-1 border-t border-black/05">
                    {isEdit && (
                        <button
                            type="button"
                            onClick={() => {
                                resetForm();
                                onCancelEdit();
                            }}
                            className="px-5 py-2.5 rounded-xl border border-stone-200 bg-white/60 text-stone-600 text-sm font-600 hover:bg-white transition"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 sm:flex-none sm:px-8 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-600 hover:bg-orange-600 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && (
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        )}
                        {loading
                            ? "Guardando..."
                            : isEdit
                              ? "Guardar cambios"
                              : "Registrar pago"}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── COMPONENTE PRINCIPAL ──
export default function Pagos() {
    const [pagos, setPagos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPago, setEditingPago] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const PER_PAGE = 20;

    // Filtros
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebounced] = useState("");
    const [filterFecha, setFilterFecha] = useState("");

    useEffect(() => {
        const t = setTimeout(() => {
            setDebounced(search);
            setCurrentPage(1);
        }, 200);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterFecha]);

    const fetchPagos = useCallback(
        async (page = 1) => {
            setLoading(true);
            try {
                const params = { page, per_page: PER_PAGE };
                if (debouncedSearch) params.search = debouncedSearch;
                if (filterFecha) params.fecha_cobro = filterFecha;
                const res = await api.get("/pagos", { params });
                const paginated = res.data;
                setPagos(paginated.data || []);
                setCurrentPage(paginated.current_page);
                setLastPage(paginated.last_page);
                setTotal(paginated.total);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        },
        [debouncedSearch, filterFecha],
    );

    useEffect(() => {
        fetchPagos(currentPage);
    }, [fetchPagos, currentPage]);

    const handleDelete = async (uuid) => {
        try {
            await api.delete(`/pagos/${uuid}`);
            setDeleteConfirm(null);
            fetchPagos(currentPage);
        } catch (err) {
            console.error(err);
        }
    };

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

    const formatMes = (mes) => {
        if (!mes) return "-";
        const [y, m] = mes.split("-");
        return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
            "es-MX",
            {
                month: "long",
                year: "numeric",
            },
        );
    };

    const formatDate = (d) => {
        if (!d) return "-";
        const [year, month, day] = d.slice(0, 10).split("-");
        return new Date(year, month - 1, day).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div>
                <h1 className="text-lg font-700 text-stone-800">
                    Gestión de Pagos
                </h1>
                <p className="text-xs text-stone-400 mt-0.5">
                    {total} pagos registrados
                </p>
            </div>

            {/* Formulario */}
            <FormularioPago
                onSaved={() => fetchPagos(currentPage)}
                editingPago={editingPago}
                onCancelEdit={() => setEditingPago(null)}
            />

            {/* Filtros tabla */}
            <div className="glass-card !p-3 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar vecino en pagos..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white/70 border border-black/08 text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 transition"
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
                <div className="flex items-center gap-2">
                    <label className="text-xs text-stone-500 whitespace-nowrap">
                        Fecha cobro:
                    </label>
                    <input
                        type="date"
                        value={filterFecha}
                        onChange={(e) => setFilterFecha(e.target.value)}
                        className="py-2.5 px-3 rounded-xl bg-white/70 border border-black/08 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400/40 transition"
                    />
                    {filterFecha && (
                        <button
                            onClick={() => setFilterFecha("")}
                            className="text-stone-400 hover:text-stone-600"
                        >
                            <XIcon />
                        </button>
                    )}
                </div>
            </div>

            {/* Tabla */}
            <div className="glass-card !p-0 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48 gap-3">
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-stone-400">
                            Cargando pagos...
                        </span>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-black/06 bg-white/40">
                                        <th className="w-8 px-3 py-3" />
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Vecino
                                        </th>
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Mes
                                        </th>
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Tipo
                                        </th>
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Cantidad
                                        </th>
                                        <th className="px-5 py-3 text-left text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Fecha cobro
                                        </th>
                                        <th className="px-5 py-3 text-center text-xs font-600 text-stone-500 uppercase tracking-wider">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagos.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="7"
                                                className="px-5 py-12 text-center text-stone-400 text-sm"
                                            >
                                                {debouncedSearch
                                                    ? `Sin resultados para "${debouncedSearch}"`
                                                    : "No hay pagos registrados."}
                                            </td>
                                        </tr>
                                    ) : (
                                        pagos.map((pago) => (
                                            <>
                                                <tr
                                                    key={pago.uuid}
                                                    className={`border-b border-black/04 hover:bg-white/40 transition-colors ${expandedId === pago.uuid ? "bg-white/30" : ""}`}
                                                >
                                                    {/* Expandir */}
                                                    <td className="px-3 py-3.5">
                                                        <button
                                                            onClick={() =>
                                                                setExpandedId(
                                                                    expandedId ===
                                                                        pago.uuid
                                                                        ? null
                                                                        : pago.uuid,
                                                                )
                                                            }
                                                            className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:bg-black/05 transition"
                                                        >
                                                            <ChevronIcon
                                                                open={
                                                                    expandedId ===
                                                                    pago.uuid
                                                                }
                                                            />
                                                        </button>
                                                    </td>
                                                    {/* Vecino */}
                                                    <td className="px-5 py-3.5">
                                                        <p className="text-sm font-600 text-stone-800">
                                                            {
                                                                pago.vecino
                                                                    ?.nombre
                                                            }
                                                        </p>
                                                        <p className="text-xs text-stone-400">
                                                            {pago.vecino?.calle}{" "}
                                                            #
                                                            {
                                                                pago.vecino
                                                                    ?.numero_casa
                                                            }
                                                        </p>
                                                    </td>
                                                    {/* Mes */}
                                                    <td className="px-5 py-3.5 text-sm text-stone-600 capitalize">
                                                        {formatMes(pago.mes)}
                                                    </td>
                                                    {/* Tipo */}
                                                    <td className="px-5 py-3.5">
                                                        <span
                                                            className={`px-2.5 py-0.5 rounded-full text-xs font-600 border
                                                        ${
                                                            pago.tipo ===
                                                            "extraordinario"
                                                                ? "bg-purple-100 text-purple-700 border-purple-200"
                                                                : "bg-blue-100 text-blue-700 border-blue-200"
                                                        }`}
                                                        >
                                                            {pago.tipo
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                                pago.tipo.slice(
                                                                    1,
                                                                )}
                                                        </span>
                                                    </td>
                                                    {/* Cantidad */}
                                                    <td className="px-5 py-3.5">
                                                        <span className="text-sm font-700 text-stone-800">
                                                            $
                                                            {parseFloat(
                                                                pago.cantidad,
                                                            ).toLocaleString(
                                                                "es-MX",
                                                            )}
                                                        </span>
                                                        {pago.meses_pagados >
                                                            1 && (
                                                            <span className="ml-1 text-xs text-stone-400">
                                                                (
                                                                {
                                                                    pago.meses_pagados
                                                                }{" "}
                                                                meses)
                                                            </span>
                                                        )}
                                                    </td>
                                                    {/* Fecha */}
                                                    <td className="px-5 py-3.5 text-sm text-stone-500">
                                                        {formatDate(
                                                            pago.fecha_de_cobro,
                                                        )}
                                                    </td>
                                                    {/* Acciones */}
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() =>
                                                                    setEditingPago(
                                                                        pago,
                                                                    )
                                                                }
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 transition"
                                                            >
                                                                <EditIcon />
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    setDeleteConfirm(
                                                                        pago,
                                                                    )
                                                                }
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition"
                                                            >
                                                                <TrashIcon />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Fila expandida */}
                                                {expandedId === pago.uuid && (
                                                    <tr
                                                        key={`exp-${pago.uuid}`}
                                                    >
                                                        <td
                                                            colSpan="7"
                                                            className="p-0"
                                                        >
                                                            <PagoExpandido
                                                                vecinoUuid={
                                                                    pago.vecino
                                                                        ?.uuid
                                                                }
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
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
                                    {total}
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
                                                className="w-5 text-center text-xs text-stone-400"
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
                                                    ${currentPage === p ? "bg-orange-500 text-white border border-orange-500" : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white"}`}
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

            {/* Confirm delete */}
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
                            ¿Eliminar pago?
                        </h3>
                        <p className="text-sm text-stone-500 mb-5">
                            Se eliminará el pago de{" "}
                            <strong>{deleteConfirm.vecino?.nombre}</strong> del
                            mes <strong>{formatMes(deleteConfirm.mes)}</strong>.
                            Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-white/60 text-stone-600 text-sm font-600 hover:bg-white transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm.uuid)}
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
